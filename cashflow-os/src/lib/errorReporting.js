// Client-side error reporting (Layer 12). Render crashes, unhandled script
// errors and rejected promises are posted to the platform Worker so the
// owner can see them in the dashboard (Operations section) instead of them
// dying silently in one visitor's console.
//
// Rules this module lives by:
//   - Fire and forget. Reporting must never throw, block rendering, or
//     retry; a reporting bug must not become a second outage.
//   - No secrets. Only kind, message, stack frame text and the page path
//     are sent. The Worker re-redacts and rate-limits anyway.
//   - Silent when the build has no API configured (preview/localStorage
//     adapter): there is nowhere meaningful to send the report.

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

let installed = false

function currentPath() {
  try {
    return typeof window !== 'undefined' ? String(window.location?.pathname || '') : ''
  } catch {
    return ''
  }
}

export function reportClientError({ kind = 'error', message, stack = '', url } = {}) {
  if (!API_BASE_URL || typeof fetch !== 'function') return
  const payload = {
    kind: String(kind || 'error').slice(0, 40),
    message: String(message || 'Unknown client error').slice(0, 500),
    stack: String(stack || '').slice(0, 4000),
    url: String(url ?? currentPath()).slice(0, 300),
  }
  try {
    // keepalive lets the report outlive the page during a crash-unload.
    fetch(`${API_BASE_URL}/events/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {})
  } catch {
    // Never let telemetry break the app it is watching.
  }
}

// Module-level guards so <React.StrictMode> double-mounting (or a future
// second import site) cannot attach duplicate listeners.
export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    reportClientError({
      kind: 'error',
      message: event.message,
      stack: event.error?.stack || '',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportClientError({
      kind: 'unhandledrejection',
      message: reason?.message || String(reason || 'Unhandled promise rejection'),
      stack: reason?.stack || '',
    })
  })
}
