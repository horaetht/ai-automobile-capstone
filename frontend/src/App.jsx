import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import GaragePage from './pages/GaragePage'
import DashboardPage from './pages/DashboardPage'
import MaintenancePage from './pages/MaintenancePage'
import SymptomCheckerPage from './pages/SymptomCheckerPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProfileSetupPage from './pages/ProfileSetupPage'
import SettingsPage from './pages/SettingsPage'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/useAuth'

function RootRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="dashboard-layout">
        <section className="card">
          <p className="empty-state">Checking your session…</p>
        </section>
      </main>
    )
  }

  if (user) {
    return <Navigate to="/home" replace />
  }

  return <LandingPage />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/profile/setup"
        element={
          <ProtectedRoute requireCompleteProfile={false}>
            <ProfileSetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/symptom-checker"
        element={
          <ProtectedRoute>
            <SymptomCheckerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/garage"
        element={
          <ProtectedRoute>
            <GaragePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vehicles/:vehicleId"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vehicles/:vehicleId/maintenance"
        element={
          <ProtectedRoute>
            <MaintenancePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
