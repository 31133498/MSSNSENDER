import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar.jsx'

const DISCONNECT_KEYWORDS = ['connection closed', 'disconnected', 'unauthorized', 'session', 'logout']

function isDisconnectError(msg) {
  if (!msg) return false
  const lower = msg.toLowerCase()
  return DISCONNECT_KEYWORDS.some(k => lower.includes(k))
}

export default function ProgressScreen({ onNavigate, apiFetch, campaignId }) {
  const [progress, setProgress] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const intervalRef = useRef(null)
  const disconnectChecked = useRef(false)

  async function checkForDisconnect(failedCount) {
    if (disconnectChecked.current || failedCount === 0) return
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}/report`)
      if (!res || !res.ok) return
      const data = await res.json()
      const hasDisconnect = (data.recipients || []).some(r => isDisconnectError(r.error_message))
      if (hasDisconnect) {
        disconnectChecked.current = true
        setShowModal(true)
        clearInterval(intervalRef.current)
      }
    } catch {}
  }

  useEffect(() => {
    function poll() {
      apiFetch(`/api/campaigns/${campaignId}/progress`)
        .then(r => r && r.ok && r.json().then(d => {
          setProgress(d)
          if (d.status === 'done') {
            clearInterval(intervalRef.current)
          } else if (d.failed > 0) {
            checkForDisconnect(d.failed)
          }
        }))
        .catch(() => {})
    }
    poll()
    intervalRef.current = setInterval(poll, 3000)
    return () => clearInterval(intervalRef.current)
  }, [campaignId])

  useEffect(() => {
    function beforeUnload(e) {
      if (progress?.status === 'running') {
        e.preventDefault()
        e.returnValue = 'Sending is in progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [progress?.status])

  function handleReconnect() {
    localStorage.removeItem('mssn_instance')
    onNavigate('reconnect')
  }

  const pct = progress ? Math.min(100, Math.round(progress.percent)) : 0
  const minsLeft = progress ? Math.ceil((progress.pending * 4) / 60) : 0
  const isDone = progress?.status === 'done'

  return (
    <div className="screen">
      <Navbar onNavigate={onNavigate} apiFetch={apiFetch} />

      {/* Disconnect modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">📵</div>
            <h2 className="modal-title">WhatsApp Disconnected</h2>
            <p className="modal-body">
              Your WhatsApp session has ended. Sending has been paused.<br /><br />
              Please reconnect your account and restart this campaign.
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary btn-full" onClick={handleReconnect}>
                Reconnect WhatsApp
              </button>
              <button className="btn btn-outline btn-full" onClick={() => setShowModal(false)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-body progress-page">
        <div className="progress-card">
          {!isDone ? (
            <>
              <h1 className="progress-title">Campaign in Progress</h1>
              <p className="progress-sub">Do not close this tab</p>
            </>
          ) : (
            <>
              <div className="checkmark">✓</div>
              <h1 className="progress-title">Campaign Complete!</h1>
              <p className="progress-sub">
                {progress.sent} message{progress.sent !== 1 ? 's' : ''} delivered · {progress.failed} failed
              </p>
            </>
          )}

          <div className="progress-bar-wrap">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${isDone ? 100 : pct}%` }} />
              <span className="progress-pct">{isDone ? 100 : pct}%</span>
            </div>
          </div>

          {progress && !isDone && (
            <p className="progress-stats">
              Sent: {progress.sent} · Failed: {progress.failed} · Remaining: {progress.pending}
              {minsLeft > 0 && ` · ~${minsLeft} min${minsLeft !== 1 ? 's' : ''} left`}
            </p>
          )}

          {isDone && (
            <button className="btn btn-primary btn-lg"
              onClick={() => onNavigate('report', { campaignId })}>
              View Full Report
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
