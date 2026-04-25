export function Spinner() {
  return <span className="spinner" />
}

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {status === 'done' ? 'Done' : status === 'running' ? (
        <><span className="pulse-dot-sm" />Sending</>
      ) : status === 'draft' ? 'Draft' : status === 'sent' ? 'Delivered' :
        status === 'failed' ? 'Failed' : status === 'pending' ? 'Pending' : status}
    </span>
  )
}
