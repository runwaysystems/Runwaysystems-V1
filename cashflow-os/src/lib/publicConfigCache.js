// Cache of the public platform config for components that need it without
// being pages themselves (footer email, Trustpilot widget, consent copy).
const listeners = new Set()
let cache = null

export function setPublicConfigCache(config) {
  cache = config
  listeners.forEach((listener) => listener(config))
}

export function getPublicConfigCache() {
  return cache
}

export function subscribePublicConfig(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSupportEmail(fallback = 'hello@yourdomain.com') {
  return cache?.supportEmail || fallback
}

export function getTrustpilotBusinessUnitId(fallback = '') {
  return cache?.trustpilotBusinessUnitId || fallback
}
