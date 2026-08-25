export const DEFAULT_OG_IMAGE_PATH = '/og-default.png'
export const DEFAULT_OG_IMAGE_ALT = 'Runway Systems social preview card'

export function resolveSeoUrl(value, origin = window.location.origin) {
  const input = String(value || '').trim()
  if (!input) return ''
  if (/^https?:\/\//i.test(input)) return input
  return `${String(origin || '').replace(/\/$/, '')}${input.startsWith('/') ? input : `/${input}`}`
}
