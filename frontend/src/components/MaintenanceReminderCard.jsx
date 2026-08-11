import { Link } from 'react-router-dom'
import { getReminderStatusLabel, REMINDER_STATUS } from '../utils/maintenanceReminderEngine'

function MaintenanceReminderCard({ reminder, vehicleId }) {
  const hasDetailLines = reminder.detailLines && reminder.detailLines.length > 0

  return (
    <div className={`reminder-card reminder-status-${reminder.status}`}>
      <div className="reminder-card-header">
        <span className="reminder-status-badge">{getReminderStatusLabel(reminder.status)}</span>
        <h3 className="reminder-card-title">{reminder.label}</h3>
      </div>
      <div className="reminder-card-body">
        {hasDetailLines ? (
          reminder.detailLines.map((line) => (
            <p className="reminder-detail-line" key={line}>
              {line}
            </p>
          ))
        ) : (
          <p className="reminder-detail-line reminder-message">{reminder.message}</p>
        )}
      </div>
      <Link to={`/vehicles/${vehicleId}/maintenance`} className="btn btn-secondary btn-small reminder-card-link">
        {reminder.status === REMINDER_STATUS.NO_HISTORY ? 'Log Service' : 'View Maintenance Log'}
      </Link>
    </div>
  )
}

export default MaintenanceReminderCard
