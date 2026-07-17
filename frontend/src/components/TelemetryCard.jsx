import { useState } from 'react'

function TelemetryCard({ vehicle, onSync }) {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState(null)

  const handleSync = async () => {
    setSyncing(true)
    setMessage(null)
    await new Promise((resolve) => setTimeout(resolve, 500))
    onSync()
    setMessage('✅ Vehicle data synced successfully!')
    setSyncing(false)
    setTimeout(() => setMessage(null), 4000)
  }

  return (
    <section className="card telemetry-card">
      <div className="telemetry-header">
        <h2 className="card-title">Live Telemetry</h2>
        <button className="btn btn-primary btn-small" onClick={handleSync} disabled={syncing}>
          {syncing ? '⏳ Syncing...' : '🔄 Sync Vehicle Data'}
        </button>
      </div>
      {message && <div className="sync-message sync-success">{message}</div>}
      <div className="telemetry-grid">
        <div className="telemetry-item">
          <div className="telemetry-label">Battery Voltage</div>
          <div className="telemetry-value">{vehicle.battery_voltage}V</div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">Fuel Level</div>
          <div className="telemetry-value">{vehicle.fuel_level}%</div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">Engine Temperature</div>
          <div className="telemetry-value">{vehicle.engine_temperature}°F</div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">Diagnostic Code</div>
          <div className="telemetry-value">
            {vehicle.dtc_code ? (
              <span className="dtc-error">{vehicle.dtc_code}</span>
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
