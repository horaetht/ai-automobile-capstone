import { Link } from 'react-router-dom'

function VehicleCard({ vehicle }) {
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
      <Link to={`/vehicles/${vehicle.id}`} className="btn btn-primary btn-small">
        View Dashboard →
      </Link>
    </div>
  )
}

export default VehicleCard
