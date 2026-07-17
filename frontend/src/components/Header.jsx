import { Link } from 'react-router-dom'

function Header({ title, subtitle, showGarageLink = true }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="header-content">
          <h1 className="site-title">
            {title}
            {subtitle && <span className="subtitle">{subtitle}</span>}
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {showGarageLink && (
              <Link to="/garage" className="home-link">
                My Garage
              </Link>
            )}
            <Link to="/" className="home-link">
              ← Home
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
