import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import GaragePage from './pages/GaragePage'
import DashboardPage from './pages/DashboardPage'
import MaintenancePage from './pages/MaintenancePage'
import SymptomCheckerPage from './pages/SymptomCheckerPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/garage" element={<GaragePage />} />
      <Route path="/vehicles/:vehicleId" element={<DashboardPage />} />
      <Route path="/vehicles/:vehicleId/maintenance" element={<MaintenancePage />} />
      <Route path="/symptom-checker" element={<SymptomCheckerPage />} />
    </Routes>
  )
}

export default App
