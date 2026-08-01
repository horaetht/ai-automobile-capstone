import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import TelemetryCard from '../components/TelemetryCard'
import { getVehicleById } from '../services/vehicleService'

function DashboardPage() {
  const { vehicleId } = useParams()
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    const loadVehicle = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getVehicleById(vehicleId)
        if (!isMounted.current) return
        setVehicle(data)
      } catch (err) {
        if (!isMounted.current) return
        setError(err.message || 'Failed to load vehicle.')
      } finally {
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }

    loadVehicle()

    return () => {
      isMounted.current = false
    }
  }, [vehicleId])

  if (loading) {
    return (
      <>
        <Header title="Online Garage" subtitle="with AI Symptom Checker" />
        <main className="dashboard-layout">
          <section className="card">
            <p className="empty-state">Loading vehicle...</p>
          </section>
        </main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header title="Online Garage" subtitle="with AI Symptom Checker" />
        <main className="dashboard-layout">
          <section className="card">
            <h2 className="card-title">Something Went Wrong</h2>
            <p className="empty-state">
              Unable to load vehicle: {error} <Link to="/garage">Return to My Garage</Link>.
            </p>
          </section>
        </main>
      </>
    )
  }

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

  return (
    <>
      <Header title="Online Garage" subtitle="with AI Symptom Checker" />
      <main className="dashboard-layout">
        <section className="card profile-card">
          <div className="profile-avatar">🚗</div>
          <div className="profile-info">
            <h2 className="profile-name">Vehicle Overview</h2>
            <p className="profile-detail">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
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
              <span className="value">{Number(vehicle.mileage).toLocaleString()} miles</span>
            </p>
            <p>
              <span className="label">Last Synced</span>
              <span className="value">
                {vehicle.last_synced_at ? new Date(vehicle.last_synced_at).toLocaleString() : 'Never'}
              </span>
            </p>
          </div>
        </section>

        <TelemetryCard vehicle={vehicle} />

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
