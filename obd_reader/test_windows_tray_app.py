"""Focused tests for windows_tray_app.py's single-instance detection and
server start/shutdown lifecycle -- the parts of the tray packaging that
have no UI and can be exercised headlessly.

Does not test pystray's tray icon/menu loop itself (that needs a real
Windows desktop session and manual clicking -- see the Day 12 manual
validation steps) or the OBD /read endpoint (unchanged, already covered by
local_bridge.py's own responsibility, reader.py, obd_probe.py).

Every test uses an ephemeral, OS-assigned port rather than the real
HOST/PORT (127.0.0.1:8765), so this suite is isolated from -- and safe to
run alongside -- an actual Online Garage OBD Bridge instance on this
machine.
"""

import json
import socket
import time
from urllib.request import urlopen

import pytest

from windows_tray_app import (
    check_existing_bridge,
    generate_tray_icon_image,
    start_bridge_server,
)

HOST = "127.0.0.1"
STARTUP_TIMEOUT_SECONDS = 5.0
SHUTDOWN_TIMEOUT_SECONDS = 5.0


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((HOST, 0))
        return sock.getsockname()[1]


def _wait_until(predicate, timeout=STARTUP_TIMEOUT_SECONDS, interval=0.05):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return predicate()


@pytest.fixture
def running_bridge():
    """Starts the real bridge (the actual FastAPI app, unmodified) on a
    fresh ephemeral port and guarantees a clean shutdown even if the test
    fails partway through.
    """
    port = _free_port()
    server, thread = start_bridge_server(host=HOST, port=port)
    assert server.started, f"bridge server failed to start: {thread.error}"
    try:
        yield HOST, port, server, thread
    finally:
        server.should_exit = True
        thread.join(timeout=SHUTDOWN_TIMEOUT_SECONDS)


def test_check_existing_bridge_returns_none_when_port_is_free():
    assert check_existing_bridge(host=HOST, port=_free_port()) is None


def test_check_existing_bridge_detects_our_bridge(running_bridge):
    host, port, _server, _thread = running_bridge
    assert check_existing_bridge(host=host, port=port) == "ours"


def test_check_existing_bridge_detects_unrelated_service():
    # Bind straight to an OS-assigned ephemeral port and keep this exact
    # socket alive for the whole test, rather than freeing a port via
    # _free_port() and re-binding it a moment later -- Windows doesn't
    # always recycle a just-closed port fast enough for that immediate
    # rebind to be reliable.
    foreign = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    foreign.bind((HOST, 0))
    foreign.listen(1)
    port = foreign.getsockname()[1]
    try:
        assert check_existing_bridge(host=HOST, port=port) == "other"
    finally:
        foreign.close()


def test_bridge_health_endpoint_matches_frontend_expectations(running_bridge):
    host, port, _server, _thread = running_bridge
    with urlopen(f"http://{host}:{port}/health", timeout=2) as response:
        payload = json.loads(response.read().decode("utf-8"))
    # Exactly what frontend/src/services/obdBridgeService.js's
    # checkObdBridge() checks for.
    assert payload["status"] == "ok"
    assert payload["service"] == "online-garage-obd-bridge"


def test_clean_shutdown_releases_the_port(running_bridge):
    host, port, server, thread = running_bridge

    server.should_exit = True
    thread.join(timeout=SHUTDOWN_TIMEOUT_SECONDS)
    assert not thread.is_alive(), "server thread did not stop within the timeout"

    # If the port were still held, this bind would raise OSError
    # (WinError 10048 / "address already in use").
    released = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        released.bind((host, port))
    finally:
        released.close()


def test_generate_tray_icon_image_is_a_valid_square_image():
    image = generate_tray_icon_image(size=64)
    assert image.size == (64, 64)
    assert image.mode == "RGBA"
