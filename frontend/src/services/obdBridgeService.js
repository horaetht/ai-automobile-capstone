// Talks only to the local OBD bridge (obd_reader/local_bridge.py) on this
// machine -- never Supabase. Keeps that responsibility separate from
// telemetrySyncService.js, which talks only to Supabase.
const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8765'
// Exported so UI that needs to display the effective configured URL (e.g.
// SettingsPage) can read it directly instead of re-deriving it.
export const BRIDGE_URL = import.meta.env.VITE_OBD_BRIDGE_URL || DEFAULT_BRIDGE_URL

export async function checkObdBridge() {
  try {
    const response = await fetch(`${BRIDGE_URL}/health`)
    if (!response.ok) return false
    const data = await response.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}

export async function readObdTelemetry(port = null) {
  let response
  try {
    response = await fetch(`${BRIDGE_URL}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port }),
    })
  } catch {
    throw new Error('Online Garage OBD Bridge is not running on this computer.')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to read telemetry from the vehicle.')
  }

  return data
}
