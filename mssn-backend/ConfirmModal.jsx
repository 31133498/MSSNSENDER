import React from 'react';

export default function ConfirmModal({ title, message, confirmText, onConfirm, onCancel, danger }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button onClick={onCancel} className="btn-outline">
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className={danger ? 'btn-danger' : 'btn-primary'}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}