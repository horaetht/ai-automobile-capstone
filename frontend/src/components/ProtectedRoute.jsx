import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { isProfileComplete } from '../services/profileService'

function ProtectedRoute({ children, requireCompleteProfile = true }) {
  const { user, loading, profile, profileLoading, profileError, refreshProfile } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="dashboard-layout">
        <section className="card">
          <p className="empty-state">Checking your session…</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireCompleteProfile) {
    if (profileLoading) {
      return (
        <main className="dashboard-layout">
          <section className="card">
            <p className="empty-state">Checking your profile…</p>
          </section>
        </main>
      )
    }

    // A failed profile request is not the same as "no profile" -- don't
    // send the user through onboarding just because the request failed;
    // let them retry loading their actual account state instead.
    if (profileError) {
      return (
        <main className="dashboard-layout">
          <section className="card">
            <h2 className="card-title">Something Went Wrong</h2>
            <p className="form-error" role="alert">
              Unable to load your account: {profileError}
            </p>
            <button type="button" className="btn btn-secondary" onClick={refreshProfile}>
              Retry
            </button>
          </section>
        </main>
      )
    }

    if (!isProfileComplete(profile)) {
      return <Navigate to="/profile/setup" state={{ from: location }} replace />
    }
  }

  return children
}

export default ProtectedRoute
