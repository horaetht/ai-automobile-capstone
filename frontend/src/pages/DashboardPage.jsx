import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import TelemetryCard from '../components/TelemetryCard'
import { findVehicleById, mockSyncVehicle } from '../data/mockData'

function DashboardPage() {
  const { vehicleId } = useParams()
  const [vehicle, setVehicle] = useState(() => findVehicleById(vehicleId))

  if (!vehicle) {
    return (
      <>
        <Header title="Online Garage" subtitle="with AI Symptom Checker" />
        <main className="dashboard-layout">
          <section className="card">
            <h2 className="card-title">Vehicle Not Found</h2>
            <p className="empty-state">
              We couldn't find a vehicle with ID "{vehicleId}". <Link to="/garage">Return to My Garage</Link>.
            </p>
          </section>
        </main>
      </>
    )
  }

  const handleSync = () => {
    const updated = mockSyncVehicle(vehicle.id)
    setVehicle({ ...updated })
  }

  return (
    <>
      <Header title="Online Garage" subtitle="with AI Symptom Checker" />
      <main className="dashboard-layout">
        <section className="card profile-card">
          <div className="profile-avatar">AJ</div>
          <div className="profile-info">
            <h2 className="profile-name">Alex Johnson</h2>
            <p className="profile-detail">Member since January 2024</p>
            <p className="profile-detail">1 vehicle on file</p>
          </div>
        </section>

        <section className="card vehicle-card">
          <h2 className="card-title">My Vehicle</h2>
          <div className="vehicle-details">
            <p>
              <span className="label">Make & Model</span>
              <span className="value">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
            </p>
            <p>
              <span className="label">VIN</span>
              <span className="value">{vehicle.vin || 'N/A'}</span>
            </p>
            <p>
              <span className="label">Mileage</span>
              <span className="value">{vehicle.mileage.toLocaleString()} miles</span>
            </p>
            <p>
              <span className="label">Last Synced</span>
              <span className="value">
                {vehicle.last_synced_at ? new Date(vehicle.last_synced_at).toLocaleString() : 'Never'}
              </span>
            </p>
          </div>
        </section>

        <TelemetryCard vehicle={vehicle} onSync={handleSync} />

        <section className="card actions-card">
          <h2 className="card-title">Quick Actions</h2>
          <div className="action-buttons">
            <Link to="/symptom-checker" className="btn btn-primary">
              AI Symptom Checker
            </Link>
            <Link to={`/vehicles/${vehicle.id}/maintenance`} className="btn btn-secondary">
              Maintenance Log
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}

export default DashboardPage
