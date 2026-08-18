// All persistence and server communication stays behind this module. The
// production adapter targets the Cloudflare Worker; localStorage is only a
// clearly labelled preview provider for interface development.

import { defaultProducts } from '../data/catalog'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

// The localStorage adapter below is a PREVIEW-ONLY provider for interface
// development. It is selected purely by VITE_API_BASE_URL being empty, which
// means a production build made without that variable silently ships seeded
// demo data and writes admin edits to the visitor's own browser instead of
// the database. That failure is invisible at build time, so surface it loudly
// at runtime and let the UI badge it.
export const IS_PREVIEW_DATA = !API_BASE_URL

if (IS_PREVIEW_DATA && typeof window !== 'undefined' && !import.meta.env.DEV) {
  console.error(
    '[Runway Systems] VITE_API_BASE_URL is not set in this build. The storefront is running on ' +
    'preview mock data: dashboard numbers are seeded demo values and product edits are saved only ' +
    'to this browser. Set VITE_API_BASE_URL to your Worker URL in the Pages build variables and redeploy.',
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
  }
}

// Every product the owner has, hidden ones included. This mirrors the
// Worker's `SELECT * FROM products` behind /admin/products, which applies no
// visibility filter: the dashboard must keep listing a hidden product so the
// owner can find it and switch it back on.
function mockAllProducts(state) {
  const defaults = defaultProducts()
  const overrides = new Map((state.products || []).map((product) => [product.key, product]))
  const merged = defaults.map((product) => {
    const saved = overrides.get(product.key)
    if (saved) return { ...product, ...saved }
    if (product.key === 'cashflow-os') {
      return {
        ...product,
        offerActive: Boolean(state.settings.offerActive),
        offerLabel: state.settings.offerLabel,
        originalPrice: state.settings.displayOriginalPrice,
        salePrice: state.settings.displaySalePrice,
      }
    }
    return product
  })
  // Owner-created products that are not part of the built-in catalog still
  // belong in the list.
  for (const saved of state.products || []) {
    if (!defaults.some((product) => product.key === saved.key)) merged.push({ ...saved })
  }
  return dedupeProducts(merged)
}

// The public, storefront-facing list. The Worker serves `WHERE active = 1`;
// the preview adapter has to apply the same rule or a product hidden in the
// dashboard keeps showing locally.
function mockProducts(state) {
  return mockAllProducts(state).filter((product) => product.active !== false)
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

async function request(path, { method = 'GET', body, token, keepalive = false } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
