import { useState } from 'react'
import { Spinner } from '../components/Spinner.jsx'

const STORAGE_TOKEN = 'mssn_token'
const STORAGE_USER = 'mssn_user'
const STORAGE_INSTANCE = 'mssn_instance'

export default function LoginScreen({ onNavigate, apiFetch }) {
  const [tab, setTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [regBranch, setRegBranch] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  async function checkInstanceAndNavigate() {
    // Small delay to ensure localStorage is readable by apiFetch
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const instanceRes = await apiFetch('/api/instance/mine')
      if (!instanceRes || !instanceRes.ok) { onNavigate('setup'); return }
      const instanceData = await instanceRes.json()
      if (instanceData && instanceData.instance_name) {
        localStorage.setItem(STORAGE_INSTANCE, instanceData.instance_name)
        onNavigate('dashboard')
      } else {
        onNavigate('setup')
      }
    } catch {
      onNavigate('setup')
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      localStorage.setItem(STORAGE_TOKEN, data.token)
      localStorage.setItem(STORAGE_USER, JSON.stringify({ email: loginEmail, user_id: data.user_id }))
      await checkInstanceAndNavigate()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (regPassword.length < 8) return setError('Password must be at least 8 characters')
    if (regPassword !== regConfirm) return setError('Passwords do not match')
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: regEmail, password: regPassword, branch_name: regBranch })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Registration failed')
      localStorage.setItem(STORAGE_TOKEN, data.token)
      localStorage.setItem(STORAGE_USER, JSON.stringify({ email: regEmail, branch: regBranch, user_id: data.user_id }))
      // New users never have an instance yet
      onNavigate('setup')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="crescent-wrap">
          <div className="crescent" />
        </div>
        <h1 className="login-brand">MSSN Sender</h1>
        <p className="login-sub">Official WhatsApp Broadcast Tool</p>
        <p className="login-org">Muslim Students' Society of Nigeria</p>
      </div>

      <div className="login-right">
        <div className="login-form-wrap">
          <div className="tab-row">
            <button
              className={`tab-btn${tab === 'login' ? ' tab-active' : ''}`}
              onClick={() => { setTab('login'); setError('') }}
            >Sign In</button>
            <button
              className={`tab-btn${tab === 'register' ? ' tab-active' : ''}`}
              onClick={() => { setTab('register'); setError('') }}
            >Create Account</button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="auth-form">
              <label className="field-label">Email</label>
              <input className="input" type="email" required value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)} placeholder="admin@mssn-unilag.com" />
              <label className="field-label">Password</label>
              <input className="input" type="password" required value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" />
              {error && <p className="form-error">{error}</p>}
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading ? <Spinner /> : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="auth-form">
              <label className="field-label">Branch Name</label>
              <input className="input" type="text" required value={regBranch}
                onChange={e => setRegBranch(e.target.value)} placeholder="e.g. MSSN Unilag" />
              <label className="field-label">Email</label>
              <input className="input" type="email" required value={regEmail}
                onChange={e => setRegEmail(e.target.value)} placeholder="admin@mssn-unilag.com" />
              <label className="field-label">Password</label>
              <input className="input" type="password" required value={regPassword}
                onChange={e => setRegPassword(e.target.value)} placeholder="Min 8 characters" />
              <label className="field-label">Confirm Password</label>
              <input className="input" type="password" required value={regConfirm}
                onChange={e => setRegConfirm(e.target.value)} placeholder="Repeat password" />
              {error && <p className="form-error">{error}</p>}
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading ? <Spinner /> : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
