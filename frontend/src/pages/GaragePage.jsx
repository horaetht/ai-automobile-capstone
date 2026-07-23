import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import VehicleCard from '../components/VehicleCard'
import { useAuth } from '../context/useAuth'
import { createVehicle, deleteVehicle, getVehicles } from '../services/vehicleService'

const emptyForm = { year: '', make: '', model: '', mileage: '', vin: '' }

function GaragePage() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deletingVehicleId, setDeletingVehicleId] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    const loadVehicles = async () => {
      setLoading(true)
      try {
        const data = await getVehicles()
        if (!isMounted.current) return
        setVehicles(data)
      } catch (err) {
        if (!isMounted.current) return
        setError(err.message || 'Failed to load vehicles.')
      } finally {
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }

    loadVehicles()

    return () => {
      isMounted.current = false
    }
  }, [])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    if (!form.year || !form.make || !form.model || !form.mileage) {
      setError('Please fill in all required fields.')
      return
    }

    if (!user?.id) {
      setError('You must be signed in to add a vehicle.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const newVehicle = await createVehicle(form, user.id)
      setVehicles((currentVehicles) => [newVehicle, ...currentVehicles])
      setForm(emptyForm)
    } catch (err) {
      setError(err.message || 'Failed to add vehicle.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteVehicle = async (vehicle) => {
    if (deletingVehicleId) return

    const confirmed = window.confirm(
      `Delete ${vehicle.year} ${vehicle.make} ${vehicle.model}? This action cannot be undone.`,
    )
    if (!confirmed) return

    setError(null)
    setDeletingVehicleId(vehicle.id)
    try {
      await deleteVehicle(vehicle.id)
      setVehicles((currentVehicles) =>
        currentVehicles.filter((currentVehicle) => currentVehicle.id !== vehicle.id),
      )
    } catch (err) {
      setError(`Unable to delete vehicle: ${err.message || 'Unknown error.'}`)
    } finally {
      setDeletingVehicleId(null)
    }
  }

  return (
    <>
      <Header title="My Garage" showGarageLink={false} />
      <main className="dashboard-layout">
        <section className="card">
          <h2 className="card-title">Select a Vehicle</h2>
          <p style={{ color: '#666', fontSize: 14, marginTop: 0 }}>
            Choose a vehicle to view its dashboard and maintenance history.
          </p>
          {loading ? (
            <p className="empty-state">Loading vehicles...</p>
          ) : vehicles.length > 0 ? (
            <div className="vehicle-list">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onDelete={() => handleDeleteVehicle(vehicle)}
                  isDeleting={deletingVehicleId === vehicle.id}
                  deleteDisabled={deletingVehicleId !== null}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">No vehicles yet. Add your first vehicle using the form below.</p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Add New Vehicle</h2>
          {error && (
            <p
              style={{
                color: '#d32f2f',
                background: '#ffebee',
                padding: '10px 14px',
                borderRadius: 6,
                borderLeft: '4px solid #f44336',
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {error}
            </p>
          )}
          <form className="maintenance-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="year">Year *</label>
              <input
                type="number"
                id="year"
                name="year"
                placeholder="e.g., 2020"
                min="1900"
                max="2100"
                value={form.year}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="make">Make *</label>
              <input
                type="text"
                id="make"
                name="make"
                placeholder="e.g., Toyota"
                value={form.make}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="model">Model *</label>
              <input
                type="text"
                id="model"
                name="model"
                placeholder="e.g., Camry"
                value={form.model}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="mileage">Mileage (miles) *</label>
              <input
                type="number"
                id="mileage"
                name="mileage"
                placeholder="e.g., 32000"
                min="0"
                value={form.mileage}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="vin">
                VIN <span style={{ fontWeight: 'normal', color: '#999' }}>(optional)</span>
              </label>
              <input
                type="text"
                id="vin"
                name="vin"
                placeholder="e.g., 1HGBH41JXMN109186"
                value={form.vin}
                onChange={handleChange}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adding Vehicle...' : 'Add Vehicle'}
            </button>
          </form>
        </section>
      </main>
    </>
  )
}

export default GaragePage
