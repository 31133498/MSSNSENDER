import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar.jsx'
import { Spinner } from '../components/Spinner.jsx'

const STORAGE_INSTANCE = 'mssn_instance'

function parseNumbers(text) {
  return text
    .split(/[\n,]+/)
    .map(t => t.trim())
    .filter(Boolean)
}

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length === 13) return digits
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1)
  if (digits.length === 10) return '234' + digits
  if (digits.startsWith('1') && digits.length === 11) return digits
  return null
}

export default function CampaignScreen({ onNavigate, apiFetch }) {
  const instance = localStorage.getItem(STORAGE_INSTANCE) || ''

  // Recipients — unified map: phone → { phone, name }
  const [recipients, setRecipients] = useState(new Map())

  // Paste tab
  const [pasteText, setPasteText] = useState('')
  const [parsedPaste, setParsedPaste] = useState([]) // { raw, phone, valid }

  // Contacts tab
  const [contacts, setContacts] = useState([])
  const [contactSearch, setContactSearch] = useState('')
  const [contactGroup, setContactGroup] = useState('')
  const [contactsLoading, setContactsLoading] = useState(false)

  // WhatsApp import tab
  const [waContacts, setWaContacts] = useState([])
  const [waSearch, setWaSearch] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [waError, setWaError] = useState('')

  // Message
  const [message, setMessage] = useState('')
  const textareaRef = useRef()

  // Send state
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  // Active tab
  const [tab, setTab] = useState('paste')

  useEffect(() => {
    setContactsLoading(true)
    apiFetch('/api/contacts')
      .then(r => r && r.ok && r.json().then(setContacts))
      .catch(() => {})
      .finally(() => setContactsLoading(false))
  }, [])

  // Parse paste text live
  useEffect(() => {
    if (!pasteText.trim()) { setParsedPaste([]); return }
    const tokens = parseNumbers(pasteText)
    setParsedPaste(tokens.map(raw => {
      const phone = formatPhone(raw)
      return { raw, phone, valid: !!phone }
    }))
  }, [pasteText])

  function addPastedNumbers() {
    const valid = parsedPaste.filter(p => p.valid)
    if (!valid.length) return
    setRecipients(prev => {
      const next = new Map(prev)
      valid.forEach(p => next.set(p.phone, { phone: p.phone, name: null }))
      return next
    })
    setPasteText('')
    setParsedPaste([])
  }

  function toggleContact(c) {
    setRecipients(prev => {
      const next = new Map(prev)
      if (next.has(c.phone)) next.delete(c.phone)
      else next.set(c.phone, { phone: c.phone, name: c.name || null })
      return next
    })
  }

  function selectAllFiltered() {
    const filtered = filteredContacts()
    setRecipients(prev => {
      const next = new Map(prev)
      filtered.forEach(c => next.set(c.phone, { phone: c.phone, name: c.name || null }))
      return next
    })
  }

  function toggleWaContact(c) {
    setRecipients(prev => {
      const next = new Map(prev)
      if (next.has(c.phone)) next.delete(c.phone)
      else next.set(c.phone, { phone: c.phone, name: c.name || null })
      return next
    })
  }

  function removeRecipient(phone) {
    setRecipients(prev => { const next = new Map(prev); next.delete(phone); return next })
  }

  function filteredContacts() {
    return contacts.filter(c => {
      const matchGroup = !contactGroup || c.group_name === contactGroup
      const q = contactSearch.toLowerCase()
      const matchSearch = !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      return matchGroup && matchSearch
    })
  }

  const groups = [...new Set(contacts.map(c => c.group_name).filter(Boolean))]

  async function loadWaContacts() {
    setWaLoading(true)
    setWaError('')
    try {
      const res = await apiFetch('/api/contacts/whatsapp-contacts')
      if (!res || !res.ok) throw new Error('Failed to load WhatsApp contacts')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setWaContacts(data.contacts || [])
      // Refresh saved contacts list so the count updates
      apiFetch('/api/contacts').then(r => r && r.ok && r.json().then(setContacts)).catch(() => {})
    } catch (e) {
      setWaError(e.message)
    } finally {
      setWaLoading(false)
    }
  }

  function insertTag(tag) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const next = message.slice(0, start) + tag + message.slice(el.selectionEnd)
    setMessage(next)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length) }, 0)
  }

  const recipientList = [...recipients.values()]
  const firstRecipient = recipientList[0]
  const previewMsg = message
    .replace(/\{\{name\}\}/g, firstRecipient?.name || 'member')
  const estMins = Math.ceil(recipientList.length * 4 / 60)

  async function handleSend() {
    if (!recipientList.length || !message.trim()) return
    setSending(true)
    setSendError('')
    try {
      const createRes = await apiFetch('/api/campaigns/create', {
        method: 'POST',
        body: JSON.stringify({
          instance_name: instance,
          message_template: message,
          recipients: recipientList
        })
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.detail || 'Failed to create campaign')

      await apiFetch(`/api/campaigns/${createData.campaign_id}/send`, { method: 'POST' })
      onNavigate('progress', { campaignId: createData.campaign_id })
    } catch (e) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  const filteredWa = waContacts.filter(c => {
    const q = waSearch.toLowerCase()
    return !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
  })

  return (
    <div className="screen">
      <Navbar onNavigate={onNavigate} />
      <div className="page-body">
        <div className="page-header">
          <button className="back-btn" onClick={() => onNavigate('dashboard')}>← Back</button>
          <h1 className="page-title">Send Messages</h1>
        </div>

        {/* ── Recipient input tabs ── */}
        <div className="card">
          <div className="tab-row">
            {[['paste', 'Paste Numbers'], ['contacts', 'From Contacts'], ['whatsapp', 'From WhatsApp']].map(([key, label]) => (
              <button key={key} className={`tab-btn${tab === key ? ' tab-active' : ''}`}
                onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {/* Paste tab */}
          {tab === 'paste' && (
            <div className="tab-content">
              <textarea
                className="textarea"
                rows={5}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={'Paste phone numbers here — one per line or comma separated.\n08012345678\n08098765432, 07011223344\n+2348055667788'}
              />
              {parsedPaste.length > 0 && (
                <div className="parsed-preview">
                  {parsedPaste.map((p, i) => (
                    <span key={i} className={`parsed-tag ${p.valid ? 'parsed-valid' : 'parsed-invalid'}`}>
                      {p.valid ? p.phone : `✕ ${p.raw}`}
                    </span>
                  ))}
                </div>
              )}
              <button
                className="btn btn-primary"
                style={{ marginTop: 12 }}
                onClick={addPastedNumbers}
                disabled={!parsedPaste.some(p => p.valid)}
              >
                Add {parsedPaste.filter(p => p.valid).length} numbers to recipients
              </button>
            </div>
          )}

          {/* Contacts tab */}
          {tab === 'contacts' && (
            <div className="tab-content">
              <div className="filter-row">
                <select className="input select-input" value={contactGroup}
                  onChange={e => setContactGroup(e.target.value)}>
                  <option value="">All groups</option>
                  {groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input className="input" placeholder="Search name or phone…"
                  value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                  style={{ flex: 1 }} />
                <button className="btn btn-sm btn-outline" onClick={selectAllFiltered}>
                  Select All
                </button>
              </div>
              {contactsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}><Spinner /></div>
              ) : (
                <div className="contact-list">
                  {filteredContacts().length === 0 && (
                    <p className="empty-state">No contacts found.</p>
                  )}
                  {filteredContacts().map(c => (
                    <label key={c.id} className="contact-row">
                      <input type="checkbox" checked={recipients.has(c.phone)}
                        onChange={() => toggleContact(c)} />
                      <span className="contact-name">{c.name || c.phone}</span>
                      {c.name && <span className="contact-phone">{c.phone}</span>}
                      {c.group_name && <span className="group-badge">{c.group_name}</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WhatsApp import tab */}
          {tab === 'whatsapp' && (
            <div className="tab-content">
              {waContacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p className="field-hint" style={{ marginBottom: 14 }}>
                    Import contacts directly from your connected WhatsApp account.
                  </p>
                  <button className="btn btn-outline" onClick={loadWaContacts} disabled={waLoading}>
                    {waLoading ? <><Spinner /> Loading...</> : 'Import from WhatsApp'}
                  </button>
                  {waError && <p className="form-error" style={{ marginTop: 10 }}>{waError}</p>}
                </div>
              ) : (
                <>
                  <input className="input" placeholder="Search WhatsApp contacts…"
                    value={waSearch} onChange={e => setWaSearch(e.target.value)}
                    style={{ marginBottom: 10 }} />
                  <div className="contact-list">
                    {filteredWa.map((c, i) => (
                      <label key={i} className="contact-row">
                        <input type="checkbox" checked={recipients.has(c.phone)}
                          onChange={() => toggleWaContact(c)} />
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
            <span className="recipients-count">
              {recipientList.length} recipient{recipientList.length !== 1 ? 's' : ''} selected
            </span>
            {recipientList.length > 0 && (
              <button className="link-btn" onClick={() => setRecipients(new Map())}>
                Clear all
              </button>
            )}
          </div>
          {recipientList.length > 0 && (
            <div className="recipient-tags">
              {recipientList.map(r => (
                <span key={r.phone} className="recipient-tag">
                  {r.name ? `${r.name} · ` : ''}{r.phone}
                  <button className="tag-remove" onClick={() => removeRecipient(r.phone)}>×</button>
                </span>
              ))}
            </div>
          )}
          {recipientList.length === 0 && (
            <p className="empty-state">No recipients yet. Add numbers above.</p>
          )}
        </div>

        {/* ── Compose message ── */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="section-title">Message</h3>
          <div className="compose-grid">
            <div className="compose-left">
              <textarea
                ref={textareaRef}
                className="textarea"
                rows={7}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={'Assalamu alaikum {{name}},\n\nWe would like to inform you...'}
              />
              <div className="chip-row" style={{ marginTop: 8 }}>
                <button className="chip" onClick={() => insertTag('{{name}}')}>{'{{name}}'}</button>
              </div>
              <p className="char-count" style={{ marginTop: 6 }}>
                {message.length} characters
                {message.length > 1000 && (
                  <span className="char-warn"> · Long messages may be split by WhatsApp</span>
                )}
              </p>
            </div>
            <div className="compose-right">
              <p className="preview-label">Preview</p>
              <div className="wa-bubble">
                {previewMsg || <span className="text-muted">Your message will appear here…</span>}
              </div>
              {firstRecipient && (
                <p className="preview-sub">For: {firstRecipient.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Send button ── */}
        <div className="card" style={{ marginTop: 16 }}>
          {recipientList.length > 100 && (
            <div className="warn-box" style={{ marginBottom: 14 }}>
              This campaign will take approximately {estMins} minutes.
              Keep this tab open until sending is finished.
            </div>
          )}
          <div className="info-box" style={{ marginBottom: 16 }}>
            Messages are sent one at a time with a 3–6 second delay to protect your account.
          </div>
          {sendError && <p className="form-error" style={{ marginBottom: 12 }}>{sendError}</p>}
          <button
            className="btn btn-wa btn-full btn-xl"
            onClick={handleSend}
            disabled={sending || recipientList.length === 0 || !message.trim()}
          >
            {sending
              ? <><Spinner /> Starting campaign...</>
              : `Send to ${recipientList.length} recipient${recipientList.length !== 1 ? 's' : ''} · ~${estMins} min${estMins !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  )
}
