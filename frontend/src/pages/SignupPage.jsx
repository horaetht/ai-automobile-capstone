import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/useAuth'
import {
  normalizeUsername,
  isValidUsername,
  isUsernameAvailable,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
} from '../services/profileService'

const emptyForm = { first_name: '', last_name: '', username: '', email: '', password: '' }

const passwordRequirements = [
  { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { id: 'uppercase', label: 'At least one uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lowercase', label: 'At least one lowercase letter', test: (pw) => /[a-z]/.test(pw) },
]

function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const passwordChecks = passwordRequirements.map((requirement) => ({
    ...requirement,
    valid: requirement.test(form.password),
  }))
  const isPasswordValid = passwordChecks.every((check) => check.valid)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    const firstName = form.first_name.trim()
    const lastName = form.last_name.trim()
    const username = normalizeUsername(form.username)
    const normalizedEmail = form.email.trim().toLowerCase()

    if (!firstName || !lastName || !username || !normalizedEmail || !form.password) {
      setError('Please fill in your first name, last name, username, email, and password.')
      return
    }
    if (!isValidUsername(username)) {
      setError(
        `Usernames must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters and contain only lowercase letters, numbers, and underscores.`,
      )
      return
    }
    if (!isPasswordValid) {
      setError('Password does not meet the requirements below.')
      return
    }

    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const available = await isUsernameAvailable(username)
      if (!available) {
        setError('That username is already taken.')
        return
      }

      const { data, error: signUpError } = await signUp(normalizedEmail, form.password, {
        username,
        first_name: firstName,
        last_name: lastName,
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.session) {
        navigate('/home', { replace: true })
        return
      }

      setMessage(
        'If this email can be registered, check your inbox for a confirmation link. If you already have an account, log in instead.',
      )
      setForm({ first_name: firstName, last_name: lastName, username, email: normalizedEmail, password: '' })
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header title="Sign Up" showGarageLink={false} />
      <main className="dashboard-layout">
        <section className="card auth-card">
          <h2 className="card-title">Create an Account</h2>
          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}
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
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={handleChange}
                aria-describedby="password-requirements"
                autoComplete="new-password"
                required
              />
              <ul className="password-requirements" id="password-requirements" aria-live="polite">
                {passwordChecks.map((check) => (
                  <li key={check.id} className={`password-requirement ${check.valid ? 'is-valid' : ''}`}>
                    <span className="requirement-icon" aria-hidden="true">
                      {check.valid ? '✓' : '○'}
                    </span>
                    {check.label}
                    <span className="sr-only">{check.valid ? ' (met)' : ' (not met)'}</span>
                  </li>
                ))}
              </ul>
              <p className="password-hint">
                This checklist runs in your browser for convenience only — it is not a substitute for
                server-side security. Supabase independently validates and secures your credentials.
              </p>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading || !isPasswordValid}>
              {loading ? 'Creating account…' : 'Sign Up'}
            </button>
          </form>
          <p className="form-links">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </section>
      </main>
    </>
  )
}

export default SignupPage
