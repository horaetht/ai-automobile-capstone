import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/useAuth'

const emptyForm = { email: '', password: '' }

function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

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
    if (!form.email || !form.password) {
      setError('Please enter your email and password.')
      return
    }

    setError(null)
    setLoading(true)
    const { error: signInError } = await signIn(form.email, form.password)
    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    navigate(destination, { replace: true })
  }

  return (
    <>
      <Header title="Log In" showGarageLink={false} />
      <main className="dashboard-layout">
        <section className="card auth-card">
          <h2 className="card-title">Log In</h2>
          {error && <p className="form-error">{error}</p>}
          <form className="maintenance-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in…' : 'Log In'}
            </button>
          </form>
          <p className="form-links">
            Don&apos;t have an account? <Link to="/signup">Sign up</Link>
          </p>
        </section>
      </main>
    </>
  )
}

export default LoginPage
