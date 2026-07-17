import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import MaintenanceTable from '../components/MaintenanceTable'
import { findVehicleById, getMaintenanceRecords, addMaintenanceRecord } from '../data/mockData'

const emptyForm = { date: '', mileage: '', description: '', parts: '', notes: '' }

function MaintenancePage() {
  const { vehicleId } = useParams()
  const vehicle = findVehicleById(vehicleId)
  const [records, setRecords] = useState(() => getMaintenanceRecords(vehicleId))
  const [form, setForm] = useState(emptyForm)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.date || !form.mileage || !form.description) return

    const newRecord = {
      Date: form.date,
      Mileage: Number(form.mileage),
      Description: form.description,
      'Replaced Parts': form.parts || 'None',
      Notes: form.notes,
    }

    addMaintenanceRecord(vehicleId, newRecord)
    setRecords([...records, newRecord])
    setForm(emptyForm)
  }

  if (!vehicle) {
    return (
      <>
        <Header title="Maintenance Log" />
        <main className="maintenance-layout">
          <section className="card">
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
      <Header title="Maintenance Log" />
      <main className="maintenance-layout">
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
              <span className="value">{vehicle.mileage.toLocaleString()} mi</span>
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
          <MaintenanceTable records={records} />
        </section>

        <section className="card add-record-section">
          <h2 className="card-title">Log New Service</h2>
          <form className="maintenance-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="date">Service Date *</label>
              <input type="date" id="date" name="date" value={form.date} onChange={handleChange} required />
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
                required
              />
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
              <label htmlFor="parts">Parts Replaced</label>
              <input
                type="text"
                id="parts"
                name="parts"
                placeholder="e.g., Oil Filter, Spark Plugs (optional)"
                value={form.parts}
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

            <button type="submit" className="btn btn-primary">
              Add Record
            </button>
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
      </main>
    </>
  )
}

export default MaintenancePage
