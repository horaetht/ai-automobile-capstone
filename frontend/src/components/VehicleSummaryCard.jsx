import { Link } from 'react-router-dom'

function formatMileage(mileage) {
  const numericMileage = Number(mileage)
  if (!Number.isFinite(numericMileage) || numericMileage < 0) {
    return 'Not recorded'
  }
  return `${numericMileage.toLocaleString()} miles`
}

function formatLastSynced(lastSyncedAt) {
  if (!lastSyncedAt) {
    return 'Never'
  }
  const syncedDate = new Date(lastSyncedAt)
  if (Number.isNaN(syncedDate.getTime())) {
    return 'Unavailable'
  }
  return syncedDate.toLocaleString()
}

function VehicleSummaryCard({ vehicle }) {
  return (
    <div className="vehicle-summary-card">
      <span className="vehicle-summary-name">
        {vehicle.year} {vehicle.make} {vehicle.model}
      </span>
      <div className="vehicle-summary-details">
        <p>
          <span className="label">Mileage</span>{' '}
          <span className="value">{formatMileage(vehicle.mileage)}</span>
        </p>
        <p>
          <span className="label">Last Synced</span>{' '}
          <span className="value">{formatLastSynced(vehicle.last_synced_at)}</span>
        </p>
      </div>
      <Link to={`/vehicles/${vehicle.id}`} className="btn btn-secondary btn-small">
        View Dashboard →
      </Link>
    </div>
  )
}

export default VehicleSummaryCard
