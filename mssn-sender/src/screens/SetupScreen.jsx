import { useState, useRef } from 'react'
import { Spinner } from '../components/Spinner.jsx'

const STORAGE_INSTANCE = 'mssn_instance'
const STORAGE_USER = 'mssn_user'

function generateInstanceName(email) {
  const prefix = (email || '').split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase()
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return prefix + suffix
}

export default function SetupScreen({ onNavigate, apiFetch, isReconnect = false }) {
  const user = JSON.parse(localStorage.getItem(STORAGE_USER) || '{}')

  // For reconnect: use existing instance name from localStorage
  // For new setup: generate a new one
  const existingInstance = localStorage.getItem(STORAGE_INSTANCE)
  const instanceNameRef = useRef(
    isReconnect && existingInstance
      ? existingInstance
      : generateInstanceName(user.email || 'mssn')
  )

  const [qrSrc, setQrSrc] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState(null)

  async function handleGenerateQR() {
    setQrLoading(true)
    setQrError('')
    setQrSrc(null)
    try {
      const res = await apiFetch(`/api/instance/connect?instance=${encodeURIComponent(instanceNameRef.current)}`)
      if (!res || !res.ok) throw new Error('Failed to generate QR code')
      const data = await res.json()
      const src = data.base64 || data.qr || data.code || null
      if (!src) throw new Error('No QR code returned from server')
      setQrSrc(src.startsWith('data:') ? src : `data:image/png;base64,${src}`)
    } catch (e) {
      setQrError(e.message)
    } finally {
      setQrLoading(false)
    }
  }

  async function handleVerify() {
    setVerifyLoading(true)
    setVerifyMsg(null)
    try {
      const res = await apiFetch(`/api/instance/status?instance=${encodeURIComponent(instanceNameRef.current)}`)
      const data = await res.json()
      const state = data?.instance?.state || data?.state
      if (state === 'open') {
        // Only save to DB if this is a new setup (not reconnect)
        if (!isReconnect) {
          await apiFetch('/api/instance/save', {
            method: 'POST',
            body: JSON.stringify({
              instance_name: instanceNameRef.current,
              whatsapp_number: ''
            })
          })
        }
        localStorage.setItem(STORAGE_INSTANCE, instanceNameRef.current)
        setVerifyMsg({ type: 'success', text: 'Connected! Redirecting to your dashboard...' })
        setTimeout(() => onNavigate('dashboard'), 1500)
      } else {
        setVerifyMsg({ type: 'warn', text: 'Not connected yet. Please scan the QR code and try again.' })
      }
    } catch (e) {
      setVerifyMsg({ type: 'warn', text: 'Could not check connection. Try again.' })
    } finally {
      setVerifyLoading(false)
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-header">
          <h2>{isReconnect ? 'Reconnect Your WhatsApp' : 'Connect Your WhatsApp'}</h2>
        </div>

        <div className="setup-body">
          {isReconnect && (
            <div className="warn-box" style={{ marginBottom: 16 }}>
              Your WhatsApp connection was disconnected. Scan the QR code below to reconnect.
            </div>
          )}

          <p className="setup-desc">
            {isReconnect
              ? 'Generate a new QR code and scan it with your WhatsApp to restore the connection.'
              : 'Scan the QR code below with the WhatsApp number you want to use for sending messages.'}
          </p>

          <button
            className="btn btn-primary btn-full"
            onClick={handleGenerateQR}
            disabled={qrLoading}
          >
            {qrLoading ? <><Spinner /> Generating...</> : 'Generate QR Code'}
          </button>

          {qrError && <p className="form-error">{qrError}</p>}

          {qrSrc && (
            <div className="qr-block">
              <img src={qrSrc} alt="WhatsApp QR Code" className="qr-img" />
              <ol className="qr-steps">
                <li>Open WhatsApp on your phone</li>
                <li>Tap Menu (3 dots) → Linked Devices</li>
                <li>Tap Link a Device</li>
                <li>Scan the QR code above</li>
              </ol>
            </div>
          )}

          {qrSrc && (
            <>
              <button
                className="btn btn-outline btn-full"
                onClick={handleVerify}
                disabled={verifyLoading}
                style={{ marginTop: 12 }}
              >
                {verifyLoading ? <><Spinner /> Checking...</> : "I've scanned it — verify connection"}
              </button>
              {verifyMsg && (
                <p className={`setup-msg setup-msg-${verifyMsg.type}`}>{verifyMsg.text}</p>
              )}
            </>
          )}

          {isReconnect && (
            <p className="setup-skip">
              <button className="link-btn" onClick={() => onNavigate('dashboard')}>
                Skip for now → Go to dashboard
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
