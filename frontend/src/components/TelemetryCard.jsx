function TelemetryCard({ vehicle }) {
  return (
    <section className="card telemetry-card">
      <div className="telemetry-header">
        <h2 className="card-title">Live Telemetry</h2>
        <button className="btn btn-primary btn-small" disabled>
          OBD Sync Not Connected
        </button>
      </div>
      <div className="telemetry-grid">
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
