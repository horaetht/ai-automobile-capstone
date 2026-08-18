import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkObdBridge, readObdTelemetry } from '../services/obdBridgeService'
import { syncVehicleTelemetry } from '../services/telemetrySyncService'

const IN_PROGRESS_STATUSES = new Set(['checking', 'reading', 'saving'])

const BUTTON_LABELS = {
  checking: 'Checking OBD...',
  reading: 'Reading Vehicle...',
  saving: 'Saving...',
  success: 'Synced',
  error: 'Retry',
}

// Falls back to the legacy single dtc_code column when dtc_codes hasn't
// been populated yet (e.g. a vehicle that has never been OBD-synced).
function getDtcCodes(vehicle) {
  if (Array.isArray(vehicle.dtc_codes) && vehicle.dtc_codes.length > 0) {
    return vehicle.dtc_codes.map((dtc) => dtc.code)
  }
  return vehicle.dtc_code ? [vehicle.dtc_code] : []
}

function TelemetryCard({ vehicle, onSynced }) {
  const dtcCodes = getDtcCodes(vehicle)

  // bridgeAvailable: null while unchecked, then true/false. Only ever
  // affects the idle-state button label -- it never disables the button,
  // since the user should still be able to click "retry" once they've
  // started the bridge.
  const [bridgeAvailable, setBridgeAvailable] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle')
  const [syncError, setSyncError] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    checkObdBridge().then((available) => {
      if (isMounted.current) setBridgeAvailable(available)
    })
    return () => {
      isMounted.current = false
    }
  }, [])

  const isSyncing = IN_PROGRESS_STATUSES.has(syncStatus)

  async function handleSync() {
    if (isSyncing) return

    setSyncError(null)
    setSyncStatus('checking')

    const bridgeUp = await checkObdBridge()
    if (!isMounted.current) return
    setBridgeAvailable(bridgeUp)
    if (!bridgeUp) {
      setSyncStatus('error')
      setSyncError('Online Garage OBD Bridge is not running on this computer.')
      return
    }

    setSyncStatus('reading')
    let telemetry
    try {
      telemetry = await readObdTelemetry()
    } catch (err) {
      if (!isMounted.current) return
      setSyncStatus('error')
      setSyncError(err.message || 'Unable to read telemetry from the vehicle.')
      return
    }
    if (!isMounted.current) return

    setSyncStatus('saving')
    try {
      await syncVehicleTelemetry(vehicle.id, telemetry)
    } catch {
      if (!isMounted.current) return
      setSyncStatus('error')
      setSyncError('Vehicle data was read, but could not be saved. Try again.')
      return
    }
    if (!isMounted.current) return

    setSyncStatus('success')
    if (onSynced) {
      await onSynced()
    }
  }

  const buttonLabel =
    BUTTON_LABELS[syncStatus] ?? (bridgeAvailable === false ? 'OBD Bridge Not Running' : 'Sync OBD Now')

  return (
    <section className="card telemetry-card">
      <div className="telemetry-header">
        <h2 className="card-title">Live Telemetry</h2>
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={handleSync}
          disabled={isSyncing}
        >
          {buttonLabel}
        </button>
      </div>
      {syncStatus === 'error' && syncError && (
        <p className="sync-message sync-error" role="alert">
          {syncError}
        </p>
      )}
      {bridgeAvailable === false && !isSyncing && (
        <p className="obd-setup-hint">
          <Link to="/settings">OBD Setup →</Link>
        </p>
      )}
      <div className="telemetry-grid">
        <div className="telemetry-item">
          <div className="telemetry-label">RPM</div>
          <div className="telemetry-value">{vehicle.rpm != null ? vehicle.rpm : 'N/A'}</div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">Vehicle Speed</div>
          <div className="telemetry-value">
            {vehicle.vehicle_speed_mph != null ? `${vehicle.vehicle_speed_mph} mph` : 'N/A'}
          </div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">Battery Voltage</div>
          <div className="telemetry-value">
            {vehicle.battery_voltage != null ? `${vehicle.battery_voltage}V` : 'N/A'}
          </div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">Fuel Level</div>
          <div className="telemetry-value">
            {vehicle.fuel_level != null ? `${vehicle.fuel_level}%` : 'N/A'}
          </div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">Engine Temperature</div>
          <div className="telemetry-value">
            {vehicle.engine_temperature != null ? `${vehicle.engine_temperature}°F` : 'N/A'}
          </div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">Diagnostic Code{dtcCodes.length === 1 ? '' : 's'}</div>
          <div className="telemetry-value">
            {dtcCodes.length > 0 ? (
              <span className="dtc-error">{dtcCodes.join(', ')}</span>
            ) : (
              <span className="dtc-clear">Clear</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default TelemetryCard
