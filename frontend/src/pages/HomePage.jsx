import { Link } from 'react-router-dom'
import { vehicles } from '../data/mockData'

function HomePage() {
  const defaultVehicleId = vehicles[0]?.id

  return (
    <main className="home-layout">
      <section className="hero">
        <h1 className="hero-title">Online Garage</h1>
        <p className="hero-subtitle">with AI Symptom Checker</p>
        <p className="hero-description">
          Manage vehicle issues, check symptoms, and track maintenance records in one place.
        </p>

        <div className="hero-buttons">
          <Link to="/garage" className="btn btn-secondary hero-button">
            My Garage
          </Link>
          <Link to="/symptom-checker" className="btn btn-secondary hero-button">
            AI Symptom Checker
          </Link>
        </div>
      </section>

      <section className="features">
        <h2 className="section-title">Features</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🚗</div>
            <h3 className="feature-title">Vehicle Dashboard</h3>
            <p className="feature-description">
              View all your vehicle information in one place. Track mileage, service history, and
              maintenance status at a glance.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3 className="feature-title">AI Symptom Checker</h3>
            <p className="feature-description">
              Describe your car's symptoms and get AI-powered analysis with possible issues and
              recommended next steps.
            </p>
          </div>

          <Link to={`/vehicles/${defaultVehicleId}/maintenance`} className="feature-card feature-link">
            <div className="feature-icon">📋</div>
            <h3 className="feature-title">Maintenance Log</h3>
            <p className="feature-description">
              Keep track of all maintenance and service records. View and add service entries to
              stay on top of preventive care.
            </p>
          </Link>
        </div>
      </section>

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
  )
}

export default HomePage
