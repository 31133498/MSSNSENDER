import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar.jsx'
import { Spinner } from '../components/Spinner.jsx'
import { API_BASE } from '../api.js'

const PAGE_SIZE = 50

export default function ContactsScreen({ onNavigate, apiFetch }) {
  const [tab, setTab] = useState('csv')
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const [csvFile, setCsvFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualGroup, setManualGroup] = useState('')
  const [manualSuccess, setManualSuccess] = useState(false)
  const [rejectedOpen, setRejectedOpen] = useState(false)
  const fileRef = useRef()

  const [waLoading, setWaLoading] = useState(false)
  const [waResult, setWaResult] = useState(null) // { total, inserted } or { error }

  async function handleWaSync() {
    setWaLoading(true)
    setWaResult(null)
    try {
      const res = await apiFetch('/api/contacts/whatsapp-contacts')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setWaResult({ total: data.total, message: `${data.total} contacts synced from WhatsApp` })
      loadContacts()
    } catch (e) {
      setWaResult({ error: e.message })
    } finally {
      setWaLoading(false)
    }
  }

  async function loadContacts() {
    const res = await apiFetch('/api/contacts')
    if (res && res.ok) setContacts(await res.json())
  }

  useEffect(() => { loadContacts() }, [])

  async function handleCSVUpload() {
    if (!csvFile) return
    setLoading(true); setResult(null)
    const form = new FormData()
    form.append('file', csvFile)
    const token = localStorage.getItem('mssn_token')
    const res = await fetch(API_BASE + '/api/contacts/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    })
    const data = await res.json()
    setResult(data); setCsvFile(null)
    setLoading(false); loadContacts()
  }

  async function handlePaste() {
    if (!pasteText.trim()) return
    setLoading(true); setResult(null)
    const res = await apiFetch('/api/contacts/paste', {
      method: 'POST',
      body: JSON.stringify({ text: pasteText })
    })
    const data = await res.json()
    setResult(data); setPasteText('')
    setLoading(false); loadContacts()
  }

  async function handleManual(e) {
    e.preventDefault()
    if (!manualPhone.trim()) return
    setLoading(true)
    const res = await apiFetch('/api/contacts/paste', {
      method: 'POST',
      body: JSON.stringify({ text: manualPhone.trim() })
    })
    if (res && res.ok) {
      setManualName(''); setManualPhone(''); setManualGroup('')
      setManualSuccess(true)
      setTimeout(() => setManualSuccess(false), 2500)
      loadContacts()
    }
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this contact?')) return
    await apiFetch(`/api/contacts/${id}`, { method: 'DELETE' })
    loadContacts()
  }

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    return !q || (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) || (c.group_name || '').toLowerCase().includes(q)
  })
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function formatDate(s) {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="screen">
      <Navbar onNavigate={onNavigate} />
      <div className="page-body">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="back-btn" onClick={() => onNavigate('dashboard')}>← Back</button>
            <h1 className="page-title">Contacts</h1>
            <span className="count-badge">{contacts.length}</span>
          </div>
        </div>

        <div className="card">
          <div className="tab-row">
            {['csv', 'paste', 'manual', 'whatsapp'].map(t => (
              <button key={t} className={`tab-btn${tab === t ? ' tab-active' : ''}`}
                onClick={() => { setTab(t); setResult(null); setWaResult(null) }}>
                {t === 'csv' ? 'Upload CSV' : t === 'paste' ? 'Paste Numbers' : t === 'manual' ? 'Manual Entry' : '📱 WhatsApp'}
              </button>
            ))}
          </div>

          {tab === 'csv' && (
            <div className="tab-content">
              <div className="upload-zone" onClick={() => fileRef.current.click()}>
                <div className="upload-icon">↑</div>
                <p className="upload-text">Drop your CSV file here or click to browse</p>
                <p className="upload-sub">Required column: phone · Optional: name, group</p>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => setCsvFile(e.target.files[0])} />
              </div>
              {csvFile && (
                <div className="file-selected">
                  <span>{csvFile.name}</span>
                  <button className="btn btn-primary" onClick={handleCSVUpload} disabled={loading}>
                    {loading ? <Spinner /> : 'Upload'}
                  </button>
                </div>
              )}
              {result && <UploadResult result={result} open={rejectedOpen} setOpen={setRejectedOpen} />}
            </div>
          )}

          {tab === 'paste' && (
            <div className="tab-content">
              <textarea className="textarea" rows={6} value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={`Paste phone numbers here — one per line, or comma separated.\nExample:\n08012345678\n08098765432, 07011223344\n+2348055667788`} />
              <p className="field-hint">Numbers are automatically converted to international format (234XXXXXXXXXX)</p>
              <button className="btn btn-primary" onClick={handlePaste} disabled={loading || !pasteText.trim()}>
                {loading ? <Spinner /> : 'Add Numbers'}
              </button>
              {result && <UploadResult result={result} open={rejectedOpen} setOpen={setRejectedOpen} />}
            </div>
          )}

          {tab === 'whatsapp' && (
            <div className="tab-content">
              <p className="setup-desc" style={{ marginBottom: 16 }}>
                Import all contacts from your connected WhatsApp account directly into your contacts list.
                Already saved contacts will not be duplicated.
              </p>
              <button className="btn btn-primary" onClick={handleWaSync} disabled={waLoading}>
                {waLoading ? <><Spinner /> Syncing...</> : '📱 Sync WhatsApp Contacts'}
              </button>
              {waResult && !waResult.error && (
                <div className="result-banner result-success" style={{ marginTop: 14 }}>
                  ✓ {waResult.message}
                </div>
              )}
              {waResult && waResult.error && (
                <div className="result-banner result-warn" style={{ marginTop: 14 }}>
                  ✕ {waResult.error}
                </div>
              )}
            </div>
          )}

          {tab === 'manual' && (
            <div className="tab-content">
              <form onSubmit={handleManual} className="manual-form">
                <input className="input" placeholder="Member name (optional)" value={manualName}
                  onChange={e => setManualName(e.target.value)} />
                <input className="input" placeholder="08012345678 or 2348012345678" required
                  value={manualPhone} onChange={e => setManualPhone(e.target.value)} />
                <input className="input" placeholder="e.g. Sisters, Brothers, Exco" value={manualGroup}
                  onChange={e => setManualGroup(e.target.value)} />
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? <Spinner /> : 'Add Contact'}
                </button>
                {manualSuccess && <p className="inline-success">Contact added ✓</p>}
              </form>
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <input className="input search-input" placeholder="Search by name, phone or group…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />

          {paged.length === 0 ? (
            <p className="empty-state">No contacts yet. Upload a CSV or paste numbers above.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Phone</th><th>Group</th><th>Added</th><th></th></tr>
                  </thead>
                  <tbody>
                    {paged.map(c => (
                      <tr key={c.id}>
                        <td>{c.name || <span className="text-muted">—</span>}</td>
                        <td>{c.phone}</td>
                        <td>{c.group_name ? <span className="group-badge">{c.group_name}</span> : '—'}</td>
                        <td>{formatDate(c.created_at)}</td>
                        <td>
                          <button className="btn-delete" onClick={() => handleDelete(c.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} className={`page-btn${page === i + 1 ? ' page-active' : ''}`}
                      onClick={() => setPage(i + 1)}>{i + 1}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function UploadResult({ result, open, setOpen }) {
  if (!result) return null
  const { inserted = 0, rejected = [] } = result
  const type = rejected.length === 0 ? 'success' : 'warn'
  return (
    <div className={`result-banner result-${type}`}>
      <span>
        {inserted} contact{inserted !== 1 ? 's' : ''} added successfully
        {rejected.length > 0 && ` · ${rejected.length} rejected`}
      </span>
      {rejected.length > 0 && (
        <>
          <button className="link-btn" onClick={() => setOpen(o => !o)}>
            {open ? 'Hide' : 'Show'} rejected
          </button>
          {open && (
            <ul className="rejected-list">
              {rejected.map((r, i) => (
                <li key={i}><code>{r.row || r.raw}</code> — {r.reason}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
