import { useState, useEffect } from 'react'

const STORAGE_INSTANCE = 'mssn_instance'
const STORAGE_USER = 'mssn_user'
const STORAGE_TOKEN = 'mssn_token'

export default function Navbar({ onNavigate, apiFetch }) {
  const instance = localStorage.getItem(STORAGE_INSTANCE) || ''
  const user = JSON.parse(localStorage.getItem(STORAGE_USER) || '{}')
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    if (!instance || !apiFetch) return
    apiFetch(`/api/instance/status?instance=${encodeURIComponent(instance)}`)
      .then(r => r && r.json())
      .then(data => {
        const state = data?.instance?.state || data?.state
        setConnected(state === 'open')
      })
      .catch(() => {})
  }, [instance])

  function signOut() {
    localStorage.removeItem(STORAGE_TOKEN)
    localStorage.removeItem(STORAGE_INSTANCE)
    localStorage.removeItem(STORAGE_USER)
    window.location.reload()
  }

  return (
    <nav className="navbar">
      <span className="navbar-brand" onClick={() => onNavigate('dashboard')}>MSSN Sender</span>

      <div className="navbar-center">
        {connected ? (
          <>
            <span className="dot-green" />
            <span className="navbar-instance">Connected</span>
          </>
        ) : (
          <>
            <span className="dot-red" />
            <span className="navbar-disconnected">Disconnected</span>
            <button className="btn-reconnect" onClick={() => onNavigate('reconnect')}>
              Reconnect
            </button>
          </>
        )}
      </div>

      <div className="navbar-right">
        <span className="navbar-email">{user.email}</span>
        <button className="link-btn" onClick={signOut}>Sign Out</button>
      </div>
    </nav>
  )
}
