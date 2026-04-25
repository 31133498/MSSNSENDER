import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar.jsx'
import { StatusBadge } from '../components/Spinner.jsx'

const DISCONNECT_KEYWORDS = ['connection closed', 'disconnected', 'unauthorized', 'session', 'logout']
function isDisconnectError(msg) {
  if (!msg) return false
  const lower = msg.toLowerCase()
  return DISCONNECT_KEYWORDS.some(k => lower.includes(k))
}

export default function ReportScreen({ onNavigate, apiFetch, campaignId }) {
  const [report, setReport] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    apiFetch(`/api/campaigns/${campaignId}/report`)
      .then(r => r && r.ok && r.json().then(setReport))
      .catch(() => {})
  }, [campaignId])

  function formatDate(s) {
    if (!s) return '—'
    return new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function exportCSV() {
    if (!report) return
    const headers = ['Name', 'Phone', 'Status', 'Time Sent', 'Error']
    const rows = report.recipients.map(r => [
      r.name || '',
      r.phone,
      r.status,
      r.sent_at ? new Date(r.sent_at).toLocaleString() : '',
      r.error_message || ''
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `campaign-${campaignId}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const recipients = report?.recipients || []
  const filtered = recipients.filter(r =>
    filter === 'all' ? true : filter === 'delivered' ? r.status === 'sent' : r.status === 'failed'
  )
  const c = report?.campaign || {}

  return (
    <div className="screen">
      <Navbar onNavigate={onNavigate} />
      <div className="page-body">
        <div className="page-header">
          <button className="back-btn" onClick={() => onNavigate('dashboard')}>← Dashboard</button>
          <h1 className="page-title">Campaign Report</h1>
        </div>

        {report && (
          <div className="card summary-card-report">
            <div className="summary-row"><span>Date sent</span><strong>{formatDate(c.created_at)}</strong></div>
            <div className="summary-row"><span>Total recipients</span><strong>{c.total_recipients}</strong></div>
            <div className="summary-row"><span>Delivered</span><strong className="text-green">{c.sent_count}</strong></div>
            <div className="summary-row"><span>Failed</span><strong className="text-red">{c.failed_count}</strong></div>
          </div>
        )}

        <div className="card" style={{ marginTop: 20 }}>
          <div className="report-table-header">
            <div className="tab-row">
              {['all', 'delivered', 'failed'].map(f => (
                <button key={f} className={`tab-btn${filter === f ? ' tab-active' : ''}`}
                  onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button className="btn btn-outline btn-sm" onClick={exportCSV}>Export as CSV</button>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Status</th><th>Time Sent</th><th>Error</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="empty-state">No records.</td></tr>
                )}
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name || <span className="text-muted">—</span>}</td>
                    <td>{r.phone}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.sent_at ? formatDate(r.sent_at) : '—'}</td>
                    <td className="text-error">
                      {r.error_message
                        ? isDisconnectError(r.error_message)
                          ? 'WhatsApp disconnected during send'
                          : r.error_message
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
