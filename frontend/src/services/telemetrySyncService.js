import { supabase } from '../lib/supabaseClient'

// engine_temperature has always been Fahrenheit in this app (see
// TelemetryCard.jsx and app/services/vehicle_sync.py); the OBD reader
// reports Celsius, so convert here -- same conversion obd_reader/obd_sync.py
// applies before its own RPC call.
function celsiusToFahrenheit(celsius) {
  if (celsius == null) return null
  return Math.round((celsius * 9 / 5 + 32) * 10) / 10
}

// Uses the browser's own authenticated Supabase session (no separate
// sign-in, no service-role key) to call the same sync_vehicle_telemetry RPC
// obd_reader/obd_sync.py uses. RLS still enforces that vehicleId must
// belong to the signed-in user.
export async function syncVehicleTelemetry(vehicleId, telemetry) {
  const { data, error } = await supabase.rpc('sync_vehicle_telemetry', {
    p_vehicle_id: vehicleId,
    p_rpm: telemetry.rpm,
    p_speed_mph: telemetry.speed_mph,
    p_engine_temperature: celsiusToFahrenheit(telemetry.coolant_temp_c),
    p_fuel_level: telemetry.fuel_level_percent,
    // adapter_voltage (ELM_VOLTAGE) is adapter/vehicle electrical-system
    // voltage, not a definitive battery-health reading on its own -- mapped
    // to battery_voltage for MVP compatibility with the existing tile only.
    p_battery_voltage: telemetry.adapter_voltage,
    p_dtc_codes: telemetry.dtc_codes,
    // Diagnostic trip counters -- NEVER the vehicle odometer. Never mapped
    // to vehicles.mileage.
    p_distance_with_mil_km: telemetry.distance_with_mil_km,
    p_distance_since_dtc_clear_km: telemetry.distance_since_dtc_clear_km,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
