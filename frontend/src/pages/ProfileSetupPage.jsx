import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/useAuth'
import { upsertProfile, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH } from '../services/profileService'

const emptyForm = { first_name: '', last_name: '', username: '' }

function ProfileSetupPage() {
  const { user, profile, refreshProfile, updateAuthMetadata } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Prefill whatever the signup trigger (or a previous incomplete save)
  // already captured, so the user only has to supply what's missing. Adjusts
  // state during render (React's documented pattern for this) rather than in
  // an effect, since AuthContext's profile can arrive after this page mounts.
  const [prefilledFrom, setPrefilledFrom] = useState(null)
  if (profile && profile !== prefilledFrom) {
    setPrefilledFrom(profile)
    setForm({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      username: profile.username || '',
    })
  }

  const fromLocation = location.state?.from
  const hasValidInternalDestination =
    typeof fromLocation?.pathname === 'string' &&
    fromLocation.pathname.startsWith('/') &&
    !fromLocation.pathname.startsWith('//')
  const destination = hasValidInternalDestination
    ? `${fromLocation.pathname}${fromLocation.search ?? ''}${fromLocation.hash ?? ''}`
    : '/home'

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    if (!form.first_name.trim() || !form.last_name.trim() || !form.username.trim()) {
      setError('Please fill in your first name, last name, and username.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const saved = await upsertProfile(user.id, form)

      try {
        await updateAuthMetadata({
          username: saved.username,
          first_name: saved.first_name,
          last_name: saved.last_name,
          full_name: `${saved.first_name} ${saved.last_name}`.trim(),
        })
      } catch {
        // Non-critical: public.profiles is the source of truth the rest of
        // the app reads from, so a failed metadata mirror doesn't block
        // onboarding from completing.
      }

      await refreshProfile()
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your profile.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Header title="Complete Your Profile" showGarageLink={false} />
      <main className="dashboard-layout">
        <section className="card auth-card">
          <h2 className="card-title">Complete Your Profile</h2>
          <p className="profile-detail">
            Just a few details to finish setting up your Online Garage account.
          </p>
          {error && <p className="form-error">{error}</p>}
          <form className="maintenance-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="first_name">First Name *</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                placeholder="Horace"
                value={form.first_name}
                onChange={handleChange}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="last_name">Last Name *</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                placeholder="Chan"
                value={form.last_name}
                onChange={handleChange}
                autoComplete="family-name"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="username">Username *</label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="horace08"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                required
              />
              <p className="field-hint">
                {USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} characters: lowercase letters, numbers, and underscores
                only.
              </p>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save and Continue'}
            </button>
          </form>
        </section>
      </main>
    </>
  )
}

export default ProfileSetupPage
