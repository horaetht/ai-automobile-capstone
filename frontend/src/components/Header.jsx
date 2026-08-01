import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function Header({ title, subtitle, showGarageLink = true }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

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
            {user && (
              <div className="header-account">
                <span className="header-user-email">{user.email}</span>
                <button type="button" className="btn btn-secondary btn-small" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
