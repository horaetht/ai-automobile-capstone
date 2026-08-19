import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageHeader from '../components/PageHeader'
import { getVehicles } from '../services/vehicleService'
import {
  analyzeSymptom,
  getSafeToDriveLabel,
  getUrgencyLabel,
  SYMPTOM_DESCRIPTION_MAX_LENGTH,
  SYMPTOM_DESCRIPTION_MIN_LENGTH,
} from '../services/symptomAnalysisService'

const WHEN_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'starting', label: 'Starting' },
  { value: 'idling', label: 'Idling' },
  { value: 'accelerating', label: 'Accelerating' },
  { value: 'cruising', label: 'Cruising' },
  { value: 'braking', label: 'Braking' },
  { value: 'turning', label: 'Turning' },
  { value: 'always', label: 'Always' },
  { value: 'other', label: 'Other' },
]

const EXAMPLE_SYMPTOMS = [
  'Engine shakes at idle',
  'Clicking when trying to start',
  'Car pulls while braking',
  'Engine temperature keeps rising',
]

const emptyForm = { description: '', when: '', warningLight: '', recentChange: '' }

function getDtcSummary(vehicle) {
  const codes =
    Array.isArray(vehicle.dtc_codes) && vehicle.dtc_codes.length > 0
      ? vehicle.dtc_codes.map((dtc) => dtc.code)
      : vehicle.dtc_code
        ? [vehicle.dtc_code]
        : []
  return codes.length > 0 ? codes.join(', ') : 'Clear'
}

function capitalize(value) {
  return typeof value === 'string' && value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function SymptomCheckerPage() {
  const [vehicles, setVehicles] = useState([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [vehiclesError, setVehiclesError] = useState(null)
  const [reloadIndex, setReloadIndex] = useState(0)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const isMounted = useRef(true)

  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    isMounted.current = true

    const loadVehicles = async () => {
      setVehiclesLoading(true)
      setVehiclesError(null)
      try {
        const data = await getVehicles()
        if (!isMounted.current) return
        setVehicles(data)
        setSelectedVehicleId((current) => current || data[0]?.id || '')
      } catch (err) {
        if (!isMounted.current) return
        setVehiclesError(err instanceof Error ? err.message : 'Failed to load your vehicles.')
      } finally {
        if (isMounted.current) {
          setVehiclesLoading(false)
        }
      }
    }

    loadVehicles()

    return () => {
      isMounted.current = false
    }
  }, [reloadIndex])

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null
  const trimmedDescriptionLength = form.description.trim().length
  const canSubmit = Boolean(selectedVehicleId) && trimmedDescriptionLength >= SYMPTOM_DESCRIPTION_MIN_LENGTH && !analyzing

  const handleVehicleChange = (e) => {
    setSelectedVehicleId(e.target.value)
    setResult(null)
    setAnalysisError(null)
  }

  const handleFieldChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleExampleClick = (example) => {
    setForm({ ...form, description: example })
    setFormError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (analyzing) return

    if (!selectedVehicleId) {
      setFormError('Select a vehicle before analyzing symptoms.')
      return
    }
    if (trimmedDescriptionLength < SYMPTOM_DESCRIPTION_MIN_LENGTH) {
      setFormError(`Please describe the symptom in at least ${SYMPTOM_DESCRIPTION_MIN_LENGTH} characters.`)
      return
    }

    setFormError(null)
    setAnalysisError(null)
    setAnalyzing(true)
    try {
      const diagnosis = await analyzeSymptom({
        vehicleId: selectedVehicleId,
        description: form.description,
        when: form.when,
        warningLight: form.warningLight,
        recentChange: form.recentChange,
      })
      setResult(diagnosis)
    } catch (err) {
      setResult(null)
      setAnalysisError(err instanceof Error ? err.message : 'Unable to analyze symptoms right now. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="AI Symptom Checker"
        subtitle="Describe what your vehicle is doing to get possible causes based on your vehicle's real data."
      />

      {vehiclesLoading ? (
        <section className="card">
          <p className="empty-state">Loading your vehicles...</p>
        </section>
      ) : vehiclesError ? (
        <section className="card">
          <h2 className="card-title">Something Went Wrong</h2>
          <p className="form-error" role="alert">
            {vehiclesError}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => setReloadIndex((n) => n + 1)}>
            Retry
          </button>
        </section>
      ) : vehicles.length === 0 ? (
        <section className="card">
          <h2 className="card-title">No Vehicles Yet</h2>
          <p className="empty-state">Add a vehicle to your garage before using the symptom checker.</p>
          <Link to="/garage" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
            Go to My Garage
          </Link>
        </section>
      ) : (
        <>
          <section className="card">
            <h2 className="card-title">Vehicle</h2>
            <div className="symptom-vehicle-row">
              <select className="symptom-vehicle-select" value={selectedVehicleId} onChange={handleVehicleChange}>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.year} {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
            {selectedVehicle && (
              <div className="vehicle-context-details" style={{ marginTop: 16 }}>
                <div className="vehicle-context-item">
                  <span className="label">Mileage</span>
                  <span className="value">{Number(selectedVehicle.mileage).toLocaleString()} mi</span>
                </div>
                <div className="vehicle-context-item">
                  <span className="label">Last OBD Sync</span>
                  <span className="value">
                    {selectedVehicle.last_synced_at
                      ? new Date(selectedVehicle.last_synced_at).toLocaleString()
                      : 'Never synced'}
                  </span>
                </div>
                <div className="vehicle-context-item">
                  <span className="label">DTC</span>
                  <span className="value">{getDtcSummary(selectedVehicle)}</span>
                </div>
              </div>
            )}
            <Link
              to={`/vehicles/${selectedVehicleId}`}
              className="btn btn-secondary btn-small"
              style={{ marginTop: 16, display: 'inline-block' }}
            >
              ← Back to Dashboard
            </Link>
          </section>

          <section className="card">
            <h2 className="card-title">Describe Symptoms</h2>

            <div className="symptom-examples">
              {EXAMPLE_SYMPTOMS.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="symptom-example-chip"
                  onClick={() => handleExampleClick(example)}
                >
                  {example}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="symptom-form">
              <div className="form-group">
                <label htmlFor="description">Describe what your vehicle is doing *</label>
                <textarea
                  id="description"
                  name="description"
                  rows={5}
                  maxLength={SYMPTOM_DESCRIPTION_MAX_LENGTH}
                  value={form.description}
                  onChange={handleFieldChange}
                  placeholder="Example: The engine shakes at idle after warming up, the check-engine light is on, and acceleration feels weaker than normal."
                  required
                />
                <p className="field-hint symptom-char-counter">
                  {form.description.length}/{SYMPTOM_DESCRIPTION_MAX_LENGTH} characters
                  {form.description.length > 0 && trimmedDescriptionLength < SYMPTOM_DESCRIPTION_MIN_LENGTH
                    ? ` — please describe in at least ${SYMPTOM_DESCRIPTION_MIN_LENGTH} characters`
                    : ''}
                </p>
              </div>

              <div className="symptom-optional-grid">
                <div className="form-group">
                  <label htmlFor="when">When does it happen?</label>
                  <select id="when" name="when" value={form.when} onChange={handleFieldChange}>
                    {WHEN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="warningLight">Warning light or dashboard message</label>
                  <input
                    type="text"
                    id="warningLight"
                    name="warningLight"
                    maxLength={300}
                    value={form.warningLight}
                    onChange={handleFieldChange}
                    placeholder="e.g. Check Engine light"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="recentChange">Recent repair, service, or change</label>
                  <input
                    type="text"
                    id="recentChange"
                    name="recentChange"
                    maxLength={300}
                    value={form.recentChange}
                    onChange={handleFieldChange}
                    placeholder="e.g. Replaced battery last week"
                  />
                </div>
              </div>

              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}

              <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                {analyzing ? 'Analyzing...' : 'Analyze Symptoms'}
              </button>
            </form>

            {analyzing && <p className="empty-state symptom-analyzing-note">Analyzing vehicle symptoms…</p>}

            {analysisError && !analyzing && (
              <div className="form-error symptom-analysis-error" role="alert">
                <p>{analysisError}</p>
                <button type="button" className="btn btn-secondary btn-small" onClick={handleSubmit}>
                  Retry
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {result && (
        <>
          <section className={`card diagnosis-summary-card urgency-${result.urgency}`}>
            <h2 className="card-title">Diagnosis Summary</h2>
            <p className="profile-detail">{result.summary}</p>
          </section>

          <div className="diagnosis-meta-grid">
            <section className="card diagnosis-meta-card">
              <span className="label">Urgency</span>
              <span className={`status-pill status-pill-${result.urgency}`}>{getUrgencyLabel(result.urgency)}</span>
            </section>
            <section className="card diagnosis-meta-card">
              <span className="label">Driveability</span>
              <span className={`status-pill status-pill-${result.safe_to_drive}`}>
                {getSafeToDriveLabel(result.safe_to_drive)}
              </span>
            </section>
          </div>

          {result.urgency === 'stop_driving' && (
            <section className="card diagnosis-critical-banner" role="alert">
              <strong>Stop Driving:</strong> This may be a safety issue. Stop the vehicle safely and arrange a tow or
              professional inspection before driving again.
            </section>
          )}

          <section className="card">
            <h2 className="card-title">Possible Causes</h2>
            {result.possible_causes.length === 0 ? (
              <p className="empty-state">
                Not enough information was provided to suggest a specific cause. See the follow-up questions below.
              </p>
            ) : (
              <ol className="possible-cause-list">
                {result.possible_causes.map((cause, index) => (
                  <li key={index} className="possible-cause-item">
                    <p className="possible-cause-title">{cause.cause}</p>
                    <p className="possible-cause-likelihood">
                      Likelihood:{' '}
                      <span className={`status-pill status-pill-${cause.likelihood}`}>
                        {capitalize(cause.likelihood)}
                      </span>
                    </p>
                    <p className="possible-cause-reasoning">{cause.reasoning}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">Recommended Next Steps</h2>
            {result.recommended_actions.length === 0 ? (
              <p className="empty-state">No specific next steps were returned.</p>
            ) : (
              <ol className="diagnosis-list">
                {result.recommended_actions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ol>
            )}
          </section>

          {result.follow_up_questions.length > 0 && (
            <section className="card">
              <h2 className="card-title">Follow-up Questions</h2>
              <ul className="diagnosis-list">
                {result.follow_up_questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2 className="card-title">Vehicle Context Used</h2>
            {result.vehicle_data_used.length === 0 ? (
              <p className="empty-state">No specific vehicle data points were referenced.</p>
            ) : (
              <ul className="diagnosis-list">
                {result.vehicle_data_used.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </section>

          <p className="demo-disclaimer">{result.disclaimer}</p>
        </>
      )}
    </AppShell>
  )
}

export default SymptomCheckerPage
