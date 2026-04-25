import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar.jsx'

export default function ProgressScreen({ onNavigate, apiFetch, campaignId }) {
  const [progress, setProgress] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    function poll() {
      apiFetch(`/api/campaigns/${campaignId}/progress`)
        .then(r => r && r.ok && r.json().then(d => {
          setProgress(d)
          if (d.status === 'done') clearInterval(intervalRef.current)
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

  const pct = progress ? Math.min(100, Math.round(progress.percent)) : 0
  const minsLeft = progress ? Math.ceil((progress.pending * 4) / 60) : 0
  const isDone = progress?.status === 'done'

  return (
    <div className="screen">
      <Navbar onNavigate={onNavigate} />
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
