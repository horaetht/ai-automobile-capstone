import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

// Global, page-independent navigation -- every entry is an existing route.
// Per-vehicle actions (e.g. "Maintenance Log" for the selected vehicle)
// stay on their originating page's Quick Actions instead of living here.
const NAV_ITEMS = [
  { to: '/home', label: 'Dashboard' },
  { to: '/garage', label: 'My Garage' },
  { to: '/symptom-checker', label: 'AI Symptom Checker' },
  { to: '/settings', label: 'Settings' },
]

function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const accountLabel = profile?.username ? `@${profile.username}` : profile?.first_name || user?.email

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <aside className="app-sidebar">
      <Link to="/home" className="sidebar-brand">
        Online Garage
      </Link>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) => `sidebar-nav-link${isActive ? ' is-active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        {accountLabel && <span className="sidebar-account">{accountLabel}</span>}
        <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
