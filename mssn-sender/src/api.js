export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002'

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('mssn_token')
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
