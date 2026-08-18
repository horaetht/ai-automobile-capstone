"""Windows tray application for the Online Garage OBD bridge (Phase 6).

Runs the exact same FastAPI app defined in local_bridge.py, in-process,
inside a background thread, behind a system tray icon -- so a user can
start the bridge by double-clicking an executable instead of running

    python obd_reader/local_bridge.py

from a terminal that has to stay open. This file owns only tray/process
lifecycle (single-instance check, thread management, logging, shutdown);
it does not redefine or duplicate the /health or /read endpoints, or any
OBD read logic -- those all still live in local_bridge.py and reader.py,
imported here as-is. local_bridge.py's own `python local_bridge.py` entry
point is untouched and keeps working exactly as before.

Windows-only: uses ctypes.windll for startup message boxes. Not intended to
run on macOS/Linux.

Development (with a terminal, for iterating on this file):
    python obd_reader/windows_tray_app.py

Packaged (no terminal) -- see OnlineGarageOBDBridge.spec and
scripts/build_obd_bridge.ps1.
"""

import ctypes
import json
import logging
import os
import socket
import sys
import threading
import time
import webbrowser
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional
from urllib.error import URLError
from urllib.request import urlopen

# PyInstaller's windowed (console=False) build gives this process no usable
# stdout/stderr. local_bridge.py and reader.py both have a handful of
# print(..., file=sys.stderr) diagnostic calls on error paths; without this
# guard, hitting one of those in the packaged app would raise
# AttributeError instead of just losing a diagnostic line. This must run
# before importing anything that might print during import, and before
# uvicorn is configured below. The rotating file handler set up in
# configure_logging() is the real diagnostic channel for the packaged app.
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

import pystray  # noqa: E402
import uvicorn  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

# obd_reader/ uses flat, package-less imports (local_bridge.py itself does
# `from reader import ...`), so this directory must be importable as a
# top-level module path. Running `python windows_tray_app.py` already gets
# this for free (Python prepends the script's own directory to sys.path),
# but the explicit insert keeps this correct under PyInstaller too.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from local_bridge import HOST, PORT, app  # noqa: E402

APP_NAME = "OnlineGarageOBDBridge"
HEALTH_SERVICE_NAME = "online-garage-obd-bridge"
STARTUP_TIMEOUT_SECONDS = 5.0
SHUTDOWN_JOIN_TIMEOUT_SECONDS = 5.0

MB_ICONINFORMATION = 0x40
MB_ICONERROR = 0x10


def _log_directory() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(Path.home())
    return Path(base) / APP_NAME


def configure_logging() -> Path:
    """Bounded rotating log file -- never stdout/stderr, since the packaged
    app has no console for anyone to see them on. Intentionally logs only
    lifecycle events and errors (startup, shutdown, port conflicts,
    unexpected exceptions): never full telemetry snapshots, and nothing
    from Supabase (this bridge holds no Supabase credentials at all).
    """
    log_dir = _log_directory()
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "bridge.log"

    handler = RotatingFileHandler(log_path, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(handler)

    return log_path


def show_message_box(title: str, message: str, icon_flag: int = MB_ICONINFORMATION) -> None:
    """A plain Win32 MessageBox -- no extra dependency, works with no
    console, and is legible even before/without the tray icon existing.
    """
    ctypes.windll.user32.MessageBoxW(None, message, title, icon_flag)


def check_existing_bridge(host: str = HOST, port: int = PORT) -> Optional[str]:
    """Return "ours" if an Online Garage bridge already answers /health on
    host:port, "other" if something else holds the port, or None if the
    port looks free.

    A plain TCP probe first avoids waiting out a full HTTP timeout against
    something that isn't listening at all, which is the common case.
    host/port are parameterized (defaulting to the real HOST/PORT) purely so
    this can be exercised against an ephemeral port in tests, isolated from
    any bridge that may really be running on 127.0.0.1:8765.
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    probe.settimeout(0.5)
    try:
        occupied = probe.connect_ex((host, port)) == 0
    finally:
        probe.close()

    if not occupied:
        return None

    try:
        with urlopen(f"http://{host}:{port}/health", timeout=1.5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (URLError, TimeoutError, ValueError, OSError):
        return "other"

    if payload.get("status") == "ok" and payload.get("service") == HEALTH_SERVICE_NAME:
        return "ours"
    return "other"


def generate_tray_icon_image(size: int = 64) -> Image.Image:
    """Small programmatically-drawn placeholder icon: a blue rounded square
    with a white "OG" mark. No external asset or font file is committed --
    text is drawn with Pillow's built-in bitmap default font. Intended to
    be replaced with a professional .ico asset later.
    """
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    margin = size // 8
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 6,
        fill=(26, 115, 232, 255),
    )

    text = "OG"
    try:
        left, top, right, bottom = draw.textbbox((0, 0), text)
        text_w, text_h = right - left, bottom - top
        position = ((size - text_w) / 2 - left, (size - text_h) / 2 - top)
    except AttributeError:  # pragma: no cover - very old Pillow fallback
        text_w, text_h = draw.textsize(text)
        position = ((size - text_w) / 2, (size - text_h) / 2)

    draw.text(position, text, fill=(255, 255, 255, 255))
    return image


class BridgeServerThread(threading.Thread):
    """Runs uvicorn.Server.run() -- which owns its own asyncio event loop --
    off the main thread, so pystray can own the main thread for its Windows
    message loop. Captures any startup/runtime failure, including the
    SystemExit uvicorn raises internally on a bind failure, so the caller
    can detect and report it instead of the thread dying silently.
    """

    def __init__(self, server: uvicorn.Server):
        super().__init__(name="uvicorn-server", daemon=True)
        self.server = server
        self.error: Optional[BaseException] = None

    def run(self) -> None:
        try:
            self.server.run()
        except SystemExit as exc:
            self.error = RuntimeError(f"Uvicorn exited during startup (code {exc.code!r}).")
        except BaseException as exc:  # noqa: BLE001 - top-level thread boundary
            self.error = exc
            logging.exception("Bridge server thread crashed.")


def start_bridge_server(host: str = HOST, port: int = PORT) -> tuple[uvicorn.Server, BridgeServerThread]:
    # log_config=None stops uvicorn from installing its own stdout-pointed
    # logging handlers (irrelevant/unsafe with no real console); its log
    # records still propagate to the root logger, which configure_logging()
    # has already pointed at the rotating file handler above.
    config = uvicorn.Config(app, host=host, port=port, log_level="warning", log_config=None)
    server = uvicorn.Server(config)
    thread = BridgeServerThread(server)
    thread.start()

    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if server.started or thread.error is not None or not thread.is_alive():
            break
        time.sleep(0.05)

    return server, thread


def open_health_check(icon=None, item=None) -> None:
    webbrowser.open(f"http://{HOST}:{PORT}/health")


def main() -> int:
    log_path = configure_logging()
    logging.info("Online Garage OBD Bridge tray app starting (pid=%d).", os.getpid())

    existing = check_existing_bridge()
    if existing == "ours":
        logging.info("An Online Garage OBD Bridge is already running on %s:%d; exiting.", HOST, PORT)
        show_message_box(
            "Online Garage OBD Bridge",
            "Online Garage OBD Bridge is already running.\n\nLook for its icon in the system tray.",
            MB_ICONINFORMATION,
        )
        return 0
    if existing == "other":
        logging.error("Port %d is already in use by another application.", PORT)
        show_message_box(
            "Online Garage OBD Bridge",
            f"Port {PORT} is already in use by another application.\n\n"
            "Online Garage OBD Bridge cannot start until that port is free. "
            "Close the other application and try again.",
            MB_ICONERROR,
        )
        return 1

    server, server_thread = start_bridge_server()
    if not server.started:
        message = str(server_thread.error) if server_thread.error else "The bridge server failed to start."
        logging.error("Bridge failed to start: %s", message)
        show_message_box("Online Garage OBD Bridge", f"The OBD bridge could not start:\n\n{message}", MB_ICONERROR)
        return 1

    logging.info("Bridge server listening on http://%s:%d (log file: %s)", HOST, PORT, log_path)

    def on_exit(icon, item):
        logging.info("Exit requested from tray menu.")
        server.should_exit = True
        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem("Online Garage OBD Bridge", None, enabled=False),
        pystray.MenuItem("Status: Running", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Open Health Check", open_health_check),
        pystray.MenuItem("Exit", on_exit),
    )

    icon = pystray.Icon(
        "online_garage_obd_bridge",
        icon=generate_tray_icon_image(),
        title="Online Garage OBD Bridge",
        menu=menu,
    )

    try:
        icon.run()
    except Exception:
        logging.exception("Tray icon loop crashed.")
    finally:
        # Ask uvicorn to stop accepting/serving, then give the server
        # thread a bounded window to actually finish -- this is what
        # releases port 8765 and any COM port a request happened to be
        # mid-read on. daemon=True on the thread is only a last-resort
        # safety net if this join times out; the graceful path is always
        # attempted first.
        server.should_exit = True
        server_thread.join(timeout=SHUTDOWN_JOIN_TIMEOUT_SECONDS)
        if server_thread.is_alive():
            logging.warning("Bridge server thread did not stop within %.1fs.", SHUTDOWN_JOIN_TIMEOUT_SECONDS)
        logging.info("Online Garage OBD Bridge exited.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
