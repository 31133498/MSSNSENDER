import { useState, useEffect } from 'react'
import LoginScreen from './screens/LoginScreen.jsx'
import SetupScreen from './screens/SetupScreen.jsx'
import DashboardScreen from './screens/DashboardScreen.jsx'
import ContactsScreen from './screens/ContactsScreen.jsx'
import CampaignScreen from './screens/CampaignScreen.jsx'
import ProgressScreen from './screens/ProgressScreen.jsx'
import ReportScreen from './screens/ReportScreen.jsx'
import LandingScreen from './screens/LandingScreen.jsx'

import { apiFetch, API_BASE } from './api.js'

export default function App() {
  const [screen, setScreen] = useState('loading')
  const [screenParams, setScreenParams] = useState({})
  const [isConnected, setIsConnected] = useState(null) // null=checking, true=open, false=closed

  function navigate(name, params = {}) {
    setScreenParams(params)
    // When navigating to dashboard, reset connection state so it re-checks
    if (name === 'dashboard') setIsConnected(null)
    setScreen(name)
  }

  useEffect(() => {
    setScreen('landing')
  }, [])

  if (screen === 'loading') {
    return (
      <div className="fullscreen-center">
        <span className="spinner spinner-lg" />
      </div>
    )
  }

  const props = { onNavigate: navigate, apiFetch }

  if (screen === 'landing') return <LandingScreen onNavigate={navigate} />
  if (screen === 'login') return <LoginScreen {...props} screenParams={screenParams} />
  if (screen === 'setup') return <SetupScreen {...props} isReconnect={false} />
  if (screen === 'reconnect') return <SetupScreen {...props} isReconnect={true} />
  if (screen === 'dashboard') return <DashboardScreen {...props} isConnected={isConnected} setIsConnected={setIsConnected} />
  if (screen === 'contacts') return <ContactsScreen {...props} screenParams={screenParams} />
  if (screen === 'campaign') return <CampaignScreen {...props} screenParams={screenParams} />
  if (screen === 'progress') return <ProgressScreen {...props} campaignId={screenParams.campaignId} />
  if (screen === 'report') return <ReportScreen {...props} campaignId={screenParams.campaignId} />
  return null
}
