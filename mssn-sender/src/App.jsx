import { useState, useEffect } from 'react'
import LoginScreen from './screens/LoginScreen.jsx'
import SetupScreen from './screens/SetupScreen.jsx'
import DashboardScreen from './screens/DashboardScreen.jsx'
import ContactsScreen from './screens/ContactsScreen.jsx'
import CampaignScreen from './screens/CampaignScreen.jsx'
import ProgressScreen from './screens/ProgressScreen.jsx'
import ReportScreen from './screens/ReportScreen.jsx'

const STORAGE_TOKEN = 'mssn_token'
const STORAGE_INSTANCE = 'mssn_instance'
const STORAGE_USER = 'mssn_user'
const API_BASE = 'https://api.zaicondigital.com'

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(STORAGE_TOKEN)
  const isFormData = options.body instanceof FormData
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })
  if (res.status === 401 && !path.includes('/api/auth/')) {
    localStorage.clear()
    window.location.reload()
    return
  }
  return res
}

export default function App() {
  const [screen, setScreen] = useState('loading')
  const [screenParams, setScreenParams] = useState({})

  function navigate(name, params = {}) {
    setScreenParams(params)
    setScreen(name)
  }

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN)
    if (!token) { setScreen('login'); return }

    apiFetch('/api/instance/mine')
      .then(r => { if (!r) return; return r.json() })
      .then(async data => {
        if (!data || !data.instance_name) {
          setScreen('setup'); return
        }
        localStorage.setItem(STORAGE_INSTANCE, data.instance_name)
        try {
          const statusRes = await apiFetch(`/api/instance/status?instance=${encodeURIComponent(data.instance_name)}`)
          const statusData = await statusRes.json()
          const state = statusData?.instance?.state || statusData?.state
          if (state === 'open') {
            setScreen('dashboard')
          } else {
            setScreen('reconnect')
          }
        } catch {
          setScreen('dashboard')
        }
      })
      .catch(() => setScreen('login'))
  }, [])

  if (screen === 'loading') {
    return (
      <div className="fullscreen-center">
        <span className="spinner spinner-lg" />
      </div>
    )
  }

  const props = { onNavigate: navigate, apiFetch }

  if (screen === 'login') return <LoginScreen {...props} />
  if (screen === 'setup') return <SetupScreen {...props} isReconnect={false} />
  if (screen === 'reconnect') return <SetupScreen {...props} isReconnect={true} />
  if (screen === 'dashboard') return <DashboardScreen {...props} />
  if (screen === 'contacts') return <ContactsScreen {...props} />
  if (screen === 'campaign') return <CampaignScreen {...props} />
  if (screen === 'progress') return <ProgressScreen {...props} campaignId={screenParams.campaignId} />
  if (screen === 'report') return <ReportScreen {...props} campaignId={screenParams.campaignId} />
  return null
}
