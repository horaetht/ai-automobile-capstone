"""Local read-only OBD-II HTTP bridge (Phase 5).

A tiny local-only HTTP service that lets the Online Garage web dashboard
trigger a real OBD-II read without the browser touching a serial port
directly, and without any terminal/email/password/vehicle-UUID input for
a normal sync. It has no Supabase credentials, no user password, and
never talks to Supabase itself -- it only ever returns one normalized,
read-only telemetry snapshot (reusing reader.py, the same module
obd_probe.py and obd_sync.py use). The authenticated browser session is
what actually calls the sync_vehicle_telemetry RPC.

Binds to 127.0.0.1 only (never 0.0.0.0): this process can open a serial
connection to a physical vehicle, so it must never be reachable from
outside this machine. CORS is restricted to an explicit origin allowlist
(no wildcard). The only accepted input is an optional serial port name --
no arbitrary ELM/AT commands, no file access, no shell execution.

Run once, then leave running while using the dashboard:
    python obd_reader/local_bridge.py
"""

import io
import os
import re
import sys
from contextlib import redirect_stderr
from typing import Optional

import obd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from reader import collect_telemetry, connect_vehicle, resolve_port

HOST = "127.0.0.1"
PORT = 8765

DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173"]
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("OBD_BRIDGE_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
] or DEFAULT_ALLOWED_ORIGINS

# The only port names this endpoint will hand to pyserial: plain Windows
# COM names and Unix tty device paths, matching the form users are already
# told to pass via --port elsewhere in obd_reader/. Anything else is
# rejected outright rather than passed through.
PORT_NAME_PATTERN = re.compile(r"^(COM\d{1,3}|/dev/[A-Za-z0-9_.\-]+)$")

app = FastAPI(title="Online Garage OBD Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ReadRequest(BaseModel):
    port: Optional[str] = None


def error_response(status_code, error, message):
    return JSONResponse(status_code=status_code, content={"error": error, "message": message})


def resolve_port_or_error(explicit_port):
    """Reuse reader.resolve_port() as-is; translate the stderr message it
    prints on ambiguity into a structured (code, message) pair, since an
    HTTP client can't see this process's stderr the way a terminal user can.
    """
    buffer = io.StringIO()
    with redirect_stderr(buffer):
        port = resolve_port(explicit_port)

    if port is not None:
        return port, None

    if "Multiple serial ports" in buffer.getvalue():
        return None, ("multiple_adapters_found", "Multiple serial ports were detected; specify one explicitly.")
    return None, ("no_adapter_found", "No OBD adapter was detected.")


@app.get("/health")
def health():
    return {"status": "ok", "service": "online-garage-obd-bridge"}


@app.post("/read")
def read(body: ReadRequest = ReadRequest()):
    if body.port and not PORT_NAME_PATTERN.match(body.port):
        return error_response(400, "invalid_port", "The supplied port name is not valid.")

    port, port_error = resolve_port_or_error(body.port)
    if port_error is not None:
        code, message = port_error
        return error_response(503, code, message)

    try:
        connection = connect_vehicle(port)
    except ConnectionError as exc:
        if getattr(exc, "obd_status", None) == obd.OBDStatus.NOT_CONNECTED:
            return error_response(503, "adapter_not_connected", "No OBD adapter was detected.")
        return error_response(
            503, "vehicle_not_responding", "OBD adapter detected, but the vehicle did not respond."
        )
    except Exception:
        print(f"Unexpected error connecting on {port}", file=sys.stderr)
        return error_response(500, "connection_failed", "Unable to connect to the vehicle through the OBD adapter.")

    try:
        telemetry = collect_telemetry(connection)
        protocol = connection.protocol_name()
    except Exception:
        print(f"Unexpected error reading telemetry on {port}", file=sys.stderr)
        return error_response(500, "read_failed", "Unable to read telemetry from the vehicle.")
    finally:
        # protocol_name() is captured above, before close() -- once closed,
        # the OBD object always reports an empty protocol name.
        connection.close()

    return {"port": port, "protocol": protocol, **telemetry}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
