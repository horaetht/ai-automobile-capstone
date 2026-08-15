-- 003_add_obd_telemetry_sync.sql
-- Online Garage: real OBD-II telemetry sync support (Phase 3).
-- Adds verified-telemetry columns to vehicles/vehicle_data_logs, makes
-- vehicle_data_logs.mileage nullable (generic OBD-II has not provided a
-- verified odometer reading), and adds an authenticated RPC that syncs one
-- telemetry snapshot atomically. This migration is not executed
-- automatically; review before running.

-- ============================================================================
-- 1. vehicle_data_logs.mileage becomes nullable
-- Generic OBD-II PIDs do not expose a verified vehicle odometer reading
-- (only diagnostic distance counters -- see distance_with_mil_km and
-- distance_since_dtc_clear_km below, which are NOT mileage). Existing rows
-- and their mileage values are untouched by this ALTER; only future
-- OBD-sourced log rows are expected to omit it.
-- ============================================================================
alter table public.vehicle_data_logs
    alter column mileage drop not null;

-- ============================================================================
-- 2. Verified real-time telemetry columns
-- rpm / vehicle_speed_mph: added to both vehicle_data_logs (history) and
-- vehicles (latest snapshot), matching the existing pattern used for
-- battery_voltage/fuel_level/engine_temperature, so the dashboard can show
-- the latest real reading without querying the history table.
--
-- distance_with_mil_km / distance_since_dtc_clear_km: MIL/DTC-clear trip
-- distance counters, NOT the vehicle odometer -- see obd_reader/reader.py
-- for the same warning at the point they are read. They are historical
-- diagnostic telemetry, so they are only added to vehicle_data_logs, not to
-- the vehicles latest-snapshot row: unlike rpm/speed/voltage/etc., there is
-- no "current" reading a dashboard needs at a glance, and keeping them out
-- of vehicles keeps that table's columns limited to values a live dashboard
-- tile actually displays.
--
-- dtc_codes (jsonb): the full list of {code, description} trouble codes
-- from a sync, on both tables. dtc_code (text) is kept on both tables for
-- backward compatibility with the pre-OBD demo/simulated-sync code path
-- (app/services/vehicle_sync.py) and the current single-code frontend
-- rendering; it is populated as the first code in dtc_codes (or null when
-- clear) -- see sync_vehicle_telemetry() below.
-- ============================================================================
alter table public.vehicle_data_logs
    add column rpm integer,
    add column vehicle_speed_mph numeric,
    add column dtc_codes jsonb not null default '[]'::jsonb,
    add column distance_with_mil_km integer,
    add column distance_since_dtc_clear_km integer;

alter table public.vehicle_data_logs
    add constraint vehicle_data_logs_rpm_non_negative check (rpm is null or rpm >= 0),
    add constraint vehicle_data_logs_speed_non_negative check (vehicle_speed_mph is null or vehicle_speed_mph >= 0),
    add constraint vehicle_data_logs_distance_with_mil_non_negative check (distance_with_mil_km is null or distance_with_mil_km >= 0),
    add constraint vehicle_data_logs_distance_since_clear_non_negative check (distance_since_dtc_clear_km is null or distance_since_dtc_clear_km >= 0);

alter table public.vehicles
    add column rpm integer,
    add column vehicle_speed_mph numeric,
    add column dtc_codes jsonb not null default '[]'::jsonb;

alter table public.vehicles
    add constraint vehicles_rpm_non_negative check (rpm is null or rpm >= 0),
    add constraint vehicles_speed_non_negative check (vehicle_speed_mph is null or vehicle_speed_mph >= 0);

-- dtc_codes is meant to always hold a JSON array (possibly empty), never a
-- bare object or scalar -- both the frontend (`vehicle.dtc_codes.map(...)`)
-- and sync_vehicle_telemetry()'s `v_dtc_codes -> 0 ->> 'code'` below assume
-- array shape. The "is null or" branch is unreachable today since both
-- columns are also NOT NULL with an array default, but it keeps the
-- constraint correct on its own terms if that ever changes.
alter table public.vehicle_data_logs
    add constraint vehicle_data_logs_dtc_codes_is_array check (dtc_codes is null or jsonb_typeof(dtc_codes) = 'array');

alter table public.vehicles
    add constraint vehicles_dtc_codes_is_array check (dtc_codes is null or jsonb_typeof(dtc_codes) = 'array');

comment on column public.vehicle_data_logs.distance_with_mil_km is 'Distance traveled with the MIL (check engine light) on, from OBD PID 0121. Diagnostic trip counter, NOT odometer mileage.';
comment on column public.vehicle_data_logs.distance_since_dtc_clear_km is 'Distance traveled since diagnostic trouble codes were last cleared, from OBD PID 0131. Diagnostic trip counter, NOT odometer mileage.';

-- engine_temperature predates this migration and has always been Fahrenheit
-- in practice (see app/services/vehicle_sync.py's "Engine temperature (F)"
-- and TelemetryCard.jsx's `°F` rendering) even though nothing documented
-- that convention in the schema. obd_reader/obd_sync.py converts the OBD
-- reader's Celsius reading to Fahrenheit before calling this RPC, to match.
comment on column public.vehicles.engine_temperature is 'Engine coolant temperature in Fahrenheit (existing app convention). Real OBD syncs convert from Celsius before writing here -- see obd_reader/obd_sync.py:celsius_to_fahrenheit.';
comment on column public.vehicle_data_logs.engine_temperature is 'Engine coolant temperature in Fahrenheit; see public.vehicles.engine_temperature.';

-- battery_voltage is populated from the OBD adapter's ELM_VOLTAGE reading,
-- which reflects adapter/vehicle electrical-system voltage at the moment of
-- the read (engine running or not, alternator charging or not, etc.). It is
-- kept mapped to this field for MVP compatibility with the existing
-- dashboard tile, but it is a single voltage sample, not a definitive
-- battery-health measurement on its own.
comment on column public.vehicles.battery_voltage is 'Voltage from the OBD adapter''s ELM_VOLTAGE reading (adapter/vehicle electrical-system voltage). A single sample, not a definitive battery-health measurement on its own.';
comment on column public.vehicle_data_logs.battery_voltage is 'Voltage from the OBD adapter''s ELM_VOLTAGE reading (adapter/vehicle electrical-system voltage). A single sample, not a definitive battery-health measurement on its own.';

-- ============================================================================
-- 3. sync_vehicle_telemetry RPC
-- Writes one telemetry snapshot atomically: inserts a vehicle_data_logs
-- row and updates the owning vehicles row's latest-snapshot columns plus
-- last_synced_at, in a single function call (and therefore a single
-- transaction -- if anything below raises, everything in this call rolls
-- back, so a partially-applied sync is not possible).
--
-- SECURITY INVOKER (the default, stated explicitly here): this function
-- runs as the calling authenticated user, so every read/write it performs
-- is still filtered by the existing RLS policies on vehicles and
-- vehicle_data_logs -- it does not bypass or weaken RLS in any way. No
-- SECURITY DEFINER is needed because the authenticated role already has
-- the insert/update grants those policies require (see the base schema).
--
-- The explicit auth.uid()/ownership checks below are defense in depth on
-- top of RLS, not a replacement for it: they turn "RLS silently filtered
-- this to zero affected rows" into one clear, uniform error message,
-- instead of the function succeeding having quietly done nothing. Because
-- the ownership check is itself just a SELECT under the same "select own
-- vehicles" RLS policy, a vehicle_id that does not exist and a vehicle_id
-- owned by someone else are indistinguishable here -- so this never reveals
-- whether another user's vehicle exists.
--
-- search_path hardening: `set search_path = ''` plus fully schema-qualified
-- references (public.vehicles, public.vehicle_data_logs) avoids the
-- SECURITY DEFINER search_path hijack class of bug on principle, even
-- though it is strictly only required for SECURITY DEFINER functions.
-- Unqualified names left in the body (uuid/integer/numeric/jsonb/text
-- types, auth.uid(), coalesce, jsonb_build_object) are either already
-- schema-qualified or pg_catalog/SQL-language built-ins, which resolve
-- regardless of search_path.
-- ============================================================================
create or replace function public.sync_vehicle_telemetry(
    p_vehicle_id uuid,
    p_rpm integer,
    p_speed_mph numeric,
    p_engine_temperature numeric,
    p_fuel_level numeric,
    p_battery_voltage numeric,
    p_dtc_codes jsonb,
    p_distance_with_mil_km integer,
    p_distance_since_dtc_clear_km integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_caller uuid := auth.uid();
    v_owned_vehicle_id uuid;
    v_dtc_code text;
    v_dtc_codes jsonb := coalesce(p_dtc_codes, '[]'::jsonb);
    v_log_id uuid;
    v_synced_at timestamptz;
begin
    if v_caller is null then
        raise exception 'Vehicle was not found or you do not have permission to access it.';
    end if;

    select id into v_owned_vehicle_id
    from public.vehicles
    where id = p_vehicle_id;

    if v_owned_vehicle_id is null then
        raise exception 'Vehicle was not found or you do not have permission to access it.';
    end if;

    -- First code in the array becomes the legacy single-code column, or
    -- null when there are no active codes; the full list always lives in
    -- dtc_codes.
    v_dtc_code := v_dtc_codes -> 0 ->> 'code';

    insert into public.vehicle_data_logs (
        user_id, vehicle_id, mileage, battery_voltage, fuel_level,
        engine_temperature, dtc_code, dtc_codes, rpm, vehicle_speed_mph,
        distance_with_mil_km, distance_since_dtc_clear_km
    ) values (
        v_caller, p_vehicle_id, null, p_battery_voltage, p_fuel_level,
        p_engine_temperature, v_dtc_code, v_dtc_codes, p_rpm, p_speed_mph,
        p_distance_with_mil_km, p_distance_since_dtc_clear_km
    )
    returning id, created_at into v_log_id, v_synced_at;

    update public.vehicles
    set battery_voltage = p_battery_voltage,
        fuel_level = p_fuel_level,
        engine_temperature = p_engine_temperature,
        dtc_code = v_dtc_code,
        dtc_codes = v_dtc_codes,
        rpm = p_rpm,
        vehicle_speed_mph = p_speed_mph,
        last_synced_at = v_synced_at
    where id = p_vehicle_id;

    if not found then
        raise exception 'Vehicle was not found or you do not have permission to access it.';
    end if;

    return jsonb_build_object(
        'log_id', v_log_id,
        'vehicle_id', p_vehicle_id,
        'synced_at', v_synced_at
    );
end;
$$;

comment on function public.sync_vehicle_telemetry is 'Atomically writes one OBD-II telemetry snapshot: inserts a vehicle_data_logs row and updates the owning vehicles row''s latest-snapshot columns + last_synced_at. Never touches vehicles.mileage.';

-- Postgres grants EXECUTE on new functions to PUBLIC by default, which
-- would otherwise let signed-out (anon) callers invoke this RPC -- the
-- v_caller/ownership checks inside would still reject them (auth.uid() is
-- null for anon), but the intent is that only authenticated users can call
-- it at all. Revoke the implicit PUBLIC grant explicitly, revoke from anon
-- as its own explicit statement (defense in depth, since anon otherwise
-- only ever gets access via PUBLIC), and grant to authenticated only.
revoke execute on function public.sync_vehicle_telemetry(
    uuid, integer, numeric, numeric, numeric, numeric, jsonb, integer, integer
) from public;

revoke execute on function public.sync_vehicle_telemetry(
    uuid, integer, numeric, numeric, numeric, numeric, jsonb, integer, integer
) from anon;

grant execute on function public.sync_vehicle_telemetry(
    uuid, integer, numeric, numeric, numeric, numeric, jsonb, integer, integer
) to authenticated;
