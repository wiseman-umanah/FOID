/**
 * Axios API client for the FOID backend.
 *
 * - Base URL points to the FastAPI dev server (http://localhost:8000)
 * - Attaches Authorization: Bearer <access_token> to every request
 * - On 401, attempts one silent token refresh then retries the request
 * - Tokens are kept in module-level variables (not localStorage) for security
 */
import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'

const _rawBase = import.meta.env.VITE_API_BASE_URL as string | undefined
export const BASE_URL = (_rawBase ?? 'http://localhost:8000').replace(/\/api\/v1\/?$/, '')

// ── In-memory token store ─────────────────────────────────────────────────
let _accessToken: string | null = null
let _refreshToken: string | null = null

export function setTokens(access: string, refresh: string) {
  _accessToken = access
  _refreshToken = refresh
  // Persist refresh token in localStorage so it survives page reloads
  localStorage.setItem('idra_refresh_token', refresh)
}

export function clearTokens() {
  _accessToken = null
  _refreshToken = null
  localStorage.removeItem('idra_refresh_token')
}

export function getAccessToken() {
  return _accessToken
}

/** Call once on app boot to restore session from persisted refresh token. */
export async function restoreSession(): Promise<boolean> {
  const stored = localStorage.getItem('idra_refresh_token')
  if (!stored) return false
  _refreshToken = stored
  return _silentRefresh()
}

// ── Axios instance ────────────────────────────────────────────────────────
export const api = axios.create({ baseURL: `${BASE_URL}/api/v1` })

// Attach access token before every request
api.interceptors.request.use(config => {
  if (_accessToken) {
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = `Bearer ${_accessToken}`
  }
  return config
})

// On 401 → try a silent refresh once, then retry
let _refreshing = false
let _refreshQueue: Array<(token: string | null) => void> = []

api.interceptors.response.use(
  res => res,
  async err => {
    const original: AxiosRequestConfig & { _retry?: boolean } = err.config
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }
    original._retry = true

    if (_refreshing) {
      // Queue concurrent requests until the refresh completes
      return new Promise((resolve, reject) => {
        _refreshQueue.push(token => {
          if (token) {
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
            resolve(api(original))
          } else {
            reject(err)
          }
        })
      })
    }

    _refreshing = true
    const newToken = await _silentRefresh() ? _accessToken : null
    _refreshing = false
    _refreshQueue.forEach(cb => cb(newToken))
    _refreshQueue = []

    if (newToken) {
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
      return api(original)
    }
    return Promise.reject(err)
  }
)

async function _silentRefresh(): Promise<boolean> {
  if (!_refreshToken) return false
  try {
    const res = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
      refresh_token: _refreshToken,
    })
    const { access_token, refresh_token } = res.data as {
      access_token: string
      refresh_token: string
    }
    setTokens(access_token, refresh_token)
    return true
  } catch {
    clearTokens()
    return false
  }
}
