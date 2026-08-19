import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageHeader from '../components/PageHeader'
import TelemetryCard from '../components/TelemetryCard'
import MaintenanceReminderCard from '../components/MaintenanceReminderCard'
import { getVehicleById } from '../services/vehicleService'
import { getMaintenanceRecords } from '../services/maintenanceService'
import {
  getMaintenanceReminders,
  sortRemindersByPriority,
  summarizeReminders,
  MAINTENANCE_DISCLAIMER,
} from '../utils/maintenanceReminderEngine'

const INITIAL_VISIBLE_REMINDER_COUNT = 4

// Presentation-only rewording of summarizeReminders()'s status labels for the
// dashboard's compact summary line -- keyed off `status`, not `label`, so it
// has no effect on how reminders are counted or sorted.
const SUMMARY_PHRASES = {
  overdue: (count) => `${count} overdue`,
  'due-soon': (count) => `${count} due soon`,
  'no-history': (count) => `${count} need service history`,
  'up-to-date': (count) => `${count} up to date`,
}

function formatSummaryEntry(entry) {
  return SUMMARY_PHRASES[entry.status]?.(entry.count) ?? `${entry.count} ${entry.label}`
}

function DashboardPage() {
  const { vehicleId } = useParams()
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const isMounted = useRef(true)

  const [maintenanceRecords, setMaintenanceRecords] = useState([])
  const [remindersLoading, setRemindersLoading] = useState(true)
  const [remindersError, setRemindersError] = useState(null)
  const [showAllReminders, setShowAllReminders] = useState(false)
  const remindersMounted = useRef(true)
  const remindersVehicleIdRef = useRef(vehicleId)

  useEffect(() => {
    isMounted.current = true

    const loadVehicle = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getVehicleById(vehicleId)
        if (!isMounted.current) return
        setVehicle(data)
      } catch (err) {
        if (!isMounted.current) return
        setError(err.message || 'Failed to load vehicle.')
      } finally {
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }

    loadVehicle()

    return () => {
      isMounted.current = false
    }
  }, [vehicleId])

  // Refetches the vehicle in place after a successful OBD sync, without
  // touching `loading`/`error` -- a full "Loading vehicle..." replacement
  // of the page for what's just a background telemetry refresh would be
  // a worse experience than the already-rendered dashboard staying put.
  const refreshVehicle = useCallback(async () => {
    try {
      const data = await getVehicleById(vehicleId)
      if (isMounted.current) {
        setVehicle(data)
      }
    } catch {
      // A failed background refresh doesn't undo the sync that already
      // succeeded; the user just sees updated values on their next visit.
    }
  }, [vehicleId])

  // Maintenance history loads independently of the vehicle so a failure here
  // never prevents the core vehicle dashboard from rendering.
  useEffect(() => {
    remindersMounted.current = true
    remindersVehicleIdRef.current = vehicleId
    const targetVehicleId = vehicleId

    const loadMaintenanceRecords = async () => {
      setRemindersLoading(true)
      setRemindersError(null)
      setShowAllReminders(false)
      try {
        const data = await getMaintenanceRecords(vehicleId)
        if (!remindersMounted.current || remindersVehicleIdRef.current !== targetVehicleId) return
        setMaintenanceRecords(data)
      } catch (err) {
        if (!remindersMounted.current || remindersVehicleIdRef.current !== targetVehicleId) return
        setRemindersError(err instanceof Error ? err.message : 'Failed to load maintenance history.')
      } finally {
        if (remindersMounted.current && remindersVehicleIdRef.current === targetVehicleId) {
          setRemindersLoading(false)
        }
      }
    }

    loadMaintenanceRecords()

    return () => {
      remindersMounted.current = false
    }
  }, [vehicleId])

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Vehicle Dashboard" />
        <section className="card">
          <p className="empty-state">Loading vehicle...</p>
        </section>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title="Vehicle Dashboard" />
        <section className="card">
          <h2 className="card-title">Something Went Wrong</h2>
          <p className="empty-state">
            Unable to load vehicle: {error} <Link to="/garage">Return to My Garage</Link>.
          </p>
        </section>
      </AppShell>
    )
  }

  if (!vehicle) {
    return (
      <AppShell>
        <PageHeader title="Vehicle Dashboard" />
        <section className="card">
          <h2 className="card-title">Vehicle Not Found</h2>
          <p className="empty-state">
            We couldn't find a vehicle with ID "{vehicleId}". <Link to="/garage">Return to My Garage</Link>.
          </p>
        </section>
      </AppShell>
    )
  }

  const remindersReady = !remindersLoading && !remindersError
  const sortedReminders = remindersReady ? sortRemindersByPriority(getMaintenanceReminders(vehicle, maintenanceRecords)) : []
  const reminderSummary = remindersReady ? summarizeReminders(sortedReminders) : []
  const hasMoreReminders = sortedReminders.length > INITIAL_VISIBLE_REMINDER_COUNT
  const visibleReminders = showAllReminders ? sortedReminders : sortedReminders.slice(0, INITIAL_VISIBLE_REMINDER_COUNT)

  return (
    <AppShell>
      <section className="card profile-card">
        <div className="profile-avatar">🚗</div>
        <div className="profile-info">
          <h2 className="profile-name">Vehicle Overview</h2>
          <p className="profile-detail">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
      </section>

      <div className="dashboard-top-row">
        <section className="card vehicle-card">
          <h2 className="card-title">My Vehicle</h2>
          <div className="vehicle-details">
            <p>
              <span className="label">Make & Model</span>
              <span className="value">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
            </p>
            <p>
              <span className="label">VIN</span>
              <span className="value">{vehicle.vin || 'N/A'}</span>
            </p>
            <p>
              <span className="label">Mileage</span>
              <span className="value">{Number(vehicle.mileage).toLocaleString()} miles</span>
            </p>
            <p>
              <span className="label">Last Synced</span>
              <span className="value">
                {vehicle.last_synced_at ? new Date(vehicle.last_synced_at).toLocaleString() : 'Never'}
              </span>
            </p>
          </div>
        </section>

        <TelemetryCard vehicle={vehicle} onSynced={refreshVehicle} />
      </div>

      <section className="card reminders-card">
        <h2 className="card-title">Maintenance Status</h2>
        <p className="maintenance-disclaimer">{MAINTENANCE_DISCLAIMER}</p>
        {remindersLoading ? (
          <p className="empty-state">Loading maintenance status...</p>
        ) : remindersError ? (
          <p className="form-error" role="alert">
            Unable to load maintenance history: {remindersError}
          </p>
        ) : (
          <>
            {reminderSummary.length > 0 && (
              <p className="reminder-summary">{reminderSummary.map(formatSummaryEntry).join(' • ')}</p>
            )}
            <div className="reminder-grid">
              {visibleReminders.map((reminder) => (
                <MaintenanceReminderCard key={reminder.key} reminder={reminder} vehicleId={vehicle.id} />
              ))}
            </div>
            {hasMoreReminders && (
              <button
                type="button"
                className="btn btn-secondary btn-small reminder-toggle"
                onClick={() => setShowAllReminders((value) => !value)}
              >
                {showAllReminders ? 'Show Fewer' : 'View All Maintenance Items'}
              </button>
            )}
            <p className="reminder-health-note">
              Live vehicle-health monitoring such as battery and tire pressure will become available when OBD data is
              connected.
            </p>
          </>
        )}
      </section>

      <div className="dashboard-quick-actions">
        <span className="quick-actions-label">Quick Actions</span>
        <Link to="/symptom-checker" className="btn btn-secondary btn-small">
          AI Symptom Checker
        </Link>
        <Link to={`/vehicles/${vehicle.id}/maintenance`} className="btn btn-secondary btn-small">
          Maintenance Log
        </Link>
      </div>
    </AppShell>
  )
}

export default DashboardPage
