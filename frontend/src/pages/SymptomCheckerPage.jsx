import { useState } from 'react'
import { Link } from 'react-router-dom'
import { checkSymptom, vehicles } from '../data/mockData'

function SymptomCheckerPage() {
  const [symptom, setSymptom] = useState('')
  const [result, setResult] = useState(null)
  const defaultVehicleId = vehicles[0]?.id

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!symptom.trim()) return
    setResult({ input: symptom, ...checkSymptom(symptom) })
  }

  return (
    <div className="container">
      <h1>AI Vehicle Symptom Checker</h1>
      <p>Enter a car symptom to get a possible issue, urgency level, and next step.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="symptom">Describe the symptom:</label>
        <input
          type="text"
          id="symptom"
          name="symptom"
          placeholder="e.g. engine light on and car shaking"
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          required
        />
        <button type="submit">Check Symptom</button>
      </form>

      {result && (
        <div style={{ marginTop: 24 }}>
          <h1>Diagnosis Result</h1>
          <p>
            <strong>Input symptom:</strong> {result.input}
          </p>
          <p>
            <strong>Possible issue:</strong> {result.possible_issue}
          </p>
          <p>
            <strong>Urgency:</strong> {result.urgency}
          </p>
          <p>
            <strong>Recommended next step:</strong> {result.recommended_next_step}
          </p>
        </div>
      )}

      <Link
        to={`/vehicles/${defaultVehicleId}`}
        className="btn btn-secondary"
        style={{ marginTop: 16, display: 'inline-block' }}
      >
        ← Back to Dashboard
      </Link>
    </div>
  )
}

export default SymptomCheckerPage
