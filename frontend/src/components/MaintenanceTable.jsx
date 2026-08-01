function MaintenanceTable({ records, onEdit, onDelete, editingRecordId, deletingRecordId, submitting }) {
  if (!records || records.length === 0) {
    return <p className="empty-state">No maintenance records yet. Add one below to get started.</p>
  }

  const actionsDisabled = submitting || deletingRecordId !== null

  return (
    <div className="table-wrapper">
      <table className="maintenance-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Mileage</th>
            <th>Service</th>
            <th>Parts Replaced</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const isEditing = editingRecordId === record.id
            const isDeleting = deletingRecordId === record.id

            return (
              <tr key={record.id} className={isEditing ? 'is-editing' : ''}>
                <td>{record.service_date}</td>
                <td>{Number(record.mileage).toLocaleString()} mi</td>
                <td>{record.description}</td>
                <td>{record.replaced_parts || '-'}</td>
                <td>{record.notes || '-'}</td>
                <td>
                  <div className="maintenance-table-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => onEdit(record)}
                      disabled={actionsDisabled || isEditing}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      onClick={() => onDelete(record)}
                      disabled={actionsDisabled}
                      aria-busy={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default MaintenanceTable
