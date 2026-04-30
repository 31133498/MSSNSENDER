export default function ConfirmModal({ title, message, confirmText, onConfirm, onCancel, danger }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card confirm-card">
        <h3 className="modal-title">{title}</h3>
        <p className="modal-body">{message}</p>
        <div className="modal-actions modal-actions-row">
          <button onClick={onCancel} className="btn btn-outline">
            Cancel
          </button>
          <button onClick={onConfirm} className={danger ? 'btn btn-danger' : 'btn btn-primary'}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
