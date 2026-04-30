import { useState, useEffect, useRef, useMemo } from 'react'
import Navbar from '../components/Navbar.jsx'
import { Spinner } from '../components/Spinner.jsx'

const STORAGE_INSTANCE = 'mssn_instance'

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length === 13) return digits
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1)
  if (digits.length === 10) return '234' + digits
  return null
}

function parseNumbers(text) {
  return text.split(/[\n,]+/).map(t => t.trim()).filter(Boolean)
}

function personalizePreview(template, recipient) {
  if (!recipient) return template
  let msg = template
  msg = msg.replace(/\{\{name\}\}/g, recipient.name || 'member')
  const cf = recipient.custom_fields || {}
  Object.entries(cf).forEach(([k, v]) => {
    if (v) msg = msg.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
  })
  return msg
}

export default function CampaignScreen({ onNavigate, apiFetch, screenParams = {} }) {
  const instance = localStorage.getItem(STORAGE_INSTANCE) || ''

  // recipients: Map phone → { phone, name, custom_fields }
  const [recipients, setRecipients] = useState(new Map())

  // Paste tab
  const [pasteText, setPasteText] = useState('')
  const [parsedPaste, setParsedPaste] = useState([])

  // Contacts tab
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [contactSearch, setContactSearch] = useState('')
  const [contactGroup, setContactGroup] = useState('')
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsPage, setContactsPage] = useState(1)
  const [contactsTotal, setContactsTotal] = useState(0)

  // WhatsApp tab
  const [waContacts, setWaContacts] = useState([])
  const [waSearch, setWaSearch] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [waError, setWaError] = useState('')

  // Message
  const [message, setMessage] = useState('')
  const textareaRef = useRef()

  // Preview cycling
  const [previewIndex, setPreviewIndex] = useState(0)

  // Send
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  // Tab
  const [tab, setTab] = useState('paste')

  // Pre-selected group from dashboard shortcut
  const preselectedGroup = screenParams?.group || null
  const preselectedGroupName = screenParams?.groupName || null

  useEffect(() => {
    // Load groups for dropdown
    apiFetch('/api/contacts/groups')
      .then(r => r && r.ok && r.json().then(d => setGroups(d.groups || [])))
      .catch(() => {})

    // If coming from group shortcut, pre-load that group
    if (preselectedGroup) {
      setContactGroup(preselectedGroup)
      setTab('contacts')
    }
  }, [])

  useEffect(() => {
    loadContacts()
  }, [contactGroup, contactSearch, contactsPage])

  async function loadContacts() {
    setContactsLoading(true)
    try {
      const params = new URLSearchParams({ page: contactsPage, per_page: 50 })
      if (contactGroup) params.set('group', contactGroup)
      if (contactSearch) params.set('search', contactSearch)
      const res = await apiFetch(`/api/contacts?${params}`)
      if (res && res.ok) {
        const data = await res.json()
        // Handle both paginated and legacy array response
        if (Array.isArray(data)) {
          setContacts(data)
          setContactsTotal(data.length)
        } else {
          setContacts(data.contacts || [])
          setContactsTotal(data.total || 0)
        }
      }
    } catch {}
    finally { setContactsLoading(false) }
  }

  // Parse paste live
  useEffect(() => {
    if (!pasteText.trim()) { setParsedPaste([]); return }
    setParsedPaste(parseNumbers(pasteText).map(raw => {
      const phone = formatPhone(raw)
      return { raw, phone, valid: !!phone }
    }))
  }, [pasteText])

  function addPastedNumbers() {
    const valid = parsedPaste.filter(p => p.valid)
    if (!valid.length) return
    setRecipients(prev => {
      const next = new Map(prev)
      valid.forEach(p => next.set(p.phone, { phone: p.phone, name: null, custom_fields: {} }))
      return next
    })
    setPasteText('')
    setParsedPaste([])
  }

  function toggleContact(c) {
    setRecipients(prev => {
      const next = new Map(prev)
      if (next.has(c.phone)) next.delete(c.phone)
      else next.set(c.phone, { phone: c.phone, name: c.name || null, custom_fields: c.custom_fields || {} })
      return next
    })
  }

  function selectAllContacts() {
    setRecipients(prev => {
      const next = new Map(prev)
      contacts.forEach(c => next.set(c.phone, { phone: c.phone, name: c.name || null, custom_fields: c.custom_fields || {} }))
      return next
    })
  }

  function deselectAllContacts() {
    setRecipients(prev => {
      const next = new Map(prev)
      contacts.forEach(c => next.delete(c.phone))
      return next
    })
  }

  function toggleWaContact(c) {
    setRecipients(prev => {
      const next = new Map(prev)
      if (next.has(c.phone)) next.delete(c.phone)
      else next.set(c.phone, { phone: c.phone, name: c.name || null, custom_fields: {} })
      return next
    })
  }

  function removeRecipient(phone) {
    setRecipients(prev => { const next = new Map(prev); next.delete(phone); return next })
  }

  async function loadWaContacts() {
    setWaLoading(true); setWaError('')
    try {
      const res = await apiFetch('/api/contacts/whatsapp-contacts')
      if (!res || !res.ok) throw new Error('Failed to load')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setWaContacts(data.contacts || [])
    } catch (e) { setWaError(e.message) }
    finally { setWaLoading(false) }
  }

  function insertTag(fieldName) {
    const el = textareaRef.current
    if (!el) return
    const tag = `{{${fieldName}}}`
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = message.slice(0, start) + tag + message.slice(end)
    setMessage(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + tag.length, start + tag.length)
    }, 0)
  }

  const recipientList = [...recipients.values()]

  // Compute available fields and coverage
  const fieldCoverage = useMemo(() => {
    const counts = {}
    recipientList.forEach(r => {
      if (r.name) counts['name'] = (counts['name'] || 0) + 1
      Object.entries(r.custom_fields || {}).forEach(([k, v]) => {
        if (v) counts[k] = (counts[k] || 0) + 1
      })
    })
    return counts
  }, [recipients])

  const availableFields = Object.keys(fieldCoverage)

  // Preview
  const total = recipientList.length
  const safeIndex = total > 0 ? Math.min(previewIndex, total - 1) : 0
  const previewRecipient = recipientList[safeIndex] || null
  const previewMsg = personalizePreview(message, previewRecipient)
  const estMins = Math.ceil(total * 4 / 60)

  const filteredWa = waContacts.filter(c => {
    const q = waSearch.toLowerCase()
    return !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
  })

  async function handleSend() {
    if (!recipientList.length || !message.trim()) return
    setSending(true); setSendError('')
    try {
      const createRes = await apiFetch('/api/campaigns/create', {
        method: 'POST',
        body: JSON.stringify({ instance_name: instance, message_template: message, recipients: recipientList })
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.detail || 'Failed to create campaign')
      await apiFetch(`/api/campaigns/${createData.campaign_id}/send`, { method: 'POST' })
      onNavigate('progress', { campaignId: createData.campaign_id })
    } catch (e) { setSendError(e.message) }
    finally { setSending(false) }
  }

  function coverageColor(count, total) {
    const pct = total > 0 ? count / total : 0
    if (pct >= 0.9) return '#1a7a3c'
    if (pct >= 0.5) return '#e67e22'
    return '#c0392b'
  }

  return (
    <div className="screen">
      <Navbar onNavigate={onNavigate} apiFetch={apiFetch} />
      <div className="page-body">
        <div className="page-header">
          <button className="back-btn" onClick={() => onNavigate('dashboard')}>← Back</button>
          <h1 className="page-title">Send Messages</h1>
        </div>

        {/* Group shortcut breadcrumb */}
        {preselectedGroupName && (
          <div className="info-box" style={{ marginBottom: 16 }}>
            Sending to: <strong>{preselectedGroupName}</strong> ({total} contacts pre-selected)
          </div>
        )}

        {/* ── Recipient input tabs ── */}
        <div className="card">
          <div className="tab-row">
            {[['paste','Paste Numbers'],['contacts','From Contacts'],['whatsapp','From WhatsApp']].map(([key, label]) => (
              <button key={key} className={`tab-btn${tab === key ? ' tab-active' : ''}`}
                onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {/* Paste tab */}
          {tab === 'paste' && (
            <div className="tab-content">
              <textarea className="textarea" rows={5} value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={'Paste phone numbers here — one per line or comma separated.\n08012345678\n08098765432, 07011223344'} />
              {parsedPaste.length > 0 && (
                <div className="parsed-preview">
                  {parsedPaste.map((p, i) => (
                    <span key={i} className={`parsed-tag ${p.valid ? 'parsed-valid' : 'parsed-invalid'}`}>
                      {p.valid ? p.phone : `✕ ${p.raw}`}
                    </span>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" style={{ marginTop: 12 }}
                onClick={addPastedNumbers} disabled={!parsedPaste.some(p => p.valid)}>
                Add {parsedPaste.filter(p => p.valid).length} numbers to recipients
              </button>
            </div>
          )}

          {/* Contacts tab */}
          {tab === 'contacts' && (
            <div className="tab-content">
              <div className="filter-row">
                <select className="input select-input" value={contactGroup}
                  onChange={e => { setContactGroup(e.target.value); setContactsPage(1) }}>
                  <option value="">All groups</option>
                  {groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input className="input" placeholder="Search name or phone…"
                  value={contactSearch}
                  onChange={e => { setContactSearch(e.target.value); setContactsPage(1) }}
                  style={{ flex: 1 }} />
                <button className="btn btn-sm btn-outline" onClick={selectAllContacts}>Select All</button>
                <button className="btn btn-sm btn-outline" onClick={deselectAllContacts}>Deselect All</button>
              </div>
              {contactsLoading ? (
                <div style={{ padding: 20, textAlign: 'center' }}><Spinner /></div>
              ) : (
                <>
                  <div className="contact-list">
                    {contacts.length === 0 && <p className="empty-state">No contacts found.</p>}
                    {contacts.map(c => (
                      <label key={c.id} className="contact-row" style={{ background: recipients.has(c.phone) ? '#f0fdf4' : '' }}>
                        <input type="checkbox" checked={recipients.has(c.phone)} onChange={() => toggleContact(c)} />
                        <span className="contact-name">{c.name || c.phone}</span>
                        {c.name && <span className="contact-phone">{c.phone}</span>}
                        {c.group_name && <span className="group-badge">{c.group_name}</span>}
                        {/* Custom fields preview pills */}
                        {c.custom_fields && Object.entries(c.custom_fields).slice(0, 2).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 11, background: '#f0f0ec', border: '0.5px solid #d0d0cc', borderRadius: 999, padding: '2px 7px', color: '#666' }}>{v}</span>
                        ))}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13, color: '#888' }}>
                    <span>Showing {contacts.length} of {contactsTotal}</span>
                    {contacts.length < contactsTotal && (
                      <button className="btn btn-sm btn-outline" onClick={() => setContactsPage(p => p + 1)}>
                        Load more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* WhatsApp tab */}
          {tab === 'whatsapp' && (
            <div className="tab-content">
              {waContacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p className="field-hint" style={{ marginBottom: 14 }}>Import contacts from your connected WhatsApp account.</p>
                  <button className="btn btn-outline" onClick={loadWaContacts} disabled={waLoading}>
                    {waLoading ? <><Spinner /> Loading...</> : 'Import from WhatsApp'}
                  </button>
                  {waError && <p className="form-error" style={{ marginTop: 10 }}>{waError}</p>}
                </div>
              ) : (
                <>
                  <input className="input" placeholder="Search WhatsApp contacts…"
                    value={waSearch} onChange={e => setWaSearch(e.target.value)} style={{ marginBottom: 10 }} />
                  <div className="contact-list">
                    {filteredWa.map((c, i) => (
                      <label key={i} className="contact-row" style={{ background: recipients.has(c.phone) ? '#f0fdf4' : '' }}>
                        <input type="checkbox" checked={recipients.has(c.phone)} onChange={() => toggleWaContact(c)} />
                        <span className="contact-name">{c.name || c.phone}</span>
                        {c.name && <span className="contact-phone">{c.phone}</span>}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Unified recipient list ── */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="recipients-header">
            <span className="recipients-count">{total} recipient{total !== 1 ? 's' : ''} selected</span>
            {total > 0 && <button className="link-btn" onClick={() => setRecipients(new Map())}>Clear all</button>}
          </div>
          {total > 0 ? (
            <div className="recipient-tags">
              {recipientList.map(r => (
                <span key={r.phone} className="recipient-tag">
                  {r.name ? `${r.name}` : r.phone}
                  <button className="tag-remove" onClick={() => removeRecipient(r.phone)}>×</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="empty-state">No recipients yet. Add numbers above.</p>
          )}
        </div>

        {/* ── Compose message ── */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="section-title">Message</h3>
          <div className="compose-grid">
            <div className="compose-left">
              <textarea id="message-textarea" ref={textareaRef} className="textarea" rows={7}
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder={'Assalamu alaikum {{name}},\n\nWe would like to inform you...'} />

              {/* Personalization panel */}
              {total > 0 && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: '#fafaf8', border: '0.5px solid #e8e8e4', borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: '#888', marginBottom: 10, fontWeight: 500 }}>
                    Personalization fields — click to insert
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {/* Always show {{name}} */}
                    <button className="chip" style={{ fontFamily: 'monospace' }} onClick={() => insertTag('name')}>
                      {'{{'+'name'+'}}'}
                    </button>
                    {availableFields.filter(f => f !== 'name').map(field => (
                      <button key={field} className="chip" style={{ fontFamily: 'monospace' }} onClick={() => insertTag(field)}>
                        {`{{${field}}}`}
                      </button>
                    ))}
                  </div>
                  {/* Coverage stats */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {['name', ...availableFields.filter(f => f !== 'name')].map(field => {
                      const count = fieldCoverage[field] || 0
                      const pct = total > 0 ? Math.round(count / total * 100) : 0
                      const color = coverageColor(count, total)
                      return (
                        <div key={field} style={{ fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <code style={{ background: '#f0f0ec', padding: '1px 5px', borderRadius: 3 }}>{`{{${field}}}`}</code>
                          <span>{count} of {total} contacts ({pct}%){pct < 50 ? ' ⚠' : ''}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <p className="char-count" style={{ marginTop: 8 }}>
                {message.length} characters
                {message.length > 1000 && <span className="char-warn"> · Long messages may be split by WhatsApp</span>}
              </p>
            </div>

            {/* Preview panel */}
            <div className="compose-right">
              <p className="preview-label">Preview</p>
              <div className="wa-bubble" style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>
                {previewMsg || <span className="text-muted">Your message will appear here…</span>}
              </div>
              {previewRecipient && (
                <>
                  <p className="preview-sub" style={{ marginTop: 8 }}>
                    For: {previewRecipient.name || previewRecipient.phone}
                  </p>
                  {total > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <button className="btn btn-sm btn-outline"
                        onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                        disabled={safeIndex === 0}>←</button>
                      <span style={{ fontSize: 12, color: '#888' }}>{safeIndex + 1} of {total}</span>
                      <button className="btn btn-sm btn-outline"
                        onClick={() => setPreviewIndex(i => Math.min(total - 1, i + 1))}
                        disabled={safeIndex === total - 1}>→</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Send button ── */}
        <div className="card" style={{ marginTop: 16 }}>
          {total > 100 && (
            <div className="warn-box" style={{ marginBottom: 14 }}>
              This campaign will take approximately {estMins} minutes. Keep this tab open.
            </div>
          )}
          <div className="info-box" style={{ marginBottom: 16 }}>
            Messages are sent one at a time with a 3–6 second delay to protect your account.
          </div>
          {sendError && <p className="form-error" style={{ marginBottom: 12 }}>{sendError}</p>}
          <button className="btn btn-wa btn-full btn-xl" onClick={handleSend}
            disabled={sending || total === 0 || !message.trim()}>
            {sending
              ? <><Spinner /> Starting campaign...</>
              : `Send to ${total} recipient${total !== 1 ? 's' : ''} · ~${estMins} min${estMins !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
