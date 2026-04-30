import { useEffect, useMemo, useRef, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import { Spinner } from '../components/Spinner.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { API_BASE } from '../api.js'

const PAGE_SIZE = 50

function emptyContact() {
  return { name: '', phone: '', group_name: '', custom_fields: {} }
}

function normalizeFieldName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"' && line[i + 1] === '"') {
      current += '"'
      i += 1
    } else if (ch === '"') {
      quoted = !quoted
    } else if (ch === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells.map(c => c.trim())
}

function parseCsvPreview(text) {
  const rows = text.split(/\r?\n/).filter(Boolean).map(parseCsvLine)
  const headers = rows[0] || []
  return {
    headers,
    rows: rows.slice(1, 4).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] || '']))),
    count: Math.max(rows.length - 1, 0),
  }
}

function guessColumnType(column) {
  const key = normalizeFieldName(column)
  if (['phone', 'phone_number', 'phonenumber', 'mobile', 'tel', 'telephone'].includes(key)) return 'phone'
  if (['name', 'full_name', 'fullname', 'student_name', 'contact_name'].includes(key)) return 'name'
  if (['group', 'group_name', 'groupname'].includes(key)) return 'group'
  return 'custom'
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

export default function ContactsScreen({ onNavigate, apiFetch }) {
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [groupCounts, setGroupCounts] = useState({})
  const [allTotal, setAllTotal] = useState(0)
  const [listTotal, setListTotal] = useState(0)
  const [ungrouped, setUngrouped] = useState(0)
  const [activeGroup, setActiveGroup] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirm, setConfirm] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [moveGroup, setMoveGroup] = useState('')

  async function fetchGroups() {
    const res = await apiFetch('/api/contacts/groups')
    if (res && res.ok) {
      const data = await res.json()
      setGroups(data.groups || [])
      setGroupCounts(data.counts || {})
      setAllTotal(data.total || 0)
      setUngrouped(data.ungrouped || 0)
    }
  }

  async function fetchContacts(nextPage = page, overrides = {}) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: nextPage, per_page: PAGE_SIZE })
      const groupFilter = Object.prototype.hasOwnProperty.call(overrides, 'group') ? overrides.group : activeGroup
      const searchFilter = Object.prototype.hasOwnProperty.call(overrides, 'search') ? overrides.search : search
      if (groupFilter) params.set('group', groupFilter)
      if (searchFilter.trim()) params.set('search', searchFilter.trim())
      const res = await apiFetch(`/api/contacts?${params}`)
      if (res && res.ok) {
        const data = await res.json()
        setContacts(data.contacts || [])
        setListTotal(data.total || 0)
        setPages(data.pages || 1)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroups() }, [])
  useEffect(() => {
    setSelectedIds(new Set())
    fetchContacts(page)
  }, [activeGroup, search, page])

  function selectGroup(group) {
    setActiveGroup(group)
    setPage(1)
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAllCurrentPage() {
    setSelectedIds(new Set(contacts.map(c => c.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function refreshAll() {
    await fetchGroups()
    await fetchContacts(page)
  }

  async function handleCsvImported(result) {
    const importedGroup = result?.group_assigned || ''
    setCsvOpen(false)
    setSearch('')
    setActiveGroup(importedGroup)
    setPage(1)
    clearSelection()
    await fetchGroups()
    await fetchContacts(1, { group: importedGroup, search: '' })
  }

  async function deleteContacts(ids) {
    await apiFetch('/api/contacts/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ contact_ids: ids }),
    })
    clearSelection()
    setConfirm(null)
    refreshAll()
  }

  function requestBulkDelete() {
    const count = selectedIds.size
    setConfirm({
      title: `Delete ${count} contacts?`,
      message: 'This action cannot be undone.',
      confirmText: `Delete ${count} contacts`,
      danger: true,
      onConfirm: () => deleteContacts(Array.from(selectedIds)),
    })
  }

  function requestDelete(contact) {
    setConfirm({
      title: 'Delete contact?',
      message: `${contact.name || contact.phone} will be removed from BulkIt.`,
      confirmText: 'Delete contact',
      danger: true,
      onConfirm: () => deleteContacts([contact.id]),
    })
  }

  async function moveSelected() {
    if (!selectedIds.size || !moveGroup.trim()) return
    await apiFetch('/api/contacts/bulk-move', {
      method: 'POST',
      body: JSON.stringify({ contact_ids: Array.from(selectedIds), group_name: moveGroup.trim() }),
    })
    setMoveGroup('')
    clearSelection()
    refreshAll()
  }

  const allSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id))
  const shownFrom = listTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const shownTo = Math.min(page * PAGE_SIZE, listTotal)

  return (
    <div className="screen">
      <Navbar onNavigate={onNavigate} apiFetch={apiFetch} />
      <div className="contacts-shell">
        <div className="contacts-topbar">
          <div className="contacts-title-row">
            <button className="back-btn" onClick={() => onNavigate('dashboard')}>← Dashboard</button>
            <h1 className="page-title">Contacts</h1>
            <span className="count-badge">{formatNumber(allTotal)}</span>
          </div>
          <div className="contacts-actions">
            <button className="btn btn-outline" onClick={() => setWaOpen(true)}>Import from WhatsApp</button>
            <button className="btn btn-outline" onClick={() => setCsvOpen(true)}>Import CSV</button>
            <button className="btn btn-primary" onClick={() => { setEditingContact(null); setAddOpen(true) }}>+ Add Contact</button>
          </div>
        </div>

        <div className="contacts-feature-guide">
          <div>
            <strong>Build rich contact lists</strong>
            <span>Save single contacts, paste number batches into groups, or upload CSVs with any columns.</span>
          </div>
          <div>
            <strong>Use every column later</strong>
            <span>Fields like matric number, department, class, role, or zone become message tags automatically.</span>
          </div>
          <div>
            <strong>Send to groups fast</strong>
            <span>Use the arrow beside a group to select every member for a campaign.</span>
          </div>
        </div>

        <div className="contacts-layout">
          <aside className="groups-panel">
            <h2>Groups</h2>
            <GroupItem label="All Contacts" count={allTotal} active={!activeGroup} onClick={() => selectGroup('')} onSend={() => onNavigate('campaign')} />
            <GroupItem label="WhatsApp Contacts" count={groupCounts['WhatsApp Contacts'] || 0} active={activeGroup === 'WhatsApp Contacts'} onClick={() => selectGroup('WhatsApp Contacts')} onSend={() => onNavigate('campaign', { group: 'WhatsApp Contacts', groupName: 'WhatsApp Contacts' })} />
            <GroupItem label="Ungrouped" count={ungrouped} active={activeGroup === '__ungrouped__'} onClick={() => selectGroup('__ungrouped__')} onSend={() => onNavigate('campaign', { group: '__ungrouped__', groupName: 'Ungrouped' })} />
            <div className="groups-divider" />
            {groups.filter(g => g !== 'WhatsApp Contacts').map(g => (
              <GroupItem key={g} label={g} count={groupCounts[g] || 0} active={activeGroup === g} onClick={() => selectGroup(g)} onSend={() => onNavigate('campaign', { group: g, groupName: g })} />
            ))}
            <button className="btn btn-outline btn-full group-new-btn" onClick={() => { setEditingContact(null); setAddOpen(true) }}>+ New Group</button>
          </aside>

          <main className="contacts-main">
            <input className="input contacts-search" placeholder="Search name, phone, group, or custom fields" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />

            {selectedIds.size > 0 && (
              <div className="bulk-bar">
                <strong>{selectedIds.size} selected</strong>
                <button className="btn btn-sm btn-danger" onClick={requestBulkDelete}>Delete selected</button>
                <input className="input bulk-group-input" placeholder="Move to group" value={moveGroup} onChange={e => setMoveGroup(e.target.value)} />
                <button className="btn btn-sm btn-outline" onClick={moveSelected} disabled={!moveGroup.trim()}>Move</button>
                <button className="link-btn" onClick={clearSelection}>Clear</button>
              </div>
            )}

            <div className="contacts-table-wrap">
              <table className="table contacts-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={allSelected} onChange={e => e.target.checked ? selectAllCurrentPage() : clearSelection()} /></th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Group</th>
                    <th>Custom fields preview</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" className="table-empty"><Spinner /></td></tr>
                  ) : contacts.length === 0 ? (
                    <tr><td colSpan="6" className="table-empty">No contacts found.</td></tr>
                  ) : contacts.map(contact => (
                    <tr key={contact.id} className={selectedIds.has(contact.id) ? 'row-selected' : ''}>
                      <td><input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleSelect(contact.id)} /></td>
                      <td>{contact.name || <span className="text-muted">member</span>}</td>
                      <td>{contact.phone}</td>
                      <td>{contact.group_name ? <span className="group-badge">{contact.group_name}</span> : <span className="text-muted">Ungrouped</span>}</td>
                      <td><CustomPreview fields={contact.custom_fields} /></td>
                      <td>
                        <div className="icon-actions">
                          <button title="Edit" onClick={() => { setEditingContact(contact); setAddOpen(true) }}>✎</button>
                          <button title="Delete" className="danger-icon" onClick={() => requestDelete(contact)}>⌫</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="contacts-pagination">
              <span>Showing {formatNumber(shownFrom)}-{formatNumber(shownTo)} of {formatNumber(listTotal)} contacts</span>
              <Pagination page={page} pages={pages} setPage={setPage} />
            </div>
          </main>
        </div>
      </div>

      {addOpen && <AddContactModal apiFetch={apiFetch} groups={groups} contact={editingContact} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); refreshAll() }} />}
      {csvOpen && <CsvUploadModal apiFetch={apiFetch} groups={groups} onClose={() => setCsvOpen(false)} onImported={handleCsvImported} />}
      {waOpen && <WhatsAppImportModal apiFetch={apiFetch} groups={groups} onClose={() => setWaOpen(false)} onSaved={() => { setWaOpen(false); refreshAll() }} />}
      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}

function GroupItem({ label, count, active, onClick, onSend }) {
  return (
    <div className={`group-item${active ? ' active' : ''}`}>
      <button onClick={onClick}>
        <span>{label}</span>
        <em>{formatNumber(count)}</em>
      </button>
      <button className="group-send-btn" title={`Send message to ${label}`} onClick={onSend}>➜</button>
    </div>
  )
}

function CustomPreview({ fields }) {
  const values = Object.values(fields || {}).filter(Boolean).slice(0, 2)
  if (!values.length) return <span className="text-muted">None</span>
  return <div className="pill-row">{values.map((value, i) => <span key={i} className="mini-pill">{value}</span>)}</div>
}

function Pagination({ page, pages, setPage }) {
  const nums = useMemo(() => {
    const values = new Set([1, pages, page - 1, page, page + 1])
    return [...values].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b)
  }, [page, pages])
  return (
    <div className="pagination compact-pagination">
      <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
      {nums.map((n, i) => (
        <span key={n} className="pagination-number-wrap">
          {i > 0 && n - nums[i - 1] > 1 && <span className="page-ellipsis">...</span>}
          <button className={`page-btn${page === n ? ' page-active' : ''}`} onClick={() => setPage(n)}>{n}</button>
        </span>
      ))}
      <button className="page-btn" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  )
}

function AddContactModal({ apiFetch, groups, contact, onClose, onSaved }) {
  const [tab, setTab] = useState('single')
  const [form, setForm] = useState(contact ? {
    name: contact.name || '',
    phone: contact.phone || '',
    group_name: contact.group_name || '',
    custom_fields: contact.custom_fields || {},
  } : emptyContact())
  const [newGroup, setNewGroup] = useState('')
  const [numbers, setNumbers] = useState('')
  const [numberGroup, setNumberGroup] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmSave, setConfirmSave] = useState(null)
  const customRows = Object.entries(form.custom_fields || {})

  function updateFieldKey(index, key) {
    const next = {}
    customRows.forEach(([oldKey, value], i) => { next[i === index ? key : oldKey] = value })
    setForm(f => ({ ...f, custom_fields: next }))
  }

  function updateFieldValue(key, value) {
    setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [key]: value } }))
  }

  function removeField(key) {
    setForm(f => {
      const next = { ...f.custom_fields }
      delete next[key]
      return { ...f, custom_fields: next }
    })
  }

  function requestSaveSingle(e) {
    e.preventDefault()
    setConfirmSave({
      title: contact ? 'Save changes?' : 'Save this contact?',
      message: 'BulkIt will save the phone number, group, and every custom field so they can be used while sending messages.',
      confirmText: contact ? 'Save changes' : 'Save contact',
      onConfirm: saveSingle,
    })
  }

  async function saveSingle() {
    setConfirmSave(null)
    setSaving(true)
    const group = form.group_name === '__new__' ? newGroup : form.group_name
    const body = { ...form, group_name: group || null }
    const path = contact ? `/api/contacts/${contact.id}` : '/api/contacts'
    await apiFetch(path, { method: contact ? 'PUT' : 'POST', body: JSON.stringify(body) })
    setSaving(false)
    onSaved()
  }

  async function saveNumbers() {
    if (!numbers.trim() || !numberGroup.trim()) return
    setConfirmSave(null)
    setSaving(true)
    await apiFetch('/api/contacts/paste', {
      method: 'POST',
      body: JSON.stringify({ text: numbers, group_name: numberGroup }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card wide-modal">
        <div className="modal-head-row">
          <h3 className="modal-title">{contact ? 'Edit Contact' : 'Add Contact'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tab-row">
          <button className={`tab-btn${tab === 'single' ? ' tab-active' : ''}`} onClick={() => setTab('single')}>Single Contact</button>
          <button className={`tab-btn${tab === 'numbers' ? ' tab-active' : ''}`} onClick={() => setTab('numbers')}>Number Only</button>
        </div>
        {tab === 'single' ? (
          <form onSubmit={requestSaveSingle} className="modal-form">
            <input className="input" placeholder="Name (optional)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="input" required placeholder="Phone, e.g. 08012345678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <select className="input select-input" value={form.group_name} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}>
              <option value="">Ungrouped</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
              <option value="__new__">New group...</option>
            </select>
            {form.group_name === '__new__' && <input className="input" placeholder="New group name" value={newGroup} onChange={e => setNewGroup(e.target.value)} />}
            <div className="custom-fields-box">
              <div className="mini-section-title">Custom fields</div>
              <p className="field-hint">Add any data you want to personalize later. Example: matric_number, class, department, role, zone.</p>
              {customRows.map(([key, value], index) => (
                <div className="custom-field-row" key={`${key}-${index}`}>
                  <input className="input" placeholder="Field name" value={key} onChange={e => updateFieldKey(index, normalizeFieldName(e.target.value))} />
                  <input className="input" placeholder="Field value" value={value} onChange={e => updateFieldValue(key, e.target.value)} />
                  <button type="button" className="small-x" onClick={() => removeField(key)}>×</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [`field_${customRows.length + 1}`]: '' } }))}>Add custom field</button>
            </div>
            <div className="modal-actions modal-actions-row">
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : 'Save Contact'}</button>
            </div>
          </form>
        ) : (
          <div className="modal-form">
            <textarea className="textarea" rows="7" placeholder="Paste phone numbers, one per line" value={numbers} onChange={e => setNumbers(e.target.value)} />
            <input className="input" list="group-options" placeholder="Select or create a group for these numbers" value={numberGroup} onChange={e => setNumberGroup(e.target.value)} />
            <datalist id="group-options">{groups.map(g => <option key={g} value={g} />)}</datalist>
            <div className="modal-actions modal-actions-row">
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={saving || !numbers.trim() || !numberGroup.trim()} onClick={() => setConfirmSave({
                title: `Save numbers to ${numberGroup}?`,
                message: 'These numbers will be saved without individual names and tagged with this group.',
                confirmText: 'Save numbers',
                onConfirm: saveNumbers,
              })}>
                {saving ? <Spinner /> : `Add ${numbers.split(/[\n,]+/).filter(Boolean).length} numbers to group`}
              </button>
            </div>
          </div>
        )}
        {confirmSave && <ConfirmModal {...confirmSave} onCancel={() => setConfirmSave(null)} />}
      </div>
    </div>
  )
}

function CsvUploadModal({ apiFetch, groups, onClose, onImported }) {
  const fileRef = useRef(null)
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState({ headers: [], rows: [], count: 0 })
  const [mapping, setMapping] = useState({})
  const [groupName, setGroupName] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function chooseFile(nextFile) {
    if (!nextFile) return
    setFile(nextFile)
    const text = await nextFile.text()
    const nextPreview = parseCsvPreview(text)
    setPreview(nextPreview)
    setMapping(Object.fromEntries(nextPreview.headers.map(h => [h, { type: guessColumnType(h), field_name: normalizeFieldName(h) }])))
    setStep(2)
  }

  function downloadSample() {
    const csv = 'phone,name,matric_number,level,department,class\n08012345678,Fatimah Bello,190404001,300,Mass Comm,CSC201\n08098765432,Musa Ibrahim,190404002,300,Mass Comm,CSC201\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'bulkit-sample-contacts.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function setColumn(column, patch) {
    setMapping(prev => ({ ...prev, [column]: { ...prev[column], ...patch } }))
  }

  async function importCsv() {
    setLoading(true)
    setError('')
    const form = new FormData()
    form.append('file', file)
    form.append('mapping_json', JSON.stringify(mapping))
    if (groupName.trim()) form.append('group_name', groupName.trim())
    const token = localStorage.getItem('mssn_token')
    try {
      const res = await fetch(API_BASE + '/api/contacts/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'CSV import failed')
      setResult(data)
      setStep(5)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const mappedColumns = Object.entries(mapping).filter(([, v]) => v.type !== 'skip').map(([col, v]) => v.type === 'custom' ? v.field_name : v.type)
  const hasPhone = Object.values(mapping).some(v => v.type === 'phone')

  return (
    <div className="modal-overlay">
      <div className="modal-card xwide-modal">
        <div className="modal-head-row">
          <h3 className="modal-title">Import CSV</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {step === 1 && (
          <div className="modal-form">
            <div className="upload-zone" onClick={() => fileRef.current?.click()} onDrop={e => { e.preventDefault(); chooseFile(e.dataTransfer.files[0]) }} onDragOver={e => e.preventDefault()}>
              <div className="upload-icon">↑</div>
              <p className="upload-text">Drop your CSV file here or click to browse</p>
              <p className="upload-sub">Only phone is required. Every other column becomes reusable message data.</p>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => chooseFile(e.target.files[0])} />
            </div>
            <button className="link-btn" onClick={downloadSample}>Download sample CSV</button>
          </div>
        )}
        {step === 2 && (
          <div className="modal-form">
            <div className="csv-preview-wrap">
              <table className="table compact-table">
                <thead><tr>{preview.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{preview.rows.map((row, i) => <tr key={i}>{preview.headers.map(h => <td key={h}>{row[h]}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="column-map-list">
              <p className="field-hint">Map phone, name, and group. Keep any other column as a custom field so it appears later as a personalization tag.</p>
              {preview.headers.map(column => (
                <div className="column-map-row" key={column}>
                  <strong>{column}</strong>
                  <select className="input select-input" value={mapping[column]?.type || 'custom'} onChange={e => setColumn(column, { type: e.target.value })}>
                    <option value="phone">Phone number</option>
                    <option value="name">Name</option>
                    <option value="group">Group</option>
                    <option value="custom">Custom field</option>
                    <option value="skip">Skip</option>
                  </select>
                  {mapping[column]?.type === 'custom' && <input className="input" value={mapping[column]?.field_name || ''} onChange={e => setColumn(column, { field_name: normalizeFieldName(e.target.value) })} />}
                </div>
              ))}
            </div>
            <div className="modal-actions modal-actions-row">
              <button className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary" disabled={!hasPhone} onClick={() => setStep(3)}>Next</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="modal-form">
            <p className="modal-body">Add all these contacts to a group?</p>
            <input className="input" list="csv-group-options" placeholder="Group name (optional)" value={groupName} onChange={e => setGroupName(e.target.value)} />
            <datalist id="csv-group-options">{groups.map(g => <option key={g} value={g} />)}</datalist>
            <div className="modal-actions modal-actions-row">
              <button className="btn btn-outline" onClick={() => setStep(2)}>Back</button>
              <button className="btn btn-primary" onClick={() => setStep(4)}>Preview</button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="modal-form">
            <div className="summary-card">
              <div className="summary-row"><span>Contacts</span><strong>{formatNumber(preview.count)} will be imported</strong></div>
              <div className="summary-row"><span>Detected columns</span><strong>{mappedColumns.join(', ')}</strong></div>
              <div className="summary-row"><span>Group</span><strong>{groupName || 'CSV values / ungrouped'}</strong></div>
            </div>
            <div className="modal-actions modal-actions-row">
              <button className="btn btn-outline" onClick={() => setStep(3)}>Back</button>
              <button className="btn btn-primary" onClick={importCsv} disabled={loading}>{loading ? <Spinner /> : `Import ${formatNumber(preview.count)} contacts`}</button>
            </div>
            {error && <p className="form-error">{error}</p>}
          </div>
        )}
        {step === 5 && result && (
          <div className="modal-form">
            <div className="result-banner result-success">{formatNumber(result.inserted)} imported successfully. {(result.rejected || []).length} rejected.</div>
            {(result.rejected || []).length > 0 && <ul className="rejected-list">{result.rejected.map((r, i) => <li key={i}>Row {r.row}: {r.reason}</li>)}</ul>}
            <button className="btn btn-primary" onClick={() => onImported(result)}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

function WhatsAppImportModal({ apiFetch, groups, onClose, onSaved }) {
  const [contacts, setContacts] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch] = useState('')
  const [groupName, setGroupName] = useState('WhatsApp Contacts')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    apiFetch('/api/contacts/whatsapp-contacts')
      .then(r => r && r.json())
      .then(data => {
        const list = data.contacts || []
        setContacts(list)
        setSelected(new Set(list.map(c => c.phone)))
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    return !q || (c.name || '').toLowerCase().includes(q) || c.phone.includes(q)
  })

  function toggle(phone) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(phone) ? next.delete(phone) : next.add(phone)
      return next
    })
  }

  async function saveSelected() {
    setSaving(true)
    const chosen = contacts.filter(c => selected.has(c.phone))
    const res = await apiFetch('/api/contacts/whatsapp-contacts', {
      method: 'POST',
      body: JSON.stringify({ save_to_contacts: true, contacts: chosen, group_name: groupName || 'WhatsApp Contacts' }),
    })
    const data = await res.json()
    setResult(data)
    setSaving(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card wide-modal">
        <div className="modal-head-row">
          <h3 className="modal-title">Import from WhatsApp</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {loading ? <div className="table-empty"><Spinner /></div> : result ? (
          <div className="modal-form">
            <div className="result-banner result-success">{formatNumber(result.saved)} contacts saved with names. {formatNumber(result.already_existed)} already existed.</div>
            <button className="btn btn-primary" onClick={onSaved}>Done</button>
          </div>
        ) : (
          <div className="modal-form">
            <input className="input" placeholder="Search WhatsApp contacts" value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn btn-sm btn-outline" onClick={() => setSelected(new Set(filtered.map(c => c.phone)))}>Select All</button>
            <div className="wa-import-list">
              {filtered.map(c => (
                <label key={c.phone} className="contact-row">
                  <input type="checkbox" checked={selected.has(c.phone)} onChange={() => toggle(c.phone)} />
                  <span className="contact-name">{c.name || c.phone}</span>
                  {c.name && <span className="contact-phone">{c.phone}</span>}
                </label>
              ))}
            </div>
            <input className="input" list="wa-group-options" placeholder="Save selected contacts to group (optional)" value={groupName} onChange={e => setGroupName(e.target.value)} />
            <datalist id="wa-group-options">{groups.map(g => <option key={g} value={g} />)}</datalist>
            <div className="modal-actions modal-actions-row">
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={saving || selected.size === 0} onClick={saveSelected}>{saving ? <Spinner /> : `Save ${selected.size} contacts to BulkIt`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
