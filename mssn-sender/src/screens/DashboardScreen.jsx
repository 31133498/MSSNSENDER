import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar.jsx'
import { StatusBadge } from '../components/Spinner.jsx'

export default function DashboardScreen({ onNavigate, apiFetch, isConnected, setIsConnected }) {
  const [stats, setStats] = useState({ contacts: 0, campaigns: 0, delivered: 0, failed: 0 })
  const [campaigns, setCampaigns] = useState([])
  const user = JSON.parse(localStorage.getItem('mssn_user') || '{}')
  const instance = localStorage.getItem('mssn_instance') || ''

  function checkConnection() {
    if (!instance) return
    apiFetch(`/api/instance/status?instance=${encodeURIComponent(instance)}`)
      .then(r => r && r.json())
      .then(data => {
        const state = data?.instance?.state || data?.state
        setIsConnected(state === 'open')
      })
      .catch(() => setIsConnected(false))
  }

  useEffect(() => {
    apiFetch('/api/stats').then(r => r && r.ok && r.json().then(d => setStats(d))).catch(() => {})
    apiFetch('/api/campaigns').then(r => r && r.ok && r.json().then(d => setCampaigns(d))).catch(() => {})
    // Check connection on mount if not already known
    if (isConnected === null) checkConnection()
    // Poll every 30 seconds
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [])

  function formatDate(s) {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="screen">
      <Navbar onNavigate={onNavigate} apiFetch={apiFetch} isConnected={isConnected} />
      <div className="page-body">

        {/* Disconnection warning banner */}
        {isConnected === false && (
          <div className="disconnect-banner">
            <span>⚠️ Your WhatsApp is disconnected. You cannot send messages until you reconnect.</span>
            <button className="btn btn-sm btn-primary" onClick={() => onNavigate('reconnect')}>
              Reconnect Now →
            </button>
          </div>
        )}

        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-sub">{user.branch || user.email || ''}</p>
          </div>
        </div>

        <div className="stats-grid">
          {[
            { label: 'Total Contacts', value: stats.contacts ?? 0, color: 'green' },
            { label: 'Campaigns Sent', value: stats.campaigns ?? 0, color: 'green' },
            { label: 'Messages Delivered', value: stats.delivered ?? 0, color: 'green' },
            { label: 'Messages Failed', value: stats.failed ?? 0, color: 'red' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <span className="stat-label">{s.label}</span>
              <span className={`stat-value stat-${s.color}`}>{s.value.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="action-row">
          <button className="btn btn-outline btn-lg" onClick={() => onNavigate('contacts')}>
            Manage Contacts
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => onNavigate('campaign')}>
            New Campaign
          </button>
        </div>

        <div className="section">
          <h2 className="section-title">Recent Campaigns</h2>
          {campaigns.length === 0 ? (
            <p className="empty-state">No campaigns yet. Create your first campaign above.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Recipients</th>
                    <th>Sent</th>
                    <th>Failed</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 10).map(c => (
                    <tr key={c.id}>
                      <td>{formatDate(c.created_at)}</td>
                      <td>{c.total_recipients}</td>
                      <td>{c.sent_count}</td>
                      <td>{c.failed_count}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        <button className="link-btn green"
                          onClick={() => onNavigate('report', { campaignId: c.id })}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
