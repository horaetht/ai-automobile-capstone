"""Local OBD-II telemetry probe (Phase 2 proof of concept).

Connects to a real vehicle over an ELM327-compatible adapter using
python-OBD, reads a handful of standard/generic PIDs, and prints one
normalized JSON telemetry snapshot to stdout. Read-only: never clears
DTCs, never writes to the vehicle, never syncs to Supabase.

Usage:
    python obd_reader/obd_probe.py --port COM3
    python obd_reader/obd_probe.py
"""

import argparse
import json
import sys

from reader import collect_telemetry, connect_vehicle, resolve_port


def main():
    parser = argparse.ArgumentParser(description="Read a live OBD-II telemetry snapshot.")
    parser.add_argument("--port", help="Serial port to connect on (e.g. COM3)")
    args = parser.parse_args()

    port = resolve_port(args.port)
    if port is None:
        sys.exit(1)

    try:
        connection = connect_vehicle(port)
    except ConnectionError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        telemetry = {
            "connection": "connected",
            "port": port,
            "protocol": connection.protocol_name(),
            **collect_telemetry(connection),
        }
        print(json.dumps(telemetry, indent=2))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
