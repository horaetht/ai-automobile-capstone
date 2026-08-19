import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageHeader from '../components/PageHeader'
import MaintenanceTable from '../components/MaintenanceTable'
import { useAuth } from '../context/useAuth'
import { getVehicleById } from '../services/vehicleService'
import {
  getMaintenanceRecords,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
} from '../services/maintenanceService'

const emptyForm = { service_date: '', mileage: '', description: '', replaced_parts: '', notes: '' }

// Returns the vehicle's current mileage as a finite non-negative number, or
// null when it is missing/invalid — callers use null to skip mileage-bound
// checks rather than enforcing an invalid ceiling.
function getValidVehicleMileage(vehicle) {
  const mileage = Number(vehicle?.mileage)
  return Number.isFinite(mileage) && mileage >= 0 ? mileage : null
}

function sortRecords(records) {
  return [...records].sort((a, b) => {
    if (a.service_date !== b.service_date) {
      return a.service_date < b.service_date ? 1 : -1
    }
    return new Date(b.created_at) - new Date(a.created_at)
  })
}

function MaintenancePage() {
  const { vehicleId } = useParams()
  const { user } = useAuth()

  const [vehicle, setVehicle] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadIndex, setReloadIndex] = useState(0)
  const isMounted = useRef(true)
  const vehicleIdRef = useRef(vehicleId)

  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [deletingRecordId, setDeletingRecordId] = useState(null)
  const [mutationError, setMutationError] = useState(null)
  const formSectionRef = useRef(null)

  const isMutating = submitting || deletingRecordId !== null

  useEffect(() => {
    isMounted.current = true
    vehicleIdRef.current = vehicleId

    const loadData = async () => {
      setLoading(true)
      setError(null)
      setForm(emptyForm)
      setEditingRecordId(null)
      setDeletingRecordId(null)
      setMutationError(null)
      try {
        const [vehicleData, recordsData] = await Promise.all([
          getVehicleById(vehicleId),
          getMaintenanceRecords(vehicleId),
        ])
        if (!isMounted.current) return
        setVehicle(vehicleData)
        setRecords(recordsData)
      } catch (err) {
        if (!isMounted.current) return
        setError(err instanceof Error ? err.message : 'Failed to load maintenance data.')
      } finally {
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted.current = false
    }
  }, [vehicleId, reloadIndex])

  const handleRetry = () => setReloadIndex((n) => n + 1)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleEdit = (record) => {
    setMutationError(null)
    setEditingRecordId(record.id)
    setForm({
      service_date: record.service_date || '',
      mileage: record.mileage != null ? String(record.mileage) : '',
      description: record.description || '',
      replaced_parts: record.replaced_parts || '',
      notes: record.notes || '',
    })
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleCancelEdit = () => {
    setEditingRecordId(null)
    setForm(emptyForm)
    setMutationError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isMutating) return

    if (!form.service_date || !form.mileage || !form.description.trim()) {
      setMutationError('Please fill in the required fields: service date, mileage, and description.')
      return
    }

    const vehicleMileage = getValidVehicleMileage(vehicle)
    const enteredMileage = Number(form.mileage)
    if (vehicleMileage !== null && Number.isFinite(enteredMileage) && enteredMileage > vehicleMileage) {
      setMutationError(`Service mileage cannot exceed the vehicle's current mileage of ${vehicleMileage.toLocaleString()} mi.`)
      return
    }

    const targetVehicleId = vehicleId
    const isEditing = editingRecordId !== null

    setMutationError(null)
    setSubmitting(true)
    try {
      if (isEditing) {
        const updated = await updateMaintenanceRecord(editingRecordId, vehicleId, form, vehicle.mileage)
        if (!isMounted.current || vehicleIdRef.current !== targetVehicleId) return
        setRecords((prev) => sortRecords(prev.map((r) => (r.id === updated.id ? updated : r))))
        setForm(emptyForm)
        setEditingRecordId(null)
      } else {
        const inserted = await createMaintenanceRecord(vehicleId, user?.id, form, vehicle.mileage)
        if (!isMounted.current || vehicleIdRef.current !== targetVehicleId) return
        setRecords((prev) => sortRecords([inserted, ...prev]))
        setForm(emptyForm)
      }
    } catch (err) {
      if (!isMounted.current) return
      setMutationError(
        err instanceof Error
          ? err.message
          : isEditing
            ? 'Failed to update maintenance record.'
            : 'Failed to add maintenance record.',
      )
    } finally {
      if (isMounted.current) {
        setSubmitting(false)
      }
    }
  }

  const handleDelete = async (record) => {
    if (isMutating) return

    const confirmed = window.confirm(
      `Delete the maintenance record from ${record.service_date} ("${record.description}")? This cannot be undone.`,
    )
    if (!confirmed) return

    const targetVehicleId = vehicleId

    setMutationError(null)
    setDeletingRecordId(record.id)
    try {
      await deleteMaintenanceRecord(record.id, vehicleId)
      if (!isMounted.current || vehicleIdRef.current !== targetVehicleId) return
      setRecords((prev) => prev.filter((r) => r.id !== record.id))
      if (editingRecordId === record.id) {
        setEditingRecordId(null)
        setForm(emptyForm)
      }
    } catch (err) {
      if (!isMounted.current) return
      setMutationError(err instanceof Error ? err.message : 'Failed to delete maintenance record.')
    } finally {
      if (isMounted.current) {
        setDeletingRecordId(null)
      }
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Maintenance Log" />
        <section className="card">
          <p className="empty-state">Loading maintenance data…</p>
        </section>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title="Maintenance Log" />
        <section className="card">
          <h2 className="card-title">Something Went Wrong</h2>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button type="button" className="btn btn-secondary" onClick={handleRetry}>
            Retry
          </button>
        </section>
      </AppShell>
    )
  }

  if (!vehicle) {
    return (
      <AppShell>
        <PageHeader title="Maintenance Log" />
        <section className="card">
          <p className="empty-state">
            We couldn't find a vehicle with ID "{vehicleId}". <Link to="/garage">Return to My Garage</Link>.
          </p>
        </section>
      </AppShell>
    )
  }

  const vehicleMileage = getValidVehicleMileage(vehicle)

  return (
    <AppShell>
      <PageHeader title="Maintenance Log" />
      <section className="card vehicle-context-card">
          <h2 className="card-title">Selected Vehicle</h2>
          <div className="vehicle-context-details">
            <div className="vehicle-context-item">
              <span className="label">Vehicle</span>
              <span className="value">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
            </div>
            <div className="vehicle-context-item">
              <span className="label">Mileage</span>
              <span className="value">{Number(vehicle.mileage).toLocaleString()} mi</span>
            </div>
            <div className="vehicle-context-item">
              <span className="label">Status</span>
              <span className="value status-active">{vehicle.status}</span>
            </div>
            <div className="vehicle-context-item">
              <span className="label">VIN</span>
              <span className="value">{vehicle.vin || 'N/A'}</span>
            </div>
          </div>
        </section>

        <section className="card records-section">
          <h2 className="card-title">
            Service History for {vehicle.year} {vehicle.make} {vehicle.model}
          </h2>
          <MaintenanceTable
            records={records}
            onEdit={handleEdit}
            onDelete={handleDelete}
            editingRecordId={editingRecordId}
            deletingRecordId={deletingRecordId}
            submitting={submitting}
          />
        </section>

        <section className="card add-record-section" ref={formSectionRef}>
          <h2 className="card-title">{editingRecordId ? 'Edit Service Record' : 'Log New Service'}</h2>
          {mutationError && (
            <p className="form-error" role="alert">
              {mutationError}
            </p>
          )}
          <form className="maintenance-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="service_date">Service Date *</label>
              <input
                type="date"
                id="service_date"
                name="service_date"
                value={form.service_date}
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
                placeholder="e.g., 45230"
                value={form.mileage}
                onChange={handleChange}
                min="0"
                max={vehicleMileage !== null ? vehicleMileage : undefined}
                required
              />
              {vehicleMileage !== null && (
                <p className="field-hint">Current vehicle mileage: {vehicleMileage.toLocaleString()} mi.</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="description">Service Description *</label>
              <input
                type="text"
                id="description"
                name="description"
                placeholder="e.g., Oil Change, Tire Rotation"
                value={form.description}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="replaced_parts">Parts Replaced</label>
              <input
                type="text"
                id="replaced_parts"
                name="replaced_parts"
                placeholder="e.g., Oil Filter, Spark Plugs (optional)"
                value={form.replaced_parts}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Additional Notes</label>
              <textarea
                id="notes"
                name="notes"
                rows="3"
                placeholder="Any other details about the service..."
                value={form.notes}
                onChange={handleChange}
              ></textarea>
            </div>

            <div className="maintenance-form-actions">
              <button type="submit" className="btn btn-primary" disabled={isMutating}>
                {submitting
                  ? editingRecordId
                    ? 'Saving...'
                    : 'Adding Record...'
                  : editingRecordId
                    ? 'Save Changes'
                    : 'Add Record'}
              </button>
              {editingRecordId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  disabled={isMutating}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card links-section">
          <div className="quick-links">
            <Link to={`/vehicles/${vehicle.id}`} className="btn btn-secondary">
              Back to Dashboard
            </Link>
            <Link to="/symptom-checker" className="btn btn-secondary">
              Check Symptoms
            </Link>
          </div>
        </section>
    </AppShell>
  )
}

export default MaintenancePage
