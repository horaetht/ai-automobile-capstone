import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { symptomRules } from '../data/mockData'

const sampleSymptoms = symptomRules.map((rule) => rule.symptom)

const initialDemoTelemetry = {
  batteryVoltage: 12.6,
  fuelLevel: 68,
  engineTemperature: 192,
  dtcCode: '',
}

const howItWorksSteps = [
  {
    number: 1,
    title: 'Add a vehicle',
    description: "Enter your vehicle's year, make, model, and mileage to start tracking it.",
  },
  {
    number: 2,
    title: 'Track maintenance and health',
    description: 'Log service records and monitor live telemetry like battery voltage and fuel level.',
  },
  {
    number: 3,
    title: 'Check symptoms and next steps',
    description: 'Describe unusual behavior and get a possible issue, urgency level, and recommended action.',
  },
]

function randomInRange(min, max) {
  return Math.random() * (max - min) + min
}

function LandingNav({ user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <Link to="/" className="landing-brand" onClick={closeMenu}>
          🚗 Online Garage
        </Link>

        <button
          type="button"
          className="landing-nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="landing-nav-links"
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
        </button>

        <nav id="landing-nav-links" className={`landing-nav-links ${menuOpen ? 'is-open' : ''}`}>
          <a href="#features" onClick={closeMenu}>
            Features
          </a>
          <a href="#how-it-works" onClick={closeMenu}>
            How It Works
          </a>
          <div className="landing-nav-actions">
            {user ? (
              <>
                <Link to="/garage" className="btn btn-secondary btn-small" onClick={closeMenu}>
                  Open My Garage
                </Link>
                <button type="button" className="btn btn-primary btn-small" onClick={onLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary btn-small" onClick={closeMenu}>
                  Sign In
                </Link>
                <Link to="/signup" className="btn btn-primary btn-small" onClick={closeMenu}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}

function Hero({ user }) {
  return (
    <section className="hero">
      <h1 className="hero-title">Know your vehicle's health before it becomes a problem.</h1>
      <p className="hero-subtitle">One place to track every vehicle, service record, and warning sign.</p>
      <p className="hero-description">
        Online Garage keeps your maintenance history, live vehicle telemetry, and AI-assisted symptom
        guidance together, so you always know what's going on under the hood and what to do next.
      </p>
      <div className="hero-buttons">
        <Link to={user ? '/garage' : '/signup'} className="btn btn-primary hero-button">
          {user ? 'Open My Garage' : 'Get Started'}
        </Link>
        <a href="#features" className="btn btn-secondary hero-button">
          Explore Features
        </a>
      </div>
    </section>
  )
}

function VehicleHealthPreview() {
  const [telemetry, setTelemetry] = useState(initialDemoTelemetry)
  const [justSynced, setJustSynced] = useState(false)

  useEffect(() => {
    if (!justSynced) return undefined
    const timeoutId = setTimeout(() => setJustSynced(false), 2500)
    return () => clearTimeout(timeoutId)
  }, [justSynced])

  const handleSimulateSync = () => {
    setTelemetry({
      batteryVoltage: Number(randomInRange(11.8, 13.4).toFixed(2)),
      fuelLevel: Math.round(randomInRange(15, 95)),
      engineTemperature: Math.round(randomInRange(175, 225)),
      dtcCode: Math.random() < 0.3 ? 'P0420' : '',
    })
    setJustSynced(true)
  }

  return (
    <section id="vehicle-preview" className="features">
      <h2 className="section-title">See Your Vehicle's Health at a Glance</h2>
      <p className="section-subtitle">
        This is a live demo with sample numbers — sign in to sync your own vehicle's real data.
      </p>
      <div className="card telemetry-card">
        <div className="telemetry-header">
          <h3 className="card-title">Demo Vehicle: 2020 Toyota Camry</h3>
          <button type="button" className="btn btn-primary btn-small" onClick={handleSimulateSync}>
            Simulate Vehicle Sync
          </button>
        </div>

        {justSynced && (
          <p className="sync-message sync-success">✓ Simulated sync complete — demo values updated.</p>
        )}

        <div className="telemetry-grid">
          <div className="telemetry-item">
            <div className="telemetry-label">Battery Voltage</div>
            <div className="telemetry-value">{telemetry.batteryVoltage.toFixed(2)} V</div>
          </div>
          <div className="telemetry-item">
            <div className="telemetry-label">Fuel Level</div>
            <div className="telemetry-value">{telemetry.fuelLevel}%</div>
          </div>
          <div className="telemetry-item">
            <div className="telemetry-label">Engine Temperature</div>
            <div className="telemetry-value">{telemetry.engineTemperature}°F</div>
          </div>
          <div className="telemetry-item">
            <div className="telemetry-label">Diagnostic Status</div>
            <div className="telemetry-value">
              {telemetry.dtcCode ? (
                <span className="dtc-error">{telemetry.dtcCode}</span>
              ) : (
                <span className="dtc-clear">No Issues Detected</span>
              )}
            </div>
          </div>
        </div>
        <p className="demo-disclaimer">Demo data only — nothing here is saved to your account.</p>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="features">
      <h2 className="section-title">Everything Your Garage Needs</h2>
      <p className="section-subtitle">Track vehicles, catch problems early, and stay on top of maintenance.</p>
      <div className="feature-grid">
        <Link to="/garage" className="feature-card feature-link">
          <div className="feature-icon">🚗</div>
          <h3 className="feature-title">My Garage</h3>
          <p className="feature-description">
            Add every vehicle you own and keep their details, mileage, and status organized in one place.
          </p>
        </Link>

        <a href="#vehicle-preview" className="feature-card feature-link">
          <div className="feature-icon">🔋</div>
          <h3 className="feature-title">Vehicle Health</h3>
          <p className="feature-description">
            Monitor battery voltage, fuel level, engine temperature, and diagnostic codes at a glance.
          </p>
        </a>

        <div className="feature-card">
          <div className="feature-icon">📋</div>
          <h3 className="feature-title">Maintenance History</h3>
          <p className="feature-description">
            Log every service, part replacement, and note so you always know what's been done and what's next.
          </p>
        </div>

        <Link to="/symptom-checker" className="feature-card feature-link">
          <div className="feature-icon">🔍</div>
          <h3 className="feature-title">AI Symptom Checker</h3>
          <p className="feature-description">
            Describe what your car is doing and get a possible cause, urgency level, and next step.
          </p>
        </Link>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="features">
      <h2 className="section-title">How It Works</h2>
      <div className="feature-grid">
        {howItWorksSteps.map((step) => (
          <div className="feature-card step-card" key={step.number}>
            <div className="step-number" aria-hidden="true">
              {step.number}
            </div>
            <h3 className="feature-title">{step.title}</h3>
            <p className="feature-description">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function SymptomPreviewSection() {
  const [selectedSymptom, setSelectedSymptom] = useState('')
  const [customSymptom, setCustomSymptom] = useState('')
  const [previewedSymptom, setPreviewedSymptom] = useState(null)

  const handlePreview = (e) => {
    e.preventDefault()
    const symptom = customSymptom.trim() || selectedSymptom
    if (!symptom) return
    setPreviewedSymptom(symptom)
  }

  return (
    <section className="features">
      <h2 className="section-title">Try the AI Symptom Checker</h2>
      <p className="section-subtitle">
        Pick a sample symptom or describe your own — sign in to see the full diagnosis.
      </p>
      <div className="card symptom-preview-card">
        <form className="maintenance-form" onSubmit={handlePreview}>
          <div className="form-group">
            <label htmlFor="sample-symptom">Choose a sample symptom</label>
            <select
              id="sample-symptom"
              value={selectedSymptom}
              onChange={(e) => {
                setSelectedSymptom(e.target.value)
                setCustomSymptom('')
              }}
            >
              <option value="">Select a symptom…</option>
              {sampleSymptoms.map((symptom) => (
                <option key={symptom} value={symptom}>
                  {symptom}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="custom-symptom">Or describe your own</label>
            <input
              type="text"
              id="custom-symptom"
              placeholder="e.g., grinding noise when braking"
              value={customSymptom}
              onChange={(e) => {
                setCustomSymptom(e.target.value)
                setSelectedSymptom('')
              }}
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Preview Check
          </button>
        </form>

        {previewedSymptom && (
          <div className="symptom-preview-result">
            <p>
              <strong>Symptom:</strong> {previewedSymptom}
            </p>
            <p className="symptom-preview-locked">
              🔒 Sign in to see the possible issue, urgency level, and recommended next step.
            </p>
            <Link
              to="/login"
              state={{ from: { pathname: '/symptom-checker', search: '' } }}
              className="btn btn-secondary"
            >
              Sign In to See Full Diagnosis
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <span>© {new Date().getFullYear()} Online Garage</span>
        <nav className="landing-footer-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <Link to="/login">Sign In</Link>
          <Link to="/signup">Sign Up</Link>
        </nav>
      </div>
    </footer>
  )
}

function LandingPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="home-layout">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <LandingNav user={user} onLogout={handleLogout} />
      <main id="main-content">
        <Hero user={user} />
        <VehicleHealthPreview />
        <FeaturesSection />
        <HowItWorksSection />
        <SymptomPreviewSection />

        <section className="disclaimer-section">
          <div className="disclaimer-box">
            <p className="disclaimer-text">
              <strong>⚠️ Disclaimer:</strong> Online Garage provides general guidance on vehicle
              maintenance and common symptoms. This tool does not replace professional mechanic
              expertise. Always consult a certified mechanic for accurate diagnosis and repairs,
              especially for critical vehicle issues.
            </p>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}

export default LandingPage
