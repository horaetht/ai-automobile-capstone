import { Link } from 'react-router-dom'

function VehicleCard({ vehicle, onDelete, isDeleting, deleteDisabled }) {
  return (
    <div className="vehicle-list-item">
      <div className="vehicle-list-info">
        <span className="vehicle-list-name">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </span>
        <span className="vehicle-list-meta">
          {vehicle.mileage.toLocaleString()} miles &nbsp;&middot;&nbsp; ID: {vehicle.id}
        </span>
      </div>
      <div className="quick-links">
        <Link to={`/vehicles/${vehicle.id}`} className="btn btn-primary btn-small">
          View Dashboard →
        </Link>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={onDelete}
          disabled={deleteDisabled}
        >
          {isDeleting ? 'Deleting...' : 'Delete Vehicle'}
        </button>
      </div>
    </div>
  )
}

export default VehicleCard
