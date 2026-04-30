import { useEffect, useMemo, useRef, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import { Spinner } from '../components/Spinner.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { API_BASE } from '../api.js'

const STORAGE_INSTANCE = 'mssn_instance'
const CONTACTS_PER_PAGE = 50

function formatPhone(raw = '') {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length === 13 && ['7', '8', '9'].includes(digits[3])) return digits
  if (digits.startsWith('0') && digits.length === 11 && ['7', '8', '9'].includes(digits[1])) return `234${digits.slice(1)}`
  if (digits.length === 10 && ['7', '8', '9'].includes(digits[0])) return `234${digits}`
  return null
}

function splitNumbers(text) {
  return text.split(/[\n,;\s]+/).map(t => t.trim()).filter(Boolean)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function recipientLabel(recipient) {
  return recipient.name || recipient.display_name || recipient.phone
}

function initialsFor(recipient) {
  const label = recipient.name || recipient.display_name
  if (!label) return '+'
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function avatarColor(recipient) {
  const seed = (recipient.name || recipient.display_name || recipient.phone || 'B').charCodeAt(0)
  const colors = ['#1a7a3c', '#0f766e', '#2563eb', '#7c3aed', '#be123c', '#b45309']
  return colors[seed % colors.length]
}

function getRecipientValue(recipient, tag) {
  if (tag === 'name') return recipient.name || 'member'
  return (recipient.custom_fields || {})[tag]
}

function previewParts(message, recipient) {
  if (!message) return []
  const parts = []
  const regex = /\{\{([^}]+)\}\}/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(message)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: message.slice(lastIndex, match.index) })
    }
    const tag = match[1].trim()
    const value = recipient ? getRecipientValue(recipient, tag) : ''
    if (value) {
      parts.push({ type: 'text', value: String(value) })
    } else {
      parts.push({ type: 'missing', value: `{{${tag}}}` })
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < message.length) parts.push({ type: 'text', value: message.slice(lastIndex) })
  return parts
}

function truncate(value, max) {
  if (!value) return ''
  return value.length > max ? `${value.slice(0, max).trim()}...` : value
}

function normalizeFieldName(value = '') {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
}

function guessColumnType(column) {
  const key = normalizeFieldName(column)
  if (['phone', 'phone_number', 'phonenumber', 'mobile', 'tel', 'telephone'].includes(key)) return 'phone'
  if (['name', 'full_name', 'fullname', 'student_name', 'contact_name'].includes(key)) return 'name'
  if (['group', 'group_name', 'groupname'].includes(key)) return 'group'
  return 'custom'
}

function parseCsvHeaders(text) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || ''
  return firstLine.split(',').map(h => h.replace(/^"|"$/g, '').trim()).filter(Boolean)
}

export default function CampaignScreen({ onNavigate, apiFetch, screenParams = {} }) {
  const instanceName = localStorage.getItem(STORAGE_INSTANCE) || ''
  const textareaRef = useRef(null)

  const [recipients, setRecipients] = useState([])
  const [message, setMessage] = useState('')
  const [previewIndex, setPreviewIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('paste')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [manualModal, setManualModal] = useState(null)
  const [csvModalOpen, setCsvModalOpen] = useState(false)

  const [pasteText, setPasteText] = useState('')
  const [parsedPaste, setParsedPaste] = useState([])

  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(screenParams?.group || '')
  const [selectedGroupName, setSelectedGroupName] = useState(screenParams?.groupName || '')
  const [contactSearch, setContactSearch] = useState('')
  const [contactPage, setContactPage] = useState(1)
  const [contactsTotal, setContactsTotal] = useState(0)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [groupSelecting, setGroupSelecting] = useState(false)
  const [showGroupPrompt, setShowGroupPrompt] = useState(false)

  const [waContacts, setWaContacts] = useState([])
  const [waSearch, setWaSearch] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [waLoaded, setWaLoaded] = useState(false)
  const [waError, setWaError] = useState('')
  const [saveWhatsAppContacts, setSaveWhatsAppContacts] = useState(false)
  const [waGroupName, setWaGroupName] = useState('')

  const refreshGroups = () => {
    apiFetch('/api/contacts/groups')
      .then(r => r && r.ok ? r.json() : null)
      .then(data => setGroups(data?.groups || []))
      .catch(() => {})
  }

  const isReady = recipients.length > 0 && message.trim().length > 0

  useEffect(() => {
    refreshGroups()
  }, [])

  useEffect(() => {
    if (screenParams?.group) {
      setActiveTab('contacts')
      selectEntireGroup(screenParams.group)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'contacts') loadContacts(1, false)
  }, [activeTab, selectedGroup, contactSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!pasteText.trim()) {
        setParsedPaste([])
        return
      }
      const seen = new Set()
      setParsedPaste(splitNumbers(pasteText).map(raw => {
        const phone = formatPhone(raw)
        const duplicate = phone && seen.has(phone)
        if (phone) seen.add(phone)
        return { raw, phone, valid: !!phone && !duplicate, duplicate }
      }))
    }, 300)
    return () => clearTimeout(timer)
  }, [pasteText])

  useEffect(() => {
    if (previewIndex >= recipients.length) setPreviewIndex(Math.max(recipients.length - 1, 0))
  }, [recipients.length, previewIndex])

  useEffect(() => {
    const handleBeforeUnload = event => {
      if (!isSending) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isSending])

  function addRecipients(nextRecipients) {
    setRecipients(prev => {
      const byPhone = new Map(prev.map(r => [r.phone, r]))
      nextRecipients.forEach(r => {
        if (r.phone) byPhone.set(r.phone, { ...byPhone.get(r.phone), ...r })
      })
      return Array.from(byPhone.values())
    })
  }

  function removeRecipient(phone) {
    setRecipients(prev => prev.filter(r => r.phone !== phone))
  }

  function clearRecipients() {
    setRecipients([])
  }

  function hasRecipient(phone) {
    return recipients.some(r => r.phone === phone)
  }

  function addPastedNumbers() {
    const valid = parsedPaste.filter(p => p.valid)
    if (!valid.length) return
    addRecipients(valid.map(p => ({ phone: p.phone, name: null, custom_fields: {}, source: 'paste' })))
    setPasteText('')
    setParsedPaste([])
  }

  function contactRecipient(contact, source = 'contacts') {
    return {
      phone: contact.phone,
      name: contact.name || null,
      display_name: contact.display_name || null,
      whatsapp_name: contact.whatsapp_name || null,
      group_name: contact.group_name || null,
      custom_fields: contact.custom_fields || {},
      source,
    }
  }

  function toggleRecipient(contact, source = 'contacts') {
    if (hasRecipient(contact.phone)) removeRecipient(contact.phone)
    else addRecipients([contactRecipient(contact, source)])
  }

  function deselectContacts(list) {
    const phones = new Set(list.map(c => c.phone))
    setRecipients(prev => prev.filter(r => !phones.has(r.phone)))
  }

  async function loadContacts(page = 1, append = false) {
    setContactsLoading(true)
    try {
      const params = new URLSearchParams({ page, per_page: CONTACTS_PER_PAGE })
      if (selectedGroup) params.set('group', selectedGroup)
      if (contactSearch.trim()) params.set('search', contactSearch.trim())
      const res = await apiFetch(`/api/contacts?${params}`)
      if (res && res.ok) {
        const data = await res.json()
        setContacts(prev => append ? [...prev, ...(data.contacts || [])] : (data.contacts || []))
        setContactsTotal(data.total || 0)
        setContactPage(page)
      }
    } finally {
      setContactsLoading(false)
    }
  }

  async function selectEntireGroup(group = selectedGroup) {
    if (!group) return
    setGroupSelecting(true)
    const params = new URLSearchParams({ page: 1, per_page: 5000, group })
    try {
      const res = await apiFetch(`/api/contacts?${params}`)
      if (res && res.ok) {
        const data = await res.json()
        addRecipients((data.contacts || []).map(c => contactRecipient(c, 'contacts')))
        setShowGroupPrompt(false)
      }
    } finally {
      setGroupSelecting(false)
    }
  }

  async function loadWhatsAppContacts() {
    setWaLoading(true)
    setWaError('')
    try {
      const res = await apiFetch('/api/contacts/whatsapp-contacts')
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.detail || data.error || 'Failed to load WhatsApp contacts')
      const savedRes = await apiFetch('/api/contacts?page=1&per_page=5000')
      const savedData = savedRes && savedRes.ok ? await savedRes.json() : { contacts: [] }
      const savedByPhone = new Map((savedData.contacts || []).map(contact => [contact.phone, contact]))
      setWaContacts((data.contacts || []).map(contact => {
        const saved = savedByPhone.get(contact.phone)
        return {
          ...contact,
          name: saved?.name || null,
          display_name: saved?.name || contact.name || contact.phone,
          whatsapp_name: contact.name || null,
          group_name: saved?.group_name || null,
          custom_fields: saved?.custom_fields || {},
        }
      }))
      setWaLoaded(true)
    } catch (error) {
      setWaError(error.message)
    } finally {
      setWaLoading(false)
    }
  }

  function insertTag(fieldName) {
    const el = textareaRef.current
    const tag = `{{${fieldName}}}`
    if (!el) {
      setMessage(prev => `${prev}${tag}`)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    setMessage(prev => `${prev.slice(0, start)}${tag}${prev.slice(end)}`)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + tag.length, start + tag.length)
    }, 0)
  }

  async function handleBulkDeleteSelectedContacts() {
    const selectedSavedContacts = contacts.filter(c => hasRecipient(c.phone) && c.id)
    if (!selectedSavedContacts.length) return
    setConfirm({
      title: `Delete ${selectedSavedContacts.length} contacts?`,
      message: 'This removes the selected saved contacts from BulkIt. This action cannot be undone.',
      confirmText: `Delete ${selectedSavedContacts.length} contacts`,
      danger: true,
      onConfirm: async () => {
        await apiFetch('/api/contacts/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ contact_ids: selectedSavedContacts.map(c => c.id) }),
        })
        const phones = new Set(selectedSavedContacts.map(c => c.phone))
        setRecipients(prev => prev.filter(r => !phones.has(r.phone)))
        setConfirm(null)
        loadContacts(1, false)
        refreshGroups()
      },
    })
  }

  function handleSavedContact(contact) {
    if (contact?.phone) addRecipients([contactRecipient(contact, 'contacts')])
    loadContacts(1, false)
    refreshGroups()
    setManualModal(null)
  }

  function handleSavedNumberBatch(groupName) {
    setManualModal(null)
    refreshGroups()
    if (groupName) {
      setActiveTab('contacts')
      setSelectedGroup(groupName)
      setSelectedGroupName(groupName)
      selectEntireGroup(groupName)
    }
  }

  function handleCsvImported(groupName) {
    setCsvModalOpen(false)
    refreshGroups()
    setActiveTab('contacts')
    setSelectedGroup(groupName || '')
    setSelectedGroupName(groupName || '')
    if (groupName) selectEntireGroup(groupName)
    else loadContacts(1, false)
  }

  const validPasteCount = parsedPaste.filter(p => p.valid).length
  const invalidPasteCount = parsedPaste.filter(p => !p.valid).length

  const selectedContactCount = contacts.filter(c => hasRecipient(c.phone)).length
  const selectedWaCount = waContacts.filter(c => hasRecipient(c.phone)).length

  const filteredWaContacts = useMemo(() => {
    const q = waSearch.trim().toLowerCase()
    if (!q) return waContacts
    return waContacts.filter(c => (c.name || '').toLowerCase().includes(q) || c.phone.includes(q))
  }, [waContacts, waSearch])

  const availableFields = useMemo(() => {
    const fields = new Set()
    if (recipients.some(r => r.name)) fields.add('name')
    recipients.forEach(r => {
      Object.keys(r.custom_fields || {}).forEach(k => {
        if (r.custom_fields[k]) fields.add(k)
      })
    })
    return Array.from(fields)
  }, [recipients])

  const usedTags = useMemo(() => {
    const matches = message.match(/\{\{([^}]+)\}\}/g) || []
    return Array.from(new Set(matches.map(m => m.slice(2, -2).trim()).filter(Boolean)))
  }, [message])

  const coverageStats = useMemo(() => {
    return usedTags.map(tag => {
      const count = recipients.filter(r => {
        if (tag === 'name') return !!r.name
        return !!(r.custom_fields || {})[tag]
      }).length
      return { tag, count, total: recipients.length, pct: Math.round((count / recipients.length) * 100) || 0 }
    })
  }, [usedTags, recipients])

  const previewRecipient = recipients[previewIndex] || null
  const estimatedMinutes = Math.ceil(recipients.length * 4 / 60)
  const recipientsWithoutNames = recipients.filter(r => !r.name).length
  const recipientGroups = Array.from(new Set(recipients.map(r => r.group_name).filter(Boolean)))
  const lowCoverage = coverageStats.filter(s => s.pct < 50)

  async function handleSend() {
    if (!isReady || isSending) return
    setIsSending(true)
    setSendError('')
    try {
      const selectedWhatsApp = recipients.filter(r => r.source === 'whatsapp')
      if (saveWhatsAppContacts && selectedWhatsApp.length > 0) {
        await apiFetch('/api/contacts/whatsapp-contacts', {
          method: 'POST',
          body: JSON.stringify({
            save_to_contacts: true,
            contacts: selectedWhatsApp.map(r => ({ phone: r.phone, name: r.name || null })),
            group_name: waGroupName.trim() || 'WhatsApp Contacts',
          }),
        })
      }

      const createRes = await apiFetch('/api/campaigns/create', {
        method: 'POST',
        body: JSON.stringify({
          instance_name: instanceName,
          message_template: message,
          recipients: recipients.map(r => ({
            phone: r.phone,
            name: r.name || null,
            custom_fields: r.custom_fields || {},
          })),
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.detail || 'Failed to create campaign')

      const sendRes = await apiFetch(`/api/campaigns/${createData.campaign_id}/send`, { method: 'POST' })
      if (!sendRes.ok) {
        const sendData = await sendRes.json().catch(() => ({}))
        throw new Error(sendData.detail || 'Failed to start campaign')
      }
      onNavigate('progress', { campaignId: createData.campaign_id })
    } catch (error) {
      setSendError(error.message)
      setIsSending(false)
    }
  }

  function requestSend() {
    if (!isReady || isSending) return
    setConfirm({
      title: `Send to ${recipients.length.toLocaleString()} people?`,
      message: `BulkIt will create this campaign and start sending from ${instanceName || 'your connected WhatsApp'}. Keep this tab open while it runs.`,
      confirmText: `Send to ${recipients.length.toLocaleString()} people`,
      onConfirm: () => {
        setConfirm(null)
        handleSend()
      },
    })
  }

  return (
    <div className="screen">
      <Navbar onNavigate={onNavigate} apiFetch={apiFetch} />
      <main className="campaign-page">
        <header className="campaign-header">
          <button className="back-btn" onClick={() => onNavigate('dashboard')} disabled={isSending}>← Back to Dashboard</button>
          <button className={`campaign-top-send${isReady ? ' ready' : ''}`} onClick={requestSend} disabled={!isReady || isSending}>
            {isSending ? <><Spinner /> Creating campaign...</> : 'Send Campaign'}
          </button>
        </header>

        {selectedGroupName && (
          <div className="campaign-shortcut-banner">
            Sending to: <strong>{selectedGroupName}</strong>
          </div>
        )}

        <CampaignSection label="Section 1" title="Recipients" subtext="Choose who receives this message">
          <div className="campaign-feature-strip">
            <div>
              <strong>Contact tools</strong>
              <span>Save names, groups, CSV columns, and custom fields. Every saved field can become a message tag.</span>
            </div>
            <div className="campaign-feature-actions">
              <button className="btn btn-sm btn-outline" onClick={() => setManualModal('single')}>Save contact manually</button>
              <button className="btn btn-sm btn-outline" onClick={() => setManualModal('numbers')}>Save numbers to group</button>
              <button className="btn btn-sm btn-outline" onClick={() => setCsvModalOpen(true)}>Import CSV data</button>
            </div>
          </div>
          <div className="campaign-tabs">
            {[
              ['paste', 'Paste Numbers'],
              ['contacts', 'From Contacts'],
              ['whatsapp', 'From WhatsApp'],
            ].map(([key, label]) => (
              <button key={key} className={`campaign-tab${activeTab === key ? ' active' : ''}`} onClick={() => setActiveTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'paste' && (
            <div className="campaign-tab-panel">
              <textarea
                className="campaign-textarea"
                rows="8"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={'Paste phone numbers here - one per line or comma separated.\n08012345678\n08098765432, 07011223344\n+2348055667788'}
              />
              <div className="paste-live-row">
                <span className="paste-valid">{validPasteCount} valid numbers detected</span>
                {invalidPasteCount > 0 && <span className="paste-invalid">{invalidPasteCount} invalid numbers ignored</span>}
              </div>
              <p className="campaign-hint">Numbers automatically converted to international format (234XXXXXXXXXX)</p>
              <button className="btn btn-primary" onClick={addPastedNumbers} disabled={validPasteCount === 0}>
                Add to recipients
              </button>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="campaign-tab-panel">
              <div className="campaign-filter-grid">
                <select
                  className="input select-input"
                  value={selectedGroup}
                  onChange={e => {
                    const group = e.target.value
                    setSelectedGroup(group)
                    setSelectedGroupName(group)
                    setContactPage(1)
                    setShowGroupPrompt(false)
                    if (group) selectEntireGroup(group)
                  }}
                >
                  <option value="">All groups</option>
                  <option value="__ungrouped__">Ungrouped</option>
                  {groups.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
                <input
                  className="input"
                  value={contactSearch}
                  onChange={e => { setContactSearch(e.target.value); setContactPage(1) }}
                  placeholder="Search name or phone"
                />
              </div>
              <div className="campaign-select-row">
                <button className="btn btn-sm btn-outline" onClick={() => addRecipients(contacts.map(c => contactRecipient(c, 'contacts')))}>Select All</button>
                <button className="btn btn-sm btn-outline" onClick={() => deselectContacts(contacts)}>Deselect All</button>
                <button className="btn btn-sm btn-danger" onClick={handleBulkDeleteSelectedContacts} disabled={selectedContactCount === 0}>Delete selected contacts</button>
                {selectedGroup && (
                  <button className="btn btn-sm btn-primary" onClick={() => selectEntireGroup()} disabled={groupSelecting}>
                    {groupSelecting ? <><Spinner /> Selecting group...</> : 'Select entire group'}
                  </button>
                )}
                <span>{selectedContactCount}/{contactsTotal} selected</span>
              </div>
              {groupSelecting && (
                <div className="group-select-banner">
                  <span>Selecting every contact in "{selectedGroupName || selectedGroup}"...</span>
                </div>
              )}
              {showGroupPrompt && selectedGroup && (
                <div className="group-select-banner">
                  <span>Select all {contactsTotal.toLocaleString()} contacts in "{selectedGroupName || selectedGroup}"?</span>
                  <button className="link-btn" onClick={() => selectEntireGroup()}>Yes, select all</button>
                  <button className="link-btn" onClick={() => setShowGroupPrompt(false)}>No, just filter</button>
                </div>
              )}
              <ContactList
                contacts={contacts}
                loading={contactsLoading}
                isSelected={phone => hasRecipient(phone)}
                onToggle={contact => toggleRecipient(contact, 'contacts')}
              />
              <div className="campaign-list-footer">
                <span>Showing {contacts.length.toLocaleString()} of {contactsTotal.toLocaleString()} contacts</span>
                {contacts.length < contactsTotal && (
                  <button className="btn btn-sm btn-outline" onClick={() => loadContacts(contactPage + 1, true)} disabled={contactsLoading}>
                    Load more
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="campaign-tab-panel">
              <div className="whatsapp-import-row">
                <button className="btn btn-outline" onClick={loadWhatsAppContacts} disabled={waLoading}>
                  {waLoading ? <><Spinner /> Loading...</> : 'Import from WhatsApp'}
                </button>
                {waLoaded && <span>{waContacts.length.toLocaleString()} contacts loaded</span>}
              </div>
              {waError && <p className="form-error">{waError}</p>}
              {waLoaded && (
                <>
                  <input className="input" value={waSearch} onChange={e => setWaSearch(e.target.value)} placeholder="Search WhatsApp contacts" />
                  <div className="campaign-select-row">
                    <button className="btn btn-sm btn-outline" onClick={() => addRecipients(filteredWaContacts.map(c => contactRecipient(c, 'whatsapp')))}>Select All</button>
                    <button className="btn btn-sm btn-outline" onClick={() => deselectContacts(filteredWaContacts)}>Deselect All</button>
                    <span>{selectedWaCount}/{waContacts.length} selected</span>
                  </div>
                  <ContactList
                    contacts={filteredWaContacts}
                    loading={waLoading}
                    isSelected={phone => hasRecipient(phone)}
                    onToggle={contact => toggleRecipient(contact, 'whatsapp')}
                    source="whatsapp"
                  />
                  <label className="save-wa-row">
                    <input type="checkbox" checked={saveWhatsAppContacts} onChange={e => setSaveWhatsAppContacts(e.target.checked)} />
                    <span>Save selected to contacts</span>
                  </label>
                  {saveWhatsAppContacts && (
                    <input className="input" value={waGroupName} onChange={e => setWaGroupName(e.target.value)} placeholder="Tag these contacts as:" />
                  )}
                </>
              )}
            </div>
          )}

          <RecipientSummary
            recipients={recipients}
            onRemove={removeRecipient}
            onClear={clearRecipients}
            withoutNames={recipientsWithoutNames}
            groups={recipientGroups}
          />
        </CampaignSection>

        <CampaignSection label="Section 2" title="Message" subtext="Write your message. Use tags to personalize.">
          <div className="campaign-compose-grid">
            <div className="composer-column">
              <div className="message-box-wrap">
                <textarea
                  id="message-textarea"
                  ref={textareaRef}
                  className="campaign-textarea message-textarea"
                  rows="10"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={'Write your message here...\n\nUse {{name}} to personalize for each recipient.\nIf you have custom contact data, use those fields too.'}
                />
                <span className="character-count">{message.length} characters</span>
              </div>
              {message.length > 1000 && (
                <p className="campaign-warning-text">Long messages may be split into multiple parts by WhatsApp</p>
              )}
              {recipients.length > 0 && availableFields.length > 0 && (
                <div className="personalization-panel">
                  <p>Insert personalization:</p>
                  <div className="campaign-chip-row">
                    {availableFields.map(field => (
                      <button key={field} className="campaign-chip" onClick={() => insertTag(field)}>
                        {`{{${field}}}`}
                      </button>
                    ))}
                    <select className="campaign-field-select" defaultValue="" onChange={e => { if (e.target.value) insertTag(e.target.value); e.target.value = '' }}>
                      <option value="">Insert field...</option>
                      {availableFields.map(field => <option key={field} value={field}>{`{{${field}}}`}</option>)}
                    </select>
                  </div>
                  {coverageStats.length > 0 && (
                    <div className="coverage-list">
                      {coverageStats.map(stat => (
                        <div key={stat.tag} className={`coverage-row ${stat.pct >= 90 ? 'good' : stat.pct >= 50 ? 'warn' : 'bad'}`}>
                          <code>{`{{${stat.tag}}}`}</code>
                          <span>
                            {stat.count}/{stat.total} have this
                            {stat.tag === 'name' && stat.count < stat.total ? ` - ${stat.total - stat.count} will get "member"` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="preview-column">
              <div className="wa-preview-card">
                <div className="wa-preview-header">
                  <span className="wa-dot" />
                  <span>Preview - {previewRecipient ? recipientLabel(previewRecipient) : 'recipient'}</span>
                </div>
                <div className="wa-preview-body">
                  <div className="wa-preview-bubble">
                    {message.trim() && previewRecipient ? (
                      previewParts(message, previewRecipient).map((part, index) => (
                        <span key={index} className={part.type === 'missing' ? 'missing-tag' : undefined}>{part.value}</span>
                      ))
                    ) : (
                      <span className="preview-empty">Your message preview will appear here as you type.</span>
                    )}
                  </div>
                </div>
                {previewRecipient && (
                  <div className="preview-cycle-row">
                    <button onClick={() => setPreviewIndex(i => Math.max(0, i - 1))} disabled={previewIndex === 0}>← Prev</button>
                    <span>{previewIndex + 1} of {recipients.length}</span>
                    <button onClick={() => setPreviewIndex(i => Math.min(recipients.length - 1, i + 1))} disabled={previewIndex >= recipients.length - 1}>Next →</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CampaignSection>

        <CampaignSection label="Section 3" title="Review" subtext="Summary before firing" muted={!isReady}>
          {isReady ? (
            <>
              <div className="campaign-review-card">
                <ReviewBlock label="Sending from">
                  <span className="review-instance"><span className="dot-green" /> {instanceName || 'Connected WhatsApp'}</span>
                </ReviewBlock>
                <ReviewBlock label="Recipients">
                  <strong>{recipients.length.toLocaleString()} people</strong>
                  <span>Groups: {recipientGroups.length ? recipientGroups.slice(0, 4).join(', ') : 'None'}</span>
                </ReviewBlock>
                <ReviewBlock label="Message">
                  <span>"{truncate(message.replace(/\s+/g, ' '), 80)}"</span>
                </ReviewBlock>
                <ReviewBlock label="Estimated time">
                  <span>~{estimatedMinutes} minutes ({recipients.length.toLocaleString()} x 4 seconds avg)</span>
                </ReviewBlock>
                <ReviewBlock label="Personalization">
                  <span>Using: {usedTags.length ? usedTags.map(tag => `{{${tag}}}`).join(', ') : 'No tags'}</span>
                  <span>Coverage: {coverageStats.length ? coverageStats.map(s => `${s.tag} ${s.pct}%`).join(' - ') : 'No personalized fields used'}</span>
                </ReviewBlock>
              </div>
              {recipients.length > 100 && (
                <div className="campaign-warning-box amber">
                  Sending to {recipients.length.toLocaleString()} people will take approximately {estimatedMinutes} minutes. Keep this tab open until complete. Do not close or refresh the page.
                </div>
              )}
              {lowCoverage.map(stat => (
                <div key={stat.tag} className="campaign-warning-box red">
                  {`{{${stat.tag}}}`} is only available for {stat.pct}% of your recipients. Some will receive an empty value here.
                </div>
              ))}
            </>
          ) : (
            <p className="review-empty">Add recipients and write a message to unlock the final review.</p>
          )}
          {sendError && <p className="form-error">{sendError}</p>}
          <button className="big-send-btn" onClick={requestSend} disabled={!isReady || isSending}>
            {isSending ? <><Spinner /> Creating campaign...</> : isReady ? `Send to ${recipients.length.toLocaleString()} people ->` : 'Add recipients and a message to send'}
          </button>
        </CampaignSection>
        {manualModal && (
          <QuickSaveContactModal
            mode={manualModal}
            groups={groups}
            apiFetch={apiFetch}
            onClose={() => setManualModal(null)}
            onSavedContact={handleSavedContact}
            onSavedNumbers={handleSavedNumberBatch}
          />
        )}
        {csvModalOpen && (
          <QuickCsvImportModal
            apiFetch={apiFetch}
            groups={groups}
            onClose={() => setCsvModalOpen(false)}
            onImported={handleCsvImported}
          />
        )}
        {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}
      </main>
    </div>
  )
}

function CampaignSection({ label, title, subtext, muted = false, children }) {
  return (
    <section className={`campaign-section${muted ? ' muted' : ''}`}>
      <div className="campaign-section-label">{label}</div>
      <div className="campaign-section-card">
        <h2>{title}</h2>
        <p className="campaign-section-subtext">{subtext}</p>
        {children}
      </div>
    </section>
  )
}

function ContactList({ contacts, loading, isSelected, onToggle, source = 'contacts' }) {
  if (loading && contacts.length === 0) {
    return <div className="campaign-contact-list empty"><Spinner /></div>
  }
  if (contacts.length === 0) {
    return <div className="campaign-contact-list empty">No contacts found.</div>
  }
  return (
    <div className="campaign-contact-list">
      {contacts.map(contact => {
        const selected = isSelected(contact.phone)
        return (
          <label key={`${source}-${contact.id || contact.phone}`} className={`campaign-contact-row${selected ? ' selected' : ''}`}>
            <input type="checkbox" checked={selected} onChange={() => onToggle(contact)} />
            <span className="campaign-avatar" style={{ background: avatarColor(contact) }}>{initialsFor(contact)}</span>
            <span className="campaign-contact-main">
              <strong>{contact.display_name || contact.name || contact.phone}</strong>
              {(contact.display_name || contact.name) && <small>{contact.phone}</small>}
              {source === 'whatsapp' && contact.whatsapp_name && contact.name && contact.whatsapp_name !== contact.name && (
                <small>WhatsApp: {contact.whatsapp_name}</small>
              )}
            </span>
            {contact.group_name && <span className="group-badge">{contact.group_name}</span>}
            <span className="campaign-pill-wrap">
              {Object.values(contact.custom_fields || {}).filter(Boolean).slice(0, 2).map((value, index) => (
                <span className="campaign-mini-pill" key={index}>{value}</span>
              ))}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function RecipientSummary({ recipients, onRemove, onClear, withoutNames, groups }) {
  const sourceCounts = recipients.reduce((acc, r) => {
    const key = r.source || 'contacts'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const fields = Array.from(new Set(recipients.flatMap(r => Object.keys(r.custom_fields || {}))))
  return (
    <div className="unified-recipients">
      <div className="unified-recipient-head">
        <h3>Recipients <span>{recipients.length}</span></h3>
      </div>
      {recipients.length === 0 ? (
        <p className="unified-empty">No recipients yet. Add numbers or select contacts above.</p>
      ) : (
        <>
          <div className="unified-tag-list">
            {recipients.map(recipient => (
              <span key={recipient.phone} className="unified-tag">
                {recipientLabel(recipient)}
                <button onClick={() => onRemove(recipient.phone)}>x</button>
              </span>
            ))}
          </div>
          <button className="clear-recipient-link" onClick={onClear}>Clear all recipients</button>
          <div className="recipient-detail-row">
            Sources: paste {sourceCounts.paste || 0}, contacts {sourceCounts.contacts || 0}, WhatsApp {sourceCounts.whatsapp || 0}
          </div>
          <div className="recipient-detail-row">
            Data fields available: {fields.length ? fields.slice(0, 8).map(f => `{{${f}}}`).join(', ') : 'name and phone only'}
          </div>
          <div className="recipient-stat-row">
            {recipients.length.toLocaleString()} recipients · {withoutNames.toLocaleString()} without names · {groups.length.toLocaleString()} groups
          </div>
        </>
      )}
    </div>
  )
}

function QuickSaveContactModal({ mode, groups, apiFetch, onClose, onSavedContact, onSavedNumbers }) {
  const [tab, setTab] = useState(mode)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [groupName, setGroupName] = useState('')
  const [numbers, setNumbers] = useState('')
  const [customFields, setCustomFields] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmSave, setConfirmSave] = useState(null)

  function setCustomField(index, patch) {
    setCustomFields(prev => prev.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  function requestSaveSingle(event) {
    event.preventDefault()
    setConfirmSave({
      title: 'Save this contact?',
      message: 'This contact and its custom fields will be saved to BulkIt and selected for this campaign.',
      confirmText: 'Save contact',
      onConfirm: saveSingle,
    })
  }

  async function saveSingle() {
    setConfirmSave(null)
    setSaving(true)
    setError('')
    const fields = {}
    customFields.forEach(row => {
      const key = normalizeFieldName(row.key)
      if (key && row.value) fields[key] = row.value
    })
    try {
      const res = await apiFetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ name, phone, group_name: groupName || null, custom_fields: fields }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not save contact')
      onSavedContact(data.contact)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveNumbers() {
    if (!numbers.trim() || !groupName.trim()) return
    setConfirmSave(null)
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch('/api/contacts/paste', {
        method: 'POST',
        body: JSON.stringify({ text: numbers, group_name: groupName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not save numbers')
      onSavedNumbers(groupName)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card campaign-tool-modal">
        <div className="modal-head-row">
          <h3 className="modal-title">Save contacts</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="campaign-tabs compact">
          <button className={`campaign-tab${tab === 'single' ? ' active' : ''}`} onClick={() => setTab('single')}>Named contact</button>
          <button className={`campaign-tab${tab === 'numbers' ? ' active' : ''}`} onClick={() => setTab('numbers')}>Numbers to group</button>
        </div>
        {tab === 'single' ? (
          <form className="modal-form" onSubmit={requestSaveSingle}>
            <input className="input" placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} />
            <input className="input" placeholder="Phone number" required value={phone} onChange={e => setPhone(e.target.value)} />
            <input className="input" list="campaign-save-groups" placeholder="Group/tag e.g. 300 Level Mass Communication" value={groupName} onChange={e => setGroupName(e.target.value)} />
            <datalist id="campaign-save-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
            <div className="campaign-custom-fields">
              <strong>Extra data fields</strong>
              <span>Add matric number, class, department, role, zone, or any fields you need. Each field becomes a tag in messages.</span>
              {customFields.map((row, index) => (
                <div className="custom-field-row" key={index}>
                  <input className="input" placeholder="Field name" value={row.key} onChange={e => setCustomField(index, { key: e.target.value })} />
                  <input className="input" placeholder="Value" value={row.value} onChange={e => setCustomField(index, { value: e.target.value })} />
                  <button type="button" className="small-x" onClick={() => setCustomFields(prev => prev.filter((_, i) => i !== index))}>x</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setCustomFields(prev => [...prev, { key: '', value: '' }])}>Add data field</button>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions modal-actions-row">
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : 'Save and select contact'}</button>
            </div>
          </form>
        ) : (
          <div className="modal-form">
            <textarea className="campaign-textarea" rows="7" placeholder="Paste numbers, one per line or comma separated" value={numbers} onChange={e => setNumbers(e.target.value)} />
            <input className="input" list="campaign-number-groups" placeholder="Group/tag required" value={groupName} onChange={e => setGroupName(e.target.value)} />
            <datalist id="campaign-number-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
            <p className="campaign-hint">These numbers will be saved into the group and immediately selected for sending.</p>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions modal-actions-row">
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={saving || !numbers.trim() || !groupName.trim()} onClick={() => setConfirmSave({
                title: `Save numbers to ${groupName}?`,
                message: 'BulkIt will save these phone numbers into this group and select the group for sending.',
                confirmText: 'Save numbers',
                onConfirm: saveNumbers,
              })}>
                {saving ? <Spinner /> : 'Save group and select members'}
              </button>
            </div>
          </div>
        )}
        {confirmSave && <ConfirmModal {...confirmSave} onCancel={() => setConfirmSave(null)} />}
      </div>
    </div>
  )
}

function QuickCsvImportModal({ apiFetch, groups, onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [groupName, setGroupName] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [confirmImport, setConfirmImport] = useState(null)

  async function chooseFile(nextFile) {
    if (!nextFile) return
    setFile(nextFile)
    setHeaders(parseCsvHeaders(await nextFile.text()))
    setResult(null)
    setError('')
  }

  async function importCsv() {
    if (!file) return
    setConfirmImport(null)
    const mapping = Object.fromEntries(headers.map(header => {
      const type = guessColumnType(header)
      return [header, { type, field_name: type === 'custom' ? normalizeFieldName(header) : undefined }]
    }))
    setSaving(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('mapping_json', JSON.stringify(mapping))
      if (groupName.trim()) form.append('group_name', groupName.trim())
      const token = localStorage.getItem('mssn_token')
      const res = await fetch(`${API_BASE}/api/contacts/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'CSV import failed')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card campaign-tool-modal">
        <div className="modal-head-row">
          <h3 className="modal-title">Import CSV data</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-form">
          <label className="campaign-csv-picker">
            <input type="file" accept=".csv" onChange={e => chooseFile(e.target.files[0])} />
            <span>{file ? file.name : 'Choose CSV file'}</span>
          </label>
          {headers.length > 0 && (
            <div className="campaign-detected-fields">
              <strong>Detected columns</strong>
              <div>{headers.map(h => <span key={h}>{h}</span>)}</div>
              <p>Phone, name, and group are recognized automatically. Every other column is saved as a reusable personalization tag like {'{{matric_number}}'} or {'{{department}}'}.</p>
            </div>
          )}
          <input className="input" list="campaign-csv-groups" placeholder="Optional group/tag for this CSV batch" value={groupName} onChange={e => setGroupName(e.target.value)} />
          <datalist id="campaign-csv-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
          {result && (
            <div className="result-banner result-success">
              {result.inserted} contacts imported. {(result.rejected || []).length} rejected.
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions modal-actions-row">
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            {result ? (
              <button className="btn btn-primary" onClick={() => onImported(result.group_assigned || groupName)}>Select imported contacts</button>
            ) : (
              <button className="btn btn-primary" disabled={saving || !file} onClick={() => setConfirmImport({
                title: 'Import this CSV?',
                message: 'BulkIt will save every row as a contact and keep all extra columns as personalization fields.',
                confirmText: 'Import CSV',
                onConfirm: importCsv,
              })}>{saving ? <Spinner /> : 'Import CSV'}</button>
            )}
          </div>
        </div>
        {confirmImport && <ConfirmModal {...confirmImport} onCancel={() => setConfirmImport(null)} />}
      </div>
    </div>
  )
}

function ReviewBlock({ label, children }) {
  return (
    <div className="review-block">
      <span className="review-label">{label}</span>
      <div className="review-content">{children}</div>
    </div>
  )
}
