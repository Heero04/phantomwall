const AUTH_REQUIRED_EVENT = 'phantomwall:auth-required'

export function getIdToken() {
  return localStorage.getItem('idToken')
}

function mergeHeaders(baseHeaders = {}, authToken) {
  if (baseHeaders instanceof Headers) {
    const headers = new Headers(baseHeaders)
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`)
    }
    return headers
  }

  const normalized = { ...baseHeaders }
  if (authToken && !normalized.Authorization) {
    normalized.Authorization = `Bearer ${authToken}`
  }
  return normalized
}

export async function apiFetch(url, options = {}) {
  const token = getIdToken()
  const response = await fetch(url, {
    ...options,
    headers: mergeHeaders(options.headers, token),
  })

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT))
  }

  return response
}

export { AUTH_REQUIRED_EVENT }
