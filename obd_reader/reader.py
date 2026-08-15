"""Shared read-only OBD-II telemetry collection.

Used by both obd_probe.py (local diagnostic printout) and obd_sync.py
(Supabase telemetry sync), so the two never drift into duplicated query
logic. Contains no CLI, JSON-printing, or Supabase logic -- callers own
presentation and transport.
"""

import sys

import obd


def resolve_port(explicit_port):
    """Return the serial port to connect on, or None if it can't be decided."""
    if explicit_port:
        return explicit_port

    candidates = obd.scan_serial()

    if len(candidates) == 1:
        return candidates[0]

    if not candidates:
        print(
            "No serial ports detected. Connect the OBD-II adapter and "
            "retry, or pass --port explicitly (e.g. --port COM3).",
            file=sys.stderr,
        )
    else:
        print(
            "Multiple serial ports detected: "
            + ", ".join(candidates)
            + ". Re-run with --port to select one explicitly.",
            file=sys.stderr,
        )

    return None


def connect_vehicle(port):
    """Open an OBD connection on `port` and verify a car connection.

    Returns the connected `obd.OBD` instance; the caller is responsible for
    calling `.close()` on it (ideally in a `finally` block) once done. Raises
    `ConnectionError` -- releasing the port first -- if a full car connection
    (not just an ELM/adapter connection) can't be established. The raised
    error's `.obd_status` attribute carries the raw `obd.OBDStatus` value, so
    callers that want to distinguish "no adapter at all" from "adapter found
    but the vehicle didn't respond" (e.g. local_bridge.py's HTTP error
    responses) don't have to re-derive it themselves.
    """
    connection = obd.OBD(portstr=port)

    if connection.status() != obd.OBDStatus.CAR_CONNECTED:
        status = connection.status()
        connection.close()
        error = ConnectionError(
            f"Could not establish a car connection on {port} (status: {status})."
        )
        error.obd_status = status
        raise error

    return connection


def read_command(connection, command, normalize=None):
    """Query a single OBD command, returning a normalized value or None.

    Never raises: unsupported commands, null responses, and query
    failures are all reported as None so one bad PID can't take down
    the rest of the telemetry snapshot.
    """
    try:
        if not connection.supports(command):
            return None

        response = connection.query(command)

        if response.is_null():
            return None

        return normalize(response.value) if normalize else response.value
    except Exception as exc:
        print(f"Warning: failed to read {command.name}: {exc}", file=sys.stderr)
        return None


def read_dtc_codes(connection):
    """Read diagnostic trouble codes as a list of {code, description} dicts."""
    codes = read_command(connection, obd.commands.GET_DTC)
    if not codes:
        return []
    return [{"code": code, "description": description} for code, description in codes]


def collect_telemetry(connection):
    """Query all supported sensor telemetry and return one normalized dict.

    Intentionally excludes connection metadata (port/protocol) -- probe and
    sync each present that differently, so callers attach it themselves.
    """
    return {
        "rpm": read_command(
            connection, obd.commands.RPM, lambda v: round(v.magnitude)
        ),
        "speed_mph": read_command(
            connection, obd.commands.SPEED, lambda v: round(v.to("mph").magnitude, 1)
        ),
        "coolant_temp_c": read_command(
            connection, obd.commands.COOLANT_TEMP, lambda v: round(v.magnitude, 1)
        ),
        "fuel_level_percent": read_command(
            connection, obd.commands.FUEL_LEVEL, lambda v: round(v.magnitude, 1)
        ),
        # NOTE: ELM_VOLTAGE is the adapter's reading of vehicle
        # electrical-system voltage at this moment (engine running or not,
        # alternator charging or not, etc.) -- a single sample, not a
        # definitive battery-health measurement on its own.
        "adapter_voltage": read_command(
            connection, obd.commands.ELM_VOLTAGE, lambda v: round(v.magnitude, 2)
        ),
        # NOTE: these two PIDs are MIL/DTC-event trip counters, NOT the vehicle
        # odometer. They reset when a MIL event ends or DTCs are cleared, and
        # must never be used as or substituted for total vehicle mileage.
        "distance_with_mil_km": read_command(
            connection, obd.commands.DISTANCE_W_MIL, lambda v: round(v.magnitude)
        ),
        "distance_since_dtc_clear_km": read_command(
            connection,
            obd.commands.DISTANCE_SINCE_DTC_CLEAR,
            lambda v: round(v.magnitude),
        ),
        "dtc_codes": read_dtc_codes(connection),
    }
