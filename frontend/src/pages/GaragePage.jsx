import { useState } from 'react'
import Header from '../components/Header'
import VehicleCard from '../components/VehicleCard'
import { vehicles as initialVehicles, addVehicle, createVehicleId } from '../data/mockData'

const emptyForm = { year: '', make: '', model: '', mileage: '', vin: '' }

function GaragePage() {
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.year || !form.make || !form.model || !form.mileage) {
      setError('Please fill in all required fields.')
      return
    }

    const newVehicle = {
      id: createVehicleId(form.make, form.model, form.year),
      year: Number(form.year),
      make: form.make,
      model: form.model,
      mileage: Number(form.mileage),
      vin: form.vin,
      status: 'Active Garage Vehicle',
      battery_voltage: 12.6,
      fuel_level: 50,
      engine_temperature: 180,
      dtc_code: '',
      last_synced_at: '',
    }

    addVehicle(newVehicle)
    setVehicles([...vehicles, newVehicle])
    setForm(emptyForm)
    setError(null)
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
          {vehicles.length > 0 ? (
            <div className="vehicle-list">
              {vehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
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
            <button type="submit" className="btn btn-primary">
              Add Vehicle
            </button>
          </form>
        </section>
      </main>
    </>
  )
}

export default GaragePage
