import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import PageHeader from '../components/PageHeader'
import { checkObdBridge, BRIDGE_URL } from '../services/obdBridgeService'

const STATUS_TEXT = {
  checking: 'Checking OBD Bridge...',
  running: 'OBD Bridge Running',
  offline: 'OBD Bridge Not Running',
}

function SettingsPage() {
  const [status, setStatus] = useState('checking')
  const isMounted = useRef(true)

  // No setState before the first await: the initial useState('checking')
  // value already covers the "just mounted" case, so this effect-invoked
  // function only ever sets state from the async continuation, after
  // yielding back to the event loop -- never synchronously within the
  // effect itself.
  const checkBridge = useCallback(async () => {
    const available = await checkObdBridge()
    if (!isMounted.current) return
    setStatus(available ? 'running' : 'offline')
  }, [])

  useEffect(() => {
    isMounted.current = true
    checkBridge()
    return () => {
      isMounted.current = false
    }
  }, [checkBridge])

  const handleCheckAgain = () => {
    setStatus('checking')
    checkBridge()
  }

  return (
    <AppShell>
      <PageHeader title="Settings" />
      <section className="card">
        <h2 className="card-title">OBD-II Connection</h2>
        {/* GET /health only proves the Windows helper process is running on
            this computer -- it says nothing about the adapter, COM port,
            ignition state, or vehicle ECU, so those are always described
            as "checked when you sync," never as a confirmed connection. */}
        <div className="obd-connection-grid">
          <div className="obd-connection-col">
            <div className="obd-status-block">
              <span className="label">Bridge App</span>
              <span className={`obd-status-${status}`}>{STATUS_TEXT[status]}</span>
            </div>

            {status === 'offline' && (
              <p className="obd-hint">Launch Online Garage OBD Bridge, then click Check Again.</p>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-small obd-check-again-btn"
              onClick={handleCheckAgain}
              disabled={status === 'checking'}
            >
              {status === 'checking' ? 'Checking...' : 'Check Again'}
            </button>

            <details className="obd-tech-details">
              <summary>Technical Details</summary>
              <p>
                Bridge URL: <code>{BRIDGE_URL}</code>
              </p>
              <p>Windows helper installed separately -- launch OnlineGarageOBDBridge.exe on this computer.</p>
            </details>
          </div>

          <div className="obd-connection-col obd-connection-explain">
            <span className="label">Vehicle Connection</span>
            <p className="obd-vehicle-connection-text">
              Checked when you press Sync OBD Now -- the Bridge App status above only confirms the Windows helper
              is running on this computer. The adapter, COM port, ignition state, and vehicle ECU are all verified
              separately, each time you sync.
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">How to Connect</h2>
        <ol className="obd-setup-steps">
          <li>Connect the OBD-II adapter to the vehicle.</li>
          <li>Connect the USB cable to the Windows computer.</li>
          <li>Launch Online Garage OBD Bridge.</li>
          <li>Confirm this page says &quot;OBD Bridge Running&quot; above.</li>
          <li>Turn the vehicle ignition on. For live engine data, start the engine in a safe, ventilated location.</li>
          <li>Open the vehicle dashboard.</li>
          <li>Press &quot;Sync OBD Now&quot;.</li>
        </ol>
      </section>

      <section className="card">
        <h2 className="card-title">About OBD Sync</h2>
        <p className="profile-detail">
          Online Garage OBD Bridge is a small Windows helper that lets this website communicate with the USB
          OBD-II adapter attached to this computer.
        </p>
        <div className="obd-safety-note">
          <p>
            Park the vehicle before setup or testing. If the engine needs to run for live data, do so only in a
            safe, well-ventilated location. Supported data varies by vehicle -- values your vehicle doesn&apos;t
            report remain unavailable rather than simulated.
          </p>
        </div>
      </section>
    </AppShell>
  )
}

export default SettingsPage
