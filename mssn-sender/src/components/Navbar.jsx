const STORAGE_INSTANCE = 'mssn_instance'
const STORAGE_USER = 'mssn_user'
const STORAGE_TOKEN = 'mssn_token'

export default function Navbar({ onNavigate, apiFetch, isConnected }) {
  const instance = localStorage.getItem(STORAGE_INSTANCE) || ''
  const user = JSON.parse(localStorage.getItem(STORAGE_USER) || '{}')

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
        {isConnected === false ? (
          <>
            <span className="dot-red" />
            <span className="navbar-disconnected">Disconnected</span>
            <button className="btn-reconnect" onClick={() => onNavigate('reconnect')}>
              Reconnect
            </button>
          </>
        ) : (
          <>
            <span className="dot-green" />
            <span className="navbar-instance">{isConnected === null ? 'Checking...' : 'Connected'}</span>
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
