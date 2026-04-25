import { useState, useEffect } from 'react'

const INSTANCE = 'Shazily'
const MAX_RECENT = 5

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Spinner() {
  return <span className="spinner" />
}

export default function App() {
  const [screen, setScreen] = useState('loading') // 'loading' | 'send' | 'error'
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [sendState, setSendState] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const [sendError, setSendError] = useState('')
  const [recentSends, setRecentSends] = useState([])

  async function checkConnection() {
    setScreen('loading')
    try {
      const res = await fetch(`/api/status?instance=${INSTANCE}`)
      const data = await res.json()
      if (data?.instance?.state === 'open') {
        setScreen('send')
      } else {
        setScreen('error')
      }
    } catch {
      setScreen('error')
    }
  }

  useEffect(() => { checkConnection() }, [])

  async function handleSend() {
    if (!phone.trim() || !message.trim()) return
    setSendState('loading')
    setSendError('')
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: INSTANCE, phone: phone.trim(), message: message.trim() })
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.detail || `Error ${res.status}`)
      }
      setSendState('success')
      setRecentSends(prev => [
        { phone: phone.trim(), message: message.trim(), ts: Date.now(), status: 'sent' },
        ...prev
      ].slice(0, MAX_RECENT))
      setPhone('')
      setMessage('')
      setTimeout(() => setSendState('idle'), 2000)
    } catch (e) {
      setSendState('error')
      setSendError(e.message || 'Failed to send message.')
      setRecentSends(prev => [
        { phone: phone.trim(), message: message.trim(), ts: Date.now(), status: 'failed' },
        ...prev
      ].slice(0, MAX_RECENT))
    }
  }

  if (screen === 'loading') {
    return (
      <div className="fullscreen-center">
        <span className="pulse-dot" />
        <span className="loading-text">Checking connection...</span>
      </div>
    )
  }

  if (screen === 'error') {
    return (
      <div className="fullscreen-center">
        <span className="error-dot" />
        <p className="error-screen-text">
          {INSTANCE} is disconnected.<br />
          Please reconnect it in the Evolution API manager.
        </p>
        <button className="btn btn-ghost" onClick={checkConnection}>Retry</button>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <div className="header-left">
          <span className="dot-green" />
          <span className="header-instance">{INSTANCE} · Connected</span>
        </div>
        <span className="header-number">2347084708292</span>
      </header>

      <main className="center">
        <div className="card">
          <div className="field-group">
            <label className="field-label" htmlFor="phone">Recipient</label>
            <input
              id="phone"
              className="input"
              type="text"
              placeholder="2349169245478"
              value={phone}
              onChange={e => { setPhone(e.target.value); setSendState('idle') }}
            />
            <span className="field-hint">International format · 234 + number, no leading zero, no +</span>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="message">Message</label>
            <div className="textarea-wrap">
              <textarea
                id="message"
                className="textarea"
                placeholder="Type your message..."
                value={message}
                onChange={e => { setMessage(e.target.value); setSendState('idle') }}
                rows={5}
              />
              <span className="char-count">{message.length}</span>
            </div>
          </div>

          <button
            className={`btn btn-primary${sendState === 'success' ? ' btn-success' : ''}`}
            onClick={handleSend}
            disabled={sendState === 'loading' || !phone.trim() || !message.trim()}
          >
            {sendState === 'loading' && <><Spinner /> Sending...</>}
            {sendState === 'success' && <>✓ Sent!</>}
            {(sendState === 'idle' || sendState === 'error') && 'Send Message'}
          </button>

          {sendState === 'error' && (
            <p className="send-error">✕ {sendError}</p>
          )}
        </div>

        <div className="card recent-card">
          <h3 className="recent-title">Recent Sends</h3>
          {recentSends.length === 0 ? (
            <p className="recent-empty">No messages sent yet this session</p>
          ) : (
            <ul className="recent-list">
              {recentSends.map((s, i) => (
                <li key={i} className="recent-item">
                  <span className="recent-phone">{s.phone}</span>
                  <span className="recent-msg">
                    {s.message.length > 40 ? s.message.slice(0, 40) + '…' : s.message}
                  </span>
                  <span className="recent-time">{formatTime(s.ts)}</span>
                  <span className={`badge badge-${s.status}`}>
                    {s.status === 'sent' ? 'Sent' : 'Failed'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
