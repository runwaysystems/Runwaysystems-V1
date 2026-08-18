// Cookie and local-storage consent state. Essential storefront storage
// (cart, theme, sign-in persistence) stays active regardless; optional
// third-party content such as the Trustpilot reviews widget is gated behind
// explicit acceptance. The choice itself is stored in localStorage, which is
// exempt from consent under ePrivacy.

const CONSENT_KEY = 'runway-consent'
const listeners = new Set()

export function getConsent() {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY)
    return value === 'all' || value === 'essential' ? value : null
  } catch {
    return null
  }
}

export function setConsent(value) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // Storage can be restricted; the choice still applies for this session.
  }
  emit()
}

export function clearConsent() {
  try {
    window.localStorage.removeItem(CONSENT_KEY)
  } catch {
    // Nothing to clear when storage is restricted.
  }
  emit()
}

export function hasOptionalConsent() {
  return getConsent() === 'all'
}

export function subscribeConsent(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit() {
  const value = getConsent()
  listeners.forEach((listener) => listener(value))
}
