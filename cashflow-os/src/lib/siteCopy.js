// Site-wide UI copy. These are the strings that live outside the catalog,
// policies, and per-product content: footer brand lines, cart labels,
// checkout and success page wording, the sign-in modal, and the 404 page.
// Every value is editable from the admin Content studio -> Site copy tab and
// flows through suiteContent.siteCopy in the public config, deep-merged over
// the defaults below.

import { useEffect, useState } from 'react'
import { getPublicConfigCache, subscribePublicConfig } from './publicConfigCache'

const SITE_COPY_DEFAULTS = {
  homeSeo: {
    title: 'Runway Systems | Calm systems for busy businesses',
    description: 'A suite of connected Google Sheets products for freelancers, consultants, and small teams. One-time purchase. No subscription. Your data stays in your Drive.',
  },
  footer: {
    tagline: 'The connected Google Sheets product suite for independent businesses.',
    motto: 'Built for clarity. Designed for action.',
    supportNotes: ['Google Sheets only', 'Mon-Fri support'],
    disclaimer: 'These products are tools, not financial or tax advice.',
    socials: [
      { id: 'instagram', label: 'Instagram', url: '', visible: false },
      { id: 'youtube',   label: 'YouTube',   url: '', visible: false },
      { id: 'x',         label: 'X',         url: '', visible: false },
      { id: 'linkedin',  label: 'LinkedIn',  url: '', visible: false },
    ],
  },
  cart: {
    emptyTitle: 'Your cart is empty',
    emptyCopy: 'Add products from the suite and check out once with a single payment. Every product arrives in your library with its own private copy link.',
    assurance: 'Instant access · One-time payment · Lifetime updates',
  },
  checkoutModal: {
    title: 'Checkout could not be started.',
    body: 'No payment was taken. If the problem continues, contact',
  },
  success: {
    verifiedTitle: 'You’re in. Your access is being delivered.',
    verifyingTitle: 'Verifying your payment...',
    verifyingBody: 'We are confirming your Lemon Squeezy payment and attaching your purchase to your Google account.',
  },
  authModal: {
    title: 'Keep your systems within reach.',
    intro: 'Sign in securely with Google to keep your purchases and feedback experience connected.',
  },
  notFound: {
    title: 'This runway ends here.',
    copy: 'The page you were looking for does not exist or has moved. Browse the suite to find your way back.',
  },
  navbar: {
    buyLabel: 'Get instant access',
    browseLabel: 'Browse products',
  },
}

function mergeCopy(defaults, overrides) {
  const merged = JSON.parse(JSON.stringify(defaults))
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return merged
  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && merged[key] && typeof merged[key] === 'object') {
      merged[key] = mergeCopy(merged[key], value)
    } else if (value !== undefined && value !== null) {
      merged[key] = value
    }
  }
  return merged
}

export function siteCopy(config = null) {
  const suiteContent = config?.suiteContent || {}
  return mergeCopy(SITE_COPY_DEFAULTS, suiteContent.siteCopy)
}

// Convenience for components without a config prop: reads the public config
// cache (kept fresh by usePublicProducts on every page).
export function siteCopyDefaults() {
  return mergeCopy(SITE_COPY_DEFAULTS, null)
}

// Hook for shell components (footer, navbar, modals) that render on pages
// where no config prop is threaded through: subscribes to the public config
// cache so saved site copy appears immediately after reloads.
export function useSiteCopy() {
  const [config, setConfig] = useState(getPublicConfigCache())
  useEffect(() => subscribePublicConfig(setConfig), [])
  return siteCopy(config)
}

export { SITE_COPY_DEFAULTS }

// Resolve the configured socials to the list the footer should actually render.
// Rows with no URL, a malformed URL, or `visible: false` are dropped. The
// remaining list is returned in the order it was saved so the owner controls
// the visual order via the admin's reorder controls.
export function visibleSocials(copy) {
  const list = copy?.footer?.socials
  if (!Array.isArray(list)) return []
  return list
    .filter((row) => row && row.visible && typeof row.url === 'string' && row.url.trim())
    .map((row) => ({
      id: String(row.id || '').trim().toLowerCase(),
      label: String(row.label || '').trim() || 'Social link',
      url: row.url.trim(),
    }))
    .filter((row) => /^https?:\/\//i.test(row.url))
}

// Normalize any saved socials list so it always has a stable `id` and the
// fields the editor expects. Used by the admin before showing the form so
// legacy data (missing id, mixed case) is migrated on save.
export function normalizeSocials(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter((row) => row && typeof row === 'object')
    .map((row, index) => {
      const id = String(row.id || row.label || `social-${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `social-${index + 1}`
      return {
        id,
        label: String(row.label || '').trim() || 'Social link',
        url: typeof row.url === 'string' ? row.url.trim() : '',
        visible: Boolean(row.visible),
      }
    })
}

// Map a social id to a lucide-react icon name. The bundled icon set is
// intentionally small (Globe, Link, Mail, AtSign, MessageCircle, Music2,
// Cloud) so the footer stays consistent: a recognised platform gets a
// distinctive glyph, anything unknown falls back to a neutral link icon.
export const SOCIAL_ICON_NAMES = {
  instagram: 'AtSign',
  youtube:   'MessageCircle',
  x:         'Link',
  twitter:   'Link',
  linkedin:  'Link',
  facebook:  'Globe',
  tiktok:    'Music2',
  threads:   'AtSign',
  github:    'Link',
  mastodon:  'Globe',
  pinterest: 'Link',
  reddit:    'MessageCircle',
  bluesky:   'Cloud',
  website:   'Globe',
}

export function socialIconName(id) {
  return SOCIAL_ICON_NAMES[String(id || '').trim().toLowerCase()] || 'Link'
}
