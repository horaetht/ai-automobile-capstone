function MaintenanceTable({ records }) {
  if (!records || records.length === 0) {
    return <p className="empty-state">No maintenance records yet. Add one below to get started.</p>
  }

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
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={`${record.Date}-${index}`}>
              <td>{record.Date}</td>
              <td>{record.Mileage} mi</td>
              <td>{record.Description}</td>
              <td>
                {record['Replaced Parts'] && record['Replaced Parts'] !== 'None'
                  ? record['Replaced Parts']
                  : '-'}
              </td>
              <td>{record.Notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default MaintenanceTable
