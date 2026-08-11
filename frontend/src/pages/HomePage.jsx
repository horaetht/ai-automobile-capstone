import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import VehicleSummaryCard from '../components/VehicleSummaryCard'
import { useAuth } from '../context/useAuth'
import { getVehicles } from '../services/vehicleService'

function MaintenanceQuickAction({ vehicles }) {
  if (vehicles.length === 0) {
    return (
      <button type="button" className="btn btn-secondary" disabled title="Add a vehicle first">
        Maintenance
      </button>
    )
  }

  if (vehicles.length === 1) {
    return (
      <Link to={`/vehicles/${vehicles[0].id}/maintenance`} className="btn btn-secondary">
        Maintenance
      </Link>
    )
  }

  return (
    <Link to="/garage" className="btn btn-secondary">
      Choose Vehicle for Maintenance
    </Link>
  )
}

function HomePage() {
  const { user, profile } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadIndex, setReloadIndex] = useState(0)

  const displayName =
    profile?.first_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Driver'

  useEffect(() => {
    let active = true

    const loadVehicles = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getVehicles()
        if (!active) return
        setVehicles(data)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load your garage.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadVehicles()

    return () => {
      active = false
    }
  }, [reloadIndex])

  const handleRetry = () => setReloadIndex((n) => n + 1)

  const syncedCount = vehicles.filter((vehicle) => Boolean(vehicle.last_synced_at)).length
  const neverSyncedCount = vehicles.length - syncedCount
  const previewVehicles = vehicles.slice(0, 3)

  return (
    <>
      <Header title="Online Garage" subtitle="Your Dashboard" />
      <main className="dashboard-layout">
        <section className="card">
          <h2 className="card-title">Welcome back, {displayName}</h2>
          <p className="profile-detail">Here is an overview of your garage.</p>
        </section>

        {loading ? (
          <section className="card">
            <p className="empty-state">Loading your garage…</p>
          </section>
        ) : error ? (
          <section className="card">
            <h2 className="card-title">Something Went Wrong</h2>
            <p className="form-error" role="alert">
              {error}
            </p>
            <button type="button" className="btn btn-secondary" onClick={handleRetry}>
              Retry
            </button>
          </section>
        ) : (
          <>
            <section className="card">
              <h2 className="card-title">Garage Summary</h2>
              <div className="status-cards">
                <div className="status-card">
                  <div className="status-label">{vehicles.length}</div>
                  <div className="status-detail">Total Vehicles</div>
                </div>
                <div className="status-card">
                  <div className="status-label">{syncedCount}</div>
                  <div className="status-detail">Synced At Least Once</div>
                </div>
                <div className="status-card">
                  <div className="status-label">{neverSyncedCount}</div>
                  <div className="status-detail">Never Synced</div>
                </div>
              </div>
            </section>

            {vehicles.length === 0 ? (
              <section className="card">
                <h2 className="card-title">No Vehicles Yet</h2>
                <p className="empty-state">
                  You haven&apos;t added any vehicles yet. Add your first vehicle to start tracking
                  maintenance and vehicle health.
                </p>
                <Link to="/garage" className="btn btn-primary">
                  Add First Vehicle
                </Link>
              </section>
            ) : (
              <section className="card">
                <h2 className="card-title">Your Vehicles</h2>
                <div className="vehicle-summary-grid">
                  {previewVehicles.map((vehicle) => (
                    <VehicleSummaryCard key={vehicle.id} vehicle={vehicle} />
                  ))}
                </div>
                <Link to="/garage" className="btn btn-secondary btn-small">
                  View All Vehicles →
                </Link>
              </section>
            )}

            <section className="card">
              <h2 className="card-title">Quick Actions</h2>
              <div className="action-buttons">
                <Link to="/garage" className="btn btn-primary">
                  Add Vehicle
                </Link>
                <Link to="/garage" className="btn btn-secondary">
                  Open My Garage
                </Link>
                <Link to="/symptom-checker" className="btn btn-secondary">
                  AI Symptom Checker
                </Link>
                <MaintenanceQuickAction vehicles={vehicles} />
              </div>
            </section>
          </>
        )}
      </main>
    </>
  )
}

export default HomePage
