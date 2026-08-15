"""Real OBD-II telemetry -> authenticated Supabase sync (Phase 3).

One invocation = one telemetry snapshot, synced to the caller's own
vehicle row via the sync_vehicle_telemetry RPC (see the
20260814120000_add_obd_telemetry_sync.sql migration). Read-only towards
the vehicle: never clears DTCs, never writes to the ECU. Authenticates as
a normal Online Garage user (publishable/anon key + password sign-in) --
never a service-role key -- so every write still goes through Supabase RLS.

Usage:
    python obd_reader/obd_sync.py --port COM3 --vehicle-id <uuid>
    python obd_reader/obd_sync.py --vehicle-id <uuid>

Environment variables (e.g. via a local, gitignored .env file):
    SUPABASE_URL
    SUPABASE_PUBLISHABLE_KEY   (preferred; falls back to SUPABASE_ANON_KEY)

Never a service-role key -- only the publishable/anon key, the same class
of key the frontend uses (VITE_SUPABASE_PUBLISHABLE_KEY).
"""

import argparse
import getpass
import json
import os
import sys
import uuid

from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client
from supabase_auth.errors import AuthError

from reader import collect_telemetry, connect_vehicle, resolve_port

VEHICLE_ACCESS_ERROR = "Vehicle was not found or you do not have permission to access it."


def celsius_to_fahrenheit(celsius):
    """Convert to the Fahrenheit convention vehicles/vehicle_data_logs.engine_temperature
    already uses (see app/services/vehicle_sync.py and TelemetryCard.jsx)."""
    if celsius is None:
        return None
    return round(celsius * 9 / 5 + 32, 1)


def build_supabase_client():
    """Build a Supabase client using the publishable/anon key only.

    Never accepts a service-role key -- SUPABASE_PUBLISHABLE_KEY (preferred)
    or SUPABASE_ANON_KEY (legacy fallback) is the same class of key the
    frontend uses, so this client is just as RLS-constrained as the browser.
    """
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in the "
            "environment (e.g. in a local, gitignored .env file). "
            "SUPABASE_ANON_KEY is accepted as a legacy fallback for the key."
        )

    return create_client(url, key)


def authenticate(client):
    """Sign in as a normal Online Garage user. Never uses a service-role key,
    so all subsequent requests on `client` remain subject to RLS."""
    email = input("Supabase email: ")
    password = getpass.getpass("Supabase password: ")

    client.auth.sign_in_with_password({"email": email, "password": password})


def verify_vehicle_access(client, vehicle_id):
    """Fail fast, before touching the vehicle, if this user can't read the
    vehicle row. RLS makes "doesn't exist" and "exists but isn't yours"
    indistinguishable here, so this never leaks other users' vehicle ids."""
    result = client.table("vehicles").select("id").eq("id", vehicle_id).maybe_single().execute()

    if result is None or result.data is None:
        raise PermissionError(VEHICLE_ACCESS_ERROR)


def sync_telemetry(client, vehicle_id, telemetry):
    response = client.rpc(
        "sync_vehicle_telemetry",
        {
            "p_vehicle_id": vehicle_id,
            "p_rpm": telemetry["rpm"],
            "p_speed_mph": telemetry["speed_mph"],
            "p_engine_temperature": celsius_to_fahrenheit(telemetry["coolant_temp_c"]),
            "p_fuel_level": telemetry["fuel_level_percent"],
            # adapter_voltage (ELM_VOLTAGE) is adapter/vehicle
            # electrical-system voltage, not a definitive battery-health
            # reading -- see the caveat in reader.py. Mapped to
            # battery_voltage for MVP compatibility with the existing
            # dashboard tile only.
            "p_battery_voltage": telemetry["adapter_voltage"],
            "p_dtc_codes": telemetry["dtc_codes"],
            "p_distance_with_mil_km": telemetry["distance_with_mil_km"],
            "p_distance_since_dtc_clear_km": telemetry["distance_since_dtc_clear_km"],
        },
    ).execute()

    return response.data


def main():
    parser = argparse.ArgumentParser(description="Sync one real OBD-II telemetry snapshot to Supabase.")
    parser.add_argument("--port", help="Serial port to connect on (e.g. COM3)")
    parser.add_argument("--vehicle-id", required=True, type=uuid.UUID, help="Target vehicle UUID")
    args = parser.parse_args()
    vehicle_id = str(args.vehicle_id)

    port = resolve_port(args.port)
    if port is None:
        sys.exit(1)

    try:
        connection = connect_vehicle(port)
    except ConnectionError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        telemetry = collect_telemetry(connection)
    finally:
        # Released as soon as the vehicle read is done -- nothing after this
        # point touches the serial port, so there's no reason to keep COM3
        # held open across the Supabase network round-trip.
        connection.close()

    try:
        client = build_supabase_client()
    except EnvironmentError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        authenticate(client)
    except AuthError as exc:
        print(f"Error: Supabase authentication failed: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        verify_vehicle_access(client, vehicle_id)
    except PermissionError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    except APIError as exc:
        print(f"Error: could not verify vehicle access: {exc.message}", file=sys.stderr)
        sys.exit(1)

    try:
        sync_result = sync_telemetry(client, vehicle_id, telemetry)
    except APIError as exc:
        print(f"Error: telemetry sync failed: {exc.message}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps({
        "sync": "success",
        "vehicle_id": vehicle_id,
        "log_id": sync_result["log_id"],
        "synced_at": sync_result["synced_at"],
        "telemetry": telemetry,
    }, indent=2))


if __name__ == "__main__":
    main()
