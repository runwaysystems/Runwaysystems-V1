// All persistence and server communication stays behind this module. The
// production adapter targets the Cloudflare Worker; localStorage is only a
// clearly labelled preview provider for interface development.

import { defaultProducts } from '../data/catalog'

const DEFAULT_PRODUCTION_API_BASE_URL = 'https://cashflow-os-platform.runwaysystems-cloud.workers.dev'
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const API_BASE_URL = configuredApiBaseUrl || (import.meta.env.DEV ? '' : DEFAULT_PRODUCTION_API_BASE_URL)

// The localStorage adapter below is a PREVIEW-ONLY provider for interface
// development. Local dev may still opt into it by leaving VITE_API_BASE_URL
// empty, but production builds now fall back to the Runway Systems Worker so
// dashboard edits persist to D1 and the sitemap can reflect active products.
export const IS_PREVIEW_DATA = !API_BASE_URL

if (!configuredApiBaseUrl && API_BASE_URL && typeof window !== 'undefined' && !import.meta.env.DEV) {
  console.warn(
    '[Runway Systems] VITE_API_BASE_URL is not set in this build. Falling back to ' +
    `${DEFAULT_PRODUCTION_API_BASE_URL}. Set VITE_API_BASE_URL explicitly in Pages for staging or custom Worker domains.`,
  )
}

if (IS_PREVIEW_DATA && typeof window !== 'undefined' && !import.meta.env.DEV) {
  console.error(
    '[Runway Systems] The storefront is running on preview mock data: dashboard numbers are seeded demo values ' +
    'and product edits are saved only to this browser. Set VITE_API_BASE_URL to your Worker URL in the Pages build variables and redeploy.',
  )
}
const STORAGE_KEY = 'cashflow-platform-mock-v2'
const DATA_EVENT = 'cashflow-platform-data-change'

const seedTestimonials = [
  {
    id: 'review-olivia',
    name: 'Olivia M.',
    rating: 5,
    text: 'I finally know what I can pay myself without guessing. The forecast has become part of my Monday routine.',
    status: 'approved',
    createdAt: '2026-07-18T10:30:00.000Z',
  },
  {
    id: 'review-marcus',
    name: 'Marcus T.',
    rating: 5,
    text: 'It replaced three disconnected trackers and made overdue invoices impossible to ignore.',
    status: 'approved',
    createdAt: '2026-07-25T14:10:00.000Z',
  },
  {
    id: 'review-priya',
    name: 'Priya S.',
    rating: 4,
    text: 'The setup was quick, the categories are practical, and my cash position is clear at a glance.',
    status: 'approved',
    createdAt: '2026-08-02T08:45:00.000Z',
  },
  {
    id: 'review-pending-demo',
    name: 'Demo submission',
    rating: 5,
    text: 'A pending testimonial is included so the approval workflow can be tested immediately.',
    status: 'pending',
    createdAt: '2026-08-10T09:15:00.000Z',
  },
]

const defaultSettings = {
  activePriceId: 'price_replace_with_test_price',
  discountEnabled: true,
  offerActive: true,
  offerLabel: 'Launch Offer',
  displayOriginalPrice: '$69',
  displaySalePrice: '$39',
  emailTemplateText: "How's CASHFLOW OS working for you?",
  trustpilotBusinessUrl: import.meta.env.VITE_TRUSTPILOT_REVIEW_URL || 'https://www.trustpilot.com/review/your-domain.com',
  suiteContent: {},
  policies: {},
  supportEmail: '',
  trustpilotBusinessUnitId: '',
  announcement: { active: false, message: '', linkText: '', linkUrl: '', dismissible: true },
  defaultOffer: { offerActive: true, offerLabel: 'Launch Offer', displayOriginalPrice: '', displaySalePrice: '' },
  paymentProvider: 'lemonsqueezy',
  lemonSqueezyStoreId: '',
  lemonSqueezyBundleVariantId: '',
}

const mockAnalytics = {
  totalSales: 284,
  revenue: 11076,
  conversionRate: 4.8,
  pageViews: 14820,
  averageRating: 4.8,
  reviewSubmissionRate: 18.6,
  revenueSeries: [720, 940, 880, 1210, 1470, 1630, 1515, 1870],
  conversionSeries: [3.1, 3.8, 3.5, 4.2, 4.7, 5.1, 4.6, 4.8],
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
}

const defaultIntegrations = [
  { id: 'lemonsqueezy', label: 'Lemon Squeezy', status: 'setup', detail: 'Merchant of record: Lemon Squeezy handles global sales tax and remittance for your orders' },
  { id: 'supabase', label: 'Supabase', status: import.meta.env.VITE_SUPABASE_URL ? 'connected' : 'setup', detail: 'Google OAuth and account verification' },
  { id: 'email', label: 'Brevo', status: 'setup', detail: 'Delivery and neutral review invitations' },
  { id: 'trustpilot', label: 'Trustpilot', status: import.meta.env.VITE_TRUSTPILOT_BUSINESS_UNIT_ID ? 'connected' : 'setup', detail: 'Neutral invitation for every verified buyer' },
  { id: 'ai', label: 'AI image scanning', status: 'setup', detail: 'Auto-writes feature headings and subheadings when configured on the Worker' },
]

const seedAudienceContacts = [
  {
    id: 'contact-01',
    email: 'elena.rostova@venturecap.io',
    userId: 'usr-elena-01',
    name: 'Elena Rostova',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    source: 'google_signin',
    status: 'subscribed',
    isCustomer: false,
    totalSpendCents: 0,
    ordersCount: 0,
    productsOwned: [],
    waitlistsJoined: ['invoice-os'],
    lastSeenAt: '2026-09-16T14:20:00Z',
    createdAt: '2026-09-12T09:15:00Z',
  },
  {
    id: 'contact-02',
    email: 'jordan.hayes@apexventures.co',
    userId: 'usr-jordan-02',
    name: 'Jordan Hayes',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    source: 'checkout',
    status: 'subscribed',
    isCustomer: true,
    totalSpendCents: 3900,
    ordersCount: 1,
    productsOwned: ['cashflow-os'],
    waitlistsJoined: [],
    lastSeenAt: '2026-09-17T08:10:00Z',
    createdAt: '2026-09-05T11:30:00Z',
  },
  {
    id: 'contact-03',
    email: 'sarah.lindqvist@nordicscale.io',
    userId: 'usr-sarah-03',
    name: 'Sarah Lindqvist',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    source: 'checkout',
    status: 'subscribed',
    isCustomer: true,
    totalSpendCents: 9800,
    ordersCount: 2,
    productsOwned: ['cashflow-os', 'client-crm-os'],
    waitlistsJoined: ['invoice-os'],
    lastSeenAt: '2026-09-17T10:05:00Z',
    createdAt: '2026-08-28T16:45:00Z',
  },
  {
    id: 'contact-04',
    email: 'marcus.vance@solocreator.co',
    userId: 'usr-marcus-04',
    name: 'Marcus Vance',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    source: 'google_signin',
    status: 'subscribed',
    isCustomer: false,
    totalSpendCents: 0,
    ordersCount: 0,
    productsOwned: [],
    waitlistsJoined: [],
    lastSeenAt: '2026-09-15T18:40:00Z',
    createdAt: '2026-09-14T20:10:00Z',
  },
  {
    id: 'contact-05',
    email: 'priya.patel@growthpulse.agency',
    userId: 'usr-priya-05',
    name: 'Priya Patel',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    source: 'waitlist',
    status: 'subscribed',
    isCustomer: false,
    totalSpendCents: 0,
    ordersCount: 0,
    productsOwned: [],
    waitlistsJoined: ['invoice-os'],
    lastSeenAt: '2026-09-16T11:00:00Z',
    createdAt: '2026-09-16T11:00:00Z',
  },
  {
    id: 'contact-06',
    email: 'carlos.mendez@solofounder.dev',
    userId: 'usr-carlos-06',
    name: 'Carlos Mendez',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
    source: 'checkout',
    status: 'subscribed',
    isCustomer: true,
    totalSpendCents: 4900,
    ordersCount: 1,
    productsOwned: ['project-os'],
    waitlistsJoined: [],
    lastSeenAt: '2026-09-10T09:12:00Z',
    createdAt: '2026-09-02T13:20:00Z',
  },
  {
    id: 'contact-07',
    email: 'david.kim@saasvelocity.net',
    userId: 'usr-david-07',
    name: 'David Kim',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
    source: 'google_signin',
    status: 'subscribed',
    isCustomer: false,
    totalSpendCents: 0,
    ordersCount: 0,
    productsOwned: [],
    waitlistsJoined: [],
    lastSeenAt: '2026-09-17T07:30:00Z',
    createdAt: '2026-09-15T15:25:00Z',
  },
]

const seedMarketingCampaigns = [
  {
    id: 'camp-01',
    title: 'Cash Flow OS 2.0 Launch Broadcast',
    subject: 'Cash Flow OS 2.0 is officially live on Runway Systems',
    previewText: 'RUNWAY SYSTEMS · VIP LAUNCH',
    targetSegment: 'all',
    targetProductKey: 'cashflow-os',
    ctaLabel: 'Get Instant Access →',
    ctaUrl: 'https://runwaysystems.cloud/products/cashflow-os',
    discountCode: 'VIP20',
    recipientCount: 148,
    sentBy: 'runwaysystems.cloud@gmail.com',
    sentAt: '2026-09-10T15:00:00Z',
  },
]

const clone = (value) => JSON.parse(JSON.stringify(value))
const wait = (ms = 180) => new Promise((resolve) => window.setTimeout(resolve, ms))
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function emptyState() {
  return {
    testimonials: clone(seedTestimonials),
    feedback: [],
    settings: clone(defaultSettings),
    products: [],
    bundles: [],
    audienceContacts: clone(seedAudienceContacts),
    marketingCampaigns: clone(seedMarketingCampaigns),
  }
}

// Every product the owner has, hidden ones included. This mirrors the
// Worker's `SELECT * FROM products` behind /admin/products, which applies no
// visibility filter: the dashboard must keep listing a hidden product so the
// owner can find it and switch it back on.
function mockAllProducts(state) {
  const defaults = defaultProducts()
  const overrides = new Map((state.products || []).map((product) => [product.key, product]))
  const waitlistCounts = new Map()
  for (const w of state.waitlist || []) {
    waitlistCounts.set(w.productKey, (waitlistCounts.get(w.productKey) || 0) + 1)
  }

  const merged = defaults.map((product) => {
    const saved = overrides.get(product.key)
    const base = saved ? { ...product, ...saved } : (product.key === 'cashflow-os' ? {
      ...product,
      offerActive: Boolean(state.settings.offerActive),
      offerLabel: state.settings.offerLabel,
      originalPrice: state.settings.displayOriginalPrice,
      salePrice: state.settings.displaySalePrice,
    } : product)

    const active = base.active === false ? false : (base.status === 'hidden' ? false : true)
    const status = base.status ? (base.active === false ? 'hidden' : base.status) : (active ? 'active' : 'hidden')
    const waitlistConfig = base.waitlistConfig || {}
    const rawCount = waitlistCounts.get(base.key) || 0
    const offset = Number(waitlistConfig.socialProofOffset) || 0
    const waitlistCount = rawCount + (waitlistConfig.showSocialProof ? offset : 0)

    return {
      ...base,
      status,
      active,
      waitlistConfig,
      waitlistCount,
      checkoutReady: Boolean(base.lemonVariantId && base.lemonVariantId !== '' && status !== 'coming_soon'),
    }
  })
  // Owner-created products that are not part of the built-in catalog still
  // belong in the list.
  for (const saved of state.products || []) {
    if (!defaults.some((product) => product.key === saved.key)) {
      const active = saved.active === false ? false : (saved.status === 'hidden' ? false : true)
      const status = saved.status ? (saved.active === false ? 'hidden' : saved.status) : (active ? 'active' : 'hidden')
      const waitlistConfig = saved.waitlistConfig || {}
      const rawCount = waitlistCounts.get(saved.key) || 0
      const offset = Number(waitlistConfig.socialProofOffset) || 0
      const waitlistCount = rawCount + (waitlistConfig.showSocialProof ? offset : 0)
      merged.push({
        ...saved,
        status,
        active,
        waitlistConfig,
        waitlistCount,
        checkoutReady: Boolean(saved.lemonVariantId && saved.lemonVariantId !== '' && status !== 'coming_soon'),
      })
    }
  }
  return dedupeProducts(merged)
}

// The public, storefront-facing list. The Worker serves `WHERE active = 1 AND status != 'hidden'`;
// the preview adapter has to apply the same rule or a product hidden in the
// dashboard keeps showing locally.
function mockProducts(state) {
  return mockAllProducts(state).filter((product) => product.active !== false && product.status !== 'hidden')
}

// Two products that render as the same card (same key, or the same display
// name) must never both reach the storefront. Keys win over names, and the
// first entry wins over later ones so catalog order stays predictable.
export function dedupeProducts(products) {
  const seenKeys = new Set()
  const seenNames = new Set()
  const unique = []
  for (const product of products || []) {
    if (!product || !product.key) continue
    const key = String(product.key).trim().toLowerCase()
    const name = String(product.name || '').trim().toLowerCase()
    if (seenKeys.has(key)) continue
    if (name && seenNames.has(name)) continue
    seenKeys.add(key)
    if (name) seenNames.add(name)
    unique.push(product)
  }
  return unique
}

function readMockState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return emptyState()
    const defaults = emptyState()
    const parsed = JSON.parse(saved)
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
    }
  } catch {
    return emptyState()
  }
}

function writeMockState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent(DATA_EVENT))
  } catch {
    // Preview persistence is optional in restricted browser contexts.
  }
}

async function request(path, { method = 'GET', body, token, keepalive = false, totp, recovery } = {}) {
  const activeTotp = !totp && isAdminPath(path) ? getActiveAdminTotp() : ''
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeTotp ? { 'X-Admin-TOTP': activeTotp } : {}),
        ...(totp ? { 'X-Admin-TOTP': totp } : {}),
        ...(recovery ? { 'X-Admin-Recovery': recovery } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      keepalive,
    })
  } catch {
    throw new Error('The secure service could not be reached. Please try again.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Request failed with status ${response.status}`)
  return payload
}

// Module-level current admin TOTP code. Set by the admin dashboard
// whenever the user enters a fresh 6-digit code, cleared after 5 minutes
// of inactivity. Every request() call below automatically injects it
// into the X-Admin-TOTP header if the path is an admin route.
//
// Persistence: stored in sessionStorage so a page refresh keeps the
// user signed in for the 5-minute window, but a closed tab clears it.
// Using sessionStorage (not localStorage) means the code never survives
// across browser sessions; using it (not memory-only) means a refresh
// or accidental nav-back does not force the user to re-type the code
// they just entered.
const ADMIN_TOTP_STORAGE_KEY = 'runway.admin.totp.v1'
const ADMIN_TOTP_TTL_MS = 5 * 60 * 1000

function readStoredTotp() {
  if (typeof window === 'undefined' || !window.sessionStorage) return ''
  try {
    const raw = window.sessionStorage.getItem(ADMIN_TOTP_STORAGE_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return ''
    if (typeof parsed.code !== 'string' || typeof parsed.expiresAt !== 'number') return ''
    if (Date.now() > parsed.expiresAt) {
      window.sessionStorage.removeItem(ADMIN_TOTP_STORAGE_KEY)
      return ''
    }
    return parsed.code
  } catch {
    return ''
  }
}

function writeStoredTotp(code) {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    if (!code) {
      window.sessionStorage.removeItem(ADMIN_TOTP_STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(ADMIN_TOTP_STORAGE_KEY, JSON.stringify({
      code,
      expiresAt: Date.now() + ADMIN_TOTP_TTL_MS,
    }))
  } catch {
    // sessionStorage may be disabled (private mode quota, etc). The
    // in-memory value below is still used for the current page load.
  }
}

let memoryTotp = ''
let memoryTotpExpiresAt = 0
function readMemoryTotp() {
  if (!memoryTotp) return ''
  if (Date.now() > memoryTotpExpiresAt) {
    memoryTotp = ''
    memoryTotpExpiresAt = 0
    return ''
  }
  return memoryTotp
}
function writeMemoryTotp(code) {
  memoryTotp = code
  memoryTotpExpiresAt = code ? Date.now() + ADMIN_TOTP_TTL_MS : 0
}

export function setActiveAdminTotp(code) {
  const normalised = String(code || '').replace(/\D/g, '').slice(0, 6)
  writeStoredTotp(normalised)
  writeMemoryTotp(normalised)
  return normalised
}

export function getActiveAdminTotp() {
  // sessionStorage is the source of truth across reloads; the in-memory
  // copy covers the same-tab fast path and the no-storage fallback.
  const stored = readStoredTotp()
  if (stored) {
    writeMemoryTotp(stored)
    return stored
  }
  const fromMemory = readMemoryTotp()
  if (!fromMemory) {
    writeMemoryTotp('')
    return ''
  }
  return fromMemory
}
function isAdminPath(path) {
  return typeof path === 'string' && path.startsWith('/admin/')
}

function requireRemoteApi() {
  if (!API_BASE_URL) throw new Error('Secure checkout is not configured yet.')
}

export function subscribeToPlatformData(callback) {
  window.addEventListener(DATA_EVENT, callback)
  return () => window.removeEventListener(DATA_EVENT, callback)
}

export async function getPublicConfig() {
  if (API_BASE_URL) return request('/config/public')
  await wait(80)
  const state = readMockState()
  return {
    products: mockProducts(state),
    bundles: mockBundles(state),
    trustpilotBusinessUrl: state.settings.trustpilotBusinessUrl,
    trustpilotBusinessUnitId: state.settings.trustpilotBusinessUnitId || '',
    supportEmail: state.settings.supportEmail || '',
    suiteContent: state.settings.suiteContent || {},
    policies: state.settings.policies || {},
    announcement: {
      ...(state.settings.announcement || {}),
      active: Boolean(state.settings.announcement?.message && state.settings.announcement?.active),
    },
    paymentProvider: 'lemonsqueezy',
    reviewPolicy: 'neutral-all-verified-buyers',
  }
}

export async function trackPageView(path) {
  if (!API_BASE_URL) return { accepted: false, preview: true }
  return request('/events/page-view', { method: 'POST', body: { path }, keepalive: true })
}

export async function createCheckoutSession(productKeys, { token, bundleKey = '', consent = false, consentSource = 'cart' } = {}) {
  requireRemoteApi()
  if (!token) throw new Error('Sign in before starting checkout.')
  const keys = (Array.isArray(productKeys) ? productKeys : [productKeys]).filter(Boolean)
  if (!keys.length) throw new Error('Select at least one product to check out.')
  // bundleKey only names the discount; the Worker verifies the cart matches
  // the bundle and recomputes the price from its own rows. consent is recorded
  // server-side against the checkout it creates.
  return request('/checkout/session', {
    method: 'POST',
    token,
    body: { productKeys: keys, consent: consent === true, consentSource, ...(bundleKey ? { bundleKey } : {}) },
  })
}

export async function verifyCheckoutSession(sessionId, { token } = {}) {
  requireRemoteApi()
  if (!sessionId || !token) throw new Error('A signed-in account and Checkout Session are required.')
  return request(`/checkout/session/${encodeURIComponent(sessionId)}`, { token })
}

export async function getAccountPurchases({ token } = {}) {
  requireRemoteApi()
  if (!token) throw new Error('Sign in to load your purchases.')
  return request('/account/purchases', { token })
}

export async function deleteAccount({ token } = {}) {
  requireRemoteApi()
  if (!token) throw new Error('Sign in to delete your account data.')
  return request('/account', { method: 'DELETE', token })
}

export async function getPurchaseDelivery(purchaseId, { token } = {}) {
  requireRemoteApi()
  if (!purchaseId || !token) throw new Error('A verified purchase is required.')
  return request(`/account/purchases/${encodeURIComponent(purchaseId)}/delivery`, { method: 'POST', token, body: {} })
}

export async function resendPurchaseDelivery(purchaseId, { token } = {}) {
  requireRemoteApi()
  if (!purchaseId || !token) throw new Error('A verified purchase is required.')
  return request(`/account/purchases/${encodeURIComponent(purchaseId)}/resend-delivery`, { method: 'POST', token, body: {} })
}

export async function getPurchaseFeedbackLink(purchaseId, { token } = {}) {
  requireRemoteApi()
  if (!purchaseId || !token) throw new Error('A verified purchase is required.')
  return request(`/account/purchases/${encodeURIComponent(purchaseId)}/feedback-link`, { method: 'POST', token, body: {} })
}

export async function verifyFeedbackAccess(feedbackToken, { token } = {}) {
  requireRemoteApi()
  if (!feedbackToken || !token) throw new Error('A signed feedback link and signed-in account are required.')
  return request(`/feedback/access?token=${encodeURIComponent(feedbackToken)}`, { token })
}

export async function getApprovedTestimonials() {
  if (API_BASE_URL) return request('/testimonials?status=approved')
  await wait()
  return readMockState().testimonials.filter((item) => item.status === 'approved')
}

export async function getTestimonials({ token } = {}) {
  if (API_BASE_URL) return request('/admin/testimonials?status=all', { token })
  await wait()
  return readMockState().testimonials
}

export async function submitTestimonial(input, { token } = {}) {
  if (API_BASE_URL) return request('/testimonials', { method: 'POST', body: input, token })
  await wait(260)
  const state = readMockState()
  const testimonial = {
    id: makeId('review'),
    name: input.name.trim(),
    rating: Number(input.rating),
    text: input.text.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  state.testimonials.unshift(testimonial)
  writeMockState(state)
  return testimonial
}

export async function updateTestimonialStatus(id, status, { token } = {}) {
  if (!['approved', 'rejected', 'pending'].includes(status)) throw new Error('Invalid testimonial status')
  if (API_BASE_URL) return request(`/admin/testimonials/${id}`, { method: 'PATCH', body: { status }, token })
  await wait(220)
  const state = readMockState()
  const testimonial = state.testimonials.find((item) => item.id === id)
  if (!testimonial) throw new Error('Testimonial not found')
  testimonial.status = status
  testimonial.moderatedAt = new Date().toISOString()
  writeMockState(state)
  return testimonial
}

export async function submitFeedback(input, { token } = {}) {
  if (API_BASE_URL) return request('/feedback', { method: 'POST', body: input, token })
  await wait(260)
  const state = readMockState()
  const feedback = {
    id: makeId('feedback'),
    rating: Number(input.rating),
    text: String(input.text || '').trim(),
    kind: input.kind === 'private' ? 'private' : 'rating',
    purchaseId: input.purchaseId || '',
    createdAt: new Date().toISOString(),
  }
  state.feedback.unshift(feedback)
  writeMockState(state)
  return feedback
}

export async function getAnalytics({ token } = {}) {
  if (API_BASE_URL) return request('/admin/analytics', { token })
  await wait()
  return clone(mockAnalytics)
}

export async function getAdminSettings({ token } = {}) {
  if (API_BASE_URL) return request('/admin/settings', { token })
  await wait()
  return readMockState().settings
}

export async function updateAdminSettings(settings, { token } = {}) {
  if (API_BASE_URL) return request('/admin/settings', { method: 'PUT', body: settings, token })
  await wait(240)
  const state = readMockState()
  state.settings = { ...state.settings, ...settings }
  writeMockState(state)
  return state.settings
}

export async function getIntegrationStatus({ token } = {}) {
  if (API_BASE_URL) return request('/admin/integrations/status', { token })
  await wait()
  return clone(defaultIntegrations)
}

export async function getAdminProducts({ token } = {}) {
  if (API_BASE_URL) return request('/admin/products', { token })
  await wait()
  // The owner dashboard lists hidden products too: unticking "Visible on
  // storefront" must not make a product disappear from its own editor.
  return mockAllProducts(readMockState())
}

export async function createAdminProduct(input, { token } = {}) {
  if (API_BASE_URL) return request('/admin/products', { method: 'POST', body: input, token })
  await wait(240)
  const state = readMockState()
  const key = String(input.key || '').toLowerCase()
  // Mirror the Worker: duplicateFrom copies the source's content but never its
  // payment wiring or images.
  const sourceKey = String(input.duplicateFrom || '')
  const source = sourceKey
    ? [...defaultProducts(), ...(state.products || [])].find((item) => item.key === sourceKey)
    : null
  const product = {
    ...(source ? { ...source, content: source.content, heroImage: '', featureImages: [], features: [] } : {}),
    ...input,
    key,
    lemonVariantId: source ? '' : (input.lemonVariantId || ''),
    deliveryUrl: source ? '' : (input.deliveryUrl || ''),
    active: Boolean(input.active),
    featured: Boolean(input.featured),
    checkoutReady: true,
  }
  delete product.duplicateFrom
  state.products = [...(state.products || []), product]
  writeMockState(state)
  return product
}

export async function updateAdminProduct(key, input, { token } = {}) {
  if (API_BASE_URL) return request(`/admin/products/${encodeURIComponent(key)}`, { method: 'PATCH', body: input, token })
  await wait(240)
  const state = readMockState()
  const existing = state.products.find((product) => product.key === key)
  const product = { ...(existing || {}), ...input, key, checkoutReady: true }
  state.products = existing
    ? state.products.map((item) => item.key === key ? product : item)
    : [...(state.products || []), product]
  writeMockState(state)
  return product
}

export async function deleteAdminProduct(key, { token } = {}) {
  if (API_BASE_URL) return request(`/admin/products/${encodeURIComponent(key)}`, { method: 'DELETE', token })
  await wait(240)
  const state = readMockState()
  const saved = (state.products || []).find((product) => product.key === key)
  const isSeeded = defaultProducts().some((product) => product.key === key)
  if (isSeeded) throw new Error('Built-in catalog products cannot be deleted. Set them to hidden instead.')
  if (!saved) throw new Error('Product not found')
  state.products = (state.products || []).filter((product) => product.key !== key)
  writeMockState(state)
  return { removed: true, key, name: saved.name || key }
}

// ------------------------------------------------------------------ bundles
// Bundles are priced as a percentage off the sum of their members, so the
// preview adapter recomputes the same way the Worker does.

function mockBundlePricing(state, bundle) {
  const products = mockProducts(state)
  const members = bundle.productKeys.map((key) => products.find((product) => product.key === key)).filter(Boolean)
  if (members.length !== bundle.productKeys.length || members.length < 2) return null
  const toCents = (value) => {
    const match = String(value || '').replace(/,/g, '').match(/^[^\d]*(\d+)(?:\.(\d{1,2}))?/)
    if (!match) return null
    return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0') || 0)
  }
  let fullCents = 0
  for (const member of members) {
    const cents = toCents(member.salePrice)
    if (cents === null) return null
    fullCents += cents
  }
  const bundleCents = Math.round(fullCents * (100 - bundle.discountPercent) / 100)
  const display = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
  return {
    products: members.map((member) => ({ key: member.key, name: member.name, icon: member.icon, accent: member.accent, salePrice: member.salePrice })),
    fullPrice: display(fullCents),
    bundlePrice: display(bundleCents),
    saving: display(fullCents - bundleCents),
  }
}

function mockBundles(state) {
  return (state.bundles || [])
    .filter((bundle) => bundle.active !== false)
    .map((bundle) => {
      const pricing = mockBundlePricing(state, bundle)
      return pricing ? { ...bundle, ...pricing } : null
    })
    .filter(Boolean)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
}

export async function getAdminBundles({ token } = {}) {
  if (API_BASE_URL) return request('/admin/bundles', { token })
  await wait(160)
  return readMockState().bundles || []
}

export async function createAdminBundle(input, { token } = {}) {
  if (API_BASE_URL) return request('/admin/bundles', { method: 'POST', body: input, token })
  await wait(240)
  const state = readMockState()
  const key = String(input.key || '').toLowerCase()
  if ((state.bundles || []).some((bundle) => bundle.key === key)) throw new Error('A bundle with this key already exists')
  const bundle = { ...input, key }
  state.bundles = [...(state.bundles || []), bundle]
  writeMockState(state)
  return bundle
}

export async function updateAdminBundle(key, input, { token } = {}) {
  if (API_BASE_URL) return request(`/admin/bundles/${encodeURIComponent(key)}`, { method: 'PATCH', body: input, token })
  await wait(240)
  const state = readMockState()
  const bundle = { ...input, key }
  state.bundles = (state.bundles || []).map((item) => item.key === key ? bundle : item)
  writeMockState(state)
  return bundle
}

export async function deleteAdminBundle(key, { token } = {}) {
  if (API_BASE_URL) return request(`/admin/bundles/${encodeURIComponent(key)}`, { method: 'DELETE', token })
  await wait(240)
  const state = readMockState()
  const existing = (state.bundles || []).find((bundle) => bundle.key === key)
  if (!existing) throw new Error('Bundle not found')
  state.bundles = (state.bundles || []).filter((bundle) => bundle.key !== key)
  writeMockState(state)
  return { removed: true, key, name: existing.name || key }
}

export async function uploadProductImage(productKey, { slot, image } = {}, { token } = {}) {
  if (API_BASE_URL) return request(`/admin/products/${encodeURIComponent(productKey)}/upload`, { method: 'POST', body: { slot, image }, token })
  await wait(340)
  if (!image || !String(image).startsWith('data:image/')) throw new Error('Image must be a PNG, JPEG, or WebP data URL')
  const state = readMockState()
  const products = state.products || []
  let index = products.findIndex((product) => product.key === productKey)
  if (index === -1) {
    const defaults = defaultProducts().find((product) => product.key === productKey)
    products.push({ ...(defaults || { key: productKey, name: productKey }), key: productKey })
    index = products.length - 1
  }
  if (slot === 'hero') {
    products[index] = { ...products[index], heroImage: image }
  } else {
    // Preview mode stores the data URL directly. No cap: features are unlimited.
    const features = [...(products[index].features || [])]
    const feature = { id: makeId('feature'), imagePath: image, heading: '', subheading: '', sortOrder: features.length }
    features.push(feature)
    products[index] = { ...products[index], features, featureImages: features.map((item) => item.imagePath) }
  }
  state.products = products
  writeMockState(state)
  return products[index]
}

export async function createProductFeature(productKey, { image, heading = '', subheading = '' } = {}, { token } = {}) {
  if (API_BASE_URL) return request(`/admin/products/${encodeURIComponent(productKey)}/features`, { method: 'POST', body: { image, heading, subheading }, token })
  await wait(340)
  if (!image || !String(image).startsWith('data:image/')) throw new Error('Image must be a PNG, JPEG, or WebP data URL')
  const state = readMockState()
  const products = state.products || []
  let index = products.findIndex((product) => product.key === productKey)
  if (index === -1) {
    const defaults = defaultProducts().find((product) => product.key === productKey)
    products.push({ ...(defaults || { key: productKey, name: productKey }), key: productKey })
    index = products.length - 1
  }
  const features = [...(products[index].features || [])]
  const feature = { id: makeId('feature'), imagePath: image, heading, subheading, sortOrder: features.length }
  features.push(feature)
  products[index] = { ...products[index], features, featureImages: features.map((item) => item.imagePath) }
  state.products = products
  writeMockState(state)
  return { feature, aiAvailable: false }
}

export async function updateProductFeature(productKey, featureId, input = {}, { token } = {}) {
  if (API_BASE_URL) return request(`/admin/products/${encodeURIComponent(productKey)}/features/${encodeURIComponent(featureId)}`, { method: 'PATCH', body: input, token })
  await wait(240)
  const state = readMockState()
  const products = state.products || []
  const index = products.findIndex((product) => product.key === productKey)
  if (index === -1) throw new Error('Product not found')
  const features = [...(products[index].features || [])]
  const feature = features.find((item) => item.id === featureId)
  if (!feature) throw new Error('Feature not found for this product')
  if (Object.prototype.hasOwnProperty.call(input, 'heading')) feature.heading = String(input.heading || '')
  if (Object.prototype.hasOwnProperty.call(input, 'subheading')) feature.subheading = String(input.subheading || '')
  if (Object.prototype.hasOwnProperty.call(input, 'sortOrder')) feature.sortOrder = Number(input.sortOrder) || 0
  features.sort((a, b) => a.sortOrder - b.sortOrder)
  products[index] = { ...products[index], features, featureImages: features.map((item) => item.imagePath) }
  state.products = products
  writeMockState(state)
  return feature
}

export async function deleteProductFeature(productKey, featureId, { token } = {}) {
  if (API_BASE_URL) return request(`/admin/products/${encodeURIComponent(productKey)}/features/${encodeURIComponent(featureId)}`, { method: 'DELETE', token })
  await wait(240)
  const state = readMockState()
  const products = state.products || []
  const index = products.findIndex((product) => product.key === productKey)
  if (index === -1) throw new Error('Product not found')
  const features = (products[index].features || []).filter((item) => item.id !== featureId)
  products[index] = { ...products[index], features, featureImages: features.map((item) => item.imagePath) }
  state.products = products
  writeMockState(state)
  return { removed: true, featureId }
}

export { API_BASE_URL }

export async function getAdminTOTPStatus({ token } = {}) {
  if (API_BASE_URL) return request('/admin/totp/status', { token })
  await wait()
  return { enrolled: false, verified: false, enrolledAt: '', lastUsedAt: '' }
}

export async function enrollAdminTOTP({ token, totp } = {}) {
  if (API_BASE_URL) return request('/admin/totp/enrol', { method: 'POST', body: {}, token, totp })
  await wait()
  return { secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/Runway%20Systems%20Admin?secret=JBSWY3DPEHPK3PXP&issuer=Runway%20Systems', recoveryCodes: ['0000-1111', '2222-3333'] }
}

export async function verifyAdminTOTP(body, { token, totp } = {}) {
  if (API_BASE_URL) return request('/admin/totp/verify', { method: 'POST', body, token, totp })
  await wait()
  return { verified: true }
}

export async function resetAdminTOTP({ token, totp } = {}) {
  if (API_BASE_URL) return request('/admin/totp/reset', { method: 'POST', body: {}, token, totp })
  await wait()
  return { reset: true }
}

export async function getAdminAuditLog({ limit = 100, entityType = '', subjectId = '' } = {}, { token } = {}) {
  if (API_BASE_URL) {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    if (entityType) params.set('entityType', entityType)
    if (subjectId) params.set('subjectId', subjectId)
    return request(`/admin/audit-log?${params.toString()}`, { token })
  }
  await wait()
  return []
}

export async function getAdminClientErrors({ limit = 50 } = {}, { token } = {}) {
  if (API_BASE_URL) {
    const params = new URLSearchParams({ limit: String(limit) })
    return request(`/admin/client-errors?${params.toString()}`, { token })
  }
  await wait()
  return []
}

export async function getAdminDeliveryIssues({ token } = {}) {
  if (API_BASE_URL) return request('/admin/delivery-issues', { token })
  await wait()
  return { issues: [] }
}

// POST mutation: the live Worker requires the fresh-JWT + TOTP admin gate
// (the request() helper injects the cached TOTP code automatically).
export async function retryDeliveryIssue(purchaseId, { token } = {}) {
  if (API_BASE_URL) {
    return request(`/admin/delivery-issues/${encodeURIComponent(purchaseId)}/retry`, { method: 'POST', token })
  }
  await wait()
  return { retried: true, purchaseId }
}

export async function subscribeWaitlist(productKey, { email, userId = '', source = 'product_page' } = {}) {
  if (API_BASE_URL) {
    return request('/waitlist/subscribe', {
      method: 'POST',
      body: { productKey, email, userId, source },
    })
  }
  await wait(200)
  const state = readMockState()
  const waitlist = state.waitlist || []
  const cleanEmail = String(email || '').trim().toLowerCase()
  const existing = waitlist.find((w) => w.productKey === productKey && w.email === cleanEmail)
  if (!existing) {
    waitlist.push({
      id: `wl-${Date.now()}`,
      productKey,
      email: cleanEmail,
      userId,
      source,
      pollResponse: '',
      welcomeSentAt: new Date().toISOString(),
      notifiedAt: null,
      createdAt: new Date().toISOString(),
    })
    writeMockState({ ...state, waitlist })
  }
  const product = (mockAllProducts(state) || []).find((p) => p.key === productKey)
  const pollConfig = product?.waitlistConfig?.pollEnabled ? {
    question: product.waitlistConfig.pollQuestion || 'Which feature is most critical for your business?',
    options: Array.isArray(product.waitlistConfig.pollOptions) && product.waitlistConfig.pollOptions.length
      ? product.waitlistConfig.pollOptions
      : ['Automated dashboard summaries', 'Multi-currency support', 'Tax reserve forecasting', 'Client retainer tracking'],
  } : null
  return {
    ok: true,
    message: "You're on the early access list! We will notify you when it launches.",
    poll: pollConfig,
  }
}

export async function voteWaitlistPoll(productKey, { email, vote } = {}) {
  if (API_BASE_URL) {
    return request('/waitlist/poll-vote', {
      method: 'POST',
      body: { productKey, email, vote },
    })
  }
  await wait(150)
  const state = readMockState()
  const waitlist = (state.waitlist || []).map((item) => {
    if (item.productKey === productKey && item.email === String(email || '').toLowerCase().trim()) {
      return { ...item, pollResponse: vote }
    }
    return item
  })
  writeMockState({ ...state, waitlist })
  return { ok: true, message: 'Thank you for your feedback!' }
}

export async function getAdminProductWaitlist(productKey, { token, totp } = {}) {
  if (API_BASE_URL) {
    return request(`/admin/products/${encodeURIComponent(productKey)}/waitlist`, { token, totp })
  }
  await wait(150)
  const state = readMockState()
  const list = (state.waitlist || []).filter((w) => w.productKey === productKey)
  const pollMap = new Map()
  for (const item of list) {
    if (item.pollResponse) {
      pollMap.set(item.pollResponse, (pollMap.get(item.pollResponse) || 0) + 1)
    }
  }
  return {
    totalSubscribers: list.length,
    notifiedCount: list.filter((w) => w.notifiedAt).length,
    welcomeSentCount: list.filter((w) => w.welcomeSentAt).length,
    pollResults: Array.from(pollMap.entries()).map(([option, count]) => ({ option, count })),
    subscribers: list.map((w) => ({
      id: w.id,
      email: w.email,
      source: w.source,
      pollResponse: w.pollResponse || '',
      welcomeSentAt: w.welcomeSentAt,
      notifiedAt: w.notifiedAt,
      createdAt: w.createdAt,
    })),
  }
}

export async function exportAdminProductWaitlist(productKey, { token, totp } = {}) {
  if (API_BASE_URL) {
    const url = `${API_BASE_URL}/admin/products/${encodeURIComponent(productKey)}/waitlist/export`
    const activeTotp = !totp ? getActiveAdminTotp() : ''
    const response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeTotp ? { 'X-Admin-TOTP': activeTotp } : {}),
        ...(totp ? { 'X-Admin-TOTP': totp } : {}),
      },
    })
    if (!response.ok) throw new Error('Failed to export waitlist')
    return response.text()
  }
  await wait(100)
  const state = readMockState()
  const list = (state.waitlist || []).filter((w) => w.productKey === productKey)
  const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const lines = ['Email,Source,Poll Response,Welcome Sent At,Notified At,Signed Up At']
  for (const r of list) {
    lines.push([
      escapeCsv(r.email),
      escapeCsv(r.source),
      escapeCsv(r.pollResponse),
      escapeCsv(r.welcomeSentAt),
      escapeCsv(r.notifiedAt),
      escapeCsv(r.createdAt),
    ].join(','))
  }
  return lines.join('\n')
}

export async function sendTestWaitlistEmail(productKey, { subject = '', message = '' } = {}, { token, totp } = {}) {
  if (API_BASE_URL) {
    return request(`/admin/products/${encodeURIComponent(productKey)}/waitlist/test-email`, {
      method: 'POST',
      token,
      totp,
      body: { subject, message },
    })
  }
  await wait(300)
  return { ok: true, message: 'Test email simulated successfully.' }
}

export async function broadcastLaunchEmail(productKey, { subject = '', message = '' } = {}, { token, totp } = {}) {
  if (API_BASE_URL) {
    return request(`/admin/products/${encodeURIComponent(productKey)}/waitlist/broadcast`, {
      method: 'POST',
      token,
      totp,
      body: { subject, message },
    })
  }
  await wait(400)
  const state = readMockState()
  let sentCount = 0
  const now = new Date().toISOString()
  const waitlist = (state.waitlist || []).map((item) => {
    if (item.productKey === productKey && !item.notifiedAt) {
      sentCount += 1
      return { ...item, notifiedAt: now }
    }
    return item
  })
  writeMockState({ ...state, waitlist })
  return {
    ok: true,
    sentCount,
    totalQueued: sentCount,
    message: `Broadcast complete: sent to ${sentCount} subscribers.`,
  }
}

export async function syncAudienceContact(user, { token } = {}) {
  if (!user || !user.email) return { ok: true }
  if (API_BASE_URL) {
    return request('/account/sync', {
      method: 'POST',
      token,
      body: {
        email: user.email,
        userId: user.id || '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      },
    }).catch(() => ({ ok: true }))
  }
  const state = readMockState()
  const email = String(user.email).toLowerCase().trim()
  const contacts = state.audienceContacts || clone(seedAudienceContacts)
  const existing = contacts.find((c) => c.email === email)
  const now = new Date().toISOString()
  if (existing) {
    existing.lastSeenAt = now
    if (user.user_metadata?.full_name && !existing.name) existing.name = user.user_metadata.full_name
    if (user.user_metadata?.avatar_url && !existing.avatarUrl) existing.avatarUrl = user.user_metadata.avatar_url
  } else {
    contacts.unshift({
      id: `contact-${Date.now()}`,
      email,
      userId: user.id || '',
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      source: 'google_signin',
      status: 'subscribed',
      isCustomer: false,
      totalSpendCents: 0,
      ordersCount: 0,
      productsOwned: [],
      waitlistsJoined: [],
      lastSeenAt: now,
      createdAt: now,
    })
  }
  writeMockState({ ...state, audienceContacts: contacts })
  return { ok: true }
}

export async function getAdminAudience({ segment = 'all', search = '', product = '', page = 1, limit = 50 } = {}, { token, totp } = {}) {
  if (API_BASE_URL) {
    const params = new URLSearchParams()
    if (segment && segment !== 'all') params.set('segment', segment)
    if (search) params.set('search', search)
    if (product) params.set('product', product)
    if (page) params.set('page', String(page))
    if (limit) params.set('limit', String(limit))
    const query = params.toString() ? `?${params.toString()}` : ''
    return request(`/admin/marketing/audience${query}`, { token, totp })
  }
  await wait(180)
  const state = readMockState()
  let list = state.audienceContacts || clone(seedAudienceContacts)

  const stats = {
    total: list.length,
    leads: list.filter((c) => !c.isCustomer && c.status === 'subscribed').length,
    customers: list.filter((c) => c.isCustomer).length,
    waitlist: list.filter((c) => Array.isArray(c.waitlistsJoined) && c.waitlistsJoined.length > 0).length,
    unsubscribed: list.filter((c) => c.status === 'unsubscribed').length,
    totalLtvCents: list.reduce((sum, c) => sum + (c.totalSpendCents || 0), 0),
  }

  if (segment === 'leads') {
    list = list.filter((c) => !c.isCustomer && c.status === 'subscribed')
  } else if (segment === 'customers') {
    list = list.filter((c) => c.isCustomer)
  } else if (segment === 'waitlist') {
    list = list.filter((c) => Array.isArray(c.waitlistsJoined) && c.waitlistsJoined.length > 0)
  } else if (segment === 'unsubscribed') {
    list = list.filter((c) => c.status === 'unsubscribed')
  }

  if (search) {
    const term = search.toLowerCase()
    list = list.filter((c) => c.email.toLowerCase().includes(term) || (c.name || '').toLowerCase().includes(term))
  }

  if (product) {
    list = list.filter((c) =>
      (Array.isArray(c.productsOwned) && c.productsOwned.includes(product)) ||
      (Array.isArray(c.waitlistsJoined) && c.waitlistsJoined.includes(product))
    )
  }

  const total = list.length
  const offset = (page - 1) * limit
  const paginated = list.slice(offset, offset + limit)

  return {
    stats,
    contacts: paginated,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  }
}

export async function exportAdminAudienceCsv({ segment = 'all' } = {}, { token, totp } = {}) {
  if (API_BASE_URL) {
    const url = `${API_BASE_URL}/admin/marketing/audience/export?segment=${encodeURIComponent(segment)}`
    const activeTotp = !totp ? getActiveAdminTotp() : ''
    const response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeTotp ? { 'X-Admin-TOTP': activeTotp } : {}),
        ...(totp ? { 'X-Admin-TOTP': totp } : {}),
      },
    })
    if (!response.ok) throw new Error('Failed to export audience CSV')
    return response.text()
  }
  await wait(150)
  const state = readMockState()
  let list = state.audienceContacts || clone(seedAudienceContacts)
  if (segment === 'leads') list = list.filter((c) => !c.isCustomer && c.status === 'subscribed')
  else if (segment === 'customers') list = list.filter((c) => c.isCustomer)
  else if (segment === 'waitlist') list = list.filter((c) => Array.isArray(c.waitlistsJoined) && c.waitlistsJoined.length > 0)
  else if (segment === 'unsubscribed') list = list.filter((c) => c.status === 'unsubscribed')

  const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const lines = ['Email,Name,Source,Status,Segment,Total Spend (USD),Orders Count,Products Owned,Waitlists,Joined At,Last Seen At']
  for (const r of list) {
    const owned = (r.productsOwned || []).join('; ')
    const waitlists = (r.waitlistsJoined || []).join('; ')
    const spend = ((r.totalSpendCents || 0) / 100).toFixed(2)
    const seg = r.isCustomer ? 'Customer' : 'Lead'
    lines.push([
      escapeCsv(r.email),
      escapeCsv(r.name),
      escapeCsv(r.source),
      escapeCsv(r.status),
      escapeCsv(seg),
      escapeCsv(`$${spend}`),
      escapeCsv(r.ordersCount || 0),
      escapeCsv(owned),
      escapeCsv(waitlists),
      escapeCsv(r.createdAt),
      escapeCsv(r.lastSeenAt),
    ].join(','))
  }
  return lines.join('\n')
}

export async function createAdminAudienceContact(contactData, { token, totp } = {}) {
  if (API_BASE_URL) {
    return request('/admin/marketing/contacts', { method: 'POST', body: contactData, token, totp })
  }
  await wait(200)
  const state = readMockState()
  const email = String(contactData.email || '').trim().toLowerCase()
  const contacts = state.audienceContacts || clone(seedAudienceContacts)
  const now = new Date().toISOString()
  const contact = {
    id: `contact-${Date.now()}`,
    email,
    name: contactData.name || '',
    source: contactData.source || 'manual',
    status: 'subscribed',
    isCustomer: false,
    totalSpendCents: 0,
    ordersCount: 0,
    productsOwned: [],
    waitlistsJoined: [],
    lastSeenAt: now,
    createdAt: now,
  }
  contacts.unshift(contact)
  writeMockState({ ...state, audienceContacts: contacts })
  return { ok: true, contact }
}

export async function updateAdminAudienceContact(id, updates, { token, totp } = {}) {
  if (API_BASE_URL) {
    return request(`/admin/marketing/contacts/${encodeURIComponent(id)}`, { method: 'PATCH', body: updates, token, totp })
  }
  await wait(180)
  const state = readMockState()
  const contacts = (state.audienceContacts || clone(seedAudienceContacts)).map((c) => {
    if (c.id === id) return { ...c, ...updates }
    return c
  })
  writeMockState({ ...state, audienceContacts: contacts })
  return { ok: true }
}

export async function deleteAdminAudienceContact(id, { token, totp } = {}) {
  if (API_BASE_URL) {
    return request(`/admin/marketing/contacts/${encodeURIComponent(id)}`, { method: 'DELETE', token, totp })
  }
  await wait(180)
  const state = readMockState()
  const contacts = (state.audienceContacts || clone(seedAudienceContacts)).filter((c) => c.id !== id)
  writeMockState({ ...state, audienceContacts: contacts })
  return { ok: true }
}

export async function getAdminMarketingCampaigns({ token, totp } = {}) {
  if (API_BASE_URL) {
    return request('/admin/marketing/campaigns', { token, totp })
  }
  await wait(150)
  const state = readMockState()
  return state.marketingCampaigns || clone(seedMarketingCampaigns)
}

export async function sendAdminMarketingTestEmail(campaignData, { token, totp } = {}) {
  if (API_BASE_URL) {
    return request('/admin/marketing/campaigns/test', { method: 'POST', body: campaignData, token, totp })
  }
  await wait(350)
  return { ok: true, message: 'Test email successfully simulated to owner inbox.' }
}

export async function broadcastAdminMarketingCampaign(campaignData, { token, totp } = {}) {
  if (API_BASE_URL) {
    return request('/admin/marketing/campaigns/broadcast', { method: 'POST', body: campaignData, token, totp })
  }
  await wait(450)
  const state = readMockState()
  const contacts = state.audienceContacts || clone(seedAudienceContacts)
  let eligible = contacts.filter((c) => c.status === 'subscribed')
  if (campaignData.targetSegment === 'leads') eligible = eligible.filter((c) => !c.isCustomer)
  else if (campaignData.targetSegment === 'customers') eligible = eligible.filter((c) => c.isCustomer)
  else if (campaignData.targetSegment === 'waitlist') {
    if (campaignData.targetProductKey) eligible = eligible.filter((c) => (c.waitlistsJoined || []).includes(campaignData.targetProductKey))
    else eligible = eligible.filter((c) => (c.waitlistsJoined || []).length > 0)
  }

  const campaign = {
    id: `camp-${Date.now()}`,
    title: campaignData.title || campaignData.subject,
    subject: campaignData.subject,
    previewText: campaignData.eyebrow || 'RUNWAY SYSTEMS · VIP ANNOUNCEMENT',
    targetSegment: campaignData.targetSegment || 'all',
    targetProductKey: campaignData.targetProductKey || '',
    ctaLabel: campaignData.ctaLabel || '',
    ctaUrl: campaignData.ctaUrl || '',
    discountCode: campaignData.discountCode || '',
    recipientCount: eligible.length,
    sentBy: 'runwaysystems.cloud@gmail.com',
    sentAt: new Date().toISOString(),
  }

  const campaigns = [campaign, ...(state.marketingCampaigns || clone(seedMarketingCampaigns))]
  writeMockState({ ...state, marketingCampaigns: campaigns })
  return {
    ok: true,
    campaignId: campaign.id,
    sentCount: eligible.length,
    totalQueued: eligible.length,
    message: `Campaign broadcast dispatched to ${eligible.length} recipients via Brevo.`,
  }
}

export async function unsubscribeMarketingContact({ email } = {}) {
  if (API_BASE_URL) {
    return request('/marketing/unsubscribe', { method: 'POST', body: { email } })
  }
  await wait(150)
  const state = readMockState()
  const clean = String(email || '').toLowerCase().trim()
  const contacts = (state.audienceContacts || clone(seedAudienceContacts)).map((c) => {
    if (c.email.toLowerCase() === clean) return { ...c, status: 'unsubscribed' }
    return c
  })
  writeMockState({ ...state, audienceContacts: contacts })
  return { ok: true }
}


