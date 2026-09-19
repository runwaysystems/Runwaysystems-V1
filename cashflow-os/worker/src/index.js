const PRODUCT_KEY = 'cashflow-os'
const REVIEW_DELAY_MS = 72 * 60 * 60 * 1000

// The exact agreement a buyer accepts at checkout, stored verbatim with each
// consent so a later wording change cannot rewrite what past buyers agreed to.
// Bump the version whenever CONSENT_TEXT changes; it must stay in step with
// src/components/CheckoutConsent.jsx.
const CONSENT_POLICY_VERSION = '2026-08-17'
const CONSENT_TEXT = 'I agree to the Terms, Privacy Policy and Refund Policy, and I understand these are digital products delivered instantly, so my right to cancel ends once I access my copy.'
const FEEDBACK_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
const COMPLIMENTARY_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
const COMPLIMENTARY_POLICY_VERSION = '2026-09-18'
const COMPLIMENTARY_POLICY_TEXT = 'By claiming this complimentary access, I agree to the Runway Systems Terms and Privacy Policy and understand that the product license applies even though no payment was taken.'
const NEWSLETTER_CONFIRMATION_TTL_MS = 48 * 60 * 60 * 1000
const NEWSLETTER_POLICY_VERSION = '2026-09-19'
const NEWSLETTER_SOURCES = new Set(['home', 'product', 'blog_index', 'blog_article', 'site_footer'])
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

const PRODUCT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/
const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const BLOG_LAYOUTS = ['editorial', 'tutorial', 'field-note', 'case-study']
const BLOG_PUBLIC_WHERE = "p.status = 'published' AND p.published_at IS NOT NULL AND p.published_at <= ? AND p.deleted_at IS NULL"
const BLOG_TRASH_RETENTION_DAYS = 30
const KNOWN_PRODUCT_ICONS = ['spreadsheet', 'users', 'gauge', 'receipt', 'folder', 'layers', 'calendar', 'kanban']
const KNOWN_PRODUCT_ACCENTS = ['lime', 'blue', 'violet', 'peach', 'mint', 'yellow', 'lavender']

const PRODUCT_FALLBACK_NAMES = {
  'cashflow-os': 'Cash Flow OS',
  'client-crm-os': 'Client CRM OS',
  'project-os': 'Project OS',
  'invoice-os': 'Invoice OS',
}

const PRODUCT_FALLBACK_ICONS = {
  'cashflow-os': 'spreadsheet',
  'client-crm-os': 'users',
  'project-os': 'gauge',
  'invoice-os': 'receipt',
}

const SEED_PRODUCTS = [
  {
    key: 'cashflow-os',
    name: 'Cash Flow OS',
    tagline: 'The complete Google Sheets finance system.',
    category: 'Finance',
    icon: 'spreadsheet',
    accent: 'lime',
    originalPrice: '$69',
    salePrice: '$39',
    offerLabel: 'Launch Offer',
    featured: 1,
    sortOrder: 0,
    includes: [
      'Live finance dashboard',
      'Revenue & expense trackers',
      'Invoice aging & client records',
      '12-month cash forecast',
      'Invoice PDF template',
      'Bank import staging area',
      'Private Google Sheets copy',
      'All future updates',
    ],
  },
  {
    key: 'client-crm-os',
    name: 'Client CRM OS',
    tagline: 'Know every client, follow-up, and next step.',
    category: 'Client relationships',
    icon: 'users',
    accent: 'blue',
    originalPrice: '$59',
    salePrice: '$35',
    offerLabel: 'Launch Offer',
    featured: 1,
    sortOrder: 1,
    includes: [
      'Client pipeline board',
      'Follow-up & touchpoint log',
      'Revenue per client',
      'Retention & churn signals',
      'Meeting notes archive',
      'Referral tracker',
      'Private Google Sheets copy',
      'All future updates',
    ],
  },
  {
    key: 'project-os',
    name: 'Project OS',
    tagline: 'Plan the work and watch the runway.',
    category: 'Projects',
    icon: 'gauge',
    accent: 'violet',
    originalPrice: '$79',
    salePrice: '$49',
    offerLabel: 'Launch Offer',
    featured: 1,
    sortOrder: 2,
    includes: [
      'Project & milestone tracker',
      'Timeline & deadline view',
      'Budget vs. actual burn',
      'Team workload board',
      'Deliverable checklist',
      'Status dashboard',
      'Private Google Sheets copy',
      'All future updates',
    ],
  },
  {
    key: 'invoice-os',
    name: 'Invoice OS',
    tagline: 'Get paid on time without the chase.',
    category: 'Invoicing',
    icon: 'receipt',
    accent: 'peach',
    originalPrice: '$49',
    salePrice: '$29',
    offerLabel: 'Launch Offer',
    featured: 1,
    sortOrder: 3,
    includes: [
      'Invoice generator with PDF export',
      'Aging buckets & overdue alerts',
      'Payment log & statuses',
      'Client balance overview',
      'Tax & discount support',
      'Chasing email templates',
      'Private Google Sheets copy',
      'All future updates',
    ],
  },
]

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const nowIso = () => new Date().toISOString()
const makeId = (prefix) => `${prefix}_${crypto.randomUUID()}`

// Server logs must never contain personal data. Before any error object or
// provider message reaches console.error, strip anything that looks like an
// email address, a URL with embedded credentials, or a long token.
function redactPii(value) {
  return String(value ?? '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED]')
    .replace(/https?:\/\/[^/\s:@]+:[^@\s]+@/gi, 'https://[REDACTED]@')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, (match) => (match.includes('-') || match.length >= 64 ? '[REDACTED]' : match))
    .slice(0, 400)
}

// Structured log helper. Emits a single-line JSON object so logs can be
// ingested by any SIEM/Datadog/Honeycomb without a parser. All free-form
// fields are passed through redactPii().
function logEvent(level, event, fields = {}) {
  const safe = {}
  for (const [k, v] of Object.entries(fields)) {
    safe[k] = typeof v === 'string' ? redactPii(v) : v
  }
  const line = JSON.stringify({ ts: nowIso(), level, event, ...safe })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

// RFC 4648 base32 (lowercase, no padding). Used for TOTP secrets so they
// fit cleanly into authenticator apps (Google Authenticator, 1Password).
const B32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'
function bytesToBase32(bytes) {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) output += B32_ALPHABET[(value << (5 - bits)) & 0x1f]
  return output
}
function base32ToBytes(input) {
  const cleaned = String(input || '').toLowerCase().replace(/=+$/, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const bytes = []
  for (const ch of cleaned) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

// HMAC-based OTP per RFC 6238. We implement TOTP-SHA1 with a 30-second
// step and 6-digit codes, which is the de-facto default every authenticator
// app speaks. Drift window of ±1 step is the standard 30s of clock slack.
async function totpCode(secret, { step = 30, digits = 6, time = Math.floor(Date.now() / 1000) } = {}) {
  const key = base32ToBytes(secret)
  if (key.length === 0) return ''
  const counter = Math.floor(time / step)
  const counterBytes = new Uint8Array(8)
  let value = counter
  for (let i = 7; i >= 0; i -= 1) {
    counterBytes[i] = value & 0xff
    value = Math.floor(value / 256)
  }
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBytes))
  const offset = digest[digest.length - 1] & 0x0f
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff)
  const code = (binary % (10 ** digits)).toString().padStart(digits, '0')
  return code
}

async function verifyTotp(secret, candidate) {
  const trimmed = String(candidate || '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(trimmed)) return false
  const now = Math.floor(Date.now() / 1000)
  // Accept the current step and the one on either side to absorb clock drift
  // between the client and the server. ±1 step = ±30s.
  for (const offset of [0, -1, 1]) {
    const expected = await totpCode(secret, { time: now + offset * 30 })
    if (expected && constantTimeEqual(expected, trimmed)) return true
  }
  return false
}

// Recovery codes are 10 single-use backup tokens. Stored as SHA-256 hashes
// in D1 so a D1 leak alone doesn't grant access. On successful TOTP the
// user can also spend a recovery code.
async function generateRecoveryCodes(count = 10) {
  const codes = []
  for (let i = 0; i < count; i += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`)
  }
  return codes
}
async function hashRecoveryCodes(codes) {
  const hashes = await Promise.all(codes.map((code) => sha256Hex(`recovery:${code.trim().toLowerCase()}`)))
  return JSON.stringify(hashes)
}
async function consumeRecoveryCode(env, candidate) {
  const normalized = String(candidate || '').trim().toLowerCase()
  if (!/^[a-f0-9]{4}-[a-f0-9]{4}$/.test(normalized)) return false
  const row = await env.DB.prepare('SELECT recovery_codes_hash FROM admin_totp WHERE id = 1').first()
  if (!row) return false
  let hashes
  try { hashes = JSON.parse(row.recovery_codes_hash) } catch { return false }
  const target = await sha256Hex(`recovery:${normalized}`)
  const remaining = []
  let matched = false
  for (const h of hashes) {
    if (!matched && constantTimeEqual(h, target)) matched = true
    else remaining.push(h)
  }
  if (matched) {
    await env.DB.prepare('UPDATE admin_totp SET recovery_codes_hash = ? WHERE id = 1').bind(JSON.stringify(remaining)).run()
  }
  return matched
}

// Admin audit log writer. Called from every /admin/* mutation handler so
// the owner has a forensic record of who changed what, when, and from
// where. Subject id and email come from the authenticated JWT, not from
// any user-supplied field, so an attacker cannot forge their identity.
async function writeAuditLog(env, request, user, action, { entityType = '', entityId = '', details = {} } = {}) {
  if (!env.DB) return
  try {
    const ip = request.headers.get('CF-Connecting-IP') || ''
    const ipHash = ip && env.RATE_LIMIT_SALT ? await sha256Hex(`${env.RATE_LIMIT_SALT}:admin-audit:${ip}`) : ''
    const now = nowIso()
    await env.DB.prepare(`
      INSERT INTO admin_audit_log (id, subject_id, subject_email, action, entity_type, entity_id, details, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId('audit'),
      String(user?.id || ''),
      String(user?.email || ''),
      String(action || '').slice(0, 80),
      String(entityType || '').slice(0, 40),
      String(entityId || '').slice(0, 80),
      JSON.stringify(details || {}).slice(0, 4000),
      ipHash,
      now,
    ).run()
  } catch (error) {
    logEvent('warn', 'audit_log_write_failed', { error: error?.message })
  }
}

async function getAdminAuditLog(env, { limit = 100, entityType = '', subjectId = '' } = {}) {
  if (!env.DB) return []
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100))
  const where = []
  const params = []
  if (entityType) { where.push('entity_type = ?'); params.push(entityType) }
  if (subjectId) { where.push('subject_id = ?'); params.push(subjectId) }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const result = await env.DB.prepare(`
    SELECT id, subject_id AS subjectId, subject_email AS subjectEmail, action,
           entity_type AS entityType, entity_id AS entityId, details, ip, created_at AS createdAt
    FROM admin_audit_log
    ${clause}
    ORDER BY created_at DESC LIMIT ?
  `).bind(...params, safeLimit).all()
  return (result.results || []).map((row) => {
    let parsedDetails = {}
    try { parsedDetails = JSON.parse(row.details || '{}') } catch { /* ignore */ }
    return { ...row, details: parsedDetails }
  })
}

async function getAdminClientErrors(env, { limit = 50 } = {}) {
  if (!env.DB) return []
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const result = await env.DB.prepare(`
    SELECT id, kind, message, stack, url, user_agent AS userAgent, created_at AS createdAt
    FROM client_errors
    ORDER BY created_at DESC LIMIT ?
  `).bind(safeLimit).all()
  return result.results || []
}

// Paid purchases whose delivery email never completed: hard failures, rows
// stuck mid-send, and pending rows old enough that the 5-minute cron should
// have delivered them already. This is the owner-facing view of Layer 13:
// a queue row that exhausts its 5 retries must be visible somewhere, not
// just printed into logs nobody reads.
async function getDeliveryIssues(env) {
  if (!env.DB) return { issues: [] }
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const pendingGrace = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const result = await env.DB.prepare(`
    SELECT id, product_key AS productKey, customer_email AS customerEmail,
           delivery_email_status AS status, delivery_email_attempts AS attempts,
           delivery_email_last_error AS lastError, delivery_email_next_eligible_at AS nextEligibleAt,
           created_at AS createdAt, updated_at AS updatedAt
    FROM purchases
    WHERE payment_status = 'paid' AND access_source = 'paid' AND access_status = 'active'
      AND (
        delivery_email_status = 'failed'
        OR (delivery_email_status = 'sending' AND updated_at <= ?)
        OR (delivery_email_status = 'pending' AND (delivery_email_attempts > 0 OR created_at <= ?))
      )
    ORDER BY updated_at DESC LIMIT 100
  `).bind(staleBefore, pendingGrace).all()
  const issues = (result.results || []).map((row) => ({
    ...row,
    permanent: row.status === 'failed' && Number(row.attempts || 0) >= 5,
  }))
  return { issues }
}

function getAllowedOrigins(env) {
  return String(env.APP_ORIGIN || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

function getPrimaryOrigin(env) {
  const [origin] = getAllowedOrigins(env)
  if (!origin) throw new HttpError(503, 'APP_ORIGIN is not configured')
  return origin
}

const PLACEHOLDER_MARKERS = ['your-domain', 'your-project', 'replace_with', 'REPLACE_WITH', 'owner@your', 'price_replace']

function isPlaceholderValue(value) {
  return typeof value !== 'string' || PLACEHOLDER_MARKERS.some((marker) => value.includes(marker))
}

// Readiness gate: every critical variable and binding is checked by name
// only (values are never returned). /health responds 503 with the missing
// items until the deployment is fully configured, so load balancers and
// uptime checks refuse to route traffic to a half-configured Worker.
async function readinessReport(env) {
  const missing = []
  const advisories = []
  const settings = await getSettings(env)
  const required = [
    ['APP_ORIGIN', 'Storefront origin allowlist'],
    ['SUPABASE_URL', 'Supabase project URL'],
    ['SUPABASE_ANON_KEY', 'Supabase anon key secret'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role key'],
    ['TOTP_ENCRYPTION_KEY', 'Admin TOTP encryption and challenge key'],
    ['BREVO_API_KEY', 'Brevo API key'],
    ['EMAIL_FROM_DELIVERY', 'Brevo delivery sender address'],
    ['EMAIL_FROM_INFO', 'Brevo info sender address'],
    ['RATE_LIMIT_SALT', 'Rate-limit salt'],
    ['FEEDBACK_SIGNING_SECRET', 'Feedback signing secret'],
  ]
  required.push(['LEMONSQUEEZY_API_KEY', 'Lemon Squeezy API key'], ['LEMONSQUEEZY_WEBHOOK_SECRET', 'Lemon Squeezy webhook signing secret'])
  if (!settings.lemonSqueezyStoreId) missing.push({ name: 'lemonSqueezyStoreId', label: 'Lemon Squeezy store ID setting' })
  for (const [name, label] of required) {
    if (!env[name] || isPlaceholderValue(String(env[name]))) missing.push({ name, label })
  }
  if (!env.OWNER_EMAIL || isPlaceholderValue(String(env.OWNER_EMAIL))) missing.push({ name: 'OWNER_EMAIL', label: 'Owner account email' })
  if (!env.DB) missing.push({ name: 'DB', label: 'D1 database binding' })
  if (!env.MEDIA) missing.push({ name: 'MEDIA', label: 'R2 media bucket binding' })
  return { ready: missing.length === 0, missing, advisories }
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const allowed = getAllowedOrigins(env)
  if (!origin || !allowed.includes(origin.replace(/\/$/, ''))) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Correlation-Id, X-Admin-Challenge, X-Admin-TOTP, X-Admin-Recovery',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'X-Correlation-Id',
    Vary: 'Origin',
  }
}

// Hardened defaults for every response. The API serves JSON only, so the
// content policy forbids embedding entirely; the browser bundle served by
// Pages carries its own CSP in public/_headers.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
}

function json(request, env, payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(request, env),
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  })
}

function cleanText(value, maxLength, field, { required = true } = {}) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw new HttpError(400, `${field} is required`)
  if (text.length > maxLength) throw new HttpError(400, `${field} is too long`)
  return text
}

function safeCsvCell(value) {
  let text = String(value ?? '')
  // Spreadsheet programs evaluate these prefixes as formulas even when the
  // CSV field is quoted. Prefix an apostrophe so exported user data is text.
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function cleanRating(value) {
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be between 1 and 5')
  return rating
}

function validHttpUrl(value, field) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') throw new Error('invalid protocol')
    return url.toString()
  } catch {
    throw new HttpError(400, `${field} must be a valid HTTPS URL`)
  }
}

function validSheetsCopyUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'docs.google.com' && url.pathname.startsWith('/spreadsheets/') && url.pathname.endsWith('/copy')
  } catch {
    return false
  }
}

function productDeliveryUrl(env, product) {
  const raw = String(product.deliveryUrl || '').trim()
  if (!raw) throw new HttpError(503, `${product.name || 'Product'} delivery is not configured`)
  if (!validSheetsCopyUrl(raw)) throw new HttpError(503, `${product.name || 'Product'} delivery is not configured correctly`)
  return new URL(raw).toString()
}

function fallbackProductName(key) {
  const known = PRODUCT_FALLBACK_NAMES[key]
  if (known) return known
  return String(key || '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim() || 'Your product'
}

function parseStringList(raw) {
  try {
    const value = JSON.parse(raw || '[]')
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

// Content blobs are JSON objects merged over built-in defaults client-side.
// Server-side they are validated as objects, size-capped, and stored as text.
function parseContentJson(raw) {
  if (!raw) return {}
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

const CONTENT_MAX_LENGTH = 120000

function cleanContentJson(input, field) {
  if (input === undefined || input === null || input === '') return {}
  if (typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, `${field} must be a JSON object`)
  let serialized
  try {
    serialized = JSON.stringify(input)
  } catch {
    throw new HttpError(400, `${field} is nested too deeply`)
  }
  if (serialized.length > CONTENT_MAX_LENGTH) throw new HttpError(400, `${field} is too large`)
  return input
}

// The site-wide announcement bar: message, optional link, and dismiss
// behaviour. Only public-safe values are accepted.
function cleanAnnouncement(input) {
  if (input === undefined || input === null) return { active: false, message: '', linkText: '', linkUrl: '', dismissible: true }
  if (typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Announcement must be a JSON object')
  const linkUrl = cleanText(input.linkUrl, 500, 'Announcement link', { required: false })
  return {
    active: Boolean(input.active),
    message: cleanText(input.message, 200, 'Announcement message', { required: false }),
    linkText: cleanText(input.linkText, 80, 'Announcement link text', { required: false }),
    linkUrl: linkUrl ? validHttpUrl(linkUrl, 'Announcement link') : '',
    dismissible: input.dismissible !== false,
  }
}

// The offer template applied to every product created in the future, so new
// products ship with a working offer before the owner customizes it.
function cleanDefaultOffer(input) {
  if (input === undefined || input === null) return { offerActive: false, offerLabel: '', displayOriginalPrice: '', displaySalePrice: '' }
  if (typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Default offer must be a JSON object')
  return {
    offerActive: Boolean(input.offerActive),
    offerLabel: cleanText(input.offerLabel, 80, 'Default offer label', { required: false }),
    displayOriginalPrice: cleanText(input.displayOriginalPrice, 32, 'Default original price', { required: false }),
    displaySalePrice: cleanText(input.displaySalePrice, 32, 'Default sale price', { required: false }),
  }
}

function parseWaitlistConfig(raw) {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function productRowToConfig(row) {
  const status = row.status || (row.active ? 'active' : 'hidden')
  return {
    key: row.key,
    name: row.name,
    tagline: row.tagline || '',
    category: row.category || '',
    icon: KNOWN_PRODUCT_ICONS.includes(row.icon) ? row.icon : 'spreadsheet',
    accent: KNOWN_PRODUCT_ACCENTS.includes(row.accent) ? row.accent : 'lime',
    deliveryUrl: row.delivery_url || '',
    originalPrice: row.original_price || '',
    salePrice: row.sale_price || '',
    priceCents: Math.max(0, Number(row.price_cents || 0)),
    currency: /^[A-Z]{3}$/.test(String(row.currency || '').toUpperCase()) ? String(row.currency).toUpperCase() : 'USD',
    offerLabel: row.offer_label || '',
    offerActive: Boolean(row.offer_active),
    includes: parseStringList(row.includes),
    lemonVariantId: row.lemon_variant_id || '',
    heroImage: row.hero_image || '',
    featureImages: parseStringList(row.feature_images),
    content: parseContentJson(row.content),
    status,
    waitlistConfig: parseWaitlistConfig(row.waitlist_config),
    updatedAt: row.updated_at || '',
    active: Boolean(row.active && status !== 'hidden'),
    featured: Boolean(row.featured),
    sortOrder: Number(row.sort_order || 0),
  }
}

async function ensureProductsSeeded(env) {
  const seededAt = nowIso()
  const statements = SEED_PRODUCTS.map((product) => env.DB.prepare(`
    INSERT OR IGNORE INTO products (
      key, name, tagline, category, icon, accent, delivery_url,
      original_price, sale_price, price_cents, currency, offer_label, offer_active, includes, active, featured, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, 'USD', ?, 1, ?, 1, ?, ?, ?, ?)
  `).bind(
    product.key,
    product.name,
    product.tagline,
    product.category,
    product.icon,
    product.accent,
    product.originalPrice,
    product.salePrice,
    priceInCents(product.salePrice) || 0,
    product.offerLabel,
    JSON.stringify(product.includes),
    product.featured,
    product.sortOrder,
    seededAt,
    seededAt,
  ))
  await env.DB.batch(statements)
}

async function resolveProductConfig(env, key) {
  await ensureProductsSeeded(env)
  const row = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(key).first()
  if (!row) throw new HttpError(404, 'Product not found')
  const product = productRowToConfig(row)
  if (key === PRODUCT_KEY) {
    const settings = await getSettings(env)
    product.deliveryUrl = product.deliveryUrl || env.GOOGLE_SHEETS_COPY_URL || ''
    product.originalPrice = product.originalPrice || settings.displayOriginalPrice || ''
    product.salePrice = product.salePrice || settings.displaySalePrice || ''
    product.offerLabel = product.offerLabel || settings.offerLabel || ''
  }
  return product
}

async function isKnownProductKey(env, key) {
  if (!key || key === PRODUCT_KEY) return true
  await ensureProductsSeeded(env)
  const row = await env.DB.prepare('SELECT key FROM products WHERE key = ?').bind(key).first()
  return Boolean(row)
}

function publicProductShape(product, features = [], waitlistCount = 0) {
  const status = product.status || (product.active ? 'active' : 'hidden')
  return {
    key: product.key,
    name: product.name,
    tagline: product.tagline,
    category: product.category,
    icon: product.icon,
    accent: product.accent,
    originalPrice: product.originalPrice,
    salePrice: product.salePrice,
    offerLabel: product.offerLabel,
    offerActive: product.offerActive,
    active: product.active,
    status,
    waitlistConfig: product.waitlistConfig || {},
    waitlistCount,
    featured: product.featured,
    sortOrder: product.sortOrder,
    includes: product.includes,
    heroImage: product.heroImage || '',
    featureImages: (features.length ? features.map((feature) => feature.imagePath) : (product.featureImages || [])),
    features,
    content: product.content || {},
    updatedAt: product.updatedAt || '',
    checkoutReady: Boolean(product.lemonVariantId && product.lemonVariantId !== '' && status !== 'coming_soon'),
  }
}

async function getActiveProducts(env) {
  await ensureProductsSeeded(env)
  const settings = await getSettings(env)
  const result = await env.DB.prepare("SELECT * FROM products WHERE (active = 1 OR status = 'coming_soon') AND (status IS NULL OR status != 'hidden') ORDER BY sort_order ASC, key ASC").all()
  const rows = result.results || []
  const featuresByKey = await featuresMapForProducts(env, rows)

  const waitlistCounts = new Map()
  try {
    const wCounts = await env.DB.prepare('SELECT product_key, COUNT(*) as count FROM product_waitlist GROUP BY product_key').all()
    for (const r of wCounts.results || []) {
      waitlistCounts.set(r.product_key, Number(r.count) || 0)
    }
  } catch { /* if waitlist table is not yet migrated in test env */ }

  return rows.map((row) => {
    const product = productRowToConfig(row)
    if (product.key === PRODUCT_KEY) {
      product.deliveryUrl = product.deliveryUrl || env.GOOGLE_SHEETS_COPY_URL || ''
      product.originalPrice = product.originalPrice || settings.displayOriginalPrice || ''
      product.salePrice = product.salePrice || settings.displaySalePrice || ''
      product.offerLabel = product.offerLabel || settings.offerLabel || ''
    }
    const rawCount = waitlistCounts.get(product.key) || 0
    const offset = Number(product.waitlistConfig?.socialProofOffset) || 0
    const waitlistCount = rawCount + (product.waitlistConfig?.showSocialProof ? offset : 0)
    return publicProductShape(product, featuresByKey.get(product.key) || [], waitlistCount)
  })
}

async function productInfoMap(env) {
  await ensureProductsSeeded(env)
  const rows = await env.DB.prepare('SELECT key, name, icon, accent FROM products').all()
  const byKey = new Map((rows.results || []).map((row) => [row.key, row]))
  return (key) => {
    const row = byKey.get(key)
    return {
      key,
      name: row?.name || fallbackProductName(key),
      icon: row?.icon || PRODUCT_FALLBACK_ICONS[key] || 'spreadsheet',
      accent: row?.accent || 'lime',
    }
  }
}

async function productNameForPurchase(env, purchaseId) {
  const row = await env.DB.prepare(`
    SELECT COALESCE(products.name, '') AS name, purchases.product_key AS key
    FROM purchases LEFT JOIN products ON products.key = purchases.product_key
    WHERE purchases.id = ?
  `).bind(purchaseId).first()
  const name = row?.name || fallbackProductName(row?.key)
  return name
}

const MEDIA_PATH_PATTERN = /^\/media\/[a-z0-9-]{1,60}\/[a-f0-9-]{8,64}\.webp$/

function cleanMediaPath(value, field) {
  const text = cleanText(value, 200, field, { required: false })
  if (text && !MEDIA_PATH_PATTERN.test(text)) throw new HttpError(400, `${field} must be an uploaded media path`)
  return text
}

function cleanIncludes(value) {
  if (!Array.isArray(value)) return []
  const items = value
    .slice(0, 20)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  for (const item of items) {
    if (item.length > 120) throw new HttpError(400, 'Included item is too long')
  }
  return items
}

function cleanProductInput(input, { create = false } = {}) {
  const key = create ? cleanText(input.key, 60, 'Product key').toLowerCase() : ''
  if (create && !PRODUCT_KEY_PATTERN.test(key)) throw new HttpError(400, 'Product key must use lowercase letters, numbers, and dashes')
  const name = cleanText(input.name, 80, 'Product name')
  const icon = String(input.icon || 'spreadsheet')
  if (!KNOWN_PRODUCT_ICONS.includes(icon)) throw new HttpError(400, 'Unknown product icon')
  const accent = String(input.accent || 'lime')
  if (!KNOWN_PRODUCT_ACCENTS.includes(accent)) throw new HttpError(400, 'Unknown product accent')
  const deliveryUrl = cleanText(input.deliveryUrl, 500, 'Delivery URL', { required: false })
  if (deliveryUrl && !validSheetsCopyUrl(deliveryUrl)) throw new HttpError(400, 'Delivery URL must be a Google Sheets copy link')
  const product = {
    key,
    name,
    tagline: cleanText(input.tagline, 120, 'Tagline', { required: false }),
    category: cleanText(input.category, 60, 'Category', { required: false }),
    icon,
    accent,
    deliveryUrl,
    originalPrice: cleanText(input.originalPrice, 32, 'Original price', { required: false }),
    salePrice: cleanText(input.salePrice, 32, 'Sale price', { required: false }),
    priceCents: Math.max(0, Math.round(Number(input.priceCents) || priceInCents(input.salePrice) || 0)),
    currency: String(input.currency || 'USD').trim().toUpperCase(),
    offerLabel: cleanText(input.offerLabel, 80, 'Offer label'),
    offerActive: Boolean(input.offerActive),
    active: Boolean(input.active),
    featured: Boolean(input.featured),
    sortOrder: Math.min(999, Math.max(0, Number(input.sortOrder) || 0)),
    includes: cleanIncludes(input.includes),
  }
  if (!/^[A-Z]{3}$/.test(product.currency)) throw new HttpError(400, 'Currency must be a three-letter ISO code')
  if (product.priceCents > 100000000) throw new HttpError(400, 'Price is too large')
  // Media fields are only applied when explicitly present so a plain editor
  // save cannot wipe uploaded visuals.
  if (!create && Object.prototype.hasOwnProperty.call(input, 'heroImage')) {
    product.heroImage = cleanMediaPath(input.heroImage, 'Hero image')
  }
  if (!create && Object.prototype.hasOwnProperty.call(input, 'featureImages')) {
    const raw = Array.isArray(input.featureImages) ? input.featureImages : []
    product.featureImages = raw.map((value) => cleanMediaPath(value, 'Screenshot path'))
  }
  if (!create && Object.prototype.hasOwnProperty.call(input, 'content')) {
    product.content = cleanContentJson(input.content, 'Product content')
  }
  const variantId = cleanText(input.lemonVariantId, 20, 'Lemon Squeezy variant ID', { required: false })
  if (variantId && !/^\d{1,20}$/.test(variantId)) throw new HttpError(400, 'Lemon Squeezy variant ID must be a number')
  product.lemonVariantId = variantId

  const status = ['active', 'coming_soon', 'hidden'].includes(input.status)
    ? input.status
    : (input.active === false ? 'hidden' : 'active')
  product.status = status
  product.active = status !== 'hidden'
  if (status === 'active' && (!Number.isInteger(product.priceCents) || product.priceCents <= 0)) {
    throw new HttpError(400, 'Active products require an authoritative checkout price in minor currency units')
  }

  let waitlistConfig = {}
  if (input.waitlistConfig && typeof input.waitlistConfig === 'object') {
    const wc = input.waitlistConfig
    let pollOptions = []
    if (Array.isArray(wc.pollOptions)) {
      pollOptions = wc.pollOptions.map((o) => cleanText(o, 80, 'Poll option', { required: false })).filter(Boolean)
    } else if (typeof wc.pollOptionsText === 'string') {
      pollOptions = parseStringList(wc.pollOptionsText)
    }
    waitlistConfig = {
      launchTimeline: cleanText(wc.launchTimeline, 80, 'Launch timeline', { required: false }),
      incentive: cleanText(wc.incentive, 200, 'Incentive', { required: false }),
      showSocialProof: Boolean(wc.showSocialProof),
      socialProofOffset: Math.max(0, Math.min(100000, Number(wc.socialProofOffset) || 0)),
      welcomeEmailEnabled: wc.welcomeEmailEnabled !== false,
      welcomeEmailSubject: cleanText(wc.welcomeEmailSubject, 120, 'Welcome subject', { required: false }),
      welcomeEmailBody: cleanText(wc.welcomeEmailBody, 1000, 'Welcome body', { required: false }),
      pollEnabled: Boolean(wc.pollEnabled),
      pollQuestion: cleanText(wc.pollQuestion, 160, 'Poll question', { required: false }),
      pollOptions,
    }
  }
  product.waitlistConfig = waitlistConfig
  return product
}

const FEATURE_HEADING_MAX = 100
const FEATURE_SUBHEADING_MAX = 300
const AI_IMAGE_MODEL = '@cf/llava-hf/llava-1.5-7b-hf'
const AI_IMAGE_PROMPT = 'Describe this screenshot of a business software tool in exactly two lines. First line: a short headline of 4 to 7 words summarizing what the screenshot shows. Second line: one plain supporting sentence of 8 to 16 words with one concrete detail visible in the image. Output only the two lines with no numbering, quotes, or extra commentary.'

function parseAiDescription(text) {
  const raw = String(text || '').replaceAll('"', '').trim()
  if (!raw) return null
  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/^[-*#>\d.)\s]+/, '').trim())
    .filter(Boolean)
  if (!lines.length) return null
  const heading = lines[0].slice(0, FEATURE_HEADING_MAX)
  const subheading = lines.slice(1).join(' ').trim().slice(0, FEATURE_SUBHEADING_MAX)
  if (!heading && !subheading) return null
  return { heading, subheading }
}

async function describeImageWithAi(env, bytes) {
  const input = {
    image: Array.from(bytes),
    prompt: AI_IMAGE_PROMPT,
    max_tokens: 120,
  }
  if (env.AI && typeof env.AI.run === 'function') {
    try {
      const result = await env.AI.run(AI_IMAGE_MODEL, input)
      const parsed = parseAiDescription(result?.description || result?.response || '')
      if (parsed) return { ...parsed, aiAvailable: true }
    } catch (error) {
      console.error('Workers AI image scan failed', redactPii(error?.message))
    }
  }
  if (env.AI_ACCOUNT_ID && env.AI_API_TOKEN) {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.AI_ACCOUNT_ID}/ai/run/${AI_IMAGE_MODEL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.AI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) {
        const payload = await response.json()
        const parsed = parseAiDescription(payload?.result?.description || payload?.result?.response || '')
        if (parsed) return { ...parsed, aiAvailable: true }
      }
    } catch (error) {
      console.error('Workers AI REST image scan failed', redactPii(error?.message))
    }
  }
  return { heading: '', subheading: '', aiAvailable: false }
}

function featureRowToConfig(row) {
  return {
    id: row.id,
    imagePath: row.media_path || '',
    heading: row.heading || '',
    subheading: row.subheading || '',
    sortOrder: Number(row.sort_order || 0),
  }
}

function mediaObjectKey(mediaPath) {
  const match = MEDIA_PATH_PATTERN.exec(String(mediaPath || ''))
  if (!match) return ''
  return `product-media/${match[1]}/${match[2]}.webp`
}

// Uploads must be real images: the declared MIME type in a data URL is
// attacker-controlled, so verify the actual file signature (magic bytes)
// before storing anything in media storage.
function verifyImageSignature(bytes, declaredType) {
  const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length))
  if (declaredType === 'png') {
    return bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  }
  if (declaredType === 'jpeg') {
    return bytes.length >= 4
      && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
  }
  if (declaredType === 'webp') {
    return bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
  }
  return false
}

function decodeUploadedImage(image) {
  const parsed = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image)
  if (!parsed) throw new HttpError(400, 'Image must be a PNG, JPEG, or WebP data URL')
  const binary = atob(parsed[2])
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (bytes.byteLength < 64) throw new HttpError(400, 'Image is too small')
  if (bytes.byteLength > 5 * 1024 * 1024) throw new HttpError(400, 'Image must be 5 MB or smaller')
  if (!verifyImageSignature(bytes, parsed[1])) throw new HttpError(400, 'Image content does not match its declared format')
  return { bytes, contentType: `image/${parsed[1]}` }
}

// Legacy uploaded feature screenshots live in products.feature_images. Move
// them into the product_features table on first access so every feature can
// carry its own heading, subheading, and position.
async function ensureFeatureBackfill(env, productKey, legacyImages) {
  if (!legacyImages.length) return
  const existing = await env.DB.prepare('SELECT COUNT(*) AS total FROM product_features WHERE product_key = ?').bind(productKey).first()
  if (Number(existing?.total || 0) > 0) return
  const updatedAt = nowIso()
  const statements = legacyImages.map((path, index) => env.DB.prepare(`
    INSERT OR IGNORE INTO product_features (id, product_key, media_path, heading, subheading, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, '', '', ?, ?, ?)
  `).bind(makeId('feature'), productKey, path, index, updatedAt, updatedAt))
  if (statements.length) await env.DB.batch(statements)
}

async function featuresForProduct(env, productKey, legacyImages = []) {
  await ensureFeatureBackfill(env, productKey, legacyImages)
  const result = await env.DB.prepare('SELECT * FROM product_features WHERE product_key = ? ORDER BY sort_order ASC, created_at ASC').bind(productKey).all()
  return (result.results || []).map(featureRowToConfig)
}

async function featuresMapForProducts(env, rows) {
  await Promise.all(rows.map((row) => ensureFeatureBackfill(env, row.key, parseStringList(row.feature_images))))
  const result = await env.DB.prepare(`
    SELECT * FROM product_features
    WHERE product_key IN (SELECT value FROM json_each(?))
    ORDER BY sort_order ASC, created_at ASC
  `).bind(JSON.stringify(rows.map((row) => row.key))).all()
  const byKey = new Map()
  for (const featureRow of result.results || []) {
    const list = byKey.get(featureRow.product_key) || []
    list.push(featureRowToConfig(featureRow))
    byKey.set(featureRow.product_key, list)
  }
  return byKey
}

async function syncLegacyFeatureImages(env, productKey) {
  const features = await featuresForProduct(env, productKey, [])
  await env.DB.prepare('UPDATE products SET feature_images = ?, updated_at = ? WHERE key = ?')
    .bind(JSON.stringify(features.map((feature) => feature.imagePath)), nowIso(), productKey)
    .run()
}

async function insertFeatureRow(env, productKey, mediaPath, { heading = '', subheading = '' } = {}) {
  const updatedAt = nowIso()
  const id = makeId('feature')
  await env.DB.prepare(`
    INSERT INTO product_features (id, product_key, media_path, heading, subheading, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM product_features WHERE product_key = ?), ?, ?)
  `).bind(id, productKey, mediaPath, heading, subheading, productKey, updatedAt, updatedAt).run()
  return env.DB.prepare('SELECT * FROM product_features WHERE id = ?').bind(id).first()
}

async function createProduct(env, input) {
  // Future products inherit the default offer template unless the owner sets
  // offer fields explicitly, so every new product ships sell-ready.
  const settings = await getSettings(env)
  const defaultOffer = settings.defaultOffer || {}
  const merged = { ...input }
  if (!Object.prototype.hasOwnProperty.call(input, 'offerActive')) merged.offerActive = Boolean(defaultOffer.offerActive)
  if (!String(input.offerLabel || '').trim()) merged.offerLabel = defaultOffer.offerLabel || 'Launch Offer'
  if (!String(input.originalPrice || '').trim()) merged.originalPrice = defaultOffer.displayOriginalPrice || ''
  if (!String(input.salePrice || '').trim()) merged.salePrice = defaultOffer.displaySalePrice || ''
  const product = cleanProductInput(merged, { create: true })
  const existing = await env.DB.prepare('SELECT key FROM products WHERE key = ?').bind(product.key).first()
  if (existing) throw new HttpError(409, 'A product with this key already exists')
  const updatedAt = nowIso()
  await env.DB.prepare(`
    INSERT INTO products (
      key, name, tagline, category, icon, accent, lemon_variant_id, delivery_url,
      original_price, sale_price, price_cents, currency, offer_label, offer_active, includes, active, featured, sort_order, status, waitlist_config, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    product.key,
    product.name,
    product.tagline,
    product.category,
    product.icon,
    product.accent,
    product.lemonVariantId,
    product.deliveryUrl,
    product.originalPrice,
    product.salePrice,
    product.priceCents,
    product.currency,
    product.offerLabel,
    product.offerActive ? 1 : 0,
    JSON.stringify(product.includes),
    product.active ? 1 : 0,
    product.featured ? 1 : 0,
    product.sortOrder,
    product.status,
    JSON.stringify(product.waitlistConfig || {}),
    updatedAt,
    updatedAt,
  ).run()
  await invalidatePublicCaches()
  return productRowToConfig(await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(product.key).first())
}

// Create a product by copying an existing one's marketing content into a new
// key. The generic fallback template is deliberately bland, so duplicating a
// well-written product and editing the specifics is far quicker than writing
// every section from scratch.
//
// Copied: the structured content JSON and the presentational fields.
// NOT copied, on purpose:
//   - lemonVariantId and deliveryUrl, which are per-product commercial config;
//     copying them would sell the new product against the source's payment
//     variant and hand buyers the wrong Google Sheet.
//   - images. Media object keys embed the owning product key
//     (product-media/<key>/<id>.webp), so sharing paths would leave the copy
//     pointing at the source's files and break it if the source is deleted.
//     The new product starts with the CSS mock until its own art is uploaded.
async function duplicateProduct(env, sourceKey, input) {
  await ensureProductsSeeded(env)
  const source = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(sourceKey).first()
  if (!source) throw new HttpError(404, 'The product being duplicated was not found')

  const created = await createProduct(env, {
    ...input,
    tagline: input.tagline || source.tagline || '',
    category: input.category || source.category || '',
    icon: input.icon || source.icon || 'spreadsheet',
    accent: input.accent || source.accent || 'lime',
    includes: input.includes?.length ? input.includes : parseStringList(source.includes),
    // Never inherit payment or delivery wiring, and never publish a duplicate
    // as purchasable before its own checkout price/variant are configured.
    lemonVariantId: '',
    deliveryUrl: '',
    status: 'coming_soon',
    active: true,
  })

  const content = String(source.content || '')
  if (content) {
    await env.DB.prepare('UPDATE products SET content = ?, updated_at = ? WHERE key = ?')
      .bind(content, nowIso(), created.key).run()
  }

  await invalidatePublicCaches()
  const row = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(created.key).first()
  return { ...productRowToConfig(row), duplicatedFrom: sourceKey }
}

async function updateProduct(env, key, input) {
  const product = cleanProductInput(input)
  const updatedAt = nowIso()
  const result = await env.DB.prepare(`
    UPDATE products SET
      name = ?, tagline = ?, category = ?, icon = ?, accent = ?, lemon_variant_id = ?, delivery_url = ?,
      original_price = ?, sale_price = ?, price_cents = ?, currency = ?, offer_label = ?, offer_active = ?, includes = ?,
      active = ?, featured = ?, sort_order = ?, status = ?, waitlist_config = ?, updated_at = ?
    WHERE key = ?
    RETURNING *
  `).bind(
    product.name,
    product.tagline,
    product.category,
    product.icon,
    product.accent,
    product.lemonVariantId,
    product.deliveryUrl,
    product.originalPrice,
    product.salePrice,
    product.priceCents,
    product.currency,
    product.offerLabel,
    product.offerActive ? 1 : 0,
    JSON.stringify(product.includes),
    product.active ? 1 : 0,
    product.featured ? 1 : 0,
    product.sortOrder,
    product.status,
    JSON.stringify(product.waitlistConfig || {}),
    updatedAt,
    key,
  ).first()
  if (!result) throw new HttpError(404, 'Product not found')

  const mediaStatements = []
  if (Object.prototype.hasOwnProperty.call(product, 'heroImage')) {
    mediaStatements.push(env.DB.prepare('UPDATE products SET hero_image = ?, updated_at = ? WHERE key = ?').bind(product.heroImage, updatedAt, key))
  }
  if (Object.prototype.hasOwnProperty.call(product, 'featureImages')) {
    mediaStatements.push(env.DB.prepare('UPDATE products SET feature_images = ?, updated_at = ? WHERE key = ?').bind(JSON.stringify(product.featureImages), updatedAt, key))
  }
  if (Object.prototype.hasOwnProperty.call(product, 'content')) {
    mediaStatements.push(env.DB.prepare('UPDATE products SET content = ?, updated_at = ? WHERE key = ?').bind(JSON.stringify(product.content || {}), updatedAt, key))
  }
  if (Object.prototype.hasOwnProperty.call(product, 'lemonVariantId')) {
    mediaStatements.push(env.DB.prepare('UPDATE products SET lemon_variant_id = ?, updated_at = ? WHERE key = ?').bind(product.lemonVariantId, updatedAt, key))
  }
  if (mediaStatements.length) await env.DB.batch(mediaStatements)

  // When the owner explicitly replaces the legacy screenshot list, mirror the
  // change into the feature table so both stores stay consistent.
  if (Object.prototype.hasOwnProperty.call(product, 'featureImages')) {
    const wanted = new Set(product.featureImages)
    const featureRows = await env.DB.prepare('SELECT * FROM product_features WHERE product_key = ?').bind(key).all()
    for (const row of featureRows.results || []) {
      if (!wanted.has(row.media_path)) await env.DB.prepare('DELETE FROM product_features WHERE id = ?').bind(row.id).run()
      else wanted.delete(row.media_path)
    }
    for (const path of wanted) await insertFeatureRow(env, key, path)
  }

  const updated = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(key).first()
  await invalidatePublicCaches()
  return productRowToConfig(updated)
}

// ---------------------------------------------------------------- bundles
//
// A bundle is a named set of 2+ products sold at a percentage off the sum of
// their sale prices. The percentage is the source of truth: member prices are
// display strings the owner edits freely, so a stored absolute price would go
// stale silently. Everything money-related is recomputed from D1 at checkout
// and never trusted from the client.

const BUNDLE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,59}$/

function bundleRowToConfig(row) {
  return {
    key: row.key,
    name: row.name,
    tagline: row.tagline || '',
    productKeys: parseStringList(row.product_keys),
    discountPercent: Number(row.discount_percent || 0),
    lemonVariantId: row.lemon_variant_id || '',
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order || 0),
    updatedAt: row.updated_at || '',
  }
}

async function cleanBundleInput(env, input, { create = false } = {}) {
  const key = create ? cleanText(input.key, 60, 'Bundle key').toLowerCase() : ''
  if (create && !BUNDLE_KEY_PATTERN.test(key)) {
    throw new HttpError(400, 'Bundle key must use lowercase letters, numbers, and dashes')
  }
  const name = cleanText(input.name, 80, 'Bundle name')
  const tagline = cleanText(input.tagline, 200, 'Bundle tagline', { required: false })

  const rawKeys = Array.isArray(input.productKeys) ? input.productKeys : []
  const productKeys = []
  for (const rawKey of rawKeys) {
    const productKey = cleanText(String(rawKey), 60, 'Product key')
    if (!productKeys.includes(productKey)) productKeys.push(productKey)
  }
  if (productKeys.length < 2) throw new HttpError(400, 'A bundle needs at least two different products')
  if (productKeys.length > 10) throw new HttpError(400, 'A bundle can hold at most ten products')

  // Every member must actually exist, or the bundle could advertise something
  // that can never be delivered.
  await ensureProductsSeeded(env)
  for (const productKey of productKeys) {
    const row = await env.DB.prepare('SELECT key FROM products WHERE key = ?').bind(productKey).first()
    if (!row) throw new HttpError(400, `Unknown product in bundle: ${productKey}`)
  }

  const discountPercent = Math.round(Number(input.discountPercent))
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 90) {
    throw new HttpError(400, 'Bundle discount must be a whole percentage between 1 and 90')
  }

  const lemonVariantId = cleanText(input.lemonVariantId, 20, 'Lemon Squeezy variant ID', { required: false })
  if (lemonVariantId && !/^\d{1,20}$/.test(lemonVariantId)) {
    throw new HttpError(400, 'Lemon Squeezy variant ID must be a number')
  }

  return {
    key,
    name,
    tagline,
    productKeys,
    discountPercent,
    lemonVariantId,
    active: input.active !== false,
    sortOrder: Math.min(999, Math.max(0, Number(input.sortOrder) || 0)),
  }
}

// Price a bundle from live D1 rows. Returns null when any member has no
// usable price, so callers can hide it rather than sell it wrongly.
function priceBundle(products, discountPercent) {
  let fullCents = 0
  const currencies = new Set()
  for (const product of products) {
    const cents = Math.round(Number(product.priceCents || 0))
    if (!Number.isInteger(cents) || cents <= 0) return null
    currencies.add(product.currency || 'USD')
    fullCents += cents
  }
  if (currencies.size !== 1) return null
  const bundleCents = Math.round(fullCents * (100 - discountPercent) / 100)
  return { fullCents, bundleCents, savingCents: fullCents - bundleCents, currency: [...currencies][0] }
}

const centsToDisplay = (cents, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency', currency, maximumFractionDigits: cents % 100 ? 2 : 0,
}).format(cents / 100)

async function bundlesForPublic(env) {
  await ensureProductsSeeded(env)
  const result = await env.DB.prepare('SELECT * FROM bundles WHERE active = 1 ORDER BY sort_order ASC, key ASC').all()
  const bundles = []
  for (const row of result.results || []) {
    const bundle = bundleRowToConfig(row)
    const members = []
    let complete = true
    for (const productKey of bundle.productKeys) {
      const productRow = await env.DB.prepare('SELECT * FROM products WHERE key = ? AND active = 1').bind(productKey).first()
      // A bundle is only sellable while every member still exists and is
      // visible; otherwise it silently drops off the storefront.
      if (!productRow) { complete = false; break }
      members.push(productRowToConfig(productRow))
    }
    if (!complete || members.length < 2) continue
    const pricing = priceBundle(members, bundle.discountPercent)
    if (!pricing) continue
    // Explicit allowlist, mirroring publicProductShape: never spread the row,
    // so operational fields such as the Lemon Squeezy variant id and the
    // active flag cannot leak into the public config.
    bundles.push({
      key: bundle.key,
      name: bundle.name,
      tagline: bundle.tagline,
      productKeys: bundle.productKeys,
      discountPercent: bundle.discountPercent,
      sortOrder: bundle.sortOrder,
      updatedAt: bundle.updatedAt,
      checkoutReady: members.every((product) => Boolean(product.lemonVariantId)),
      products: members.map((product) => ({ key: product.key, name: product.name, icon: product.icon, accent: product.accent, salePrice: product.salePrice })),
      fullPrice: centsToDisplay(pricing.fullCents, pricing.currency),
      bundlePrice: centsToDisplay(pricing.bundleCents, pricing.currency),
      saving: centsToDisplay(pricing.savingCents, pricing.currency),
    })
  }
  return bundles
}

async function createBundle(env, input) {
  const bundle = await cleanBundleInput(env, input, { create: true })
  const existing = await env.DB.prepare('SELECT key FROM bundles WHERE key = ?').bind(bundle.key).first()
  if (existing) throw new HttpError(409, 'A bundle with this key already exists')
  const now = nowIso()
  await env.DB.prepare(`
    INSERT INTO bundles (key, name, tagline, product_keys, discount_percent, lemon_variant_id, active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    bundle.key,
    bundle.name,
    bundle.tagline,
    JSON.stringify(bundle.productKeys),
    bundle.discountPercent,
    bundle.lemonVariantId,
    bundle.active ? 1 : 0,
    bundle.sortOrder,
    now,
    now,
  ).run()
  await invalidatePublicCaches()
  return bundleRowToConfig(await env.DB.prepare('SELECT * FROM bundles WHERE key = ?').bind(bundle.key).first())
}

async function updateBundle(env, key, input) {
  const bundle = await cleanBundleInput(env, input)
  const updated = await env.DB.prepare(`
    UPDATE bundles SET name = ?, tagline = ?, product_keys = ?, discount_percent = ?,
      lemon_variant_id = ?, active = ?, sort_order = ?, updated_at = ?
    WHERE key = ? RETURNING *
  `).bind(
    bundle.name,
    bundle.tagline,
    JSON.stringify(bundle.productKeys),
    bundle.discountPercent,
    bundle.lemonVariantId,
    bundle.active ? 1 : 0,
    bundle.sortOrder,
    nowIso(),
    key,
  ).first()
  if (!updated) throw new HttpError(404, 'Bundle not found')
  await invalidatePublicCaches()
  return bundleRowToConfig(updated)
}

async function deleteBundle(env, key) {
  const row = await env.DB.prepare('SELECT name FROM bundles WHERE key = ?').bind(key).first()
  if (!row) throw new HttpError(404, 'Bundle not found')
  await env.DB.prepare('DELETE FROM bundles WHERE key = ?').bind(key).run()
  await invalidatePublicCaches()
  return { removed: true, key, name: row.name || key }
}

// Permanently remove a product and everything attached to it. Seeded catalog
// products are protected: deleting one would only have it re-seeded on the
// next request, so they must be hidden with `active = 0` instead. Purchases
// are never touched — a buyer keeps their delivery history even after the
// owner retires the product they bought.
async function deleteProduct(env, key) {
  await ensureProductsSeeded(env)
  const row = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(key).first()
  if (!row) throw new HttpError(404, 'Product not found')
  if (SEED_PRODUCTS.some((product) => product.key === key)) {
    throw new HttpError(409, 'Built-in catalog products cannot be deleted. Set them to hidden instead.')
  }

  // Collect every stored object before the rows go away, then best-effort
  // clean the bucket so deleted products leave no orphaned media behind.
  const featureRows = await env.DB.prepare('SELECT media_path FROM product_features WHERE product_key = ?').bind(key).all()
  const mediaPaths = [
    String(row.hero_image || ''),
    ...parseStringList(row.feature_images),
    ...(featureRows.results || []).map((feature) => String(feature.media_path || '')),
  ].filter(Boolean)

  await env.DB.batch([
    env.DB.prepare('DELETE FROM product_features WHERE product_key = ?').bind(key),
    env.DB.prepare('DELETE FROM products WHERE key = ?').bind(key),
  ])

  if (env.MEDIA) {
    for (const mediaPath of new Set(mediaPaths)) {
      await env.MEDIA.delete(mediaObjectKey(mediaPath)).catch(() => {})
    }
  }

  await invalidatePublicCaches()
  return { removed: true, key, name: row.name || key }
}

const JSON_BODY_MAX_LENGTH = 8 * 1024 * 1024

async function readBodyTextBounded(request, maxBytes = JSON_BODY_MAX_LENGTH, label = 'Request') {
  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new HttpError(413, `${label} body is too large`)
  if (!request.body) return ''

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel('body limit exceeded').catch(() => {})
        throw new HttpError(413, `${label} body is too large`)
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return text
  } finally {
    reader.releaseLock()
  }
}

async function readJson(request) {
  const contentType = request.headers.get('Content-Type') || ''
  if (!contentType.includes('application/json')) throw new HttpError(415, 'Content-Type must be application/json')
  const text = await readBodyTextBounded(request)
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON')
  }
}

async function sha256Hex(value) {
  const data = value instanceof Uint8Array ? value : new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function stringToBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

function base64UrlToBytes(value) {
  const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function base64UrlToString(value) {
  return new TextDecoder().decode(base64UrlToBytes(value))
}

async function dataEncryptionKey(env, purpose) {
  if (!env.TOTP_ENCRYPTION_KEY) throw new HttpError(503, 'Server-side encryption is not configured')
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`runway:${purpose}:${env.TOTP_ENCRYPTION_KEY}`))
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encryptSensitiveValue(env, purpose, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await dataEncryptionKey(env, purpose)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(value || '')))
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`
}

async function decryptSensitiveValue(env, purpose, sealed) {
  const [version, encodedIv, encodedCiphertext, extra] = String(sealed || '').split('.')
  if (version !== 'v1' || !encodedIv || !encodedCiphertext || extra) throw new Error('Invalid encrypted value')
  const key = await dataEncryptionKey(env, purpose)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(encodedIv) },
    key,
    base64UrlToBytes(encodedCiphertext),
  )
  return new TextDecoder().decode(plaintext)
}

async function readTotpSecret(env, storedSecret) {
  const stored = String(storedSecret || '')
  if (!stored.startsWith('v1.')) {
    // Transparently seal legacy plaintext rows after the first successful
    // owner-authentication read; the compare protects a concurrently reset row.
    if (stored) {
      const encrypted = await encryptSensitiveValue(env, 'admin-totp-secret', stored)
      await env.DB.prepare('UPDATE admin_totp SET secret = ? WHERE id = 1 AND secret = ?').bind(encrypted, stored).run()
    }
    return stored
  }
  return decryptSensitiveValue(env, 'admin-totp-secret', stored)
}

async function feedbackSignature(env, encodedPayload) {
  if (!env.FEEDBACK_SIGNING_SECRET) throw new HttpError(503, 'Feedback link signing is not configured')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.FEEDBACK_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload))
  return bytesToBase64Url(new Uint8Array(signature))
}

async function createFeedbackToken(env, purchaseId, expiresAt = Math.floor(Date.now() / 1000) + FEEDBACK_TOKEN_TTL_SECONDS) {
  const payload = stringToBase64Url(JSON.stringify({
    v: 1,
    purpose: 'feedback',
    purchaseId,
    expiresAt,
  }))
  return `${payload}.${await feedbackSignature(env, payload)}`
}

async function verifyFeedbackToken(env, token) {
  try {
    const [payload, suppliedSignature, extra] = String(token || '').split('.')
    if (!payload || !suppliedSignature || extra) throw new Error('malformed')
    const expectedSignature = await feedbackSignature(env, payload)
    if (!constantTimeEqual(suppliedSignature, expectedSignature)) throw new Error('signature')
    const decoded = JSON.parse(base64UrlToString(payload))
    if (decoded.v !== 1 || decoded.purpose !== 'feedback' || !decoded.purchaseId) throw new Error('payload')
    if (!Number.isInteger(decoded.expiresAt) || decoded.expiresAt < Math.floor(Date.now() / 1000)) {
      throw new HttpError(410, 'This feedback link has expired')
    }
    return decoded
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Invalid feedback link')
  }
}

async function feedbackPurchaseForUser(env, token, userId) {
  const payload = await verifyFeedbackToken(env, token)
  return findPurchaseForUser(env, payload.purchaseId, userId)
}

// Runway Systems Blog publishing ------------------------------------------------
function normalizeBlogSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function blogTagList(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',')
  const tags = [...new Set(source.map((tag) => String(tag || '').trim()).filter(Boolean))].slice(0, 8)
  for (const tag of tags) if (tag.length > 32) throw new HttpError(400, 'Tags must be 32 characters or shorter')
  return tags
}

function blogReadingMinutes(markdown) {
  const words = String(markdown || '').replace(/[`#>*_\[\]()|~-]/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 220))
}

function cleanBlogDraft(input, current = null) {
  const fallback = (camel, snake, empty = '') => input[camel] !== undefined ? input[camel] : (current?.[snake] ?? empty)
  const title = cleanText(fallback('title', 'title', 'Untitled article'), 140, 'Title')
  const slug = normalizeBlogSlug(fallback('slug', 'slug', title) || title)
  if (!slug || slug.length > 110 || !BLOG_SLUG_PATTERN.test(slug)) throw new HttpError(400, 'Use a valid lowercase article slug')
  const requestedLayout = fallback('layout', 'layout', 'editorial')
  const layout = BLOG_LAYOUTS.includes(requestedLayout) ? requestedLayout : 'editorial'
  const currentTags = String(current?.tag_names || '').split('\u001f').filter(Boolean)
  return {
    title,
    slug,
    excerpt: cleanText(fallback('excerpt', 'excerpt'), 360, 'Excerpt', { required: false }),
    bodyMarkdown: cleanText(fallback('bodyMarkdown', 'body_markdown'), 120000, 'Article body', { required: false }),
    categoryId: cleanText(fallback('categoryId', 'category_id'), 80, 'Category', { required: false }),
    authorName: cleanText(fallback('authorName', 'author_name', 'Runway Systems'), 80, 'Author'),
    coverMediaId: cleanText(fallback('coverMediaId', 'cover_media_id'), 80, 'Cover media', { required: false }),
    seoTitle: cleanText(fallback('seoTitle', 'seo_title'), 75, 'SEO title', { required: false }),
    seoDescription: cleanText(fallback('seoDescription', 'seo_description'), 180, 'SEO description', { required: false }),
    featured: Boolean(fallback('featured', 'featured', false)),
    layout,
    tags: blogTagList(input.tags !== undefined ? input.tags : currentTags),
  }
}

function blogRowToPost(row, { includeBody = false, owner = false } = {}) {
  const tags = String(row.tag_names || '').split('\u001f').filter(Boolean)
  const post = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || '',
    status: row.status,
    layout: row.layout || 'editorial',
    category: row.category_id ? { id: row.category_id, slug: row.category_slug || '', name: row.category_name || '' } : null,
    tags,
    authorName: row.author_name || 'Runway Systems',
    cover: row.cover_media_id ? {
      id: row.cover_media_id,
      path: row.cover_public_path || '',
      altText: row.cover_alt_text || '',
      caption: row.cover_caption || '',
      width: Number(row.cover_width || 0),
      height: Number(row.cover_height || 0),
    } : null,
    seoTitle: row.seo_title || '',
    seoDescription: row.seo_description || '',
    featured: Boolean(row.featured),
    scheduledAt: row.scheduled_at || '',
    firstPublishedAt: row.first_published_at || '',
    publishedAt: row.published_at || '',
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readingMinutes: blogReadingMinutes(row.body_markdown),
  }
  if (includeBody) post.bodyMarkdown = row.body_markdown || ''
  if (owner) post.deletedAt = row.deleted_at || ''
  return post
}

const BLOG_SELECT = `
  SELECT p.*, c.slug AS category_slug, c.name AS category_name,
         m.public_path AS cover_public_path, m.alt_text AS cover_alt_text,
         m.caption AS cover_caption, m.width AS cover_width, m.height AS cover_height,
         COALESCE(GROUP_CONCAT(t.name, char(31)), '') AS tag_names
  FROM blog_posts p
  LEFT JOIN blog_categories c ON c.id = p.category_id
  LEFT JOIN blog_media m ON m.id = p.cover_media_id AND m.status = 'ready'
  LEFT JOIN blog_post_tags pt ON pt.post_id = p.id
  LEFT JOIN blog_tags t ON t.id = pt.tag_id
`

async function blogPostById(env, id, { includeBody = true, includeDeleted = true } = {}) {
  const row = await env.DB.prepare(`${BLOG_SELECT} WHERE p.id = ? ${includeDeleted ? '' : 'AND p.deleted_at IS NULL'} GROUP BY p.id`).bind(id).first()
  if (!row) throw new HttpError(404, 'Article not found')
  return { row, post: blogRowToPost(row, { includeBody, owner: true }) }
}

async function blogCategoryExists(env, id) {
  if (!id) return true
  const row = await env.DB.prepare('SELECT id FROM blog_categories WHERE id = ? AND active = 1').bind(id).first()
  return Boolean(row)
}

async function blogMediaById(env, id, { ready = true } = {}) {
  if (!id) return null
  const row = await env.DB.prepare(`SELECT * FROM blog_media WHERE id = ? ${ready ? "AND status = 'ready' AND deleted_at IS NULL" : ''}`).bind(id).first()
  if (!row) throw new HttpError(400, 'Selected media is unavailable')
  return row
}

function inlineBlogMediaIds(markdown) {
  return [...new Set([...String(markdown || '').matchAll(/\/blog-media\/([a-f0-9-]{36})\/[a-f0-9]{8}\.(?:png|jpe?g|webp)/g)].map((match) => match[1]))]
}

async function validateBlogReferences(env, draft) {
  const markdownImages = [...String(draft.bodyMarkdown || '').matchAll(/!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+["'][^)]*["'])?\s*\)/g)].map((match) => ({ alt: match[1].trim(), path: match[2] }))
  if (markdownImages.some((image) => !/^\/blog-media\/[a-f0-9-]{36}\/[a-f0-9]{8}\.(?:png|jpe?g|webp)$/i.test(image.path))) {
    throw new HttpError(400, 'Article images must come from the Blog media library')
  }
  if (markdownImages.some((image) => !image.alt)) throw new HttpError(400, 'Every inline image needs descriptive alt text')
  if (!(await blogCategoryExists(env, draft.categoryId))) throw new HttpError(400, 'Choose an active category')
  if (draft.coverMediaId) {
    const cover = await blogMediaById(env, draft.coverMediaId)
    if (!String(cover.alt_text || '').trim()) throw new HttpError(400, 'Cover image alt text is required')
  }
  const inlineIds = inlineBlogMediaIds(draft.bodyMarkdown)
  for (const id of inlineIds) {
    const media = await blogMediaById(env, id)
    if (!String(media.alt_text || '').trim()) throw new HttpError(400, 'Every inline image needs alt text')
  }
  return inlineIds
}

function validatePublishableBlog(draft) {
  if (draft.title.length < 8) throw new HttpError(400, 'Published titles must be at least 8 characters')
  if (draft.excerpt.length < 40) throw new HttpError(400, 'Add an excerpt of at least 40 characters')
  if (draft.bodyMarkdown.length < 150) throw new HttpError(400, 'Add a complete article before publishing')
  if (!draft.categoryId) throw new HttpError(400, 'Choose a category before publishing')
}

async function replaceBlogTagsAndMedia(env, postId, draft, inlineIds, at) {
  const statements = [
    env.DB.prepare('DELETE FROM blog_post_tags WHERE post_id = ?').bind(postId),
    env.DB.prepare('DELETE FROM blog_post_media WHERE post_id = ?').bind(postId),
  ]
  for (const name of draft.tags) {
    const slug = normalizeBlogSlug(name)
    if (!slug) continue
    const id = `blog-tag-${(await sha256Hex(slug)).slice(0, 24)}`
    statements.push(env.DB.prepare('INSERT OR IGNORE INTO blog_tags (id, slug, name, created_at) VALUES (?, ?, ?, ?)').bind(id, slug, name, at))
    statements.push(env.DB.prepare('INSERT OR IGNORE INTO blog_post_tags (post_id, tag_id) VALUES (?, ?)').bind(postId, id))
  }
  if (draft.coverMediaId) statements.push(env.DB.prepare("INSERT INTO blog_post_media (post_id, media_id, role, created_at) VALUES (?, ?, 'cover', ?)").bind(postId, draft.coverMediaId, at))
  for (const mediaId of inlineIds) statements.push(env.DB.prepare("INSERT OR IGNORE INTO blog_post_media (post_id, media_id, role, created_at) VALUES (?, ?, 'inline', ?)").bind(postId, mediaId, at))
  await env.DB.batch(statements)
}

async function createBlogDraft(env, owner, input) {
  const draft = cleanBlogDraft(input)
  if (!(await blogCategoryExists(env, draft.categoryId))) throw new HttpError(400, 'Choose an active category')
  const duplicate = await env.DB.prepare('SELECT id FROM blog_posts WHERE slug = ? OR id IN (SELECT post_id FROM blog_slug_redirects WHERE old_slug = ?)').bind(draft.slug, draft.slug).first()
  if (duplicate) throw new HttpError(409, 'That article URL is already reserved')
  const inlineIds = await validateBlogReferences(env, draft)
  const id = crypto.randomUUID()
  const at = nowIso()
  await env.DB.prepare(`
    INSERT INTO blog_posts (id, slug, title, excerpt, body_markdown, status, layout, category_id, author_name,
      cover_media_id, seo_title, seo_description, featured, version, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?, NULLIF(?, ''), ?, NULLIF(?, ''), ?, ?, ?, 1, ?, ?, ?)
  `).bind(id, draft.slug, draft.title, draft.excerpt, draft.bodyMarkdown, draft.layout, draft.categoryId,
    draft.authorName, draft.coverMediaId, draft.seoTitle, draft.seoDescription, draft.featured ? 1 : 0,
    owner.id, at, at).run()
  await replaceBlogTagsAndMedia(env, id, draft, inlineIds, at)
  return (await blogPostById(env, id)).post
}

async function updateBlogDraft(env, id, input) {
  const { row } = await blogPostById(env, id)
  if (row.deleted_at) throw new HttpError(409, 'Restore this article before editing it')
  const expectedVersion = Number(input.version)
  if (!Number.isInteger(expectedVersion) || expectedVersion !== Number(row.version)) throw new HttpError(409, 'This article changed in another tab. Reload before saving.')
  const draft = cleanBlogDraft(input, row)
  if (row.first_published_at && draft.slug !== row.slug) throw new HttpError(409, 'Use Change URL to preserve a redirect for a published article')
  const duplicate = await env.DB.prepare('SELECT id FROM blog_posts WHERE slug = ? AND id != ?').bind(draft.slug, id).first()
  if (duplicate) throw new HttpError(409, 'That article URL is already in use')
  const inlineIds = await validateBlogReferences(env, draft)
  const at = nowIso()
  if (row.status === 'published') await createBlogRevision(env, row, 'published-update', row.created_by_user_id)
  const result = await env.DB.prepare(`
    UPDATE blog_posts SET slug = ?, title = ?, excerpt = ?, body_markdown = ?, layout = ?, category_id = NULLIF(?, ''),
      author_name = ?, cover_media_id = NULLIF(?, ''), seo_title = ?, seo_description = ?, featured = ?,
      version = version + 1, updated_at = ? WHERE id = ? AND version = ?
  `).bind(draft.slug, draft.title, draft.excerpt, draft.bodyMarkdown, draft.layout, draft.categoryId,
    draft.authorName, draft.coverMediaId, draft.seoTitle, draft.seoDescription, draft.featured ? 1 : 0,
    at, id, expectedVersion).run()
  if (!Number(result.meta?.changes || 0)) throw new HttpError(409, 'This article changed in another tab. Reload before saving.')
  await replaceBlogTagsAndMedia(env, id, draft, inlineIds, at)
  if (row.status === 'published') await enqueueBlogEvent(env, id, expectedVersion + 1, 'published-update')
  return (await blogPostById(env, id)).post
}

function blogSnapshot(row) {
  const keys = ['slug', 'title', 'excerpt', 'body_markdown', 'status', 'layout', 'category_id', 'author_name', 'cover_media_id',
    'seo_title', 'seo_description', 'featured', 'scheduled_at', 'first_published_at', 'published_at', 'tag_names', 'version']
  return Object.fromEntries(keys.map((key) => [key, row[key] ?? null]))
}

async function createBlogRevision(env, row, reason, ownerId) {
  await env.DB.prepare(`INSERT OR IGNORE INTO blog_post_revisions
    (id, post_id, version, reason, snapshot_json, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), row.id, Number(row.version), reason, JSON.stringify(blogSnapshot(row)), ownerId || 'system', nowIso()).run()
}

async function enqueueBlogEvent(env, postId, version, eventType) {
  const at = nowIso()
  const id = crypto.randomUUID()
  await env.DB.prepare(`INSERT INTO blog_publication_outbox
    (id, post_id, post_version, event_type, attempts, last_error, created_at, next_attempt_at)
    VALUES (?, ?, ?, ?, 0, '', ?, ?)`)
    .bind(id, postId || null, Number(version || 0), eventType, at, at).run()
  try {
    await invalidatePublicCaches()
    await env.DB.prepare('UPDATE blog_publication_outbox SET processed_at = ?, attempts = 1 WHERE id = ?').bind(nowIso(), id).run()
  } catch {
    // The durable outbox keeps the event pending for the scheduled retry.
  }
}

async function transitionBlogPost(env, id, action, input, owner) {
  const { row } = await blogPostById(env, id)
  const expectedVersion = Number(input.version)
  if (!Number.isInteger(expectedVersion) || expectedVersion !== Number(row.version)) throw new HttpError(409, 'This article changed. Reload before continuing.')
  const at = nowIso()
  await createBlogRevision(env, row, action, owner?.id || 'system')
  let sql = ''
  let bindings = []
  if (action === 'publish') {
    const draft = cleanBlogDraft({
      ...blogRowToPost(row, { includeBody: true, owner: true }),
      bodyMarkdown: row.body_markdown,
      categoryId: row.category_id || '', coverMediaId: row.cover_media_id || '',
      tags: String(row.tag_names || '').split('\u001f').filter(Boolean),
    }, row)
    validatePublishableBlog(draft)
    await validateBlogReferences(env, draft)
    sql = "status = 'published', published_at = ?, first_published_at = COALESCE(first_published_at, ?), scheduled_at = NULL, deleted_at = NULL"
    bindings = [at, at]
  } else if (action === 'schedule') {
    const due = Date.parse(String(input.scheduledAt || ''))
    if (!Number.isFinite(due) || due <= Date.now()) throw new HttpError(400, 'Choose a future publication time')
    const draft = cleanBlogDraft({
      ...blogRowToPost(row, { includeBody: true, owner: true }), bodyMarkdown: row.body_markdown,
      categoryId: row.category_id || '', coverMediaId: row.cover_media_id || '',
      tags: String(row.tag_names || '').split('\u001f').filter(Boolean),
    }, row)
    validatePublishableBlog(draft)
    await validateBlogReferences(env, draft)
    sql = "status = 'scheduled', scheduled_at = ?, deleted_at = NULL"
    bindings = [new Date(due).toISOString()]
  } else if (action === 'unpublish' || action === 'cancel-schedule') {
    sql = "status = 'draft', scheduled_at = NULL"
  } else if (action === 'archive') {
    sql = "status = 'archived', scheduled_at = NULL"
  } else if (action === 'restore') {
    sql = "status = 'draft', scheduled_at = NULL, deleted_at = NULL"
  } else if (action === 'trash') {
    sql = "status = 'archived', scheduled_at = NULL, deleted_at = ?"
    bindings = [at]
  } else {
    throw new HttpError(400, 'Unsupported article action')
  }
  const result = await env.DB.prepare(`UPDATE blog_posts SET ${sql}, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`)
    .bind(...bindings, at, id, expectedVersion).run()
  if (!Number(result.meta?.changes || 0)) throw new HttpError(409, 'This article changed. Reload before continuing.')
  await enqueueBlogEvent(env, id, expectedVersion + 1, action)
  return (await blogPostById(env, id)).post
}

async function changeBlogSlug(env, id, input, owner) {
  const { row } = await blogPostById(env, id)
  const expectedVersion = Number(input.version)
  if (expectedVersion !== Number(row.version)) throw new HttpError(409, 'This article changed. Reload before continuing.')
  const slug = normalizeBlogSlug(input.slug)
  if (!slug || !BLOG_SLUG_PATTERN.test(slug) || slug.length > 110) throw new HttpError(400, 'Use a valid article URL')
  if (slug === row.slug) return blogRowToPost(row, { includeBody: true, owner: true })
  const collision = await env.DB.prepare('SELECT id FROM blog_posts WHERE slug = ? UNION SELECT post_id AS id FROM blog_slug_redirects WHERE old_slug = ?').bind(slug, slug).first()
  if (collision) throw new HttpError(409, 'That article URL is already reserved')
  const at = nowIso()
  await createBlogRevision(env, row, 'change-slug', owner.id)
  const results = await env.DB.batch([
    env.DB.prepare('INSERT OR REPLACE INTO blog_slug_redirects (old_slug, post_id, created_by_user_id, reason, created_at) VALUES (?, ?, ?, ?, ?)').bind(row.slug, id, owner.id, cleanText(input.reason || '', 180, 'Reason', { required: false }), at),
    env.DB.prepare('UPDATE blog_posts SET slug = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?').bind(slug, at, id, expectedVersion),
  ])
  if (!Number(results[1]?.meta?.changes || 0)) {
    await env.DB.prepare('DELETE FROM blog_slug_redirects WHERE old_slug = ? AND post_id = ? AND created_at = ?').bind(row.slug, id, at).run()
    throw new HttpError(409, 'This article changed. Reload before continuing.')
  }
  await enqueueBlogEvent(env, id, expectedVersion + 1, 'change-slug')
  return (await blogPostById(env, id)).post
}

async function restoreBlogRevision(env, id, revisionId, input, owner) {
  const { row } = await blogPostById(env, id)
  if (Number(input.version) !== Number(row.version)) throw new HttpError(409, 'This article changed. Reload before restoring.')
  const revision = await env.DB.prepare('SELECT * FROM blog_post_revisions WHERE id = ? AND post_id = ?').bind(revisionId, id).first()
  if (!revision) throw new HttpError(404, 'Revision not found')
  const snapshot = parseJsonSafe(revision.snapshot_json, null)
  if (!snapshot) throw new HttpError(500, 'Revision data is unavailable')
  const restoredDraft = cleanBlogDraft({
    title: snapshot.title, slug: row.slug, excerpt: snapshot.excerpt, bodyMarkdown: snapshot.body_markdown,
    layout: snapshot.layout, categoryId: snapshot.category_id || '', authorName: snapshot.author_name,
    coverMediaId: snapshot.cover_media_id || '', seoTitle: snapshot.seo_title, seoDescription: snapshot.seo_description,
    featured: Boolean(snapshot.featured), tags: String(snapshot.tag_names ?? row.tag_names ?? '').split('\u001f').filter(Boolean),
  }, row)
  const inlineIds = await validateBlogReferences(env, restoredDraft)
  await createBlogRevision(env, row, 'before-restore', owner.id)
  const at = nowIso()
  const result = await env.DB.prepare(`UPDATE blog_posts SET title = ?, excerpt = ?, body_markdown = ?, layout = ?, category_id = NULLIF(?, ''),
    author_name = ?, cover_media_id = NULLIF(?, ''), seo_title = ?, seo_description = ?, featured = ?, version = version + 1,
    updated_at = ? WHERE id = ? AND version = ?`).bind(restoredDraft.title, restoredDraft.excerpt, restoredDraft.bodyMarkdown,
    restoredDraft.layout, restoredDraft.categoryId, restoredDraft.authorName, restoredDraft.coverMediaId,
    restoredDraft.seoTitle, restoredDraft.seoDescription, restoredDraft.featured ? 1 : 0, at, id, Number(row.version)).run()
  if (!Number(result.meta?.changes || 0)) throw new HttpError(409, 'This article changed. Reload before restoring.')
  await replaceBlogTagsAndMedia(env, id, restoredDraft, inlineIds, at)
  await enqueueBlogEvent(env, id, Number(row.version) + 1, 'revision-restore')
  return (await blogPostById(env, id)).post
}

async function listPublicBlogPosts(env, { limit = 12, cursor = '', category = '', tag = '', search = '' } = {}) {
  const safeLimit = Math.min(24, Math.max(1, Number(limit) || 12))
  const params = [nowIso()]
  let extra = ''
  if (cursor) {
    const parsed = /^([01])\|(.+)$/.exec(cursor)
    if (parsed) {
      const cursorFeatured = Number(parsed[1]); const cursorPublishedAt = parsed[2]
      extra += ' AND (p.featured < ? OR (p.featured = ? AND p.published_at < ?))'
      params.push(cursorFeatured, cursorFeatured, cursorPublishedAt)
    } else { extra += ' AND p.published_at < ?'; params.push(cursor) }
  }
  if (category) { extra += ' AND c.slug = ?'; params.push(category) }
  if (tag) { extra += ' AND EXISTS (SELECT 1 FROM blog_post_tags xpt JOIN blog_tags xt ON xt.id = xpt.tag_id WHERE xpt.post_id = p.id AND xt.slug = ?)'; params.push(tag) }
  if (search) { extra += ' AND (LOWER(p.title) LIKE ? OR LOWER(p.excerpt) LIKE ?)'; const q = `%${search.toLowerCase()}%`; params.push(q, q) }
  params.push(safeLimit + 1)
  const rows = await env.DB.prepare(`${BLOG_SELECT} WHERE ${BLOG_PUBLIC_WHERE} ${extra} GROUP BY p.id ORDER BY p.featured DESC, p.published_at DESC LIMIT ?`).bind(...params).all()
  const all = rows.results || []
  const hasMore = all.length > safeLimit
  const page = all.slice(0, safeLimit)
  return { posts: page.map((row) => blogRowToPost(row)), hasMore, nextCursor: hasMore && page.length ? `${Number(page.at(-1).featured || 0)}|${page.at(-1).published_at}` : '' }
}

async function getPublicBlogPost(env, slug) {
  if (!BLOG_SLUG_PATTERN.test(slug)) throw new HttpError(404, 'Article not found')
  const row = await env.DB.prepare(`${BLOG_SELECT} WHERE p.slug = ? AND ${BLOG_PUBLIC_WHERE} GROUP BY p.id`).bind(slug, nowIso()).first()
  if (!row) {
    const redirect = await env.DB.prepare(`SELECT p.slug FROM blog_slug_redirects r JOIN blog_posts p ON p.id = r.post_id
      WHERE r.old_slug = ? AND p.status = 'published' AND p.published_at <= ? AND p.deleted_at IS NULL`).bind(slug, nowIso()).first()
    if (redirect) return { redirectTo: `/blog/${redirect.slug}` }
    throw new HttpError(404, 'Article not found')
  }
  const relatedRows = await env.DB.prepare(`${BLOG_SELECT} WHERE ${BLOG_PUBLIC_WHERE} AND p.id != ?
    GROUP BY p.id ORDER BY CASE WHEN p.category_id = ? THEN 0 ELSE 1 END, p.published_at DESC LIMIT 3`)
    .bind(nowIso(), row.id, row.category_id || '').all()
  return { post: blogRowToPost(row, { includeBody: true }), relatedPosts: (relatedRows.results || []).map((item) => blogRowToPost(item)) }
}

async function listBlogCategories(env, { owner = false } = {}) {
  const rows = await env.DB.prepare(`SELECT c.*, COUNT(p.id) AS published_count FROM blog_categories c
    LEFT JOIN blog_posts p ON p.category_id = c.id AND p.status = 'published' AND p.published_at <= ? AND p.deleted_at IS NULL
    ${owner ? '' : 'WHERE c.active = 1'} GROUP BY c.id ORDER BY c.sort_order, c.name`).bind(nowIso()).all()
  return (rows.results || []).map((row) => ({ id: row.id, slug: row.slug, name: row.name, description: row.description || '', active: Boolean(row.active), publishedCount: Number(row.published_count || 0) }))
}

async function listAdminBlogPosts(env, { status = '', search = '', trashed = false } = {}) {
  const params = []
  let where = trashed ? 'WHERE p.deleted_at IS NOT NULL' : 'WHERE p.deleted_at IS NULL'
  if (status) { where += ' AND p.status = ?'; params.push(status) }
  if (search) { where += ' AND (LOWER(p.title) LIKE ? OR LOWER(p.slug) LIKE ?)'; const q = `%${search.toLowerCase()}%`; params.push(q, q) }
  const rows = await env.DB.prepare(`${BLOG_SELECT} ${where} GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 200`).bind(...params).all()
  return (rows.results || []).map((row) => blogRowToPost(row, { owner: true }))
}

function blogMediaDimensions(bytes, type) {
  if (type === 'image/png' && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (type === 'image/jpeg') {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue }
      const marker = bytes[offset + 1]
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3]
      if (marker >= 0xc0 && marker <= 0xc3) return { height: (bytes[offset + 5] << 8) + bytes[offset + 6], width: (bytes[offset + 7] << 8) + bytes[offset + 8] }
      if (length < 2) break
      offset += length + 2
    }
  }
  if (type === 'image/webp' && bytes.length >= 30) {
    const kind = String.fromCharCode(...bytes.slice(12, 16))
    if (kind === 'VP8X') return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) }
    if (kind === 'VP8 ' && bytes.length >= 30) return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff }
    if (kind === 'VP8L' && bytes.length >= 25) {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
  }
  throw new HttpError(400, 'Image dimensions could not be verified')
}

function blogMediaFromRow(row) {
  return {
    id: row.id, path: row.public_path, mimeType: row.mime_type, byteSize: Number(row.byte_size),
    width: Number(row.width), height: Number(row.height), altText: row.alt_text || '', caption: row.caption || '',
    originalName: row.original_name || '', status: row.status, usageCount: Number(row.usage_count || 0),
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

async function uploadBlogMedia(env, owner, input) {
  if (!env.MEDIA) throw new HttpError(503, 'Media storage is not configured')
  const image = cleanText(input.image, 7000000, 'Image')
  const { bytes, contentType } = decodeUploadedImage(image)
  const { width, height } = blogMediaDimensions(bytes, contentType)
  if (width > 6000 || height > 6000 || width * height > 30000000) throw new HttpError(400, 'Image dimensions are too large')
  const hash = await sha256Hex(bytes)
  const duplicate = await env.DB.prepare("SELECT *, 0 AS usage_count FROM blog_media WHERE sha256 = ? AND status = 'ready' AND deleted_at IS NULL").bind(hash).first()
  if (duplicate) return { media: blogMediaFromRow(duplicate), duplicate: true }
  const id = crypto.randomUUID()
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/jpeg' ? 'jpg' : 'webp'
  const key = `blog-media/${id}/${hash.slice(0, 8)}.${ext}`
  const path = `/blog-media/${id}/${hash.slice(0, 8)}.${ext}`
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } })
  const at = nowIso()
  await env.DB.prepare(`INSERT INTO blog_media (id, r2_key, public_path, mime_type, byte_size, width, height, sha256,
    alt_text, caption, original_name, status, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`)
    .bind(id, key, path, contentType, bytes.byteLength, width, height, hash,
      cleanText(input.altText || '', 220, 'Alt text', { required: false }), cleanText(input.caption || '', 320, 'Caption', { required: false }),
      cleanText(input.originalName || '', 180, 'Filename', { required: false }), owner.id, at, at).run()
  const row = await env.DB.prepare('SELECT *, 0 AS usage_count FROM blog_media WHERE id = ?').bind(id).first()
  return { media: blogMediaFromRow(row), duplicate: false }
}

async function listBlogMedia(env) {
  const result = await env.DB.prepare(`SELECT m.*, COUNT(pm.post_id) AS usage_count FROM blog_media m
    LEFT JOIN blog_post_media pm ON pm.media_id = m.id WHERE m.status != 'trashed'
    GROUP BY m.id ORDER BY m.created_at DESC LIMIT 250`).all()
  return (result.results || []).map(blogMediaFromRow)
}

async function updateBlogMedia(env, id, input) {
  const row = await env.DB.prepare("SELECT * FROM blog_media WHERE id = ? AND status != 'trashed'").bind(id).first()
  if (!row) throw new HttpError(404, 'Media not found')
  const at = nowIso()
  await env.DB.prepare('UPDATE blog_media SET alt_text = ?, caption = ?, updated_at = ? WHERE id = ?')
    .bind(cleanText(input.altText || '', 220, 'Alt text', { required: false }), cleanText(input.caption || '', 320, 'Caption', { required: false }), at, id).run()
  return blogMediaFromRow({ ...row, alt_text: input.altText || '', caption: input.caption || '', updated_at: at, usage_count: 0 })
}

async function trashBlogMedia(env, id) {
  const usage = await env.DB.prepare('SELECT COUNT(*) AS total FROM blog_post_media WHERE media_id = ?').bind(id).first()
  if (Number(usage?.total || 0)) throw new HttpError(409, 'This image is used by an article')
  const at = nowIso()
  const result = await env.DB.prepare("UPDATE blog_media SET status = 'trashed', deleted_at = ?, updated_at = ? WHERE id = ? AND status != 'trashed'").bind(at, at, id).run()
  if (!Number(result.meta?.changes || 0)) throw new HttpError(404, 'Media not found')
  return { removed: true, id }
}

function importHtmlAsMarkdown(value) {
  return String(value || '')
    .replace(/<(script|style|iframe|form|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n').replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n').replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n').trim()
}

function sanitizeImportedMarkdown(value) {
  return String(value || '')
    .replace(/<(script|style|iframe|form|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+["'][^)]*["'])?\s*\)/g, (full, alt, path) => (
      /^\/blog-media\/[a-f0-9-]{36}\/[a-f0-9]{8}\.(?:png|jpe?g|webp)$/i.test(path) ? full : `> Image omitted during safe import: ${String(alt || 'remote image').trim()}`
    ))
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n').trim()
}

async function importBlogDraft(env, owner, input) {
  const format = ['markdown', 'text', 'html'].includes(input.format) ? input.format : 'text'
  const source = cleanText(input.content, 120000, 'Imported content')
  const bodyMarkdown = sanitizeImportedMarkdown(format === 'html' ? importHtmlAsMarkdown(source) : source)
  const title = cleanText(input.title || bodyMarkdown.match(/^#\s+(.+)$/m)?.[1] || 'Imported article', 140, 'Title')
  return createBlogDraft(env, owner, { title, slug: input.slug || title, bodyMarkdown: bodyMarkdown.replace(/^#\s+.+$/m, '').trim(), layout: input.layout || 'editorial' })
}

async function processScheduledBlogPosts(env) {
  if (!env.DB) return 0
  const due = await env.DB.prepare("SELECT * FROM blog_posts WHERE status = 'scheduled' AND scheduled_at <= ? AND deleted_at IS NULL LIMIT 50").bind(nowIso()).all()
  let published = 0
  for (const row of due.results || []) {
    try {
      await createBlogRevision(env, row, 'scheduled-publish', 'system')
      const at = nowIso()
      const result = await env.DB.prepare(`UPDATE blog_posts SET status = 'published', published_at = ?,
        first_published_at = COALESCE(first_published_at, ?), scheduled_at = NULL, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND status = 'scheduled'`).bind(at, at, at, row.id, row.version).run()
      if (Number(result.meta?.changes || 0)) { published += 1; await enqueueBlogEvent(env, row.id, Number(row.version) + 1, 'scheduled-publish') }
    } catch (error) {
      logEvent('warn', 'blog_schedule_publish_failed', { postId: row.id, error: error?.message })
    }
  }
  return published
}

async function processBlogOutbox(env) {
  const events = await env.DB.prepare(`SELECT * FROM blog_publication_outbox WHERE processed_at IS NULL AND next_attempt_at <= ? ORDER BY created_at LIMIT 50`).bind(nowIso()).all()
  if (!(events.results || []).length) return 0
  try {
    await invalidatePublicCaches()
    const at = nowIso()
    await env.DB.batch(events.results.map((event) => env.DB.prepare('UPDATE blog_publication_outbox SET processed_at = ?, attempts = attempts + 1 WHERE id = ?').bind(at, event.id)))
    return events.results.length
  } catch (error) {
    const next = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    await env.DB.batch(events.results.map((event) => env.DB.prepare('UPDATE blog_publication_outbox SET attempts = attempts + 1, last_error = ?, next_attempt_at = ? WHERE id = ?').bind(String(error?.message || 'cache invalidation failed').slice(0, 300), next, event.id)))
    return 0
  }
}

async function cleanupBlogTrash(env) {
  const cutoff = new Date(Date.now() - BLOG_TRASH_RETENTION_DAYS * 86400000).toISOString()
  const posts = await env.DB.prepare('SELECT id FROM blog_posts WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT 50').bind(cutoff).all()
  if ((posts.results || []).length) {
    await env.DB.batch(posts.results.map((post) => env.DB.prepare('DELETE FROM blog_posts WHERE id = ? AND deleted_at < ?').bind(post.id, cutoff)))
    await enqueueBlogEvent(env, null, 0, 'trash-retention-cleanup')
  }
  const media = await env.DB.prepare("SELECT * FROM blog_media WHERE status = 'trashed' AND deleted_at < ? LIMIT 50").bind(cutoff).all()
  for (const row of media.results || []) {
    if (env.MEDIA) await env.MEDIA.delete(row.r2_key).catch(() => {})
    await env.DB.prepare('DELETE FROM blog_media WHERE id = ?').bind(row.id).run().catch(() => {})
  }
}

async function blogSitemapRows(env) {
  const result = await env.DB.prepare("SELECT slug, updated_at FROM blog_posts WHERE status = 'published' AND published_at <= ? AND deleted_at IS NULL ORDER BY published_at DESC LIMIT 49000").bind(nowIso()).all()
  return result.results || []
}

async function blogRssXml(env) {
  const origin = getPrimaryOrigin(env)
  const rows = await env.DB.prepare(`${BLOG_SELECT} WHERE ${BLOG_PUBLIC_WHERE} GROUP BY p.id ORDER BY p.published_at DESC LIMIT 50`).bind(nowIso()).all()
  const xml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  const items = (rows.results || []).map((row) => `<item><title>${xml(row.title)}</title><link>${xml(`${origin}/blog/${row.slug}`)}</link><guid isPermaLink="true">${xml(`${origin}/blog/${row.slug}`)}</guid><description>${xml(row.excerpt)}</description><pubDate>${new Date(row.published_at).toUTCString()}</pubDate>${row.category_name ? `<category>${xml(row.category_name)}</category>` : ''}</item>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Runway Systems Blog</title><link>${origin}/blog</link><description>Practical systems for calmer independent businesses.</description><language>en</language><atom:link href="${origin}/blog/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`
}

async function blogLlmsText(env, { full = false } = {}) {
  const origin = getPrimaryOrigin(env)
  const limit = full ? 1000 : 20
  const rows = await env.DB.prepare("SELECT slug, title, excerpt FROM blog_posts WHERE status = 'published' AND published_at <= ? AND deleted_at IS NULL ORDER BY featured DESC, published_at DESC LIMIT ?").bind(nowIso(), limit).all()
  return [`# Runway Systems Blog`, '', '> Practical guidance on finance, clients, projects, invoicing, and calmer business operations.', '', `- Blog: ${origin}/blog`, `- RSS: ${origin}/blog/feed.xml`, `- Sitemap: ${origin}/sitemap.xml`, '', '## Published articles', '', ...(rows.results || []).flatMap((row) => [`- [${row.title}](${origin}/blog/${row.slug}) — ${row.excerpt}`, ''])].join('\n')
}

// Public reads (config, sitemap, testimonials) hit D1 on every request and
// are cacheable. Caching them server-side prevents quota-exhaustion floods,
// and every admin write invalidates them so saved changes stay visible
// immediately.
const PUBLIC_CACHE_ORIGIN = 'https://runway-cache.local'

async function getCachedPublic(key, maxAgeSeconds, producer) {
  const cache = caches.default
  const cacheKey = `${PUBLIC_CACHE_ORIGIN}/${key}`
  try {
    const cached = await cache.match(cacheKey)
    if (cached) {
      const text = await cached.text()
      if (text) return text
    }
  } catch {
    // Cache unavailable: fall through to the producer.
  }
  const text = await producer()
  try {
    await cache.put(cacheKey, new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${maxAgeSeconds}` } }))
  } catch {
    // Caching is best-effort.
  }
  return text
}

async function invalidatePublicCaches() {
  const cache = caches.default
  await Promise.all(['config-public', 'sitemap', 'testimonials', 'blog-index', 'blog-rss', 'blog-llms', 'blog-llms-full'].map((key) => cache.delete(`${PUBLIC_CACHE_ORIGIN}/${key}`).catch(() => {})))
}

async function rateLimit(request, env, bucket, limit, windowSeconds, subject = '') {
  if (!env.DB) throw new HttpError(503, 'Database is not configured')
  const address = request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!env.RATE_LIMIT_SALT) throw new HttpError(503, 'Rate limiting is not configured')
  // Hash both IP- and identity-based subjects so emails and Supabase user IDs
  // never appear in D1 rate-limit keys.
  const identity = subject ? `subject:${subject}` : `ip:${address}`
  const safeSubject = await sha256Hex(`${env.RATE_LIMIT_SALT}:${identity}`)
  const windowId = Math.floor(Date.now() / (windowSeconds * 1000))
  const key = `${bucket}:${safeSubject}:${windowId}`
  const expiresAt = new Date((windowId + 1) * windowSeconds * 1000).toISOString()
  await env.DB.prepare(`
    INSERT INTO rate_limits (key, count, expires_at)
    VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1
  `).bind(key, expiresAt).run()
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key = ?').bind(key).first()
  if (Number(row?.count || 0) > limit) throw new HttpError(429, 'Too many requests. Please try again later.')
}

function bearerToken(request) {
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required')
  return authorization.slice(7).trim()
}

async function authenticate(request, env) {
  // Auth-gate rate limit: every token validation counts against the
  // caller's IP, capping brute-force attempts against Supabase token
  // checking. Sign-in, OTP, and password reset themselves are handled by
  // Supabase; configure Supabase rate limits to cover those directly.
  await rateLimit(request, env, 'auth-gate', 300, 600)
  const token = bearerToken(request)
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new HttpError(503, 'Authentication is not configured')
  // 5s hard timeout on the Supabase round-trip. A slow auth provider must
  // not be able to tie up a Worker request indefinitely; the request
  // budget is 30s and a slow auth here is the single biggest cause of
  // 30s-shaped tail latency.
  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new HttpError(401, 'Your session is invalid or expired')
  const user = await response.json()
  if (!user?.id || !user?.email) throw new HttpError(401, 'A verified account email is required')
  return user
}

function userIsOwner(user, env) {
  const ownerEmail = String(env.OWNER_EMAIL || '').trim().toLowerCase()
  return user?.app_metadata?.role === 'owner'
    || Boolean(ownerEmail && String(user?.email || '').toLowerCase() === ownerEmail)
}

// Admin endpoint gate. Tiers:
//   - GET requests: just the owner JWT.
//   - Mutating requests (POST/PATCH/PUT/DELETE): owner JWT issued within
//     the last 30 minutes, AND a valid TOTP code in X-Admin-TOTP, OR a
//     valid recovery code in X-Admin-Recovery. The recency floor closes
//     the window where a stolen long-lived JWT is enough on its own; the
//     TOTP gate then makes a single factor (a leaked JWT) insufficient.
const ADMIN_MUTATION_JWT_MAX_AGE_SECONDS = 30 * 60

// Read the issued-at time straight from the JWT payload. Supabase verified
// the token signature during authenticate(), so decoding claims here adds
// no new trust; it only recovers a field the /auth/v1/user resource is not
// guaranteed to echo back. Without this fallback a provider that omits
// `iat` from the user resource would make every admin mutation look
// infinitely stale and 401 forever.
function jwtIssuedAt(request) {
  try {
    const token = bearerToken(request)
    const [, payload] = token.split('.')
    if (!payload) return 0
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const claims = JSON.parse(atob(padded))
    return Number(claims?.iat || 0)
  } catch {
    return 0
  }
}

const ADMIN_CHALLENGE_TTL_SECONDS = 5 * 60

async function createAdminChallenge(env, request, user) {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_CHALLENGE_TTL_SECONDS
  const payload = stringToBase64Url(JSON.stringify({
    v: 1,
    purpose: 'admin-challenge',
    userId: user.id,
    sessionIssuedAt: jwtIssuedAt(request),
    expiresAt,
    nonce: crypto.randomUUID(),
  }))
  return {
    challenge: `${payload}.${await feedbackSignature(env, payload)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  }
}

async function verifyAdminChallenge(env, request, user, token) {
  try {
    const [payload, suppliedSignature, extra] = String(token || '').split('.')
    if (!payload || !suppliedSignature || extra) return false
    const expectedSignature = await feedbackSignature(env, payload)
    if (!constantTimeEqual(suppliedSignature, expectedSignature)) return false
    const decoded = JSON.parse(base64UrlToString(payload))
    return decoded.v === 1
      && decoded.purpose === 'admin-challenge'
      && decoded.userId === user.id
      && decoded.sessionIssuedAt === jwtIssuedAt(request)
      && Number.isInteger(decoded.expiresAt)
      && decoded.expiresAt >= Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

async function requireOwner(request, env, { mutation = false } = {}) {
  const user = await authenticate(request, env)
  if (!userIsOwner(user, env)) throw new HttpError(403, 'Owner access required')
  if (!mutation) return user

  // Recency check. The `iat` claim is seconds since epoch. We allow up to
  // 5s clock skew so a near-fresh token is not rejected.
  const iat = Number(user?.iat || 0) || jwtIssuedAt(request)
  const ageSeconds = iat ? Math.floor(Date.now() / 1000) - iat : Number.POSITIVE_INFINITY
  if (!iat || ageSeconds > ADMIN_MUTATION_JWT_MAX_AGE_SECONDS + 5) {
    logEvent('warn', 'admin_mutation_stale_jwt', { subjectId: user.id, ageSeconds })
    throw new HttpError(401, 'Re-authenticate to make changes (admin session older than 30 minutes).')
  }

  const path = new URL(request.url).pathname
  const row = await env.DB.prepare('SELECT secret, verified_at FROM admin_totp WHERE id = 1').first().catch(() => null)

  // Bootstrap is deliberately narrow: until 2FA is verified, the owner may
  // only start/restart and confirm enrolment. A stolen owner JWT cannot use
  // the absence of a TOTP row to mutate the rest of the store.
  if (!row || !row.verified_at) {
    if (path === '/admin/totp/enrol' || path === '/admin/totp/verify') return user
    throw new HttpError(428, 'Complete two-factor authentication enrolment before making admin changes.')
  }

  // A current TOTP or one-time recovery code is exchanged at the challenge
  // endpoint for this signed five-minute token. Raw time-based codes are not
  // cached or replayed by the browser.
  if (path === '/admin/totp/challenge') return user
  const challenge = String(request.headers.get('X-Admin-Challenge') || '').trim()
  if (challenge && await verifyAdminChallenge(env, request, user, challenge)) return user

  // Keep direct one-action headers for non-browser recovery tooling. The UI
  // uses challenges, but these are useful during incident recovery.
  const totpCandidate = String(request.headers.get('X-Admin-TOTP') || '').trim()
  const recoveryCandidate = String(request.headers.get('X-Admin-Recovery') || '').trim()
  let ok = false
  if (totpCandidate && await verifyTotp(await readTotpSecret(env, row.secret), totpCandidate)) ok = true
  if (!ok && recoveryCandidate && await consumeRecoveryCode(env, recoveryCandidate)) ok = true
  if (!ok) {
    logEvent('warn', 'admin_mutation_totp_failed', { subjectId: user.id })
    throw new HttpError(401, 'A fresh admin security challenge is required.')
  }
  await env.DB.prepare('UPDATE admin_totp SET last_used_at = ? WHERE id = 1').bind(nowIso()).run()
  return user
}

async function getSettings(env) {
  const defaults = {
    offerActive: true,
    offerLabel: 'Launch Offer',
    displayOriginalPrice: '$69',
    displaySalePrice: '$39',
    emailTemplateText: "How's CASHFLOW OS working for you?",
    trustpilotBusinessUrl: env.TRUSTPILOT_REVIEW_URL || 'https://www.trustpilot.com/',
    suiteContent: {},
    policies: {},
    supportEmail: env.SUPPORT_EMAIL || '',
    trustpilotBusinessUnitId: '',
    announcement: { active: false, message: '', linkText: '', linkUrl: '', dismissible: true },
    defaultOffer: { offerActive: true, offerLabel: 'Launch Offer', displayOriginalPrice: '', displaySalePrice: '' },
    paymentProvider: 'lemonsqueezy',
    lemonSqueezyStoreId: env.LEMONSQUEEZY_STORE_ID || '',
    lemonSqueezyBundleVariantId: env.LEMONSQUEEZY_BUNDLE_VARIANT_ID || '',
  }
  const result = await env.DB.prepare('SELECT key, value FROM settings').all()
  for (const row of result.results || []) {
    if (!(row.key in defaults)) continue
    try {
      defaults[row.key] = JSON.parse(row.value)
    } catch {
      defaults[row.key] = row.value
    }
  }
  return defaults
}

async function saveSettings(env, input) {
  const settings = {
    offerActive: Boolean(input.offerActive),
    offerLabel: cleanText(input.offerLabel, 80, 'Offer label'),
    displayOriginalPrice: cleanText(input.displayOriginalPrice, 32, 'Displayed original price'),
    displaySalePrice: cleanText(input.displaySalePrice, 32, 'Displayed sale price'),
    emailTemplateText: cleanText(input.emailTemplateText, 500, 'Email prompt'),
    trustpilotBusinessUrl: validHttpUrl(input.trustpilotBusinessUrl, 'Trustpilot URL'),
  }
  // Optional storefront content settings; only stored when provided so a
  // plain settings save never wipes content.
  if (Object.prototype.hasOwnProperty.call(input, 'suiteContent')) settings.suiteContent = cleanContentJson(input.suiteContent, 'Suite content')
  if (Object.prototype.hasOwnProperty.call(input, 'policies')) settings.policies = cleanContentJson(input.policies, 'Policy content')
  if (Object.prototype.hasOwnProperty.call(input, 'supportEmail')) settings.supportEmail = cleanText(input.supportEmail, 120, 'Support email', { required: false })
  if (Object.prototype.hasOwnProperty.call(input, 'trustpilotBusinessUnitId')) settings.trustpilotBusinessUnitId = cleanText(input.trustpilotBusinessUnitId, 80, 'Trustpilot business unit ID', { required: false })
  if (Object.prototype.hasOwnProperty.call(input, 'announcement')) settings.announcement = cleanAnnouncement(input.announcement)
  if (Object.prototype.hasOwnProperty.call(input, 'defaultOffer')) settings.defaultOffer = cleanDefaultOffer(input.defaultOffer)
  if (Object.prototype.hasOwnProperty.call(input, 'lemonSqueezyStoreId')) {
    const storeId = cleanText(input.lemonSqueezyStoreId, 30, 'Lemon Squeezy store ID', { required: false })
    if (storeId && !/^\d{1,30}$/.test(storeId)) throw new HttpError(400, 'Lemon Squeezy store ID must be a number')
    settings.lemonSqueezyStoreId = storeId
  }
  if (Object.prototype.hasOwnProperty.call(input, 'lemonSqueezyBundleVariantId')) {
    const bundleVariantId = cleanText(input.lemonSqueezyBundleVariantId, 20, 'Lemon Squeezy bundle variant ID', { required: false })
    if (bundleVariantId && !/^\d{1,20}$/.test(bundleVariantId)) throw new HttpError(400, 'Lemon Squeezy bundle variant ID must be a number')
    settings.lemonSqueezyBundleVariantId = bundleVariantId
  }
  const updatedAt = nowIso()
  await env.DB.batch(Object.entries(settings).map(([key, value]) => env.DB.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(key, JSON.stringify(value), updatedAt)))
  await invalidatePublicCaches()
  return settings
}

const LEMON_SQUEEZY_API = 'https://api.lemonsqueezy.com/v1'

function lemonSqueezyApiBase(env) {
  const raw = String(env.LEMONSQUEEZY_API_URL || LEMON_SQUEEZY_API).replace(/\/$/, '')
  let parsed
  try { parsed = new URL(raw) } catch { throw new HttpError(503, 'Lemon Squeezy API URL is invalid') }
  const localDev = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !(localDev && parsed.protocol === 'http:')) {
    throw new HttpError(503, 'Lemon Squeezy API URL must use HTTPS')
  }
  return parsed.toString().replace(/\/$/, '')
}

async function lemonSqueezyRequest(env, path, { method = 'GET', body } = {}) {
  if (!env.LEMONSQUEEZY_API_KEY) throw new HttpError(503, 'Lemon Squeezy API key is not configured')
  let response
  try {
    response = await fetch(`${lemonSqueezyApiBase(env)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
        Accept: 'application/vnd.api+json',
        ...(body ? { 'Content-Type': 'application/vnd.api+json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw new HttpError(503, 'Lemon Squeezy could not be reached. Please try again.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    logEvent('warn', 'lemon_squeezy_request_failed', { path, status: response.status })
    throw new HttpError(response.status >= 500 ? 502 : 400, 'The payment service could not complete the request')
  }
  return payload
}

function priceInCents(value) {
  const raw = String(value || '').trim()
  const match = raw.replace(/,/g, '').match(/^[^\d]*(-?\d+)(?:\.(\d{1,2}))?/)
  if (!match) return null
  const whole = Number(match[1])
  const fraction = (match[2] || '').padEnd(2, '0') || '00'
  const cents = whole * 100 + Number(fraction.slice(0, 2))
  if (!Number.isFinite(cents) || cents < 0) return null
  return cents
}

// Lemon Squeezy checkouts carry a single line item, so a multi-product cart
// becomes ONE custom-priced checkout: the bundle total is the sum of the
// suite's D1 sale prices (never client input), the item list is shown in
// the checkout description, and the paid webhook grants every product key.
async function createLemonSqueezyCheckout(env, user, items, settings, bundle = null, consentId = '') {
  const storeId = String(settings.lemonSqueezyStoreId || '').trim()
  if (!storeId) throw new HttpError(503, 'The Lemon Squeezy store is not configured')
  const origin = getPrimaryOrigin(env)
  const productKeys = items.map((item) => item.product.key)
  const isMultiItem = items.length > 1
  let variantId = String(items[0].product.lemonVariantId || '').trim()
  if (!variantId) throw new HttpError(503, `No Lemon Squeezy variant is configured for ${items[0].product.name}`)
  // Lemon Squeezy only accepts string values in checkout_data.custom. An
  // array for product_keys is rejected as 422 and surfaces to the buyer as
  // "The payment service could not complete the request". Store and variant
  // belong in relationships, not attributes, on create.
  const attributes = {
    checkout_data: {
      email: String(user.email || ''),
      custom: {
        user_id: String(user.id || ''),
        product_keys: productKeys.join(','),
        consent_id: String(consentId || ''),
      },
    },
    product_options: { redirect_url: `${origin}/success`, enabled_variants: [Number(variantId)] },
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }
  if (!isMultiItem) {
    const cents = Math.round(Number(items[0].product.priceCents || 0))
    if (!Number.isInteger(cents) || cents <= 0) throw new HttpError(503, `The checkout price is not configured for ${items[0].product.name}`)
    attributes.custom_price = cents
  }
  if (isMultiItem) {
    const lines = []
    let totalCents = 0
    const currencies = new Set()
    for (const item of items) {
      const cents = Math.round(Number(item.product.priceCents || 0))
      if (!Number.isInteger(cents) || cents <= 0) throw new HttpError(503, `The checkout price is not configured for ${item.product.name}`)
      totalCents += cents
      currencies.add(item.product.currency || 'USD')
      lines.push(`${item.product.name} — ${centsToDisplay(cents, item.product.currency || 'USD')}`)
    }
    if (currencies.size !== 1) throw new HttpError(503, 'All products in one checkout must use the same currency')
    // A named bundle applies its percentage discount here, server-side, from
    // the D1 row. This is the only place the sale price is decided.
    let checkoutName = 'Runway Systems Suite Bundle'
    if (bundle) {
      const discounted = Math.round(totalCents * (100 - bundle.discountPercent) / 100)
      lines.push(`${bundle.discountPercent}% bundle discount applied`)
      totalCents = discounted
      checkoutName = bundle.name
    }
    // A bundle can carry its own Lemon Squeezy variant; otherwise the global
    // suite variant, and failing that the first product's variant, anchors
    // the combined checkout so receipts read sensibly.
    const bundleVariantId = String(bundle?.lemonVariantId || settings.lemonSqueezyBundleVariantId || '').trim()
    if (bundleVariantId) variantId = bundleVariantId
    attributes.custom_price = totalCents
    attributes.product_options = {
      redirect_url: `${origin}/success`,
      enabled_variants: [Number(variantId)],
      name: checkoutName,
      description: lines.join('\n'),
    }
  }
  const payload = {
    data: {
      type: 'checkouts',
      attributes,
      relationships: {
        store: { data: { type: 'stores', id: String(storeId) } },
        variant: { data: { type: 'variants', id: String(variantId) } },
      },
    },
  }
  const response = await lemonSqueezyRequest(env, '/checkouts', { method: 'POST', body: payload })
  const url = response?.data?.attributes?.url
  if (!url) throw new HttpError(502, 'Lemon Squeezy did not return a checkout URL')
  return { url, checkoutId: response?.data?.id || '' }
}

async function createCheckoutSession(request, env, user) {
  await rateLimit(request, env, 'checkout', 8, 600, user.id)
  // Per-email rate limit. The user-id limit above caps attempts by one
  // account, but an attacker can mass-create Supabase accounts (or
  // script a Google OAuth loop) to multiply the per-user budget by N.
  // This bucket caps the *addressed* email instead, so 1,000 accounts
  // all targeting attacker@evil.com hit the same wall.
  const emailSubject = String(user?.email || '').trim().toLowerCase()
  if (emailSubject) await rateLimit(request, env, 'checkout-email', 4, 86400, emailSubject)
  const body = await readJson(request)
  // Accept either a single productKey (legacy clients) or an array of
  // productKeys. Every item in the cart is validated here; the checkout
  // itself is a single Lemon Squeezy checkout (bundled when there are
  // several products), so the buyer pays exactly once.
  const requested = Array.isArray(body.productKeys)
    ? body.productKeys.filter(Boolean)
    : [body.productKey].filter(Boolean)
  if (!requested.length) throw new HttpError(400, 'Select at least one product to check out')
  if (requested.length > 10) throw new HttpError(400, 'At most 10 products can be checked out together')

  // Consent is a precondition for payment, checked before any catalog or
  // pricing work so a refusal is unambiguous rather than masked by an
  // unrelated configuration error.
  if (body.consent !== true) {
    throw new HttpError(400, 'You must accept the terms, privacy policy, and refund policy before checking out')
  }
  const consentSource = ['cart', 'product'].includes(String(body.consentSource || '')) ? String(body.consentSource) : 'cart'

  const settings = await getSettings(env)
  // Never trust the client's item list blindly: dedupe so a repeated key
  // cannot create duplicate charges for the same product.
  const items = []
  const seenKeys = new Set()
  for (const rawKey of requested) {
    const productKey = cleanText(String(rawKey), 60, 'Product key')
    if (seenKeys.has(productKey)) continue
    seenKeys.add(productKey)
    const product = await resolveProductConfig(env, productKey)
    if (!product.active || product.status === 'hidden') throw new HttpError(404, `${product.name} is not available`)
    if (product.status === 'coming_soon') throw new HttpError(400, `${product.name} is coming soon and cannot be purchased yet`)
    const variantId = String(product.lemonVariantId || '').trim()
    if (!variantId) throw new HttpError(503, `No Lemon Squeezy variant is configured for ${product.name}`)
    items.push({ product, lemonVariantId: variantId })
  }
  if (!items.length) throw new HttpError(400, 'Select at least one product to check out')

  // An optional bundleKey applies that bundle's discount. The percentage and
  // the member list are read from D1, never from the request, and the cart
  // must contain exactly the bundle's members so a client cannot claim a
  // discount for a cart it does not apply to.
  let bundle = null
  const requestedBundleKey = cleanText(String(body.bundleKey || ''), 60, 'Bundle key', { required: false })
  if (requestedBundleKey) {
    const row = await env.DB.prepare('SELECT * FROM bundles WHERE key = ? AND active = 1').bind(requestedBundleKey).first()
    if (!row) throw new HttpError(404, 'That bundle is not available')
    const config = bundleRowToConfig(row)
    const cartKeys = [...seenKeys].sort().join(',')
    const bundleKeys = [...config.productKeys].sort().join(',')
    if (cartKeys !== bundleKeys) throw new HttpError(400, 'The cart does not match the products in that bundle')
    bundle = config
  }

  // Record the agreement BEFORE creating the checkout. Consent happened at the
  // moment the buyer submitted, so it must survive a payment provider outage
  // rather than being lost with the failed request. The row is stamped with
  // the checkout id afterwards so it can be tied to the resulting order.
  const consentId = makeId('consent')
  await env.DB.prepare(`
    INSERT INTO checkout_consents (
      id, checkout_id, user_id, customer_email, product_keys, bundle_key,
      policy_version, consent_text, source, created_at
    ) VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    consentId,
    user.id,
    user.email || '',
    JSON.stringify([...seenKeys]),
    bundle?.key || '',
    CONSENT_POLICY_VERSION,
    CONSENT_TEXT,
    consentSource,
    nowIso(),
  ).run()

  const session = await createLemonSqueezyCheckout(env, user, items, settings, bundle, consentId)

  if (session.checkoutId) {
    await env.DB.prepare('UPDATE checkout_consents SET checkout_id = ? WHERE id = ?')
      .bind(session.checkoutId, consentId).run()
  }

  const date = nowIso().slice(0, 10)
  await env.DB.prepare(`
    INSERT INTO daily_metrics (date, page_views, checkout_starts)
    VALUES (?, 0, 1)
    ON CONFLICT(date) DO UPDATE SET checkout_starts = checkout_starts + 1
  `).bind(date).run()
  return { url: session.url, sessionId: session.checkoutId || '', provider: 'lemonsqueezy' }
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return difference === 0
}

// Byte-array constant-time compare. Use this for HMAC verification
// instead of comparing hex strings: the hex form leaks through length
// differences and (on some platforms) per-byte work differences.
function constantTimeEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index]
  return difference === 0
}

function purchaseFromRow(row, productInfo = null) {
  const purchase = {
    id: row.id,
    productKey: row.product_key,
    amountTotal: Number(row.amount_total || 0),
    currency: row.currency || 'usd',
    paymentStatus: row.payment_status,
    accessSource: row.access_source || 'paid',
    accessStatus: row.access_status || 'active',
    createdAt: row.created_at,
    deliveryEmailStatus: row.delivery_email_status,
  }
  if (productInfo) purchase.product = productInfo(row.product_key)
  return purchase
}

async function findPurchaseForUser(env, purchaseId, userId) {
  const row = await env.DB.prepare(`
    SELECT * FROM purchases WHERE id = ? AND user_id = ? AND payment_status = 'paid' AND access_status = 'active'
  `).bind(purchaseId, userId).first()
  if (!row) throw new HttpError(404, 'Purchase not found for this account')
  return row
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

// Brevo transactional email (no Brevo templates: the full HTML body is built
// in code by emailLayout and sent as raw htmlContent, so template ids and
// params are not involved). Sender selection is per message so each mail
// type leaves from its own verified address.
//
// Quota handling: on 429 or 400-with-quota-message, the response's
// `Retry-After` header (or a 1-hour fallback) is attached to the thrown
// error as `.retryAfterSeconds`, and the same value is persisted to the
// brevo_quota table so the cron worker can short-circuit known-exhausted
// ticks instead of burning 5 attempts per row during a quota outage.
class BrevoError extends Error {
  constructor(message, { retryAfterSeconds = 0, isQuota = false, status = 0 } = {}) {
    super(message)
    this.name = 'BrevoError'
    this.retryAfterSeconds = retryAfterSeconds
    this.isQuota = isQuota
    this.status = status
  }
}

function parseBrevoQuotaResponse(text) {
  // Brevo returns 400 with this body on the free-tier daily cap:
  //   { "code": "forbidden_quota", "message": "Daily quota exceeded" }
  // Paid tiers typically return 429 with a Retry-After header.
  if (!text) return { isQuota: false, message: '' }
  try {
    const body = JSON.parse(text)
    const code = String(body?.code || '').toLowerCase()
    const message = String(body?.message || '')
    const isQuota = code === 'forbidden_quota' || /quota|rate.?limit|too many/i.test(message)
    return { isQuota, message: message || code }
  } catch {
    return { isQuota: false, message: text.slice(0, 200) }
  }
}

function parseRetryAfter(headerValue) {
  if (!headerValue) return 0
  const asInt = Number.parseInt(headerValue, 10)
  if (Number.isFinite(asInt) && asInt >= 0) return asInt
  // RFC 7231 also allows an HTTP-date. Not common on SMTP APIs, but be safe.
  const date = Date.parse(headerValue)
  if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000))
  return 0
}

async function recordBrevoQuotaState(env, retryAfterSeconds, message) {
  if (!env.DB) return
  try {
    const now = nowIso()
    await env.DB.prepare(`
      INSERT INTO brevo_quota (id, exhausted_at, retry_after_seconds, message, updated_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        exhausted_at = excluded.exhausted_at,
        retry_after_seconds = excluded.retry_after_seconds,
        message = excluded.message,
        updated_at = excluded.updated_at
    `).bind(now, retryAfterSeconds, String(message || '').slice(0, 500), now).run()
  } catch (error) {
    // Never let quota-state writes fail the parent operation.
    console.error('Failed to persist Brevo quota state', redactPii(error?.message))
  }
}

async function clearBrevoQuotaState(env) {
  if (!env.DB) return
  try {
    await env.DB.prepare('DELETE FROM brevo_quota WHERE id = 1').run()
  } catch {
    // Best-effort.
  }
}

function brevoApiUrl(env) {
  const raw = String(env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email')
  let parsed
  try { parsed = new URL(raw) } catch { throw new BrevoError('Brevo API URL is invalid') }
  const localDev = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !(localDev && parsed.protocol === 'http:')) throw new BrevoError('Brevo API URL must use HTTPS')
  return parsed.toString()
}

async function sendBrevo(env, message) {
  if (!env.BREVO_API_KEY || !message.from) throw new BrevoError('Brevo is not configured')
  const response = await fetch(brevoApiUrl(env), {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: message.from, name: message.fromName || 'Runway Systems' },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
      ...((message.idempotencyKey || message.headers) ? {
        headers: {
          ...(message.headers || {}),
          ...(message.idempotencyKey ? { 'X-Request-Id': message.idempotencyKey } : {}),
        },
      } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (response.ok) {
    // Any successful send proves the cap has lifted. Drop the recorded
    // exhausted state so the next cron tick doesn't short-circuit.
    await clearBrevoQuotaState(env)
    return
  }
  const text = await response.text().catch(() => '')
  const { isQuota, message: detailMessage } = parseBrevoQuotaResponse(text)
  const headerRetry = parseRetryAfter(response.headers.get('Retry-After'))
  // If Brevo signals a quota problem but doesn't give a Retry-After, fall
  // back to a 1-hour cooldown. That is the smallest cooldown that won't
  // keep hammering the API every 5 minutes during a free-tier reset.
  const retryAfterSeconds = headerRetry || (isQuota ? 3600 : 0)
  if (isQuota) await recordBrevoQuotaState(env, retryAfterSeconds, detailMessage || `Brevo returned ${response.status}`)
  console.error('Brevo request failed', response.status, isQuota ? 'quota' : 'other')
  throw new BrevoError(`Brevo returned ${response.status}`, {
    retryAfterSeconds,
    isQuota,
    status: response.status,
  })
}

function emailLayout(title, intro, actionLabel, actionUrl, footer, secondaryAction = null, eyebrow = 'RUNWAY SYSTEMS') {
  const safeTitle = escapeHtml(title)
  const safeIntro = escapeHtml(intro)
  const safeLabel = escapeHtml(actionLabel)
  const safeUrl = escapeHtml(actionUrl)
  const safeFooter = escapeHtml(footer)
  const safeEyebrow = escapeHtml(eyebrow)
  const secondary = secondaryAction
    ? `<tr><td style="padding-top:16px"><a href="${escapeHtml(secondaryAction.url)}" style="color:#c9a227;font-size:14px">${escapeHtml(secondaryAction.label)}</a></td></tr>`
    : ''
  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#0a0c10;color:#f4f1e9;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0c10;padding:36px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#11141a;border:1px solid #2b3039;border-radius:18px;padding:38px">
<tr><td style="color:#c9a227;font-size:11px;letter-spacing:2px;padding-bottom:18px">${safeEyebrow}</td></tr>
<tr><td style="font-size:32px;font-weight:700;line-height:1.15;padding-bottom:16px">${safeTitle}</td></tr>
<tr><td style="color:#a9afba;font-size:16px;line-height:1.65;padding-bottom:28px">${safeIntro}</td></tr>
<tr><td><a href="${safeUrl}" style="display:inline-block;background:#c9a227;color:#0a0c10;text-decoration:none;font-weight:700;padding:15px 20px;border-radius:9px">${safeLabel}</a></td></tr>
${secondary}
<tr><td style="color:#737b89;font-size:12px;line-height:1.6;padding-top:30px">${safeFooter}</td></tr>
</table></td></tr></table></body></html>`
}

function parseJsonSafe(val, fallback = []) {
  if (!val) return fallback
  if (typeof val === 'object') return val
  try {
    const parsed = JSON.parse(val)
    return parsed !== null ? parsed : fallback
  } catch {
    return fallback
  }
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

async function marketingEmailHash(env, email) {
  return sha256Hex(`${env.RATE_LIMIT_SALT || 'runway-marketing'}:marketing:${String(email || '').trim().toLowerCase()}`)
}

async function suppressMarketingEmail(env, email, reason = 'recipient_request') {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) return
  const emailHash = await marketingEmailHash(env, cleanEmail)
  await env.DB.prepare(`
    INSERT INTO marketing_suppressions (email_hash, unsubscribed_at, reason)
    VALUES (?, ?, ?)
    ON CONFLICT(email_hash) DO UPDATE SET unsubscribed_at = excluded.unsubscribed_at, reason = excluded.reason
  `).bind(emailHash, nowIso(), reason).run()
  await env.DB.prepare("UPDATE audience_contacts SET status = 'unsubscribed' WHERE email = ?").bind(cleanEmail).run()
  await env.DB.prepare(`
    UPDATE marketing_deliveries
    SET status = 'failed', attempts = 5, last_error = 'Recipient unsubscribed', updated_at = ?
    WHERE recipient_email = ? AND kind = 'campaign' AND status != 'sent'
  `).bind(nowIso(), cleanEmail).run()
}

async function createUnsubscribeToken(env, email) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString()
  await env.DB.prepare(`
    INSERT INTO marketing_unsubscribe_tokens (token_hash, email, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(await sha256Hex(token), String(email).trim().toLowerCase(), createdAt, expiresAt).run()
  return token
}

async function emailForUnsubscribeToken(env, token) {
  const raw = String(token || '').trim()
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(raw)) return ''
  const row = await env.DB.prepare(`
    SELECT email FROM marketing_unsubscribe_tokens
    WHERE token_hash = ? AND expires_at >= ? AND COALESCE(used_at, '') = ''
  `).bind(await sha256Hex(raw), nowIso()).first()
  return String(row?.email || '').trim().toLowerCase()
}

async function consumeUnsubscribeToken(env, token) {
  const raw = String(token || '').trim()
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(raw)) throw new HttpError(400, 'This unsubscribe link is invalid or expired')
  const consumed = await env.DB.prepare(`
    UPDATE marketing_unsubscribe_tokens SET used_at = ?
    WHERE token_hash = ? AND COALESCE(used_at, '') = '' AND expires_at >= ?
    RETURNING email
  `).bind(nowIso(), await sha256Hex(raw), nowIso()).first()
  const email = String(consumed?.email || '').trim().toLowerCase()
  if (!email) throw new HttpError(400, 'This unsubscribe link is invalid or expired')
  await suppressMarketingEmail(env, email)
  return email
}

async function recordAudienceContact(env, {
  email,
  userId = '',
  name = '',
  avatarUrl = '',
  source = 'google_signin',
  isCustomer = false,
  spendCents = 0,
  productKey = '',
  productKeys = [],
  orderIncrement = 0,
  waitlistKey = '',
  marketingOptIn = false,
  marketingOptInSource = '',
}) {
  if (!env.DB || !email || !isValidEmail(email)) return
  const cleanEmail = String(email).trim().toLowerCase()
  const cleanName = String(name || '').trim().slice(0, 100)
  const cleanAvatar = String(avatarUrl || '').trim().slice(0, 500)
  const cleanUserId = String(userId || '').trim().slice(0, 80)
  const now = nowIso()

  try {
    const existing = await env.DB.prepare('SELECT * FROM audience_contacts WHERE email = ?').bind(cleanEmail).first()
    if (existing) {
      const owned = parseJsonSafe(existing.products_owned, [])
      const nextProductKeys = [productKey, ...(Array.isArray(productKeys) ? productKeys : [])].filter(Boolean)
      for (const key of nextProductKeys) if (!owned.includes(key)) owned.push(key)

      const waitlists = parseJsonSafe(existing.waitlists_joined, [])
      if (waitlistKey && !waitlists.includes(waitlistKey)) waitlists.push(waitlistKey)

      const nextCustomer = (existing.is_customer || isCustomer || owned.length > 0) ? 1 : 0
      const nextSpend = (existing.total_spend_cents || 0) + (spendCents || 0)
      const nextOrders = (existing.orders_count || 0) + Math.max(0, Number(orderIncrement) || 0)
      const nextName = cleanName || existing.name || ''
      const nextAvatar = cleanAvatar || existing.avatar_url || ''
      const nextUserId = cleanUserId || existing.user_id || ''

      await env.DB.prepare(`
        UPDATE audience_contacts
        SET user_id = CASE WHEN user_id = '' THEN ? ELSE user_id END,
            name = CASE WHEN ? != '' THEN ? ELSE name END,
            avatar_url = CASE WHEN ? != '' THEN ? ELSE avatar_url END,
            is_customer = ?,
            total_spend_cents = ?,
            orders_count = ?,
            products_owned = ?,
            waitlists_joined = ?,
            status = CASE WHEN ? = 1 THEN 'subscribed' ELSE status END,
            marketing_opt_in_at = CASE WHEN ? = 1 THEN ? ELSE marketing_opt_in_at END,
            marketing_opt_in_source = CASE WHEN ? = 1 THEN ? ELSE marketing_opt_in_source END,
            marketing_opt_in_policy_version = CASE WHEN ? = 1 THEN ? ELSE marketing_opt_in_policy_version END,
            last_seen_at = ?
        WHERE email = ?
      `).bind(
        nextUserId,
        nextName, nextName,
        nextAvatar, nextAvatar,
        nextCustomer,
        nextSpend,
        nextOrders,
        JSON.stringify(owned),
        JSON.stringify(waitlists),
        marketingOptIn ? 1 : 0,
        marketingOptIn ? 1 : 0, now,
        marketingOptIn ? 1 : 0, marketingOptInSource || source,
        marketingOptIn ? 1 : 0, 'marketing-v1',
        now,
        cleanEmail
      ).run()
    } else {
      const id = makeId('contact')
      const owned = [...new Set([productKey, ...(Array.isArray(productKeys) ? productKeys : [])].filter(Boolean))]
      const waitlists = waitlistKey ? [waitlistKey] : []
      await env.DB.prepare(`
        INSERT INTO audience_contacts (
          id, email, user_id, name, avatar_url, source, status,
          is_customer, total_spend_cents, orders_count, products_owned,
          waitlists_joined, marketing_opt_in_at, marketing_opt_in_source,
          marketing_opt_in_policy_version, last_seen_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        cleanEmail,
        cleanUserId,
        cleanName,
        cleanAvatar,
        source,
        marketingOptIn ? 'subscribed' : 'unsubscribed',
        (isCustomer || owned.length > 0) ? 1 : 0,
        spendCents || 0,
        Math.max(0, Number(orderIncrement) || 0),
        JSON.stringify(owned),
        JSON.stringify(waitlists),
        marketingOptIn ? now : '',
        marketingOptIn ? (marketingOptInSource || source) : '',
        marketingOptIn ? 'marketing-v1' : '',
        now,
        now
      ).run()
    }
    // Only a successfully persisted, explicit opt-in may clear a previous
    // suppression. If this delete fails, campaign queries still fail safe by
    // excluding the durable suppression row.
    if (marketingOptIn) {
      await env.DB.prepare('DELETE FROM marketing_suppressions WHERE email_hash = ?')
        .bind(await marketingEmailHash(env, cleanEmail)).run()
    }
  } catch (err) {
    console.error('Failed to record audience contact', err?.message)
  }
}

async function requestNewsletterConfirmation(request, env, input) {
  const generic = { accepted: true, message: 'Check your inbox. A confirmation message is on its way if this address can receive Blog emails.' }
  // A filled honeypot gets the same response but creates no contact, token, or
  // provider call. Bots cannot use the response to tune around the trap.
  if (String(input.company || '').trim()) return generic
  if (input.consent !== true) throw new HttpError(400, 'Confirm that you want to receive Runway Systems Blog emails')
  const email = cleanText(input.email, 254, 'Email').trim().toLowerCase()
  if (!isValidEmail(email)) throw new HttpError(400, 'Please enter a valid email address')
  const requestedSource = cleanText(input.source || 'site_footer', 40, 'Source', { required: false })
  const source = NEWSLETTER_SOURCES.has(requestedSource) ? requestedSource : 'site_footer'
  await rateLimit(request, env, 'newsletter-ip', 20, 3600)
  await rateLimit(request, env, 'newsletter-email', 5, 24 * 60 * 60, email)

  const subscribed = await env.DB.prepare(`
    SELECT id FROM audience_contacts
    WHERE email = ? AND status = 'subscribed' AND marketing_opt_in_at != ''
      AND NOT EXISTS (SELECT 1 FROM marketing_suppressions WHERE email_hash = ?)
  `).bind(email, await marketingEmailHash(env, email)).first()
  if (subscribed) return generic

  const rawToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256Hex(rawToken)
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + NEWSLETTER_CONFIRMATION_TTL_MS).toISOString()
  // Keep at most one live request per address. Previous links become invalid
  // before a replacement is sent.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM newsletter_confirmations WHERE email = ? AND COALESCE(used_at, \'\') = \'\'').bind(email),
    env.DB.prepare(`
      INSERT INTO newsletter_confirmations
        (token_hash, email, source, policy_version, created_at, expires_at, used_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `).bind(tokenHash, email, source, NEWSLETTER_POLICY_VERSION, createdAt, expiresAt),
  ])

  const confirmUrl = `${getPrimaryOrigin(env)}/newsletter/confirm#token=${encodeURIComponent(rawToken)}`
  const html = emailLayout(
    'Confirm your Blog emails',
    'One final step: confirm that you want occasional Runway Systems Blog articles about money, clients, projects, and calmer business operations.',
    'Review and confirm',
    confirmUrl,
    'This confirmation link expires in 48 hours. If you did not request these emails, you can safely ignore this message.',
    null,
    'RUNWAY SYSTEMS BLOG · EMAIL UPDATES',
  )
  try {
    await sendBrevo(env, {
      to: email,
      from: env.EMAIL_FROM_INFO || 'info@runwaysystems.cloud',
      fromName: 'Runway Systems',
      subject: 'Confirm your Runway Systems Blog emails',
      html,
      text: `Confirm your Runway Systems Blog emails: ${confirmUrl}\n\nThis link expires in 48 hours. If you did not request these emails, ignore this message.`,
      idempotencyKey: `newsletter-confirm-${tokenHash.slice(0, 24)}`,
    })
  } catch (error) {
    await env.DB.prepare('DELETE FROM newsletter_confirmations WHERE token_hash = ?').bind(tokenHash).run().catch(() => {})
    logEvent('warn', 'newsletter.confirmation_email_failed', { error: error?.message })
    // Keep the same public response as subscribed, pending, and honeypot paths.
    // Provider availability must not become an address-enumeration oracle.
  }
  return generic
}

async function confirmNewsletterSubscription(request, env, input) {
  const token = cleanText(input.token, 120, 'Confirmation token')
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new HttpError(400, 'This confirmation link is invalid or expired')
  await rateLimit(request, env, 'newsletter-confirm', 20, 3600, token)
  const confirmedAt = nowIso()
  const tokenHash = await sha256Hex(token)
  const row = await env.DB.prepare(`
    UPDATE newsletter_confirmations SET used_at = ?
    WHERE token_hash = ? AND COALESCE(used_at, '') = '' AND expires_at >= ?
    RETURNING email, source, policy_version
  `).bind(confirmedAt, tokenHash, confirmedAt).first()
  if (!row?.email) throw new HttpError(410, 'This confirmation link is invalid, expired, or already used')

  await recordAudienceContact(env, {
    email: row.email,
    source: 'manual',
    marketingOptIn: true,
    marketingOptInSource: `newsletter_${row.source || 'site_footer'}`,
  })
  const contact = await env.DB.prepare(`
    SELECT id FROM audience_contacts
    WHERE email = ? AND status = 'subscribed' AND marketing_opt_in_at != ''
      AND NOT EXISTS (SELECT 1 FROM marketing_suppressions WHERE email_hash = ?)
  `).bind(row.email, await marketingEmailHash(env, row.email)).first()
  if (!contact) {
    await env.DB.prepare('UPDATE newsletter_confirmations SET used_at = NULL WHERE token_hash = ? AND used_at = ?').bind(tokenHash, confirmedAt).run().catch(() => {})
    throw new HttpError(503, 'The subscription could not be confirmed. Please try again shortly.')
  }
  await env.DB.prepare("DELETE FROM newsletter_confirmations WHERE email = ? AND COALESCE(used_at, '') = ''").bind(row.email).run()
  return { confirmed: true, message: 'You are subscribed to Runway Systems Blog email updates.' }
}

function renderMarketingTemplate(text, contact = {}, product = null) {
  if (!text) return ''
  const fullName = contact.name || 'there'
  const firstName = contact.name ? contact.name.split(' ')[0] : 'there'
  const email = contact.email || ''
  const productName = product?.name || 'Runway Systems'

  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*email\s*\}\}/gi, email)
    .replace(/\{\{\s*product_name\s*\}\}/gi, productName)
}

function formatMarketingBodyToHtml(text) {
  if (!text) return ''
  const paragraphs = text.split(/\n\s*\n/)
  return paragraphs.map((p) => {
    let formatted = escapeHtml(p.trim())
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>')
    formatted = formatted.replace(/\n/g, '<br/>')
    return `<p style="margin:0 0 16px 0;line-height:1.75;color:#cbd0d8">${formatted}</p>`
  }).join('')
}

function marketingEmailLayout({
  title,
  eyebrow = 'RUNWAY SYSTEMS · VIP ANNOUNCEMENT',
  bodyHtml,
  discountCode = '',
  actionLabel = '',
  actionUrl = '',
  footerText = '',
  unsubscribeUrl = '',
}) {
  const safeTitle = escapeHtml(title)
  const safeEyebrow = escapeHtml(eyebrow)
  const safeLabel = escapeHtml(actionLabel)
  const safeUrl = escapeHtml(actionUrl)

  const discountSection = discountCode
    ? `<tr><td style="padding:16px 0 20px 0">
        <div style="background:#161922;border:1px dashed #c9a227;border-radius:12px;padding:16px 20px;text-align:center">
          <span style="color:#a9afba;font-size:12px;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Exclusive Promotion Code</span>
          <code style="font-family:Courier,monospace;font-size:20px;font-weight:700;color:#c9a227;letter-spacing:2px;background:#0a0c10;padding:4px 12px;border-radius:6px;border:1px solid #2b3039">${escapeHtml(discountCode)}</code>
        </div>
      </td></tr>`
    : ''

  const ctaSection = (actionLabel && actionUrl)
    ? `<tr><td style="padding:24px 0 16px 0" align="center">
        <a href="${safeUrl}" style="display:inline-block;background:#c9a227;color:#0a0c10;text-decoration:none;font-weight:700;font-size:15px;padding:16px 32px;border-radius:9px;text-align:center;letter-spacing:0.3px">${safeLabel}</a>
      </td></tr>`
    : ''

  const unsubscribeSection = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#737b89;text-decoration:underline">Unsubscribe</a> · `
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0c10;color:#f4f1e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0c10;padding:40px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#11141a;border:1px solid #242933;border-radius:18px;padding:40px">
<tr><td style="color:#c9a227;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding-bottom:18px">${safeEyebrow}</td></tr>
<tr><td style="font-size:28px;font-weight:700;line-height:1.2;color:#f4f1e9;padding-bottom:24px">${safeTitle}</td></tr>
<tr><td style="color:#cbd0d8;font-size:15px;line-height:1.75;padding-bottom:12px">${bodyHtml}</td></tr>
${discountSection}
${ctaSection}
<tr><td style="color:#737b89;font-size:12px;line-height:1.6;padding-top:36px;border-top:1px solid #1c212b;margin-top:24px">
${footerText ? `<div>${escapeHtml(footerText)}</div>` : ''}
<div style="padding-top:8px">
${unsubscribeSection}
<span>Runway Systems · info@runwaysystems.cloud</span>
</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function complimentaryGrantFromRow(row, items = []) {
  return {
    id: row.id,
    recipientEmail: row.recipient_email,
    status: row.status,
    products: items,
    emailStatus: row.email_status,
    emailAttempts: Number(row.email_attempts || 0),
    emailSentAt: row.email_sent_at || '',
    emailLastError: row.email_last_error || '',
    tokenExpiresAt: row.token_expires_at,
    claimedByUserId: row.claimed_by_user_id || '',
    claimedAt: row.claimed_at || '',
    reviewInvitedAt: row.review_invited_at || '',
    revokedAt: row.revoked_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function complimentaryItemsByGrant(env, grantIds) {
  const ids = [...new Set((grantIds || []).filter(Boolean))]
  const grouped = new Map(ids.map((id) => [id, []]))
  if (!ids.length) return grouped
  const placeholders = ids.map(() => '?').join(',')
  const rows = await env.DB.prepare(`
    SELECT i.grant_id, i.product_key, i.purchase_id, i.item_status, p.name
    FROM complimentary_grant_items i
    LEFT JOIN products p ON p.key = i.product_key
    WHERE i.grant_id IN (${placeholders})
    ORDER BY i.created_at ASC, i.product_key ASC
  `).bind(...ids).all()
  for (const row of rows.results || []) {
    const list = grouped.get(row.grant_id) || []
    list.push({
      productKey: row.product_key,
      productName: row.name || fallbackProductName(row.product_key),
      purchaseId: row.purchase_id || '',
      status: row.item_status,
    })
    grouped.set(row.grant_id, list)
  }
  return grouped
}

async function getComplimentaryGrants(env, { limit = 100, status = '', search = '' } = {}) {
  const where = []
  const params = []
  if (status) {
    if (!['pending', 'claimed', 'cancelled', 'expired', 'revoked'].includes(status)) throw new HttpError(400, 'Invalid complimentary access status')
    where.push('status = ?')
    params.push(status)
  }
  if (search) {
    where.push('LOWER(recipient_email) LIKE ?')
    params.push(`%${search.toLowerCase()}%`)
  }
  const safeLimit = Math.min(75, Math.max(1, Number(limit) || 75))
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = await env.DB.prepare(`
    SELECT * FROM complimentary_grants ${clause}
    ORDER BY created_at DESC LIMIT ?
  `).bind(...params, safeLimit).all()
  const grants = rows.results || []
  const itemMap = await complimentaryItemsByGrant(env, grants.map((grant) => grant.id))
  const counts = await env.DB.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) AS claimed,
      SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS revoked
    FROM complimentary_grants
  `).first()
  return {
    grants: grants.map((grant) => complimentaryGrantFromRow(grant, itemMap.get(grant.id) || [])),
    stats: {
      total: Number(counts?.total || 0),
      pending: Number(counts?.pending || 0),
      claimed: Number(counts?.claimed || 0),
      revoked: Number(counts?.revoked || 0),
    },
  }
}

async function sendComplimentaryInvitationEmail(env, grant) {
  if (!grant.token_ciphertext) throw new Error('Complimentary claim token is unavailable')
  const token = await decryptSensitiveValue(env, 'complimentary-claim-token', grant.token_ciphertext)
  const itemMap = await complimentaryItemsByGrant(env, [grant.id])
  const items = itemMap.get(grant.id) || []
  if (!items.length) throw new Error('Complimentary invitation has no products')
  const productNames = items.map((item) => item.productName)
  const productLabel = productNames.length === 1 ? productNames[0] : `${productNames.length} Runway Systems products`
  const claimUrl = `${getPrimaryOrigin(env)}/claim#token=${encodeURIComponent(token)}`
  const intro = `${productNames.join(', ')} ${productNames.length === 1 ? 'has' : 'have'} been provided to you at no cost. Claim with the exact Google account for ${grant.recipient_email}. No payment is required, and this email does not subscribe you to marketing.`
  const footer = `This private invitation expires ${new Date(grant.token_expires_at).toUTCString()}. The claim link expires immediately after use. Product access then remains in your verified account library. By claiming, you agree to the Runway Systems Terms and Privacy Policy. Need help? ${env.SUPPORT_EMAIL || 'Contact Runway Systems support.'}`
  await sendBrevo(env, {
    to: grant.recipient_email,
    from: env.EMAIL_FROM_DELIVERY,
    subject: `Your complimentary ${productLabel} access is ready`,
    idempotencyKey: `runway-complimentary-${grant.id}-${grant.email_attempts}`,
    html: emailLayout(
      'Your complimentary access is ready.',
      intro,
      'Claim my products',
      claimUrl,
      footer,
      null,
      'RUNWAY SYSTEMS / COMPLIMENTARY ACCESS',
    ),
    text: `Your complimentary access is ready.\n\n${intro}\n\nClaim your products: ${claimUrl}\n\n${footer}`,
  })
}

async function deliverComplimentaryInvitation(env, grantOrId) {
  const grantId = typeof grantOrId === 'string' ? grantOrId : grantOrId?.id
  if (!grantId) return false
  const claimedAt = nowIso()
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const claimed = await env.DB.prepare(`
    UPDATE complimentary_grants
    SET email_status = 'sending', email_attempts = email_attempts + 1,
        email_last_error = NULL, updated_at = ?
    WHERE id = ? AND status = 'pending' AND token_expires_at >= ?
      AND email_attempts < 5
      AND (email_status IN ('pending', 'failed') OR (email_status = 'sending' AND updated_at <= ?))
      AND (email_next_eligible_at = '' OR email_next_eligible_at <= ?)
    RETURNING *
  `).bind(claimedAt, grantId, claimedAt, staleBefore, claimedAt).first()
  if (!claimed) return false

  try {
    await sendComplimentaryInvitationEmail(env, claimed)
    const sentAt = nowIso()
    await env.DB.prepare(`
      UPDATE complimentary_grants
      SET email_status = 'sent', email_sent_at = ?, email_last_error = NULL,
          email_next_eligible_at = '', token_ciphertext = NULL, updated_at = ?
      WHERE id = ? AND email_status = 'sending'
    `).bind(sentAt, sentAt, grantId).run()
    return true
  } catch (error) {
    const errorText = redactPii(String(error?.message || error)).slice(0, 500)
    const cooldownSeconds = Math.max(60, Number(error?.retryAfterSeconds) || 0)
    const cooldownAt = new Date(Date.now() + cooldownSeconds * 1000).toISOString()
    await env.DB.prepare(`
      UPDATE complimentary_grants
      SET email_status = 'failed', email_last_error = ?, email_next_eligible_at = ?, updated_at = ?
      WHERE id = ? AND email_status = 'sending'
    `).bind(errorText, cooldownAt, cooldownAt, grantId).run()
    logEvent('warn', 'complimentary_invitation_delivery_failed', { grantId, attempts: claimed.email_attempts, error: errorText })
    return false
  }
}

async function createComplimentaryGrant(env, ownerUser, input) {
  const email = cleanText(input.email, 254, 'Recipient email').trim().toLowerCase()
  if (!isValidEmail(email)) throw new HttpError(400, 'Please enter a valid recipient email address')
  const idempotencyKey = cleanText(input.idempotencyKey, 100, 'Idempotency key')
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(idempotencyKey)) throw new HttpError(400, 'Idempotency key format is invalid')
  const requestedKeys = [...new Set((Array.isArray(input.productKeys) ? input.productKeys : []).map((value) => String(value || '').trim()).filter(Boolean))]
  if (!requestedKeys.length || requestedKeys.length > 10) throw new HttpError(400, 'Select between one and ten products')

  const existingRequest = await env.DB.prepare('SELECT * FROM complimentary_grants WHERE idempotency_key = ?').bind(idempotencyKey).first()
  if (existingRequest) {
    const itemMap = await complimentaryItemsByGrant(env, [existingRequest.id])
    return { duplicate: true, grant: complimentaryGrantFromRow(existingRequest, itemMap.get(existingRequest.id) || []), skippedProductKeys: [] }
  }

  await ensureProductsSeeded(env)
  const eligible = []
  for (const productKey of requestedKeys) {
    if (!PRODUCT_KEY_PATTERN.test(productKey)) throw new HttpError(400, 'A selected product key is invalid')
    const product = await resolveProductConfig(env, productKey)
    if (product.status !== 'active' || product.active === false) {
      throw new HttpError(409, `${product.name || 'Product'} must be active before complimentary access can be granted`)
    }
    productDeliveryUrl(env, product)
    eligible.push(product)
  }

  const alreadyOwned = await env.DB.prepare(`
    SELECT DISTINCT product_key FROM purchases
    WHERE LOWER(customer_email) = ? AND payment_status = 'paid' AND access_status = 'active'
  `).bind(email).all()
  const pending = await env.DB.prepare(`
    SELECT DISTINCT i.product_key
    FROM complimentary_grant_items i
    JOIN complimentary_grants g ON g.id = i.grant_id
    WHERE g.recipient_email = ? AND g.status = 'pending'
  `).bind(email).all()
  const unavailable = new Set([...(alreadyOwned.results || []), ...(pending.results || [])].map((row) => row.product_key))
  const products = eligible.filter((product) => !unavailable.has(product.key))
  const skippedProductKeys = eligible.filter((product) => unavailable.has(product.key)).map((product) => product.key)
  if (!products.length) throw new HttpError(409, 'This recipient already owns or has a pending invitation for every selected product')

  const grantId = makeId('complimentary')
  const rawToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256Hex(rawToken)
  const tokenCiphertext = await encryptSensitiveValue(env, 'complimentary-claim-token', rawToken)
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + COMPLIMENTARY_TOKEN_TTL_MS).toISOString()
  const emailHash = await sha256Hex(`${env.RATE_LIMIT_SALT}:complimentary:${email}`)
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO complimentary_grants (
        id, recipient_email, recipient_email_hash, status, token_hash, token_ciphertext,
        token_expires_at, created_by_user_id, idempotency_key, email_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(grantId, email, emailHash, tokenHash, tokenCiphertext, expiresAt, ownerUser.id, idempotencyKey, createdAt, createdAt),
    ...products.map((product) => env.DB.prepare(`
      INSERT INTO complimentary_grant_items (grant_id, product_key, created_at)
      VALUES (?, ?, ?)
    `).bind(grantId, product.key, createdAt)),
  ])
  await recordAudienceContact(env, { email, source: 'manual', isCustomer: true })
  await refreshComplimentaryAudienceForEmail(env, email)
  const row = await env.DB.prepare('SELECT * FROM complimentary_grants WHERE id = ?').bind(grantId).first()
  const itemMap = await complimentaryItemsByGrant(env, [grantId])
  return { duplicate: false, grant: complimentaryGrantFromRow(row, itemMap.get(grantId) || []), skippedProductKeys }
}

async function refreshComplimentaryAudienceForEmail(env, email) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) return
  const grants = await env.DB.prepare(`
    SELECT id, status FROM complimentary_grants
    WHERE recipient_email = ? AND status IN ('pending', 'claimed')
  `).bind(cleanEmail).all()
  const activeGrants = grants.results || []
  const grantIds = activeGrants.map((grant) => grant.id)
  const itemMap = await complimentaryItemsByGrant(env, grantIds)
  const complimentaryProducts = [...new Set(activeGrants.flatMap((grant) => (itemMap.get(grant.id) || []).map((item) => item.productKey)))]
  const ownedRows = await env.DB.prepare(`
    SELECT DISTINCT product_key FROM purchases
    WHERE LOWER(customer_email) = ? AND payment_status = 'paid' AND access_status = 'active'
  `).bind(cleanEmail).all()
  const owned = (ownedRows.results || []).map((row) => row.product_key)
  const paid = await env.DB.prepare(`
    SELECT COUNT(*) AS total FROM purchases
    WHERE LOWER(customer_email) = ? AND payment_status = 'paid' AND access_source = 'paid' AND access_status = 'active'
  `).bind(cleanEmail).first()
  const hasClaimed = activeGrants.some((grant) => grant.status === 'claimed')
  const hasPending = activeGrants.some((grant) => grant.status === 'pending')
  await env.DB.prepare(`
    UPDATE audience_contacts
    SET complimentary_status = ?, complimentary_products = ?, products_owned = ?,
        is_customer = ?
    WHERE email = ?
  `).bind(
    hasClaimed ? 'active' : (hasPending ? 'pending' : ''),
    JSON.stringify(complimentaryProducts),
    JSON.stringify(owned),
    (activeGrants.length > 0 || Number(paid?.total || 0) > 0) ? 1 : 0,
    cleanEmail,
  ).run()
}

async function claimComplimentaryGrant(env, user, rawToken) {
  const token = String(rawToken || '').trim()
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new HttpError(400, 'This complimentary invitation is invalid or expired')
  const tokenHash = await sha256Hex(token)
  const grant = await env.DB.prepare(`
    SELECT * FROM complimentary_grants
    WHERE token_hash = ? AND status = 'pending' AND token_expires_at >= ?
  `).bind(tokenHash, nowIso()).first()
  if (!grant) throw new HttpError(410, 'This complimentary invitation is invalid, expired, or already used')
  const verified = Boolean(user.email_confirmed_at || user.confirmed_at || user?.app_metadata?.provider === 'google')
  if (!verified) throw new HttpError(403, 'A verified account email is required to claim this invitation')
  const userEmail = String(user.email || '').trim().toLowerCase()
  if (userEmail !== String(grant.recipient_email || '').trim().toLowerCase()) {
    throw new HttpError(403, 'Sign in with the exact email address that received this invitation')
  }

  const itemMap = await complimentaryItemsByGrant(env, [grant.id])
  const items = itemMap.get(grant.id) || []
  if (!items.length) throw new HttpError(409, 'This complimentary invitation has no products')
  const productInfo = new Map()
  for (const item of items) {
    const product = await resolveProductConfig(env, item.productKey)
    productDeliveryUrl(env, product)
    productInfo.set(item.productKey, product)
  }

  const claimedAt = nowIso()
  const customerName = String(user.user_metadata?.full_name || user.user_metadata?.name || '').trim().slice(0, 100)
  const statements = [env.DB.prepare(`
    UPDATE complimentary_grants
    SET status = 'claimed', token_hash = NULL, token_ciphertext = NULL,
        token_used_at = ?, claimed_by_user_id = ?, claimed_at = ?,
        accepted_policy_version = ?, accepted_policy_text = ?, updated_at = ?
    WHERE id = ? AND token_hash = ? AND status = 'pending' AND token_expires_at >= ?
  `).bind(claimedAt, user.id, claimedAt, COMPLIMENTARY_POLICY_VERSION, COMPLIMENTARY_POLICY_TEXT, claimedAt, grant.id, tokenHash, claimedAt)]

  for (const item of items) {
    const existing = await env.DB.prepare(`
      SELECT id FROM purchases
      WHERE user_id = ? AND product_key = ? AND payment_status = 'paid' AND access_status = 'active'
      ORDER BY created_at ASC LIMIT 1
    `).bind(user.id, item.productKey).first()
    if (existing) {
      statements.push(env.DB.prepare(`
        UPDATE complimentary_grant_items
        SET purchase_id = ?, item_status = 'already_owned'
        WHERE grant_id = ? AND product_key = ?
          AND EXISTS (SELECT 1 FROM complimentary_grants WHERE id = ? AND claimed_at = ? AND claimed_by_user_id = ?)
      `).bind(existing.id, grant.id, item.productKey, grant.id, claimedAt, user.id))
      continue
    }
    const product = productInfo.get(item.productKey)
    const purchaseId = `complimentary_${(await sha256Hex(`${grant.id}:${item.productKey}`)).slice(0, 40)}`
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO purchases (
        id, order_identifier, user_id, customer_email, customer_name, variant_id,
        amount_total, currency, payment_status, product_key, delivery_email_status,
        delivery_email_attempts, delivery_email_sent_at, created_at, updated_at,
        consent_at, consent_policy_version, delivery_email_next_eligible_at,
        checkout_id, access_source, access_status, complimentary_grant_id
      )
      SELECT ?, ?, ?, ?, ?, '', 0, ?, 'paid', ?, 'sent', 1, ?, ?, ?, ?, ?, '', '', 'complimentary', 'active', ?
      WHERE EXISTS (
        SELECT 1 FROM complimentary_grants
        WHERE id = ? AND claimed_at = ? AND claimed_by_user_id = ? AND status = 'claimed'
      )
    `).bind(
      purchaseId,
      `complimentary:${grant.id}`,
      user.id,
      userEmail,
      customerName,
      String(product.currency || 'USD').toLowerCase(),
      item.productKey,
      claimedAt,
      claimedAt,
      claimedAt,
      claimedAt,
      COMPLIMENTARY_POLICY_VERSION,
      grant.id,
      grant.id,
      claimedAt,
      user.id,
    ))
    statements.push(env.DB.prepare(`
      UPDATE complimentary_grant_items
      SET purchase_id = ?, item_status = 'granted'
      WHERE grant_id = ? AND product_key = ?
        AND EXISTS (SELECT 1 FROM complimentary_grants WHERE id = ? AND claimed_at = ? AND claimed_by_user_id = ?)
    `).bind(purchaseId, grant.id, item.productKey, grant.id, claimedAt, user.id))
  }

  const result = await env.DB.batch(statements)
  if (Number(result[0]?.meta?.changes || 0) !== 1) throw new HttpError(410, 'This complimentary invitation was already claimed')
  await recordAudienceContact(env, {
    email: userEmail,
    userId: user.id,
    name: customerName,
    avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
    source: 'manual',
    isCustomer: true,
    productKeys: items.map((item) => item.productKey),
  })
  await refreshComplimentaryAudienceForEmail(env, userEmail)

  const purchases = await env.DB.prepare(`
    SELECT DISTINCT p.* FROM purchases p
    JOIN complimentary_grant_items i ON i.purchase_id = p.id
    WHERE i.grant_id = ? AND p.user_id = ? AND p.payment_status = 'paid' AND p.access_status = 'active'
    ORDER BY p.created_at DESC
  `).bind(grant.id, user.id).all()
  const publicInfo = await productInfoMap(env)
  return {
    claimed: true,
    grantId: grant.id,
    products: (purchases.results || []).map((purchase) => purchaseFromRow(purchase, publicInfo)),
  }
}

async function sendDeliveryEmail(env, purchase, product) {
  const productName = product.name || fallbackProductName(purchase.product_key)
  const deliveryUrl = productDeliveryUrl(env, product)
  const accountUrl = `${getPrimaryOrigin(env)}/account`
  const name = purchase.customer_name ? ` ${purchase.customer_name.split(' ')[0]}` : ''
  const title = `Your ${productName} access is ready${name}.`
  const intro = `Your payment is confirmed. Use the private Google Sheets link below to create your ${productName} copy. Your purchase also remains available in your Runway Systems account library.`
  const footer = `Account library: ${accountUrl}\nNeed help? ${env.SUPPORT_EMAIL || 'Contact Runway Systems support.'}`
  await sendBrevo(env, {
    to: purchase.customer_email,
    from: env.EMAIL_FROM_DELIVERY,
    subject: `Your ${productName} access is ready`,
    idempotencyKey: `runway-delivery-${purchase.id}`,
    html: emailLayout(title, intro, 'Make my private Google Sheets copy', deliveryUrl, footer, null, `RUNWAY SYSTEMS / ${productName.toUpperCase()}`),
    text: `${title}\n\n${intro}\n\nMake your private copy: ${deliveryUrl}\n\nAccount library: ${accountUrl}\n\n${footer}`,
  })
}

async function deliverPurchaseEmail(env, purchase) {
  const claimedAt = nowIso()
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const claimed = await env.DB.prepare(`
    UPDATE purchases
    SET delivery_email_status = 'sending', delivery_email_attempts = delivery_email_attempts + 1,
        delivery_email_last_error = NULL, updated_at = ?
    WHERE id = ?
      AND delivery_email_attempts < 5
      AND (delivery_email_status IN ('pending', 'failed') OR (delivery_email_status = 'sending' AND updated_at <= ?))
      AND (delivery_email_next_eligible_at = '' OR delivery_email_next_eligible_at <= ?)
    RETURNING *
  `).bind(claimedAt, purchase.id, staleBefore, claimedAt).first()

  if (!claimed) return false

  try {
    const product = await resolveProductConfig(env, claimed.product_key)
    await sendDeliveryEmail(env, claimed, product)
    await env.DB.prepare(`
      UPDATE purchases
      SET delivery_email_status = 'sent', delivery_email_sent_at = ?,
          delivery_email_last_error = NULL, updated_at = ?,
          delivery_email_next_eligible_at = ''
      WHERE id = ? AND delivery_email_status = 'sending'
    `).bind(nowIso(), nowIso(), purchase.id).run()
    return true
  } catch (error) {
    const errorText = redactPii(String(error.message || error)).slice(0, 500)
    // A Retry-After hint from Brevo is stamped onto the per-row cooldown
    // column so the same row isn't picked up again before the cooldown
    // ends. We round up to a minute so we never schedule a retry exactly
    // at the wall-clock instant the cooldown expires (sub-minute precision
    // would race the cron tick).
    const cooldownSeconds = Math.max(60, Number(error.retryAfterSeconds) || 0)
    const cooldownIso = new Date(Date.now() + cooldownSeconds * 1000).toISOString()
    await env.DB.prepare(`
      UPDATE purchases
      SET delivery_email_status = 'failed', delivery_email_last_error = ?,
          updated_at = ?, delivery_email_next_eligible_at = ?
      WHERE id = ? AND delivery_email_status = 'sending'
    `).bind(errorText, cooldownIso, cooldownIso, purchase.id).run()
    console.error('Delivery email failed', purchase.id, redactPii(error.message))
    // Loud permanent-failure log so a stuck row shows up in Cloudflare
    // log search. The 5-attempt cap is hard-coded in the SQL above; the
    // matching .attempts === 5 here means no more retries will fire.
    if (Number(claimed.delivery_email_attempts) >= 5) {
      console.error('Delivery email permanently failed after max attempts', {
        purchaseId: purchase.id,
        attempts: claimed.delivery_email_attempts,
        lastError: redactPii(errorText),
        isQuota: Boolean(error.isQuota),
      })
    }
    return false
  }
}

async function sendReviewEmail(env, request, settings) {
  const origin = getPrimaryOrigin(env)
  const feedbackExpiresAt = Math.floor(new Date(request.feedback_expires_at).getTime() / 1000)
  if (!Number.isInteger(feedbackExpiresAt)) throw new Error('Review feedback expiry is not configured')
  const feedbackToken = await createFeedbackToken(env, request.purchase_id, feedbackExpiresAt)
  const feedbackUrl = `${origin}/feedback?token=${encodeURIComponent(feedbackToken)}`
  const trustpilotUrl = settings.trustpilotBusinessUrl
  const productName = await productNameForPurchase(env, request.purchase_id)
  const purchase = await env.DB.prepare('SELECT access_source FROM purchases WHERE id = ?').bind(request.purchase_id).first()
  const complimentary = purchase?.access_source === 'complimentary'
  const prompt = settings.emailTemplateText || `How's ${productName.toUpperCase()} working for you?`
  const intro = complimentary
    ? 'You received this product through complimentary access. If you have used it, your honest experience can help Runway Systems improve. You may leave an independent Trustpilot review or send private feedback; no particular rating is expected and no benefit depends on your response.'
    : 'Your honest experience helps Runway Systems improve. Every verified buyer receives this same neutral invitation, regardless of their experience or rating. You can leave an independent Trustpilot review or send private feedback directly to our team.'
  const footer = complimentary
    ? `This optional invitation concerns complimentary product access. Disclose that access if the review service requires it. The private feedback link expires after 30 days. Need help? ${env.SUPPORT_EMAIL || 'Contact Runway Systems support.'}`
    : `This invitation is sent consistently to verified buyers. The private feedback link expires after 30 days. Need help? ${env.SUPPORT_EMAIL || 'Contact Runway Systems support.'}`
  await sendBrevo(env, {
    to: request.email,
    from: env.EMAIL_FROM_INFO,
    subject: prompt,
    idempotencyKey: `runway-review-${request.id}`,
    html: emailLayout(
      prompt,
      intro,
      `Review ${productName} on Trustpilot`,
      trustpilotUrl,
      footer,
      { label: 'Send private feedback to Runway Systems', url: feedbackUrl },
      `RUNWAY SYSTEMS / ${productName.toUpperCase()}`,
    ),
    text: `${prompt}\n\n${intro}\n\nIndependent Trustpilot review: ${trustpilotUrl}\n\nPrivate feedback: ${feedbackUrl}\n\n${footer}`,
  })
}

async function enqueueMarketingDeliveries(env, jobs) {
  for (let offset = 0; offset < jobs.length; offset += 40) {
    const chunk = jobs.slice(offset, offset + 40)
    await env.DB.batch(chunk.map((job) => env.DB.prepare(`
      INSERT OR IGNORE INTO marketing_deliveries (
        id, campaign_id, kind, recipient_email, subject, html,
        unsubscribe_url, waitlist_id, status, attempts, next_eligible_at,
        created_at, updated_at, dedupe_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, '', ?, ?, ?)
    `).bind(
      job.id || makeId('marketing_delivery'),
      job.campaignId || '',
      job.kind,
      job.email,
      job.subject,
      job.html,
      job.unsubscribeUrl || '',
      job.waitlistId || '',
      job.createdAt || nowIso(),
      job.createdAt || nowIso(),
      job.dedupeKey,
    )))
  }
}

async function refreshCampaignDeliveryStatus(env, campaignId) {
  if (!campaignId) return
  const counts = await env.DB.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
           SUM(CASE WHEN status = 'failed' AND attempts >= 5 THEN 1 ELSE 0 END) AS failed,
           SUM(CASE WHEN status IN ('pending', 'sending') OR (status = 'failed' AND attempts < 5) THEN 1 ELSE 0 END) AS remaining
    FROM marketing_deliveries WHERE campaign_id = ?
  `).bind(campaignId).first()
  const remaining = Number(counts?.remaining || 0)
  await env.DB.prepare(`
    UPDATE marketing_campaigns
    SET sent_count = ?, failed_count = ?,
        status = CASE WHEN ? = 0 THEN 'completed' ELSE 'sending' END,
        completed_at = CASE WHEN ? = 0 THEN ? ELSE completed_at END
    WHERE id = ?
  `).bind(Number(counts?.sent || 0), Number(counts?.failed || 0), remaining, remaining, nowIso(), campaignId).run()
}

async function processMarketingQueue(env, limit = 20) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const now = nowIso()
  const rows = await env.DB.prepare(`
    SELECT * FROM marketing_deliveries
    WHERE (status = 'pending' OR (status = 'failed' AND attempts < 5) OR (status = 'sending' AND updated_at <= ?))
      AND (next_eligible_at = '' OR next_eligible_at <= ?)
    ORDER BY created_at ASC LIMIT ?
  `).bind(staleBefore, now, limit).all()

  for (const row of rows.results || []) {
    const claimedAt = nowIso()
    const claimed = await env.DB.prepare(`
      UPDATE marketing_deliveries
      SET status = 'sending', attempts = attempts + 1, last_error = NULL, updated_at = ?
      WHERE id = ? AND attempts < 5
        AND (status = 'pending' OR status = 'failed' OR (status = 'sending' AND updated_at <= ?))
      RETURNING *
    `).bind(claimedAt, row.id, staleBefore).first()
    if (!claimed) continue
    try {
      await sendBrevo(env, {
        to: claimed.recipient_email,
        from: env.EMAIL_FROM_INFO,
        fromName: 'Runway Systems',
        subject: claimed.subject,
        html: claimed.html,
        idempotencyKey: claimed.dedupe_key,
        headers: claimed.unsubscribe_url ? {
          'List-Unsubscribe': `<${claimed.unsubscribe_url}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        } : {},
      })
      const sentAt = nowIso()
      await env.DB.prepare(`
        UPDATE marketing_deliveries
        SET status = 'sent', sent_at = ?, updated_at = ?, next_eligible_at = '', last_error = NULL
        WHERE id = ? AND status = 'sending'
      `).bind(sentAt, sentAt, claimed.id).run()
      if (claimed.waitlist_id) {
        await env.DB.prepare('UPDATE product_waitlist SET notified_at = ? WHERE id = ?').bind(sentAt, claimed.waitlist_id).run()
      }
    } catch (error) {
      const retrySeconds = Math.max(60, Number(error.retryAfterSeconds) || 60 * Math.max(1, claimed.attempts))
      const next = new Date(Date.now() + retrySeconds * 1000).toISOString()
      await env.DB.prepare(`
        UPDATE marketing_deliveries
        SET status = 'failed', last_error = ?, next_eligible_at = ?, updated_at = ?
        WHERE id = ? AND status = 'sending'
      `).bind(redactPii(error?.message), next, nowIso(), claimed.id).run()
    }
    await refreshCampaignDeliveryStatus(env, claimed.campaign_id)
  }
}

async function processEmailQueues(env) {
  // Short-circuit when Brevo's daily cap has been hit and the cooldown
  // recorded on a previous failed send is still in force. Saves burning
  // 5 attempts per row across a backlog during a free-tier reset.
  if (env.DB) {
    const quota = await env.DB.prepare('SELECT exhausted_at, retry_after_seconds FROM brevo_quota WHERE id = 1').first().catch(() => null)
    if (quota?.exhausted_at) {
      const elapsed = (Date.now() - new Date(quota.exhausted_at).getTime()) / 1000
      if (elapsed < Number(quota.retry_after_seconds || 0)) {
        const wait = Math.ceil(Number(quota.retry_after_seconds) - elapsed)
        console.warn('Brevo quota cooldown active, skipping email tick', { retryInSeconds: wait })
        await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(nowIso()).run()
        return
      }
    }
  }

  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const now = nowIso()
  const pendingComplimentaryInvitations = await env.DB.prepare(`
    SELECT id FROM complimentary_grants
    WHERE status = 'pending' AND token_expires_at >= ?
      AND (email_status IN ('pending', 'failed') OR (email_status = 'sending' AND updated_at <= ?))
      AND email_attempts < 5
      AND (email_next_eligible_at = '' OR email_next_eligible_at <= ?)
    ORDER BY created_at ASC LIMIT 20
  `).bind(now, staleBefore, now).all()
  for (const grant of pendingComplimentaryInvitations.results || []) await deliverComplimentaryInvitation(env, grant.id)

  const pendingDeliveries = await env.DB.prepare(`
    SELECT * FROM purchases
    WHERE payment_status = 'paid' AND access_source = 'paid' AND access_status = 'active'
      AND (delivery_email_status IN ('pending', 'failed') OR (delivery_email_status = 'sending' AND updated_at <= ?))
      AND delivery_email_attempts < 5
      AND (delivery_email_next_eligible_at = '' OR delivery_email_next_eligible_at <= ?)
    ORDER BY created_at ASC LIMIT 20
  `).bind(staleBefore, now).all()
  for (const purchase of pendingDeliveries.results || []) await deliverPurchaseEmail(env, purchase)

  const settings = await getSettings(env)
  const dueReviews = await env.DB.prepare(`
    SELECT * FROM review_requests
    WHERE (status IN ('pending', 'failed') OR (status = 'sending' AND updated_at <= ?))
      AND attempts < 5 AND send_at <= ?
      AND (next_eligible_at = '' OR next_eligible_at <= ?)
    ORDER BY send_at ASC LIMIT 20
  `).bind(staleBefore, nowIso(), now).all()
  for (const request of dueReviews.results || []) {
    const claimedAt = nowIso()
    const feedbackExpiresAt = new Date(Date.now() + FEEDBACK_TOKEN_TTL_SECONDS * 1000).toISOString()
    const claimed = await env.DB.prepare(`
      UPDATE review_requests
      SET status = 'sending', attempts = attempts + 1, feedback_expires_at = COALESCE(feedback_expires_at, ?),
          last_error = NULL, updated_at = ?
      WHERE id = ? AND attempts < 5
        AND (status IN ('pending', 'failed') OR (status = 'sending' AND updated_at <= ?))
        AND (next_eligible_at = '' OR next_eligible_at <= ?)
        AND EXISTS (SELECT 1 FROM purchases WHERE purchases.id = review_requests.purchase_id AND purchases.payment_status = 'paid' AND purchases.access_status = 'active')
      RETURNING *
    `).bind(feedbackExpiresAt, claimedAt, request.id, staleBefore, claimedAt).first()
    if (!claimed) continue

    try {
      await sendReviewEmail(env, claimed, settings)
      await env.DB.prepare(`
        UPDATE review_requests
        SET status = 'sent', sent_at = ?, last_error = NULL, updated_at = ?, next_eligible_at = ''
        WHERE id = ? AND status = 'sending'
      `).bind(nowIso(), nowIso(), request.id).run()
    } catch (error) {
      const errorText = redactPii(String(error.message || error)).slice(0, 500)
      const cooldownSeconds = Math.max(60, Number(error.retryAfterSeconds) || 0)
      const cooldownIso = new Date(Date.now() + cooldownSeconds * 1000).toISOString()
      await env.DB.prepare(`
        UPDATE review_requests SET status = 'failed', last_error = ?, updated_at = ?, next_eligible_at = ?
        WHERE id = ? AND status = 'sending'
      `).bind(errorText, cooldownIso, cooldownIso, request.id).run()
      console.error('Review email failed', request.id, redactPii(error?.message))
      if (Number(claimed.attempts) >= 5) {
        console.error('Review email permanently failed after max attempts', {
          reviewRequestId: request.id,
          purchaseId: claimed.purchase_id,
          attempts: claimed.attempts,
          lastError: redactPii(errorText),
          isQuota: Boolean(error.isQuota),
        })
      }
    }
  }

  await processMarketingQueue(env)
  const expiredAt = nowIso()
  const expiringComplimentary = await env.DB.prepare(`
    SELECT DISTINCT recipient_email FROM complimentary_grants
    WHERE status = 'pending' AND token_expires_at < ?
  `).bind(expiredAt).all()
  await env.DB.prepare(`
    UPDATE complimentary_grants
    SET status = 'expired', token_hash = NULL, token_ciphertext = NULL,
        email_status = CASE WHEN email_status = 'sent' THEN 'sent' ELSE 'cancelled' END,
        email_next_eligible_at = '', updated_at = ?
    WHERE status = 'pending' AND token_expires_at < ?
  `).bind(expiredAt, expiredAt).run()
  for (const row of expiringComplimentary.results || []) {
    await refreshComplimentaryAudienceForEmail(env, row.recipient_email)
  }
  await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(expiredAt).run()
  await env.DB.prepare('DELETE FROM marketing_unsubscribe_tokens WHERE expires_at < ?').bind(nowIso()).run()
  await env.DB.prepare('DELETE FROM waitlist_action_tokens WHERE expires_at < ?').bind(nowIso()).run()
}

function parseCheckoutProductKeys(custom) {
  const raw = custom?.product_keys ?? custom?.product_key ?? ''
  if (Array.isArray(raw)) return raw.map((value) => String(value || '').trim()).filter(Boolean)
  return String(raw || '').split(',').map((value) => value.trim()).filter(Boolean)
}

function customDataFromLemonEvent(event, attributes) {
  // Official webhooks put custom checkout data on meta.custom_data. Older
  // fixtures and some order payloads also echo it on attributes.custom.
  const fromMeta = event?.meta?.custom_data
  const fromAttributes = attributes?.custom
  return (fromMeta && typeof fromMeta === 'object' && !Array.isArray(fromMeta))
    ? fromMeta
    : (fromAttributes && typeof fromAttributes === 'object' ? fromAttributes : {})
}

async function recordLemonOrder(env, data, eventKey, eventName, event = null) {
  const attributes = data?.attributes || {}
  const status = String(attributes.status || '').toLowerCase()
  if (status !== 'paid') {
    // Orders can arrive before payment completes; entitlements are created
    // only for paid orders. Non-paid events are recorded as processed.
    await env.DB.prepare('INSERT OR IGNORE INTO processed_webhooks (event_id, event_type, processed_at) VALUES (?, ?, ?)').bind(eventKey, eventName, nowIso()).run()
    return []
  }
  const identifier = String(attributes.identifier || data.id || '').trim()
  const email = String(attributes.user_email || '').trim().toLowerCase()
  const custom = customDataFromLemonEvent(event, attributes)
  const userId = String(custom.user_id || '').trim()
  const keys = parseCheckoutProductKeys(custom)
  if (!identifier || !userId || !email) throw new HttpError(400, 'Lemon Squeezy order is missing account ownership metadata')
  const items = []
  for (const rawKey of keys.slice(0, 10)) {
    const productKey = String(rawKey).trim()
    if (!productKey) continue
    if (!(await isKnownProductKey(env, productKey))) throw new HttpError(400, 'Lemon Squeezy order is not for a known product')
    items.push(productKey)
  }
  if (!items.length) throw new HttpError(400, 'Lemon Squeezy order is missing product metadata')

  const totalAmount = Number(attributes.total ?? attributes.subtotal ?? 0)
  const fallbackBase = Math.floor(totalAmount / items.length)
  const createdAt = attributes.created_at ? new Date(attributes.created_at).toISOString() : nowIso()
  const updatedAt = nowIso()
  const reviewSendAt = new Date(new Date(createdAt).getTime() + REVIEW_DELAY_MS).toISOString()
  // Correlate consent exactly through our random consent id (included in
  // checkout custom data), with provider checkout id as a compatibility
  // fallback. Never attach an arbitrary "most recent" agreement to an order.
  const checkoutId = String(attributes.checkout_id || attributes.first_order_item?.checkout_id || '')
  const consentId = String(custom.consent_id || '').trim()
  const consentRow = consentId
    ? await env.DB.prepare('SELECT created_at, policy_version, checkout_id, customer_email, product_keys, bundle_key FROM checkout_consents WHERE id = ? AND user_id = ? LIMIT 1').bind(consentId, userId).first()
    : (checkoutId
        ? await env.DB.prepare('SELECT created_at, policy_version, checkout_id, customer_email, product_keys, bundle_key FROM checkout_consents WHERE checkout_id = ? AND user_id = ? LIMIT 1').bind(checkoutId, userId).first()
        : null)
  const consentAt = consentRow?.created_at || ''
  const consentPolicyVersion = consentRow?.policy_version || ''
  const resolvedCheckoutId = checkoutId || consentRow?.checkout_id || ''
  if (!consentRow) throw new HttpError(400, 'Order does not match an authenticated checkout session')
  if (consentRow.customer_email && String(consentRow.customer_email).trim().toLowerCase() !== email) {
    throw new HttpError(400, 'Order email does not match the checkout session')
  }
  if (checkoutId && consentRow.checkout_id && checkoutId !== String(consentRow.checkout_id)) {
    throw new HttpError(400, 'Order checkout identifier does not match')
  }
  const consentedKeys = parseStringList(consentRow.product_keys).sort()
  if (consentedKeys.join(',') !== [...items].sort().join(',')) {
    throw new HttpError(400, 'Order products do not match the authenticated checkout session')
  }

  let expectedSubtotal = 0
  const expectedCurrencies = new Set()
  for (const productKey of items) {
    const product = await resolveProductConfig(env, productKey)
    if (!Number.isInteger(product.priceCents) || product.priceCents <= 0) throw new HttpError(503, 'Authoritative product pricing is incomplete')
    expectedSubtotal += product.priceCents
    expectedCurrencies.add(product.currency)
  }
  if (consentRow.bundle_key) {
    const bundleRow = await env.DB.prepare('SELECT discount_percent FROM bundles WHERE key = ?').bind(consentRow.bundle_key).first()
    if (!bundleRow) throw new HttpError(400, 'Order bundle is no longer recognized')
    expectedSubtotal = Math.round(expectedSubtotal * (100 - Number(bundleRow.discount_percent || 0)) / 100)
  }
  const actualSubtotal = Number(attributes.subtotal ?? attributes.total ?? 0)
  const actualCurrency = String(attributes.currency || 'usd').toUpperCase()
  if (expectedCurrencies.size !== 1 || [...expectedCurrencies][0] !== actualCurrency || actualSubtotal !== expectedSubtotal) {
    throw new HttpError(400, 'Order amount or currency does not match authoritative checkout pricing')
  }

  const firstItem = attributes.first_order_item || {}
  const variantId = String(firstItem.variant_id || '')

  const statements = []
  for (let index = 0; index < items.length; index += 1) {
    const productKey = items[index]
    const amount = index === 0 ? totalAmount - fallbackBase * (items.length - 1) : fallbackBase
    const purchaseId = makeId('purchase')
    statements.push(env.DB.prepare(`
      INSERT INTO purchases (
        id, order_identifier, user_id, customer_email, customer_name,
        variant_id, amount_total, currency, payment_status, product_key,
        delivery_email_status, delivery_email_attempts, created_at, updated_at,
        consent_at, consent_policy_version, delivery_email_next_eligible_at, checkout_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
        CASE WHEN EXISTS (SELECT 1 FROM revoked_orders WHERE order_identifier = ?) THEN 'refunded' ELSE 'paid' END,
        ?, 'pending', 0, ?, ?, ?, ?, '', ?)
      ON CONFLICT(order_identifier, product_key) DO UPDATE SET
        user_id = excluded.user_id,
        customer_email = excluded.customer_email,
        customer_name = excluded.customer_name,
        variant_id = excluded.variant_id,
        amount_total = excluded.amount_total,
        currency = excluded.currency,
        checkout_id = CASE WHEN excluded.checkout_id != '' THEN excluded.checkout_id ELSE purchases.checkout_id END,
        payment_status = CASE
          WHEN purchases.payment_status = 'refunded'
            OR EXISTS (SELECT 1 FROM revoked_orders WHERE order_identifier = excluded.order_identifier)
          THEN 'refunded' ELSE 'paid'
        END,
        updated_at = excluded.updated_at
    `).bind(
      purchaseId,
      identifier,
      userId,
      email,
      String(attributes.user_name || ''),
      variantId,
      amount,
      String(attributes.currency || 'usd').toLowerCase(),
      identifier,
      productKey,
      createdAt,
      updatedAt,
      consentAt,
      consentPolicyVersion,
      resolvedCheckoutId,
    ))
    statements.push(env.DB.prepare(`
      INSERT INTO review_requests (
        id, purchase_id, user_id, email, customer_name, send_at, status, attempts, created_at, updated_at, next_eligible_at
      )
      SELECT ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ''
      WHERE EXISTS (SELECT 1 FROM purchases WHERE id = ? AND payment_status = 'paid' AND access_status = 'active')
      ON CONFLICT(purchase_id) DO NOTHING
    `).bind(makeId('review_request'), purchaseId, userId, email, String(attributes.user_name || ''), reviewSendAt, updatedAt, updatedAt, purchaseId))
  }
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO processed_webhooks (event_id, event_type, processed_at) VALUES (?, ?, ?)').bind(eventKey, eventName, updatedAt))
  await env.DB.batch(statements)

  await recordAudienceContact(env, {
    email,
    userId,
    name: String(attributes.user_name || '').trim(),
    source: 'checkout',
    isCustomer: true,
    spendCents: totalAmount,
    productKeys: items,
    orderIncrement: 1,
  })

  const rows = []
  for (const productKey of items) {
    const row = await env.DB.prepare('SELECT * FROM purchases WHERE order_identifier = ? AND product_key = ?').bind(identifier, productKey).first()
    if (row) rows.push(row)
  }
  return rows
}

async function recordLemonRefund(env, data, eventKey, eventName) {
  const attributes = data?.attributes || {}
  const identifier = String(attributes.identifier || data.id || '').trim()
  const updatedAt = nowIso()
  if (!identifier) throw new HttpError(400, 'Lemon Squeezy refund is missing the order identifier')
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO revoked_orders (order_identifier, refunded_at) VALUES (?, ?)').bind(identifier, updatedAt),
    env.DB.prepare('UPDATE purchases SET payment_status = ?, access_status = ?, updated_at = ? WHERE order_identifier = ? AND access_source = ?').bind('refunded', 'revoked', updatedAt, identifier, 'paid'),
    env.DB.prepare(`
      UPDATE review_requests SET status = 'cancelled', updated_at = ?
      WHERE purchase_id IN (SELECT id FROM purchases WHERE order_identifier = ?) AND status != 'sent'
    `).bind(updatedAt, identifier),
    env.DB.prepare('INSERT OR IGNORE INTO processed_webhooks (event_id, event_type, processed_at) VALUES (?, ?, ?)').bind(eventKey, eventName, updatedAt),
  ])
}

async function handleLemonSqueezyWebhook(request, env, ctx) {
  if (!env.LEMONSQUEEZY_WEBHOOK_SECRET) throw new HttpError(503, 'Lemon Squeezy webhook verification is not configured')
  const rawBody = await readBodyTextBounded(request, JSON_BODY_MAX_LENGTH, 'Webhook')
  const signature = String(request.headers.get('X-Signature') || '').toLowerCase()
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) throw new HttpError(400, 'Invalid Lemon Squeezy signature')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.LEMONSQUEEZY_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  // Compare the raw byte arrays instead of their hex strings. Hex-string
  // comparison leaks through differences in length and per-byte CPU cost;
  // comparing the 32 raw bytes leaks far less. An attacker who can time
  // individual Worker invocations to microsecond precision still has a
  // hard problem, but this is the standard recommendation.
  const expectedBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))
  const suppliedBytes = new Uint8Array(32)
  for (let i = 0; i < 32; i += 1) suppliedBytes[i] = parseInt(signature.slice(i * 2, i * 2 + 2), 16)
  if (!constantTimeEqualBytes(suppliedBytes, expectedBytes)) throw new HttpError(400, 'Invalid Lemon Squeezy signature')

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    throw new HttpError(400, 'Invalid webhook JSON')
  }
  const eventName = String(event?.meta?.event_name || '')
  if (!eventName || !event?.data || event?.data?.type !== 'orders') throw new HttpError(400, 'Invalid Lemon Squeezy event')
  const eventKey = `ls:${eventName}:${event?.data?.attributes?.identifier || event?.data?.id || 'unknown'}`
  const processed = await env.DB.prepare('SELECT event_id FROM processed_webhooks WHERE event_id = ?').bind(eventKey).first()
  if (processed) return json(request, env, { received: true, duplicate: true })

  if (eventName === 'order_created') {
    // Re-verify the custom.user_id against Supabase before honouring the
    // webhook. The custom field is set by us during checkout, but a
    // belt-and-suspenders check stops a forged webhook from granting a
    // purchase to a user id that was never authenticated. This check
    // requires SUPABASE_SERVICE_ROLE_KEY (a server-side admin key).
    // When the key is absent, we log a warning and continue; the
    // HMAC verification above is the primary defence.
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const expectedUserId = String(customDataFromLemonEvent(event, event?.data?.attributes)?.user_id || '').trim()
      const expectedEmail = String(event?.data?.attributes?.user_email || '').trim().toLowerCase()
      if (expectedUserId) {
        try {
          const lookup = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(expectedUserId)}`, {
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            signal: AbortSignal.timeout(4000),
          })
          if (!lookup.ok) {
            logEvent('warn', 'webhook_user_lookup_failed', { status: lookup.status, userId: expectedUserId })
            throw new HttpError(400, 'Supabase rejected the custom user id')
          }
          const u = await lookup.json().catch(() => ({}))
          const userEmail = String(u?.email || '').trim().toLowerCase()
          if (userEmail && expectedEmail && userEmail !== expectedEmail) {
            logEvent('warn', 'webhook_email_mismatch', { userId: expectedUserId })
            throw new HttpError(400, 'Webhook ownership metadata does not match Supabase user')
          }
        } catch (error) {
          if (error instanceof HttpError) throw error
          logEvent('warn', 'webhook_user_lookup_error', { error: error?.message })
          throw new HttpError(503, 'Account ownership verification is temporarily unavailable')
        }
      }
    } else {
      throw new HttpError(503, 'Webhook account ownership verification is not configured')
    }
    const purchases = await recordLemonOrder(env, event.data, eventKey, eventName, event)
    for (const purchase of purchases) {
      if (purchase.payment_status === 'paid') ctx.waitUntil(deliverPurchaseEmail(env, purchase))
    }
  } else if (eventName === 'order_refunded') {
    await recordLemonRefund(env, event.data, eventKey, eventName)
  } else {
    await env.DB.prepare('INSERT OR IGNORE INTO processed_webhooks (event_id, event_type, processed_at) VALUES (?, ?, ?)').bind(eventKey, eventName, nowIso()).run()
  }
  return json(request, env, { received: true })
}

async function getAccountPurchases(env, user) {
  if (user?.email) {
    await recordAudienceContact(env, {
      email: user.email,
      userId: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      source: 'google_signin',
    })
  }
  const result = await env.DB.prepare(`
    SELECT * FROM purchases
    WHERE user_id = ? AND payment_status = 'paid' AND access_status = 'active'
    ORDER BY created_at DESC
  `).bind(user.id).all()
  const productInfo = await productInfoMap(env)
  return (result.results || []).map((row) => purchaseFromRow(row, productInfo))
}

// Account deletion: remove or anonymize every piece of personal data this
// platform holds for a user. Aggregate metrics (sales counts, revenue,
// ratings) are preserved, but all identifiers and free text are wiped.
async function deleteAccountData(env, user) {
  const updatedAt = nowIso()

  // Invalidate unclaimed invitations and anonymize claimed grant provenance.
  // Grant/item rows may remain for aggregate operational accounting, but no
  // reusable token, recipient email, or Supabase identifier survives.
  await env.DB.prepare(`
    UPDATE complimentary_grant_items
    SET item_status = CASE WHEN item_status = 'granted' THEN 'revoked' ELSE item_status END
    WHERE grant_id IN (
      SELECT id FROM complimentary_grants WHERE recipient_email = ? OR claimed_by_user_id = ?
    )
  `).bind(user.email || '', user.id).run()
  await env.DB.prepare(`
    UPDATE complimentary_grants
    SET recipient_email = 'deleted:' || id,
        recipient_email_hash = '',
        status = CASE WHEN status = 'pending' THEN 'cancelled' WHEN status = 'claimed' THEN 'revoked' ELSE status END,
        revoked_at = CASE WHEN status = 'claimed' THEN ? ELSE revoked_at END,
        token_hash = NULL,
        token_ciphertext = NULL,
        claimed_by_user_id = CASE WHEN claimed_by_user_id = ? THEN 'deleted:' || id ELSE claimed_by_user_id END,
        email_status = CASE WHEN email_status = 'sent' THEN 'sent' ELSE 'cancelled' END,
        email_next_eligible_at = '',
        updated_at = ?
    WHERE recipient_email = ? OR claimed_by_user_id = ?
  `).bind(updatedAt, user.id, updatedAt, user.email || '', user.id).run()
  await env.DB.prepare(`
    UPDATE complimentary_grants
    SET created_by_user_id = 'deleted:' || id, updated_at = ?
    WHERE created_by_user_id = ?
  `).bind(updatedAt, user.id).run()
  await env.DB.prepare("UPDATE blog_posts SET created_by_user_id = 'deleted:' || id WHERE created_by_user_id = ?").bind(user.id).run()
  await env.DB.prepare("UPDATE blog_media SET created_by_user_id = 'deleted:' || id WHERE created_by_user_id = ?").bind(user.id).run()
  await env.DB.prepare("UPDATE blog_post_revisions SET created_by_user_id = 'deleted:' || id WHERE created_by_user_id = ?").bind(user.id).run()
  await env.DB.prepare("UPDATE blog_slug_redirects SET created_by_user_id = 'deleted:' || post_id WHERE created_by_user_id = ?").bind(user.id).run()

  // Purchases: detach ownership and clear email and name. Order
  // identifiers stay for refund revocation, and amount/currency stay for
  // aggregate reporting.
  const purchasesResult = await env.DB.prepare(`
    UPDATE purchases
    SET user_id = 'deleted:' || id,
        customer_email = '',
        customer_name = '',
        access_status = CASE WHEN access_source = 'complimentary' THEN 'revoked' ELSE access_status END,
        delivery_email_status = CASE WHEN delivery_email_status = 'sent' THEN 'sent' ELSE 'failed' END,
        delivery_email_attempts = CASE WHEN delivery_email_status = 'sent' THEN delivery_email_attempts ELSE 5 END,
        delivery_email_last_error = CASE WHEN delivery_email_status = 'sent' THEN delivery_email_last_error ELSE 'Account deleted' END,
        delivery_email_next_eligible_at = '',
        updated_at = ?
    WHERE user_id = ?
  `).bind(updatedAt, user.id).run()

  // Review requests hold delivery email addresses: delete outright.
  await env.DB.prepare('DELETE FROM review_requests WHERE user_id = ? OR email = ?').bind(user.id, user.email || '').run()

  // A deletion request also suppresses optional marketing so a future login
  // cannot silently recreate a subscribed contact.
  if (user.email) await suppressMarketingEmail(env, user.email, 'account_deletion')
  await env.DB.prepare('DELETE FROM audience_contacts WHERE user_id = ? OR email = ?').bind(user.id, user.email || '').run()
  await env.DB.prepare('DELETE FROM marketing_unsubscribe_tokens WHERE email = ?').bind(user.email || '').run()
  await env.DB.prepare('DELETE FROM newsletter_confirmations WHERE email = ?').bind(user.email || '').run()
  await env.DB.prepare(`
    UPDATE marketing_deliveries
    SET recipient_email = 'deleted:' || id,
        unsubscribe_url = '',
        status = CASE WHEN status = 'sent' THEN 'sent' ELSE 'failed' END,
        attempts = CASE WHEN status = 'sent' THEN attempts ELSE 5 END,
        last_error = CASE WHEN status = 'sent' THEN last_error ELSE 'Account deleted' END,
        next_eligible_at = '',
        updated_at = ?
    WHERE recipient_email = ?
  `).bind(updatedAt, user.email || '').run()

  // Remove waitlist records outright; otherwise a deleted account could still
  // receive a later product-launch email.
  await env.DB.prepare(`
    DELETE FROM waitlist_action_tokens
    WHERE waitlist_id IN (SELECT id FROM product_waitlist WHERE user_id = ? OR email = ?)
  `).bind(user.id, user.email || '').run()
  await env.DB.prepare('DELETE FROM product_waitlist WHERE user_id = ? OR email = ?').bind(user.id, user.email || '').run()

  // Keep the fact/version of purchase consent where legally necessary, but
  // remove both direct identifiers and replace the user id with a row-local
  // non-correlatable marker.
  await env.DB.prepare(`
    UPDATE checkout_consents
    SET user_id = 'deleted:' || id, customer_email = ''
    WHERE user_id = ? OR customer_email = ?
  `).bind(user.id, user.email || '').run()

  // Testimonials: withdraw from public display, clear content, and remove the
  // reusable account identifier while preserving an anonymous aggregate row.
  await env.DB.prepare(`
    UPDATE testimonials
    SET user_id = 'deleted:' || id, name = '', text = '', status = 'rejected', moderated_at = ?
    WHERE user_id = ?
  `).bind(updatedAt, user.id).run()

  // Feedback keeps only the numeric rating for aggregate statistics.
  await env.DB.prepare(`
    UPDATE feedback SET user_id = 'deleted:' || id, text = '' WHERE user_id = ?
  `).bind(user.id).run()

  // Scrub references to this user from mutations performed by somebody else,
  // then remove rows where the deleted user was the actor. Audit `details` is
  // free-form JSON, so keeping those actor rows would not be anonymization.
  await env.DB.prepare(`
    UPDATE admin_audit_log
    SET details = replace(replace(details, ?, '[deleted]'), ?, '[deleted]'),
        entity_id = CASE WHEN entity_id = ? OR entity_id = ? THEN '[deleted]' ELSE entity_id END
    WHERE instr(details, ?) > 0 OR instr(details, ?) > 0 OR entity_id = ? OR entity_id = ?
  `).bind(user.email || '', user.id, user.id, user.email || '', user.email || '', user.id, user.id, user.email || '').run()
  await env.DB.prepare('DELETE FROM admin_audit_log WHERE subject_id = ? OR subject_email = ?').bind(user.id, user.email || '').run()

  await invalidatePublicCaches()

  // Remove the authentication identity as the final step. D1 cleanup is
  // already durable if the provider is temporarily unavailable; returning an
  // error lets the signed-in user retry while their current session remains.
  const authBase = String(env.SUPABASE_URL || '').replace(/\/$/, '')
  let identityResponse
  try {
    identityResponse = await fetch(`${authBase}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new HttpError(503, 'Storefront data was removed, but authentication deletion must be retried')
  }
  if (!identityResponse.ok && identityResponse.status !== 404) {
    throw new HttpError(502, 'Storefront data was removed, but authentication deletion must be retried')
  }
  return { deleted: true, identityDeleted: true, purchasesDetached: Number(purchasesResult.meta?.changes || 0) }
}

async function getApprovedTestimonials(env) {
  const result = await env.DB.prepare(`
    SELECT id, name, rating, text, created_at AS createdAt
    FROM testimonials WHERE status = 'approved'
    ORDER BY created_at DESC LIMIT 12
  `).all()
  return result.results || []
}

async function submitTestimonial(request, env, user, body) {
  await rateLimit(request, env, 'testimonial', 4, 3600, user.id)
  const purchase = await feedbackPurchaseForUser(env, cleanText(body.feedbackToken, 2000, 'Feedback token'), user.id)
  const item = {
    id: makeId('testimonial'),
    name: cleanText(body.name, 80, 'Name'),
    rating: cleanRating(body.rating),
    text: cleanText(body.text, 1800, 'Testimonial'),
    status: 'pending',
    createdAt: nowIso(),
  }
  await env.DB.prepare(`
    INSERT INTO testimonials (id, user_id, purchase_id, name, rating, text, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(item.id, user.id, purchase.id, item.name, item.rating, item.text, item.createdAt).run()
  return item
}

async function submitFeedback(request, env, user, body) {
  await rateLimit(request, env, 'feedback', 12, 3600, user.id)
  const purchase = await feedbackPurchaseForUser(env, cleanText(body.feedbackToken, 2000, 'Feedback token'), user.id)
  const item = {
    id: makeId('feedback'),
    rating: cleanRating(body.rating),
    text: cleanText(body.text, 2500, 'Feedback', { required: false }),
    kind: body.kind === 'private' ? 'private' : 'rating',
    createdAt: nowIso(),
  }
  await env.DB.prepare(`
    INSERT INTO feedback (id, user_id, purchase_id, rating, text, kind, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(item.id, user.id, purchase.id, item.rating, item.text, item.kind, item.createdAt).run()
  return item
}

function monthBuckets(count = 8) {
  const months = []
  const today = new Date()
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1))
    months.push({
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    })
  }
  return months
}

async function getAnalytics(env) {
  const [sales, views, reviews, revenueByMonth, viewsByMonth, complimentary] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(amount_total), 0) AS revenue FROM purchases WHERE payment_status = 'paid' AND access_source = 'paid' AND access_status = 'active'`).first(),
    env.DB.prepare('SELECT COALESCE(SUM(page_views), 0) AS total FROM daily_metrics').first(),
    env.DB.prepare(`
      SELECT COUNT(DISTINCT CASE WHEN p.access_source = 'paid' THEN f.purchase_id END) AS total,
             COALESCE(AVG(f.rating), 0) AS average
      FROM feedback f JOIN purchases p ON p.id = f.purchase_id
      WHERE p.access_status = 'active'
    `).first(),

    env.DB.prepare(`
      SELECT substr(created_at, 1, 7) AS month, COALESCE(SUM(amount_total), 0) AS revenue, COUNT(*) AS sales
      FROM purchases WHERE payment_status = 'paid' AND access_source = 'paid' AND access_status = 'active' GROUP BY month
    `).all(),
    env.DB.prepare(`
      SELECT substr(date, 1, 7) AS month, COALESCE(SUM(page_views), 0) AS views
      FROM daily_metrics GROUP BY month
    `).all(),
    env.DB.prepare(`
      SELECT COUNT(DISTINCT recipient_email) AS total,
             COUNT(DISTINCT CASE WHEN status = 'claimed' THEN recipient_email END) AS claimed,
             COUNT(DISTINCT CASE WHEN status = 'pending' THEN recipient_email END) AS pending
      FROM complimentary_grants WHERE status IN ('pending', 'claimed')
    `).first(),
  ])
  const totalSales = Number(sales?.total || 0)
  const pageViews = Number(views?.total || 0)
  const submittedReviews = Number(reviews?.total || 0)
  const revenueMap = new Map((revenueByMonth.results || []).map((row) => [row.month, row]))
  const viewsMap = new Map((viewsByMonth.results || []).map((row) => [row.month, row]))
  const buckets = monthBuckets()
  return {
    totalSales,
    revenue: Number(sales?.revenue || 0) / 100,
    complimentaryCustomers: Number(complimentary?.total || 0),
    complimentaryClaimed: Number(complimentary?.claimed || 0),
    complimentaryPending: Number(complimentary?.pending || 0),
    conversionRate: pageViews ? Number(((totalSales / pageViews) * 100).toFixed(1)) : 0,
    pageViews,
    averageRating: Number(Number(reviews?.average || 0).toFixed(1)),
    reviewSubmissionRate: totalSales ? Number(((submittedReviews / totalSales) * 100).toFixed(1)) : 0,
    revenueSeries: buckets.map(({ key }) => Number(revenueMap.get(key)?.revenue || 0) / 100),
    conversionSeries: buckets.map(({ key }) => {
      const monthlySales = Number(revenueMap.get(key)?.sales || 0)
      const monthlyViews = Number(viewsMap.get(key)?.views || 0)
      return monthlyViews ? Number(((monthlySales / monthlyViews) * 100).toFixed(1)) : 0
    }),
    labels: buckets.map(({ label }) => label),
  }
}

async function trackPageView(request, env) {
  await rateLimit(request, env, 'page-view', 120, 3600)
  const body = await readJson(request)
  const path = cleanText(body.path, 160, 'Path')
  if (!path.startsWith('/')) throw new HttpError(400, 'Invalid page path')
  const date = nowIso().slice(0, 10)
  await env.DB.prepare(`
    INSERT INTO daily_metrics (date, page_views, checkout_starts)
    VALUES (?, 1, 0)
    ON CONFLICT(date) DO UPDATE SET page_views = page_views + 1
  `).bind(date).run()
}

// ---------------------------------------------------------------------------
// Client-side error telemetry (Layer 12). The storefront reports render
// crashes and unhandled script errors here so a failure a visitor hits is
// visible to the owner in the dashboard and in structured logs, instead of
// dying silently in one browser console. Payloads are strictly capped,
// PII-redacted before storage, rate-limited per IP, and retained 30 days
// (pruned by the cron tick). The source IP is only kept as a salted hash.
const CLIENT_ERROR_KINDS = new Set(['render', 'error', 'unhandledrejection'])
const CLIENT_ERROR_RETENTION_DAYS = 30
const ADMIN_AUDIT_RETENTION_DAYS = 365

async function handleClientErrorEvent(request, env) {
  await rateLimit(request, env, 'client-error', 30, 3600)
  const body = await readJson(request)
  // cleanText rejects anything over the cap outright: telemetry endpoints
  // must not become a free D1 write amplification channel.
  const message = cleanText(body.message, 500, 'Error message')
  const kind = CLIENT_ERROR_KINDS.has(String(body.kind || '')) ? String(body.kind) : 'error'
  const stack = cleanText(body.stack || '', 4000, 'Stack', { required: false })
  const pageUrl = cleanText(body.url || '', 300, 'Page URL', { required: false })
  if (pageUrl && !pageUrl.startsWith('/') && !/^https?:\/\//i.test(pageUrl)) {
    throw new HttpError(400, 'Invalid page URL')
  }
  const ip = request.headers.get('CF-Connecting-IP') || ''
  const ipHash = ip && env.RATE_LIMIT_SALT ? await sha256Hex(`${env.RATE_LIMIT_SALT}:${ip}`) : ''
  const row = {
    id: makeId('cerr'),
    kind,
    message: redactPii(message),
    stack: redactPii(stack),
    url: redactPii(pageUrl),
    userAgent: String(request.headers.get('User-Agent') || '').slice(0, 300),
    ipHash,
  }
  // A failed telemetry write must not surface as an error to the visitor's
  // browser (which would generate more telemetry); log and accept anyway.
  try {
    await env.DB.prepare(`
      INSERT INTO client_errors (id, kind, message, stack, url, user_agent, ip_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(row.id, row.kind, row.message, row.stack, row.url, row.userAgent, row.ipHash, nowIso()).run()
  } catch (error) {
    logEvent('warn', 'client_error_store_failed', { error: error?.message })
  }
  logEvent('error', 'client_error', { id: row.id, kind: row.kind, message: row.message, url: row.url })
}

async function getIntegrationStatus(env) {
  const aiMode = env.AI ? 'binding' : (env.AI_ACCOUNT_ID && env.AI_API_TOKEN ? 'rest' : '')
  return [
    { id: 'lemonsqueezy', label: 'Lemon Squeezy', status: env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_WEBHOOK_SECRET ? 'connected' : 'setup', detail: 'Merchant of record: Lemon Squeezy handles global sales tax and remittance for your orders' },
    { id: 'supabase', label: 'Supabase', status: env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? 'connected' : 'setup', detail: 'Google OAuth and account verification' },
    { id: 'email', label: 'Brevo', status: env.BREVO_API_KEY && env.EMAIL_FROM_DELIVERY && env.EMAIL_FROM_INFO ? 'connected' : 'setup', detail: 'Delivery and neutral review invitations' },
    { id: 'trustpilot', label: 'Trustpilot', status: env.TRUSTPILOT_REVIEW_URL ? 'connected' : 'setup', detail: 'Neutral review invitation for every verified buyer (no on-site widget)' },
    { id: 'ai', label: 'AI image scanning', status: aiMode ? 'connected' : 'setup', detail: aiMode === 'binding' ? 'Workers AI binding analyzes uploaded screenshots and writes feature copy' : aiMode === 'rest' ? 'Workers AI REST access writes feature headings and subheadings' : 'Add the AI binding or AI_ACCOUNT_ID and AI_API_TOKEN for auto-written feature copy' },
  ]
}

function routeMatch(pathname, pattern) {
  const match = pathname.match(pattern)
  return match || null
}

async function handleRequest(request, env, ctx) {
  if (!env.DB) throw new HttpError(503, 'D1 database is not configured')
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  let match = null

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...corsHeaders(request, env), ...SECURITY_HEADERS } })
  if (path === '/health' && request.method === 'GET') {
    const report = await readinessReport(env)
    return json(request, env, { ok: report.ready, service: 'cashflow-os-platform', ...report }, report.ready ? 200 : 503, { 'Cache-Control': 'no-store' })
  }
  if (path === '/webhooks/lemonsqueezy' && request.method === 'POST') return handleLemonSqueezyWebhook(request, env, ctx)

  if (path === '/config/public' && request.method === 'GET') {
    const bodyText = await getCachedPublic('config-public', 60, async () => {
      const settings = await getSettings(env)
      return JSON.stringify({
        products: await getActiveProducts(env),
        bundles: await bundlesForPublic(env),
        trustpilotBusinessUrl: settings.trustpilotBusinessUrl,
        trustpilotBusinessUnitId: settings.trustpilotBusinessUnitId || '',
        supportEmail: settings.supportEmail || '',
        infoEmail: env.EMAIL_FROM_INFO || '',
        suiteContent: settings.suiteContent || {},
        policies: settings.policies || {},
        announcement: { ...(settings.announcement || {}), active: Boolean(settings.announcement?.message && settings.announcement?.active) },
        paymentProvider: 'lemonsqueezy',
        reviewPolicy: 'neutral-all-verified-buyers',
      })
    })
    return json(request, env, JSON.parse(bodyText), 200, { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' })
  }
  if (path === '/blog/posts' && request.method === 'GET') {
    const result = await listPublicBlogPosts(env, {
      limit: url.searchParams.get('limit'), cursor: cleanText(url.searchParams.get('cursor') || '', 40, 'Cursor', { required: false }),
      category: cleanText(url.searchParams.get('category') || '', 80, 'Category', { required: false }),
      tag: cleanText(url.searchParams.get('tag') || '', 80, 'Tag', { required: false }),
      search: cleanText(url.searchParams.get('search') || '', 100, 'Search', { required: false }),
    })
    return json(request, env, result, 200, { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' })
  }
  if (path === '/blog/categories' && request.method === 'GET') {
    return json(request, env, { categories: await listBlogCategories(env) }, 200, { 'Cache-Control': 'public, max-age=300, s-maxage=900' })
  }
  if (path === '/blog/feed.xml' && request.method === 'GET') {
    const body = await getCachedPublic('blog-rss', 60, () => blogRssXml(env))
    return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', ...SECURITY_HEADERS, 'Cache-Control': 'public, max-age=60, s-maxage=300' } })
  }
  if ((path === '/llms.txt' || path === '/llms-full.txt') && request.method === 'GET') {
    const full = path === '/llms-full.txt'
    const body = await getCachedPublic(full ? 'blog-llms-full' : 'blog-llms', 60, () => blogLlmsText(env, { full }))
    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS, 'Cache-Control': 'public, max-age=60, s-maxage=300' } })
  }
  match = routeMatch(path, /^\/blog\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/)
  if (match && request.method === 'GET') {
    const result = await getPublicBlogPost(env, match[1])
    return json(request, env, result, 200, { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' })
  }
  match = routeMatch(path, /^\/blog-media\/([a-f0-9-]{36})\/([a-f0-9]{8}\.(?:png|jpe?g|webp))$/)
  if (match && request.method === 'GET') {
    if (!env.MEDIA) throw new HttpError(503, 'Media storage is not configured')
    const publicPath = `/blog-media/${match[1]}/${match[2]}`
    const media = await env.DB.prepare("SELECT * FROM blog_media WHERE id = ? AND public_path = ? AND status = 'ready' AND deleted_at IS NULL").bind(match[1], publicPath).first()
    if (!media) throw new HttpError(404, 'Media not found')
    const object = await env.MEDIA.get(media.r2_key)
    if (!object) throw new HttpError(404, 'Media not found')
    const headers = new Headers({ ...corsHeaders(request, env), ...SECURITY_HEADERS, 'Cache-Control': 'public, max-age=31536000, immutable' })
    object.writeHttpMetadata(headers)
    return new Response(object.body, { status: 200, headers })
  }
  if (path === '/sitemap.xml' && request.method === 'GET') {
    const xml = await getCachedPublic('sitemap', 60, async () => {
      const origin = getPrimaryOrigin(env)
      const [products, blogPosts] = await Promise.all([getActiveProducts(env), blogSitemapRows(env)])
      const escapeXml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
      const urls = [
        `<url><loc>${escapeXml(origin)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
        `<url><loc>${escapeXml(origin)}/terms</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>`,
        `<url><loc>${escapeXml(origin)}/blog</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
        ...products.map((product) => `<url><loc>${escapeXml(origin)}/products/${escapeXml(product.key)}</loc>${product.updatedAt ? `<lastmod>${escapeXml(product.updatedAt.slice(0, 10))}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>0.9</priority></url>`),
        ...blogPosts.map((post) => `<url><loc>${escapeXml(origin)}/blog/${escapeXml(post.slug)}</loc><lastmod>${escapeXml(post.updated_at.slice(0, 10))}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`),
      ]
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
    })
    return new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', ...SECURITY_HEADERS, 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' },
    })
  }
  if (path === '/events/page-view' && request.method === 'POST') {
    await trackPageView(request, env)
    return json(request, env, { accepted: true }, 202)
  }
  if (path === '/events/client-error' && request.method === 'POST') {
    await handleClientErrorEvent(request, env)
    return json(request, env, { accepted: true }, 202)
  }
  if (path === '/testimonials' && request.method === 'GET') {
    const bodyText = await getCachedPublic('testimonials', 60, async () => JSON.stringify(await getApprovedTestimonials(env)))
    return json(request, env, JSON.parse(bodyText), 200, { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' })
  }

  if (path === '/newsletter/subscribe' && request.method === 'POST') {
    const result = await requestNewsletterConfirmation(request, env, await readJson(request))
    return json(request, env, result, 202, { 'Cache-Control': 'no-store' })
  }
  if (path === '/newsletter/confirm' && request.method === 'POST') {
    const result = await confirmNewsletterSubscription(request, env, await readJson(request))
    return json(request, env, result, 200, { 'Cache-Control': 'no-store' })
  }

  if (path === '/waitlist/subscribe' && request.method === 'POST') {
    const body = await readJson(request)
    const productKey = cleanText(body.productKey, 60, 'Product key')
    const email = cleanText(body.email, 254, 'Email').toLowerCase().trim()
    if (!email || !email.includes('@') || !email.includes('.')) {
      throw new HttpError(400, 'Please enter a valid email address')
    }
    await rateLimit(request, env, 'waitlist', 15, 3600, email)

    await ensureProductsSeeded(env)
    const productRow = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(productKey).first()
    if (!productRow) throw new HttpError(404, 'Product not found')
    const product = productRowToConfig(productRow)
    if (product.status !== 'coming_soon') {
      throw new HttpError(400, 'This product is not currently accepting waitlist signups')
    }

    const user = await authenticate(request, env).catch(() => null)
    // Identity is derived only from a verified optional bearer token. Never
    // accept a client-supplied Supabase user id on a public endpoint.
    const userId = user?.id || ''
    const source = cleanText(body.source, 40, 'Source', { required: false }) || 'product_page'
    const marketingOptIn = body.marketingOptIn === true

    let existing = null
    try {
      existing = await env.DB.prepare('SELECT id, welcome_sent_at FROM product_waitlist WHERE product_key = ? AND email = ?').bind(productKey, email).first()
    } catch { /* if table not yet migrated in test fixture */ }

    const waitlistId = existing?.id || crypto.randomUUID()
    const createdAt = nowIso()

    if (!existing) {
      try {
        await env.DB.prepare(`
          INSERT INTO product_waitlist (id, product_key, email, user_id, source, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(waitlistId, productKey, email, userId, source, createdAt).run()
      } catch (err) {
        logEvent('warn', 'waitlist.insert_failed', { error: err.message, email })
      }

      // Dispatch welcome email via Brevo if enabled
      const waitlistConfig = product.waitlistConfig || {}
      if (waitlistConfig.welcomeEmailEnabled !== false && env.BREVO_API_KEY) {
        const subject = waitlistConfig.welcomeEmailSubject || `You're on the early-access list for ${product.name}`
        const intro = waitlistConfig.welcomeEmailBody || `Thank you for requesting early notification for ${product.name} on Runway Systems. We're finalizing this Google Sheets operating system and will email you the moment it goes live, along with your early-bird access.`
        const title = `Early access confirmed: ${product.name}`
        const actionLabel = 'Explore Runway Systems'
        const actionUrl = `${getPrimaryOrigin(env)}/products/${product.key}`
        const footer = `You received this email because you requested notification for ${product.name} on Runway Systems.\nFrom: ${env.EMAIL_FROM_INFO || 'info@runwaysystems.cloud'}`

        const html = emailLayout(title, intro, actionLabel, actionUrl, footer, null, 'RUNWAY SYSTEMS · EARLY ACCESS')
        try {
          await sendBrevo(env, {
            to: email,
            from: env.EMAIL_FROM_INFO || 'info@runwaysystems.cloud',
            fromName: 'Runway Systems',
            subject,
            html,
          })
          await env.DB.prepare('UPDATE product_waitlist SET welcome_sent_at = ? WHERE id = ?').bind(nowIso(), waitlistId).run()
        } catch (mailError) {
          logEvent('warn', 'waitlist.welcome_email_failed', { error: mailError.message, email })
        }
      }

    } else if (userId) {
      await env.DB.prepare("UPDATE product_waitlist SET user_id = ? WHERE id = ? AND user_id = ''").bind(userId, waitlistId).run()
    }

    await recordAudienceContact(env, {
      email,
      userId,
      name: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
      avatarUrl: user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '',
      source: 'waitlist',
      waitlistKey: productKey,
      marketingOptIn,
      marketingOptInSource: 'waitlist_checkbox',
    })

    let pollToken = ''
    if (product.waitlistConfig?.pollEnabled) {
      pollToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)))
      await env.DB.prepare(`
        INSERT INTO waitlist_action_tokens (token_hash, waitlist_id, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(token_hash) DO NOTHING
      `).bind(
        await sha256Hex(pollToken),
        waitlistId,
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ).run()
    }

    return json(request, env, {
      ok: true,
      message: "You're on the early access list! We will notify you when it launches.",
      poll: product.waitlistConfig?.pollEnabled ? {
        token: pollToken,
        question: product.waitlistConfig.pollQuestion || 'Which feature is most critical for your business?',
        options: Array.isArray(product.waitlistConfig.pollOptions) && product.waitlistConfig.pollOptions.length
          ? product.waitlistConfig.pollOptions
          : ['Automated dashboard summaries', 'Multi-currency support', 'Tax reserve forecasting', 'Client retainer tracking'],
      } : null,
    }, 200)
  }

  if (path === '/waitlist/poll-vote' && request.method === 'POST') {
    const body = await readJson(request)
    const productKey = cleanText(body.productKey, 60, 'Product key')
    const token = cleanText(body.token, 100, 'Poll token')
    const vote = cleanText(body.vote, 200, 'Poll vote')
    await rateLimit(request, env, 'waitlist-vote', 30, 3600, token)

    const action = await env.DB.prepare(`
      DELETE FROM waitlist_action_tokens
      WHERE token_hash = ? AND expires_at >= ?
      RETURNING waitlist_id
    `).bind(await sha256Hex(token), nowIso()).first()
    if (!action) throw new HttpError(401, 'This waitlist poll link is invalid or expired')
    const updated = await env.DB.prepare(`
      UPDATE product_waitlist SET poll_response = ?
      WHERE id = ? AND product_key = ?
      RETURNING id
    `).bind(vote, action.waitlist_id, productKey).first()
    if (!updated) throw new HttpError(404, 'Waitlist signup not found')

    return json(request, env, { ok: true, message: 'Thank you for your feedback!' }, 200)
  }

  if (path === '/account/sync' && request.method === 'POST') {
    const user = await authenticate(request, env).catch(() => null)
    if (user?.email) {
      await recordAudienceContact(env, {
        email: user.email,
        userId: user.id || '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
        source: 'google_signin',
      })
    }
    return json(request, env, { ok: true }, 200, { 'Cache-Control': 'no-store' })
  }

  if (path === '/unsubscribe' && request.method === 'GET') {
    const token = cleanText(url.searchParams.get('token') || '', 100, 'Token', { required: false })
    const valid = Boolean(token && await emailForUnsubscribeToken(env, token))
    const origin = getPrimaryOrigin(env)
    const title = valid ? 'Confirm unsubscribe' : 'Invalid unsubscribe link'
    const content = valid
      ? `<p>This removes you from optional Runway Systems marketing. Purchase delivery and security emails are unaffected.</p>
         <form method="post" action="/unsubscribe?token=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form>`
      : '<p>This link is invalid or expired. Contact support if you still receive optional marketing.</p>'
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title} · Runway Systems</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0a0c10;color:#f4f1e9;font:16px/1.6 Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:520px;background:#11141a;border:1px solid #2b3039;border-radius:16px;padding:36px;text-align:center}p{color:#a9afba}button,a{display:inline-block;border:0;border-radius:8px;padding:12px 22px;background:#c9a227;color:#0a0c10;font-weight:700;text-decoration:none;cursor:pointer}</style></head><body><main class="card"><small>RUNWAY SYSTEMS</small><h1>${title}</h1>${content}<p><a href="${escapeHtml(origin)}">Return to storefront</a></p></main></body></html>`
    return new Response(html, { headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } })
  }

  if (path === '/unsubscribe' && request.method === 'POST') {
    const token = cleanText(url.searchParams.get('token') || '', 100, 'Token')
    await rateLimit(request, env, 'unsubscribe', 30, 3600, token)
    await consumeUnsubscribeToken(env, token)
    const origin = getPrimaryOrigin(env)
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unsubscribed · Runway Systems</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0a0c10;color:#f4f1e9;font:16px/1.6 Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:520px;background:#11141a;border:1px solid #2b3039;border-radius:16px;padding:36px;text-align:center}p{color:#a9afba}a{display:inline-block;border-radius:8px;padding:12px 22px;background:#c9a227;color:#0a0c10;font-weight:700;text-decoration:none}</style></head><body><main class="card"><small>RUNWAY SYSTEMS</small><h1>Unsubscribed</h1><p>You have been removed from optional marketing. Purchase delivery and security emails are unaffected.</p><a href="${escapeHtml(origin)}">Return to storefront</a></main></body></html>`
    return new Response(html, { headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" } })
  }

  if (path === '/marketing/unsubscribe' && request.method === 'POST') {
    const body = await readJson(request)
    const token = cleanText(body.token, 100, 'Unsubscribe token')
    await rateLimit(request, env, 'unsubscribe', 30, 3600, token)
    await consumeUnsubscribeToken(env, token)
    return json(request, env, { ok: true, message: 'Unsubscribed successfully' }, 200)
  }

  if (path === '/checkout/session' && request.method === 'POST') {
    const user = await authenticate(request, env)
    return json(request, env, await createCheckoutSession(request, env, user), 201, { 'Cache-Control': 'no-store' })
  }
  let checkoutMatch = routeMatch(path, /^\/checkout\/session\/([^/]+)$/)
  if (checkoutMatch && request.method === 'GET') {
    const user = await authenticate(request, env)
    const checkoutId = decodeURIComponent(checkoutMatch[1])
    const consent = await env.DB.prepare('SELECT id FROM checkout_consents WHERE checkout_id = ? AND user_id = ? LIMIT 1').bind(checkoutId, user.id).first()
    if (!consent) throw new HttpError(404, 'Checkout session not found for this account')
    const result = await env.DB.prepare(`
      SELECT * FROM purchases
      WHERE checkout_id = ? AND user_id = ? AND payment_status = 'paid'
        AND access_source = 'paid' AND access_status = 'active'
      ORDER BY created_at ASC
    `).bind(checkoutId, user.id).all()
    const productInfo = await productInfoMap(env)
    const purchases = (result.results || []).map((row) => purchaseFromRow(row, productInfo))
    return json(request, env, { pending: purchases.length === 0, purchases }, 200, { 'Cache-Control': 'no-store' })
  }
  if (path === '/complimentary/claim' && request.method === 'POST') {
    const user = await authenticate(request, env)
    await rateLimit(request, env, 'complimentary-claim', 20, 3600, user.id)
    const body = await readJson(request)
    return json(request, env, await claimComplimentaryGrant(env, user, body.token), 200, { 'Cache-Control': 'no-store' })
  }
  if (path === '/account' && request.method === 'DELETE') {
    const user = await authenticate(request, env)
    await rateLimit(request, env, 'account-delete', 5, 3600, user.id)
    return json(request, env, await deleteAccountData(env, user), 200, { 'Cache-Control': 'no-store' })
  }
  if (path === '/account/purchases' && request.method === 'GET') {
    const user = await authenticate(request, env)
    return json(request, env, await getAccountPurchases(env, user), 200, { 'Cache-Control': 'no-store' })
  }
  match = routeMatch(path, /^\/account\/purchases\/([^/]+)\/delivery$/)
  if (match && request.method === 'POST') {
    const user = await authenticate(request, env)
    await rateLimit(request, env, 'delivery', 20, 3600, user.id)
    const purchase = await findPurchaseForUser(env, decodeURIComponent(match[1]), user.id)
    const product = await resolveProductConfig(env, purchase.product_key)
    return json(request, env, { url: productDeliveryUrl(env, product) }, 200, { 'Cache-Control': 'no-store' })
  }
  match = routeMatch(path, /^\/account\/purchases\/([^/]+)\/resend-delivery$/)
  if (match && request.method === 'POST') {
    const user = await authenticate(request, env)
    await rateLimit(request, env, 'delivery', 20, 3600, user.id)
    const purchaseId = decodeURIComponent(match[1])
    const purchase = await findPurchaseForUser(env, purchaseId, user.id)
    // Reset the attempt counter and any pending cooldown so the next cron
    // tick (or the eager send below) actually picks the row up. The buyer
    // shouldn't have to wait for the system to age out a failed row.
    const reset = await env.DB.prepare(`
      UPDATE purchases
      SET delivery_email_status = 'pending',
          delivery_email_attempts = 0,
          delivery_email_next_eligible_at = '',
          delivery_email_last_error = NULL,
          updated_at = ?
      WHERE id = ? AND user_id = ? AND payment_status = 'paid'
        AND access_source = 'paid' AND access_status = 'active'
      RETURNING *
    `).bind(nowIso(), purchase.id, user.id).first()
    if (!reset) throw new HttpError(404, 'Purchase not found for this account')
    ctx.waitUntil(deliverPurchaseEmail(env, reset))
    const productInfo = await productInfoMap(env)
    return json(request, env, { ...purchaseFromRow(reset, productInfo), resendQueued: true }, 200, { 'Cache-Control': 'no-store' })
  }
  match = routeMatch(path, /^\/account\/purchases\/([^/]+)\/feedback-link$/)
  if (match && request.method === 'POST') {
    const user = await authenticate(request, env)
    await rateLimit(request, env, 'feedback-link', 20, 3600, user.id)
    const purchase = await findPurchaseForUser(env, decodeURIComponent(match[1]), user.id)
    const token = await createFeedbackToken(env, purchase.id)
    return json(request, env, { url: `/feedback?token=${encodeURIComponent(token)}` }, 200, { 'Cache-Control': 'no-store' })
  }

  if (path === '/feedback/access' && request.method === 'GET') {
    const user = await authenticate(request, env)
    await rateLimit(request, env, 'feedback-access', 30, 3600, user.id)
    const purchase = await feedbackPurchaseForUser(env, cleanText(url.searchParams.get('token'), 2000, 'Feedback token'), user.id)
    return json(request, env, {
      purchaseId: purchase.id,
      productKey: purchase.product_key,
      productName: await productNameForPurchase(env, purchase.id),
      purchasedAt: purchase.created_at,
    }, 200, { 'Cache-Control': 'no-store' })
  }

  if (path === '/feedback' && request.method === 'POST') {
    const user = await authenticate(request, env)
    return json(request, env, await submitFeedback(request, env, user, await readJson(request)), 201, { 'Cache-Control': 'no-store' })
  }
  if (path === '/testimonials' && request.method === 'POST') {
    const user = await authenticate(request, env)
    return json(request, env, await submitTestimonial(request, env, user, await readJson(request)), 201, { 'Cache-Control': 'no-store' })
  }

  match = routeMatch(path, /^\/media\/([a-z0-9-]{1,60})\/([a-f0-9-]{8,64})\.webp$/)
  if (match && request.method === 'GET') {
    if (!env.MEDIA) throw new HttpError(503, 'Media storage is not configured')
    const objectKey = `product-media/${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}.webp`
    const object = await env.MEDIA.get(objectKey)
    if (!object) throw new HttpError(404, 'Media not found')
    const headers = new Headers({
      ...corsHeaders(request, env),
      ...SECURITY_HEADERS,
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
    object.writeHttpMetadata(headers)
    return new Response(object.body, { status: 200, headers })
  }

  if (path.startsWith('/admin/')) {
    const isMutation = request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS'
    const ownerUser = await requireOwner(request, env, { mutation: isMutation })

    if (path === '/admin/blog/categories' && request.method === 'GET') {
      return json(request, env, { categories: await listBlogCategories(env, { owner: true }) }, 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/blog/categories' && request.method === 'POST') {
      const body = await readJson(request)
      const name = cleanText(body.name, 60, 'Category name')
      const slug = normalizeBlogSlug(body.slug || name)
      if (!slug) throw new HttpError(400, 'Category slug is required')
      const at = nowIso()
      const id = crypto.randomUUID()
      await env.DB.prepare(`INSERT INTO blog_categories (id, slug, name, description, sort_order, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)`).bind(id, slug, name, cleanText(body.description || '', 240, 'Description', { required: false }), Number(body.sortOrder || 0), at, at).run()
      await writeAuditLog(env, request, ownerUser, 'blog.category_create', { entityType: 'blog_category', entityId: id, details: { slug, name } })
      return json(request, env, { categories: await listBlogCategories(env, { owner: true }) }, 201, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/blog\/categories\/([^/]+)$/)
    if (match && request.method === 'PATCH') {
      const body = await readJson(request)
      const id = decodeURIComponent(match[1])
      const existing = await env.DB.prepare('SELECT * FROM blog_categories WHERE id = ?').bind(id).first()
      if (!existing) throw new HttpError(404, 'Category not found')
      const name = cleanText(body.name ?? existing.name, 60, 'Category name')
      const slug = normalizeBlogSlug(body.slug ?? existing.slug)
      await env.DB.prepare('UPDATE blog_categories SET slug = ?, name = ?, description = ?, sort_order = ?, active = ?, updated_at = ? WHERE id = ?')
        .bind(slug, name, cleanText(body.description ?? existing.description, 240, 'Description', { required: false }), Number(body.sortOrder ?? existing.sort_order), body.active === false ? 0 : 1, nowIso(), id).run()
      await writeAuditLog(env, request, ownerUser, 'blog.category_update', { entityType: 'blog_category', entityId: id, details: { slug, name } })
      await enqueueBlogEvent(env, null, 0, 'category-update')
      return json(request, env, { categories: await listBlogCategories(env, { owner: true }) }, 200, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/blog/posts' && request.method === 'GET') {
      const status = cleanText(url.searchParams.get('status') || '', 20, 'Status', { required: false })
      const search = cleanText(url.searchParams.get('search') || '', 100, 'Search', { required: false })
      return json(request, env, { posts: await listAdminBlogPosts(env, { status, search, trashed: url.searchParams.get('trashed') === 'true' }) }, 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/blog/posts' && request.method === 'POST') {
      await rateLimit(request, env, 'blog-draft-create', 60, 3600, ownerUser.id)
      const post = await createBlogDraft(env, ownerUser, await readJson(request))
      await writeAuditLog(env, request, ownerUser, 'blog.create', { entityType: 'blog_post', entityId: post.id, details: { slug: post.slug, title: post.title } })
      return json(request, env, { post }, 201, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/blog/import' && request.method === 'POST') {
      await rateLimit(request, env, 'blog-import', 30, 3600, ownerUser.id)
      const input = await readJson(request)
      const post = await importBlogDraft(env, ownerUser, input)
      const warnings = ['Review AI-created facts, citations, links, and image rights before publishing.']
      if (/<(?:script|style|iframe|form|object|embed|img)\b/i.test(String(input.content || ''))) warnings.push('Executable, embedded, form, style, or webpage image HTML was removed during safe conversion.')
      if (/!\[[^\]]*\]\(\s*(?:https?:)?\/\//i.test(String(input.content || ''))) warnings.push('Remote Markdown images were omitted. Add validated images through the Blog media library.')
      await writeAuditLog(env, request, ownerUser, 'blog.import', { entityType: 'blog_post', entityId: post.id, details: { slug: post.slug, title: post.title } })
      return json(request, env, { post, warnings }, 201, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/blog/media' && request.method === 'GET') {
      return json(request, env, { media: await listBlogMedia(env) }, 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/blog/media' && request.method === 'POST') {
      await rateLimit(request, env, 'blog-media-upload', 40, 3600, ownerUser.id)
      const result = await uploadBlogMedia(env, ownerUser, await readJson(request))
      await writeAuditLog(env, request, ownerUser, result.duplicate ? 'blog.media_reuse' : 'blog.media_upload', { entityType: 'blog_media', entityId: result.media.id, details: { mimeType: result.media.mimeType, width: result.media.width, height: result.media.height } })
      return json(request, env, result, result.duplicate ? 200 : 201, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/blog\/media\/([^/]+)$/)
    if (match && request.method === 'PATCH') {
      const id = decodeURIComponent(match[1])
      const media = await updateBlogMedia(env, id, await readJson(request))
      await writeAuditLog(env, request, ownerUser, 'blog.media_update', { entityType: 'blog_media', entityId: id })
      await enqueueBlogEvent(env, null, 0, 'media-update')
      return json(request, env, { media }, 200, { 'Cache-Control': 'no-store' })
    }
    if (match && request.method === 'DELETE') {
      const id = decodeURIComponent(match[1])
      const result = await trashBlogMedia(env, id)
      await writeAuditLog(env, request, ownerUser, 'blog.media_trash', { entityType: 'blog_media', entityId: id })
      return json(request, env, result, 200, { 'Cache-Control': 'no-store' })
    }

    match = routeMatch(path, /^\/admin\/blog\/posts\/([^/]+)\/revisions$/)
    if (match && request.method === 'GET') {
      const postId = decodeURIComponent(match[1])
      await blogPostById(env, postId)
      const result = await env.DB.prepare('SELECT id, post_id, version, reason, created_at FROM blog_post_revisions WHERE post_id = ? ORDER BY created_at DESC LIMIT 100').bind(postId).all()
      return json(request, env, { revisions: result.results || [] }, 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/blog\/posts\/([^/]+)\/revisions\/([^/]+)\/restore$/)
    if (match && request.method === 'POST') {
      const post = await restoreBlogRevision(env, decodeURIComponent(match[1]), decodeURIComponent(match[2]), await readJson(request), ownerUser)
      await writeAuditLog(env, request, ownerUser, 'blog.revision_restore', { entityType: 'blog_post', entityId: post.id, details: { version: post.version } })
      return json(request, env, { post }, 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/blog\/posts\/([^/]+)\/change-slug$/)
    if (match && request.method === 'POST') {
      const post = await changeBlogSlug(env, decodeURIComponent(match[1]), await readJson(request), ownerUser)
      await writeAuditLog(env, request, ownerUser, 'blog.slug_change', { entityType: 'blog_post', entityId: post.id, details: { slug: post.slug } })
      return json(request, env, { post }, 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/blog\/posts\/([^/]+)\/(publish|schedule|unpublish|cancel-schedule|archive|restore|trash)$/)
    if (match && request.method === 'POST') {
      const action = match[2]
      const post = await transitionBlogPost(env, decodeURIComponent(match[1]), action, await readJson(request), ownerUser)
      await writeAuditLog(env, request, ownerUser, `blog.${action}`, { entityType: 'blog_post', entityId: post.id, details: { slug: post.slug, status: post.status, version: post.version } })
      return json(request, env, { post }, 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/blog\/posts\/([^/]+)\/permanent$/)
    if (match && request.method === 'DELETE') {
      const id = decodeURIComponent(match[1])
      const { row } = await blogPostById(env, id)
      if (!row.deleted_at) throw new HttpError(409, 'Move this article to trash first')
      await env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run()
      await enqueueBlogEvent(env, null, 0, 'permanent-delete')
      await writeAuditLog(env, request, ownerUser, 'blog.permanent_delete', { entityType: 'blog_post', entityId: id, details: { slug: row.slug } })
      return json(request, env, { removed: true, id }, 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/blog\/posts\/([^/]+)$/)
    if (match && request.method === 'GET') {
      return json(request, env, { post: (await blogPostById(env, decodeURIComponent(match[1]))).post }, 200, { 'Cache-Control': 'no-store' })
    }
    if (match && request.method === 'PATCH') {
      await rateLimit(request, env, 'blog-draft-save', 240, 3600, ownerUser.id)
      const post = await updateBlogDraft(env, decodeURIComponent(match[1]), await readJson(request))
      await writeAuditLog(env, request, ownerUser, 'blog.update', { entityType: 'blog_post', entityId: post.id, details: { slug: post.slug, status: post.status, version: post.version } })
      return json(request, env, { post }, 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/complimentary-grants' && request.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') || 100)
      const status = cleanText(url.searchParams.get('status') || '', 20, 'Status', { required: false })
      const search = cleanText(url.searchParams.get('search') || '', 100, 'Search', { required: false })
      return json(request, env, await getComplimentaryGrants(env, { limit, status, search }), 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/complimentary-grants' && request.method === 'POST') {
      await rateLimit(request, env, 'complimentary-grant-create', 50, 3600, ownerUser.id)
      const result = await createComplimentaryGrant(env, ownerUser, await readJson(request))
      await writeAuditLog(env, request, ownerUser, result.duplicate ? 'complimentary.duplicate' : 'complimentary.create', {
        entityType: 'complimentary_grant',
        entityId: result.grant.id,
        details: { productKeys: result.grant.products.map((product) => product.productKey), skippedProductKeys: result.skippedProductKeys },
      })
      if (!result.duplicate) ctx.waitUntil(deliverComplimentaryInvitation(env, result.grant.id))
      return json(request, env, result, result.duplicate ? 200 : 202, { 'Cache-Control': 'no-store' })
    }

    match = routeMatch(path, /^\/admin\/complimentary-grants\/([^/]+)\/resend$/)
    if (match && request.method === 'POST') {
      await rateLimit(request, env, 'complimentary-grant-resend', 50, 3600, ownerUser.id)
      const grantId = decodeURIComponent(match[1])
      const existing = await env.DB.prepare('SELECT * FROM complimentary_grants WHERE id = ?').bind(grantId).first()
      if (!existing) throw new HttpError(404, 'Complimentary invitation not found')
      if (!['pending', 'expired'].includes(existing.status)) throw new HttpError(409, 'Only an unclaimed invitation can be resent')
      const rawToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
      const tokenHash = await sha256Hex(rawToken)
      const tokenCiphertext = await encryptSensitiveValue(env, 'complimentary-claim-token', rawToken)
      const updatedAt = nowIso()
      const expiresAt = new Date(Date.now() + COMPLIMENTARY_TOKEN_TTL_MS).toISOString()
      const updated = await env.DB.prepare(`
        UPDATE complimentary_grants
        SET status = 'pending', token_hash = ?, token_ciphertext = ?, token_expires_at = ?,
            token_used_at = NULL, email_status = 'pending', email_attempts = 0,
            email_sent_at = NULL, email_next_eligible_at = '', email_last_error = NULL,
            updated_at = ?
        WHERE id = ? AND status IN ('pending', 'expired')
        RETURNING *
      `).bind(tokenHash, tokenCiphertext, expiresAt, updatedAt, grantId).first()
      if (!updated) throw new HttpError(409, 'This invitation can no longer be resent')
      await refreshComplimentaryAudienceForEmail(env, updated.recipient_email)
      await writeAuditLog(env, request, ownerUser, 'complimentary.resend', { entityType: 'complimentary_grant', entityId: grantId })
      ctx.waitUntil(deliverComplimentaryInvitation(env, grantId))
      const itemMap = await complimentaryItemsByGrant(env, [grantId])
      return json(request, env, { grant: complimentaryGrantFromRow(updated, itemMap.get(grantId) || []) }, 202, { 'Cache-Control': 'no-store' })
    }

    match = routeMatch(path, /^\/admin\/complimentary-grants\/([^/]+)\/cancel$/)
    if (match && request.method === 'POST') {
      const grantId = decodeURIComponent(match[1])
      const updatedAt = nowIso()
      const cancelled = await env.DB.prepare(`
        UPDATE complimentary_grants
        SET status = 'cancelled', token_hash = NULL, token_ciphertext = NULL,
            email_status = CASE WHEN email_status = 'sent' THEN 'sent' ELSE 'cancelled' END,
            email_next_eligible_at = '', updated_at = ?
        WHERE id = ? AND status IN ('pending', 'expired')
        RETURNING *
      `).bind(updatedAt, grantId).first()
      if (!cancelled) throw new HttpError(409, 'Only an unclaimed invitation can be cancelled')
      await refreshComplimentaryAudienceForEmail(env, cancelled.recipient_email)
      await writeAuditLog(env, request, ownerUser, 'complimentary.cancel', { entityType: 'complimentary_grant', entityId: grantId })
      return json(request, env, { cancelled: true, grantId }, 200, { 'Cache-Control': 'no-store' })
    }

    match = routeMatch(path, /^\/admin\/complimentary-grants\/([^/]+)\/revoke$/)
    if (match && request.method === 'POST') {
      const grantId = decodeURIComponent(match[1])
      const grant = await env.DB.prepare("SELECT * FROM complimentary_grants WHERE id = ? AND status = 'claimed'").bind(grantId).first()
      if (!grant) throw new HttpError(409, 'Only active complimentary access can be revoked')
      const revokedAt = nowIso()
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE complimentary_grants
          SET status = 'revoked', revoked_at = ?, updated_at = ?
          WHERE id = ? AND status = 'claimed'
        `).bind(revokedAt, revokedAt, grantId),
        env.DB.prepare(`
          UPDATE purchases SET access_status = 'revoked', updated_at = ?
          WHERE complimentary_grant_id = ? AND access_source = 'complimentary'
        `).bind(revokedAt, grantId),
        env.DB.prepare(`
          UPDATE complimentary_grant_items SET item_status = 'revoked'
          WHERE grant_id = ? AND item_status = 'granted'
        `).bind(grantId),
        env.DB.prepare(`
          UPDATE review_requests SET status = 'cancelled', updated_at = ?
          WHERE purchase_id IN (SELECT id FROM purchases WHERE complimentary_grant_id = ?)
            AND status != 'sent'
        `).bind(revokedAt, grantId),
      ])
      await refreshComplimentaryAudienceForEmail(env, grant.recipient_email)
      await writeAuditLog(env, request, ownerUser, 'complimentary.revoke', { entityType: 'complimentary_grant', entityId: grantId })
      return json(request, env, { revoked: true, grantId }, 200, { 'Cache-Control': 'no-store' })
    }

    match = routeMatch(path, /^\/admin\/complimentary-grants\/([^/]+)\/review-invite$/)
    if (match && request.method === 'POST') {
      const grantId = decodeURIComponent(match[1])
      const grant = await env.DB.prepare("SELECT * FROM complimentary_grants WHERE id = ? AND status = 'claimed'").bind(grantId).first()
      if (!grant) throw new HttpError(409, 'Review invitations require active complimentary access')
      const rows = await env.DB.prepare(`
        SELECT id, user_id, customer_email, customer_name FROM purchases
        WHERE complimentary_grant_id = ? AND access_source = 'complimentary'
          AND access_status = 'active' AND payment_status = 'paid'
      `).bind(grantId).all()
      if (!(rows.results || []).length) throw new HttpError(409, 'No active complimentary products are eligible for a review invitation')
      const queuedAt = nowIso()
      await env.DB.batch((rows.results || []).map((purchase) => env.DB.prepare(`
        INSERT INTO review_requests (
          id, purchase_id, user_id, email, customer_name, send_at, status,
          attempts, created_at, updated_at, next_eligible_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, '')
        ON CONFLICT(purchase_id) DO UPDATE SET
          status = CASE WHEN review_requests.status = 'sent' THEN 'sent' ELSE 'pending' END,
          attempts = CASE WHEN review_requests.status = 'sent' THEN review_requests.attempts ELSE 0 END,
          send_at = CASE WHEN review_requests.status = 'sent' THEN review_requests.send_at ELSE excluded.send_at END,
          next_eligible_at = '', last_error = NULL, updated_at = excluded.updated_at
      `).bind(makeId('review_request'), purchase.id, purchase.user_id, purchase.customer_email, purchase.customer_name, queuedAt, queuedAt, queuedAt)))
      await env.DB.prepare('UPDATE complimentary_grants SET review_invited_at = ?, updated_at = ? WHERE id = ?').bind(queuedAt, queuedAt, grantId).run()
      await writeAuditLog(env, request, ownerUser, 'complimentary.review_invite', { entityType: 'complimentary_grant', entityId: grantId, details: { totalQueued: rows.results.length } })
      ctx.waitUntil(processEmailQueues(env))
      return json(request, env, { queued: true, totalQueued: rows.results.length, grantId }, 202, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/products' && request.method === 'GET') {
      await ensureProductsSeeded(env)
      const result = await env.DB.prepare('SELECT * FROM products ORDER BY sort_order ASC, key ASC').all()
      const rows = result.results || []
      const featuresByKey = await featuresMapForProducts(env, rows)
      return json(request, env, rows.map((row) => {
        const product = productRowToConfig(row)
        if (product.key === PRODUCT_KEY) product.deliveryUrl = product.deliveryUrl || env.GOOGLE_SHEETS_COPY_URL || ''
        let deliveryConfigured = false
        try { productDeliveryUrl(env, product); deliveryConfigured = true } catch { /* shown as unavailable in the owner UI */ }
        return { ...product, deliveryConfigured, features: featuresByKey.get(row.key) || [] }
      }), 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/products' && request.method === 'POST') {
      const body = await readJson(request)
      // An optional duplicateFrom copies an existing product's content into the
      // new key; without it this is an ordinary create.
      const source = cleanText(String(body.duplicateFrom || ''), 60, 'Source product key', { required: false })
      let created
      if (source) {
        created = await duplicateProduct(env, source, body)
      } else {
        created = await createProduct(env, body)
      }
      await writeAuditLog(env, request, ownerUser, source ? 'product.duplicate' : 'product.create', { entityType: 'product', entityId: created.key, details: { name: created.name, source: source || '' } })
      return json(request, env, created, 201, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/bundles' && request.method === 'GET') {
      const result = await env.DB.prepare('SELECT * FROM bundles ORDER BY sort_order ASC, key ASC').all()
      return json(request, env, (result.results || []).map(bundleRowToConfig), 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/bundles' && request.method === 'POST') {
      const created = await createBundle(env, await readJson(request))
      await writeAuditLog(env, request, ownerUser, 'bundle.create', { entityType: 'bundle', entityId: created.key, details: { name: created.name } })
      return json(request, env, created, 201, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/bundles\/([^/]+)$/)
    if (match && request.method === 'PATCH') {
      const key = decodeURIComponent(match[1])
      const before = await env.DB.prepare('SELECT * FROM bundles WHERE key = ?').bind(key).first()
      const updated = await updateBundle(env, key, await readJson(request))
      await writeAuditLog(env, request, ownerUser, 'bundle.update', { entityType: 'bundle', entityId: key, details: { changed: Object.keys(updated || {}), before: before ? { name: before.name, discount: before.discount_percent } : null } })
      return json(request, env, updated, 200, { 'Cache-Control': 'no-store' })
    }
    if (match && request.method === 'DELETE') {
      const key = decodeURIComponent(match[1])
      const result = await deleteBundle(env, key)
      await writeAuditLog(env, request, ownerUser, 'bundle.delete', { entityType: 'bundle', entityId: key, details: { name: result.name } })
      return json(request, env, result, 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/products\/([^/]+)$/)
    if (match && request.method === 'PATCH') {
      const key = decodeURIComponent(match[1])
      const updated = await updateProduct(env, key, await readJson(request))
      await writeAuditLog(env, request, ownerUser, 'product.update', { entityType: 'product', entityId: key, details: { name: updated.name, salePrice: updated.salePrice } })
      return json(request, env, updated, 200, { 'Cache-Control': 'no-store' })
    }
    if (match && request.method === 'DELETE') {
      const key = decodeURIComponent(match[1])
      const result = await deleteProduct(env, key)
      await writeAuditLog(env, request, ownerUser, 'product.delete', { entityType: 'product', entityId: key, details: { name: result.name } })
      return json(request, env, result, 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/products\/([^/]+)\/upload$/)
    if (match && request.method === 'POST') {
      await rateLimit(request, env, 'media-upload', 60, 3600, ownerUser.id)
      if (!env.MEDIA) throw new HttpError(503, 'Media storage is not configured')
      const productKey = decodeURIComponent(match[1])
      await ensureProductsSeeded(env)
      const existing = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(productKey).first()
      if (!existing) throw new HttpError(404, 'Product not found')
      const body = await readJson(request)
      const slot = body.slot === 'feature' ? 'feature' : 'hero'
      const image = cleanText(body.image, 7000000, 'Image')
      const { bytes, contentType } = decodeUploadedImage(image)
      const mediaId = crypto.randomUUID()
      const objectKey = `product-media/${productKey}/${mediaId}.webp`
      await env.MEDIA.put(objectKey, bytes, {
        httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
      })
      const mediaPath = `/media/${productKey}/${mediaId}.webp`
      const updatedAt = nowIso()
      let updated
      if (slot === 'hero') {
        const previous = String(existing.hero_image || '')
        if (previous) await env.MEDIA.delete(mediaObjectKey(previous)).catch(() => {})
        updated = await env.DB.prepare('UPDATE products SET hero_image = ?, updated_at = ? WHERE key = ? RETURNING *').bind(mediaPath, updatedAt, productKey).first()
        await invalidatePublicCaches()
        return json(request, env, { ...productRowToConfig(updated), aiAvailable: false }, 201, { 'Cache-Control': 'no-store' })
      }
      // Feature screenshots are unlimited. Every feature gets an AI-scanned
      // heading and subheading when the image model is configured; the owner
      // can still edit the copy afterwards.
      const ai = await describeImageWithAi(env, bytes)
      const featureRow = await insertFeatureRow(env, productKey, mediaPath, {
        heading: cleanText(body.heading, FEATURE_HEADING_MAX, 'Heading', { required: false }) || ai.heading,
        subheading: cleanText(body.subheading, FEATURE_SUBHEADING_MAX, 'Subheading', { required: false }) || ai.subheading,
      })
      await syncLegacyFeatureImages(env, productKey)
      await invalidatePublicCaches()
      updated = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(productKey).first()
      const feature = featureRowToConfig(featureRow)
      return json(request, env, {
        ...productRowToConfig(updated),
        features: await featuresForProduct(env, productKey, []),
        feature,
        aiAvailable: ai.aiAvailable,
      }, 201, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/products\/([^/]+)\/features$/)
    if (match && request.method === 'POST') {
      await rateLimit(request, env, 'media-upload', 60, 3600, ownerUser.id)
      if (!env.MEDIA) throw new HttpError(503, 'Media storage is not configured')
      const productKey = decodeURIComponent(match[1])
      await ensureProductsSeeded(env)
      const existing = await env.DB.prepare('SELECT key FROM products WHERE key = ?').bind(productKey).first()
      if (!existing) throw new HttpError(404, 'Product not found')
      const body = await readJson(request)
      const image = cleanText(body.image, 7000000, 'Image')
      const { bytes, contentType } = decodeUploadedImage(image)
      const mediaId = crypto.randomUUID()
      const objectKey = `product-media/${productKey}/${mediaId}.webp`
      await env.MEDIA.put(objectKey, bytes, {
        httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
      })
      const mediaPath = `/media/${productKey}/${mediaId}.webp`
      const ai = await describeImageWithAi(env, bytes)
      const featureRow = await insertFeatureRow(env, productKey, mediaPath, {
        heading: cleanText(body.heading, FEATURE_HEADING_MAX, 'Heading', { required: false }) || ai.heading,
        subheading: cleanText(body.subheading, FEATURE_SUBHEADING_MAX, 'Subheading', { required: false }) || ai.subheading,
      })
      await syncLegacyFeatureImages(env, productKey)
      await invalidatePublicCaches()
      const feature = featureRowToConfig(featureRow)
      return json(request, env, { feature, aiAvailable: ai.aiAvailable }, 201, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/products\/([^/]+)\/features\/([^/]+)$/)
    if (match && request.method === 'PATCH') {
      const productKey = decodeURIComponent(match[1])
      const featureId = decodeURIComponent(match[2])
      const body = await readJson(request)
      const owned = await env.DB.prepare('SELECT * FROM product_features WHERE id = ? AND product_key = ?').bind(featureId, productKey).first()
      if (!owned) throw new HttpError(404, 'Feature not found for this product')
      const heading = Object.prototype.hasOwnProperty.call(body, 'heading')
        ? cleanText(body.heading, FEATURE_HEADING_MAX, 'Heading', { required: false })
        : owned.heading
      const subheading = Object.prototype.hasOwnProperty.call(body, 'subheading')
        ? cleanText(body.subheading, FEATURE_SUBHEADING_MAX, 'Subheading', { required: false })
        : owned.subheading
      const sortOrder = Object.prototype.hasOwnProperty.call(body, 'sortOrder')
        ? Math.min(9999, Math.max(0, Number(body.sortOrder) || 0))
        : Number(owned.sort_order || 0)
      const updated = await env.DB.prepare(`
        UPDATE product_features SET heading = ?, subheading = ?, sort_order = ?, updated_at = ?
        WHERE id = ? RETURNING *
      `).bind(heading, subheading, sortOrder, nowIso(), featureId).first()
      await invalidatePublicCaches()
      return json(request, env, featureRowToConfig(updated), 200, { 'Cache-Control': 'no-store' })
    }
    if (match && request.method === 'DELETE') {
      const productKey = decodeURIComponent(match[1])
      const featureId = decodeURIComponent(match[2])
      const owned = await env.DB.prepare('SELECT * FROM product_features WHERE id = ? AND product_key = ?').bind(featureId, productKey).first()
      if (!owned) throw new HttpError(404, 'Feature not found for this product')
      await env.DB.prepare('DELETE FROM product_features WHERE id = ?').bind(featureId).run()
      if (owned.media_path) await env.MEDIA.delete(mediaObjectKey(owned.media_path)).catch(() => {})
      await syncLegacyFeatureImages(env, productKey)
      await invalidatePublicCaches()
      return json(request, env, { removed: true, featureId }, 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/products\/([^/]+)\/waitlist$/)
    if (match && request.method === 'GET') {
      const productKey = decodeURIComponent(match[1])
      let stats = null
      let pollRows = { results: [] }
      let subscribers = { results: [] }
      try {
        stats = await env.DB.prepare(`
          SELECT
            COUNT(*) AS total,
            COUNT(CASE WHEN notified_at IS NOT NULL THEN 1 END) AS notified,
            COUNT(CASE WHEN welcome_sent_at IS NOT NULL THEN 1 END) AS welcome_sent
          FROM product_waitlist WHERE product_key = ?
        `).bind(productKey).first()

        pollRows = await env.DB.prepare(`
          SELECT poll_response AS option, COUNT(*) AS count
          FROM product_waitlist
          WHERE product_key = ? AND poll_response != ''
          GROUP BY poll_response
          ORDER BY count DESC
        `).bind(productKey).all()

        subscribers = await env.DB.prepare(`
          SELECT id, email, user_id, source, poll_response, welcome_sent_at, notified_at, created_at
          FROM product_waitlist
          WHERE product_key = ?
          ORDER BY created_at DESC
          LIMIT 200
        `).bind(productKey).all()
      } catch { /* waitlist table fallback */ }

      return json(request, env, {
        totalSubscribers: Number(stats?.total || 0),
        notifiedCount: Number(stats?.notified || 0),
        welcomeSentCount: Number(stats?.welcome_sent || 0),
        pollResults: pollRows.results || [],
        subscribers: (subscribers.results || []).map((row) => ({
          id: row.id,
          email: row.email,
          userId: row.user_id || '',
          source: row.source,
          pollResponse: row.poll_response,
          welcomeSentAt: row.welcome_sent_at,
          notifiedAt: row.notified_at,
          createdAt: row.created_at,
        })),
      }, 200, { 'Cache-Control': 'no-store' })
    }

    match = routeMatch(path, /^\/admin\/products\/([^/]+)\/waitlist\/export$/)
    if (match && request.method === 'GET') {
      const productKey = decodeURIComponent(match[1])
      let rows = { results: [] }
      try {
        rows = await env.DB.prepare(`
          SELECT email, source, poll_response, welcome_sent_at, notified_at, created_at
          FROM product_waitlist
          WHERE product_key = ?
          ORDER BY created_at DESC
        `).bind(productKey).all()
      } catch {}

      const lines = ['Email,Source,Poll Response,Welcome Sent At,Notified At,Signed Up At']
      for (const r of rows.results || []) {
        lines.push([
          safeCsvCell(r.email),
          safeCsvCell(r.source),
          safeCsvCell(r.poll_response),
          safeCsvCell(r.welcome_sent_at),
          safeCsvCell(r.notified_at),
          safeCsvCell(r.created_at),
        ].join(','))
      }
      return new Response(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${productKey}-waitlist.csv"`,
          ...corsHeaders(request, env),
          ...SECURITY_HEADERS,
        },
      })
    }

    match = routeMatch(path, /^\/admin\/products\/([^/]+)\/waitlist\/test-email$/)
    if (match && request.method === 'POST') {
      const productKey = decodeURIComponent(match[1])
      await ensureProductsSeeded(env)
      const productRow = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(productKey).first()
      if (!productRow) throw new HttpError(404, 'Product not found')
      const product = productRowToConfig(productRow)
      const body = await readJson(request)
      const recipient = env.OWNER_EMAIL || 'runwaysystems.cloud@gmail.com'

      const customSubject = cleanText(body.subject, 150, 'Subject', { required: false }) || `${product.name} is now live on Runway Systems`
      const customMessage = cleanText(body.message, 2000, 'Message', { required: false }) || `The wait is over: ${product.name} is officially available. As an early-access subscriber, you can get instant access now.`
      const title = `${product.name} is now live.`
      const actionLabel = `Get ${product.name} →`
      const actionUrl = `${getPrimaryOrigin(env)}/products/${product.key}`
      const footer = `This is a test preview sent to the store owner (${recipient}).\nFrom: ${env.EMAIL_FROM_INFO || 'info@runwaysystems.cloud'}`

      const html = emailLayout(title, customMessage, actionLabel, actionUrl, footer, null, 'RUNWAY SYSTEMS · LAUNCH ANNOUNCEMENT [TEST]')
      await sendBrevo(env, {
        to: recipient,
        from: env.EMAIL_FROM_INFO || 'info@runwaysystems.cloud',
        fromName: 'Runway Systems',
        subject: `[TEST PREVIEW] ${customSubject}`,
        html,
      })

      await writeAuditLog(env, request, ownerUser, 'waitlist.test_email', { entityType: 'product', entityId: productKey, details: { recipient } })
      return json(request, env, { ok: true, message: `Test email sent to ${recipient}` }, 200, { 'Cache-Control': 'no-store' })
    }

    match = routeMatch(path, /^\/admin\/products\/([^/]+)\/waitlist\/broadcast$/)
    if (match && request.method === 'POST') {
      const productKey = decodeURIComponent(match[1])
      await ensureProductsSeeded(env)
      const productRow = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(productKey).first()
      if (!productRow) throw new HttpError(404, 'Product not found')
      const product = productRowToConfig(productRow)
      const body = await readJson(request)
      const idempotencyKey = cleanText(body.idempotencyKey, 100, 'Idempotency key')
      if (!/^[A-Za-z0-9._:-]{8,100}$/.test(idempotencyKey)) throw new HttpError(400, 'Idempotency key format is invalid')
      const broadcastId = `waitlist_${(await sha256Hex(`${productKey}:${idempotencyKey}`)).slice(0, 32)}`
      const dedupePrefix = `waitlist:${productKey}:${idempotencyKey}:`
      const existingJobs = await env.DB.prepare(`
        SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent
        FROM marketing_deliveries WHERE campaign_id = ?
      `).bind(broadcastId).first()
      if (Number(existingJobs?.total || 0) > 0) {
        return json(request, env, {
          ok: true,
          duplicate: true,
          sentCount: Number(existingJobs.sent || 0),
          totalQueued: Number(existingJobs.total || 0),
          message: 'This launch announcement was already queued.',
        }, 202, { 'Cache-Control': 'no-store' })
      }

      const customSubject = cleanText(body.subject, 150, 'Subject', { required: false }) || `${product.name} is now live on Runway Systems`
      const customMessage = cleanText(body.message, 2000, 'Message', { required: false }) || `The wait is over: ${product.name} is officially available. As an early-access subscriber, you can get instant access now.`
      const title = `${product.name} is now live.`
      const actionLabel = `Get ${product.name} →`
      const actionUrl = `${getPrimaryOrigin(env)}/products/${product.key}`
      const footer = `You received this email because you requested early notification for ${product.name} on Runway Systems.\nFrom: ${env.EMAIL_FROM_INFO || 'info@runwaysystems.cloud'}`
      const html = emailLayout(title, customMessage, actionLabel, actionUrl, footer, null, 'RUNWAY SYSTEMS · LAUNCH ANNOUNCEMENT')

      let list = []
      try {
        const unnotified = await env.DB.prepare(`
          SELECT id, email FROM product_waitlist WHERE product_key = ? AND notified_at IS NULL
        `).bind(productKey).all()
        list = unnotified.results || []
      } catch {}

      const queuedAt = nowIso()
      await enqueueMarketingDeliveries(env, list.map((subscriber) => ({
        campaignId: broadcastId,
        kind: 'waitlist_launch',
        email: subscriber.email,
        subject: customSubject,
        html,
        waitlistId: subscriber.id,
        createdAt: queuedAt,
        dedupeKey: `${dedupePrefix}${subscriber.id}`,
      })))

      await writeAuditLog(env, request, ownerUser, 'waitlist.broadcast_queued', {
        entityType: 'product',
        entityId: productKey,
        details: { totalQueued: list.length },
      })
      ctx.waitUntil(processMarketingQueue(env, 5))

      return json(request, env, {
        ok: true,
        sentCount: 0,
        totalQueued: list.length,
        message: `Launch announcement queued for ${list.length} subscribers.`,
      }, 202, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/marketing/audience' && request.method === 'GET') {
      const segment = url.searchParams.get('segment') || 'all'
      if (!['all', 'leads', 'customers', 'waitlist', 'unsubscribed'].includes(segment)) throw new HttpError(400, 'Invalid audience segment')
      const search = (url.searchParams.get('search') || '').trim().toLowerCase()
      const productFilter = (url.searchParams.get('product') || '').trim()
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
      const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)))
      const offset = (page - 1) * limit

      let stats = {
        total: 0,
        leads: 0,
        customers: 0,
        waitlist: 0,
        unsubscribed: 0,
        totalLtvCents: 0,
        complimentary: 0,
      }

      let contacts = []
      let totalFiltered = 0

      try {
        const statsRow = await env.DB.prepare(`
          SELECT
            COUNT(*) AS total,
            COUNT(CASE WHEN is_customer = 0 AND status = 'subscribed' AND marketing_opt_in_at != '' THEN 1 END) AS leads,
            COUNT(CASE WHEN is_customer = 1 AND status = 'subscribed' AND marketing_opt_in_at != '' THEN 1 END) AS customers,
            COUNT(CASE WHEN waitlists_joined != '[]' AND waitlists_joined != '' AND status = 'subscribed' AND marketing_opt_in_at != '' THEN 1 END) AS waitlist,
            COUNT(CASE WHEN status = 'unsubscribed' THEN 1 END) AS unsubscribed,
            COALESCE(SUM(total_spend_cents), 0) AS totalLtvCents,
            COUNT(CASE WHEN complimentary_status IN ('pending', 'active') THEN 1 END) AS complimentary
          FROM audience_contacts
        `).first()

        if (statsRow) {
          stats = {
            total: Number(statsRow.total || 0),
            leads: Number(statsRow.leads || 0),
            customers: Number(statsRow.customers || 0),
            waitlist: Number(statsRow.waitlist || 0),
            unsubscribed: Number(statsRow.unsubscribed || 0),
            totalLtvCents: Number(statsRow.totalLtvCents || 0),
            complimentary: Number(statsRow.complimentary || 0),
          }
        }

        const whereClauses = []
        const params = []

        if (segment === 'leads') {
          whereClauses.push("is_customer = 0 AND status = 'subscribed' AND marketing_opt_in_at != ''")
        } else if (segment === 'customers') {
          whereClauses.push("is_customer = 1 AND status = 'subscribed' AND marketing_opt_in_at != ''")
        } else if (segment === 'waitlist') {
          whereClauses.push("waitlists_joined != '[]' AND waitlists_joined != '' AND status = 'subscribed' AND marketing_opt_in_at != ''")
        } else if (segment === 'unsubscribed') {
          whereClauses.push("status = 'unsubscribed'")
        }

        if (search) {
          whereClauses.push("(LOWER(email) LIKE ? OR LOWER(name) LIKE ?)")
          params.push(`%${search}%`, `%${search}%`)
        }

        if (productFilter) {
          whereClauses.push("(products_owned LIKE ? OR waitlists_joined LIKE ?)")
          params.push(`%${productFilter}%`, `%${productFilter}%`)
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

        const countQuery = `SELECT COUNT(*) AS total FROM audience_contacts ${whereSql}`
        const countRow = params.length > 0
          ? await env.DB.prepare(countQuery).bind(...params).first()
          : await env.DB.prepare(countQuery).first()
        totalFiltered = Number(countRow?.total || 0)

        const listQuery = `
          SELECT id, email, user_id, name, avatar_url, source, status,
                 is_customer, total_spend_cents, orders_count,
                 products_owned, waitlists_joined, complimentary_status,
                 complimentary_products, marketing_opt_in_source,
                 marketing_opt_in_at, last_seen_at, created_at
          FROM audience_contacts
          ${whereSql}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `
        const listRows = await env.DB.prepare(listQuery).bind(...params, limit, offset).all()
        contacts = (listRows.results || []).map((row) => ({
          id: row.id,
          email: row.email,
          userId: row.user_id,
          name: row.name,
          avatarUrl: row.avatar_url,
          source: row.source,
          status: row.status,
          isCustomer: Boolean(row.is_customer),
          totalSpendCents: Number(row.total_spend_cents || 0),
          ordersCount: Number(row.orders_count || 0),
          productsOwned: parseJsonSafe(row.products_owned, []),
          waitlistsJoined: parseJsonSafe(row.waitlists_joined, []),
          complimentaryStatus: row.complimentary_status || '',
          complimentaryProducts: parseJsonSafe(row.complimentary_products, []),
          marketingOptInSource: row.marketing_opt_in_source || '',
          marketingOptInAt: row.marketing_opt_in_at || '',
          lastSeenAt: row.last_seen_at,
          createdAt: row.created_at,
        }))
      } catch (err) {
        logEvent('warn', 'marketing.audience_query_failed', { error: err.message })
      }

      return json(request, env, {
        stats,
        contacts,
        total: totalFiltered,
        page,
        limit,
        totalPages: Math.ceil(totalFiltered / limit) || 1,
      }, 200, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/marketing/audience/export' && request.method === 'GET') {
      const segment = url.searchParams.get('segment') || 'all'
      let whereSql = ''
      if (segment === 'leads') whereSql = "WHERE is_customer = 0 AND status = 'subscribed'"
      else if (segment === 'customers') whereSql = "WHERE is_customer = 1"
      else if (segment === 'waitlist') whereSql = "WHERE waitlists_joined != '[]' AND waitlists_joined != ''"
      else if (segment === 'unsubscribed') whereSql = "WHERE status = 'unsubscribed'"

      let rows = { results: [] }
      try {
        rows = await env.DB.prepare(`
          SELECT email, name, source, status, is_customer, total_spend_cents, orders_count,
                 products_owned, waitlists_joined, complimentary_status,
                 complimentary_products, marketing_opt_in_source,
                 marketing_opt_in_at, created_at, last_seen_at
          FROM audience_contacts
          ${whereSql}
          ORDER BY created_at DESC
        `).all()
      } catch {}

      const lines = ['Email,Name,Source,Status,Marketing Opt-In Source,Marketing Opt-In At,Segment,Total Spend (USD),Orders Count,Products Owned,Waitlists,Complimentary Status,Complimentary Products,Joined At,Last Seen At']
      for (const r of rows.results || []) {
        const owned = parseJsonSafe(r.products_owned, []).join('; ')
        const waitlists = parseJsonSafe(r.waitlists_joined, []).join('; ')
        const complimentaryProducts = parseJsonSafe(r.complimentary_products, []).join('; ')
        const spend = (Number(r.total_spend_cents || 0) / 100).toFixed(2)
        const seg = r.is_customer ? 'Customer' : 'Lead'
        lines.push([
          safeCsvCell(r.email),
          safeCsvCell(r.name),
          safeCsvCell(r.source),
          safeCsvCell(r.status),
          safeCsvCell(r.marketing_opt_in_source || ''),
          safeCsvCell(r.marketing_opt_in_at || ''),
          safeCsvCell(seg),
          safeCsvCell(`$${spend}`),
          safeCsvCell(r.orders_count || 0),
          safeCsvCell(owned),
          safeCsvCell(waitlists),
          safeCsvCell(r.complimentary_status || ''),
          safeCsvCell(complimentaryProducts),
          safeCsvCell(r.created_at),
          safeCsvCell(r.last_seen_at),
        ].join(','))
      }
      return new Response(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="runway-audience-${segment}-${nowIso().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
          ...corsHeaders(request, env),
          ...SECURITY_HEADERS,
        },
      })
    }

    if (path === '/admin/marketing/contacts' && request.method === 'POST') {
      const body = await readJson(request)
      const email = cleanText(body.email, 254, 'Email').toLowerCase().trim()
      if (!email || !email.includes('@')) throw new HttpError(400, 'A valid email is required')
      const name = cleanText(body.name, 100, 'Name', { required: false }) || ''
      const source = cleanText(body.source, 40, 'Source', { required: false }) || 'manual'
      if (source !== 'manual') throw new HttpError(400, 'Admin-created contacts must use the manual source')
      if (body.consentConfirmed !== true) throw new HttpError(400, 'Confirm that this contact explicitly requested marketing before subscribing them')

      await recordAudienceContact(env, { email, name, source, marketingOptIn: true, marketingOptInSource: 'manual_admin_confirmation' })
      await writeAuditLog(env, request, ownerUser, 'marketing.contact_create', { entityType: 'contact', entityId: email, details: { name, source } })
      return json(request, env, { ok: true, message: 'Contact saved successfully' }, 201, { 'Cache-Control': 'no-store' })
    }

    match = routeMatch(path, /^\/admin\/marketing\/contacts\/([^/]+)$/)
    if (match && request.method === 'PATCH') {
      const contactId = decodeURIComponent(match[1])
      const body = await readJson(request)
      const allowedStatuses = ['subscribed', 'unsubscribed']
      if (body.status && !allowedStatuses.includes(body.status)) throw new HttpError(400, 'Invalid status')

      const existing = await env.DB.prepare('SELECT id, email FROM audience_contacts WHERE id = ?').bind(contactId).first()
      if (!existing) throw new HttpError(404, 'Contact not found')

      const nextName = body.name !== undefined ? cleanText(body.name, 100, 'Name', { required: false }) : null
      const nextStatus = body.status || null

      if (nextStatus === 'subscribed') {
        if (body.consentConfirmed !== true) throw new HttpError(400, 'Renewed marketing consent must be confirmed before resubscribing')
        await env.DB.prepare(`
          UPDATE audience_contacts
          SET status = 'subscribed', marketing_opt_in_at = ?,
              marketing_opt_in_source = 'manual_admin_confirmation', marketing_opt_in_policy_version = 'marketing-v1'
          WHERE id = ?
        `).bind(nowIso(), contactId).run()
        await env.DB.prepare('DELETE FROM marketing_suppressions WHERE email_hash = ?')
          .bind(await marketingEmailHash(env, existing.email)).run()
      } else if (nextStatus === 'unsubscribed') {
        await suppressMarketingEmail(env, existing.email, 'admin_action')
      }
      if (nextName !== null) {
        await env.DB.prepare('UPDATE audience_contacts SET name = ? WHERE id = ?').bind(nextName, contactId).run()
      }

      await writeAuditLog(env, request, ownerUser, 'marketing.contact_update', { entityType: 'contact', entityId: existing.email, details: body })
      return json(request, env, { ok: true, message: 'Contact updated' }, 200, { 'Cache-Control': 'no-store' })
    }

    if (match && request.method === 'DELETE') {
      const contactId = decodeURIComponent(match[1])
      const existing = await env.DB.prepare('SELECT id, email FROM audience_contacts WHERE id = ?').bind(contactId).first()
      if (!existing) throw new HttpError(404, 'Contact not found')
      await suppressMarketingEmail(env, existing.email, 'admin_delete')
      await env.DB.prepare('DELETE FROM audience_contacts WHERE id = ?').bind(contactId).run()
      await writeAuditLog(env, request, ownerUser, 'marketing.contact_delete', { entityType: 'contact', entityId: existing.email })
      return json(request, env, { ok: true, message: 'Contact deleted' }, 200, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/marketing/campaigns' && request.method === 'GET') {
      let rows = { results: [] }
      try {
        rows = await env.DB.prepare(`
          SELECT id, title, subject, preview_text AS previewText, target_segment AS targetSegment,
                 target_product_key AS targetProductKey, cta_label AS ctaLabel, cta_url AS ctaUrl,
                 discount_code AS discountCode, recipient_count AS recipientCount, sent_count AS sentCount,
                 failed_count AS failedCount, status, completed_at AS completedAt, sent_by AS sentBy, sent_at AS sentAt
          FROM marketing_campaigns
          ORDER BY sent_at DESC
          LIMIT 50
        `).all()
      } catch {}
      return json(request, env, rows.results || [], 200, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/marketing/campaigns/test' && request.method === 'POST') {
      const body = await readJson(request)
      const recipient = env.OWNER_EMAIL || 'runwaysystems.cloud@gmail.com'
      const subject = cleanText(body.subject, 150, 'Subject')
      const eyebrow = cleanText(body.eyebrow, 80, 'Eyebrow', { required: false }) || 'RUNWAY SYSTEMS · VIP PREVIEW'
      const rawMessage = cleanText(body.message, 5000, 'Message')
      const discountCode = cleanText(body.discountCode, 30, 'Discount code', { required: false }) || ''
      const ctaLabel = cleanText(body.ctaLabel, 60, 'CTA Label', { required: false }) || ''
      const rawCtaUrl = cleanText(body.ctaUrl, 500, 'CTA URL', { required: false }) || ''
      const ctaUrl = rawCtaUrl ? validHttpUrl(rawCtaUrl, 'CTA URL') : ''
      const targetProductKey = cleanText(body.targetProductKey, 60, 'Target product key', { required: false }) || ''

      let product = null
      if (targetProductKey) {
        try {
          const pRow = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(targetProductKey).first()
          if (pRow) product = productRowToConfig(pRow)
        } catch {}
      }

      const dummyContact = { name: 'Owner Preview', email: recipient }
      const personalizedSubject = renderMarketingTemplate(subject, dummyContact, product)
      const personalizedMessage = renderMarketingTemplate(rawMessage, dummyContact, product)
      const formattedBody = formatMarketingBodyToHtml(personalizedMessage)
      const footerText = `This is a test preview sent to the store owner (${recipient}).\nFrom: ${env.EMAIL_FROM_INFO || 'info@runwaysystems.cloud'}`

      const html = marketingEmailLayout({
        title: personalizedSubject,
        eyebrow: `${eyebrow} [TEST PREVIEW]`,
        bodyHtml: formattedBody,
        discountCode,
        actionLabel: ctaLabel,
        actionUrl: ctaUrl || getPrimaryOrigin(env),
        footerText,
        unsubscribeUrl: '',
      })

      await sendBrevo(env, {
        to: recipient,
        from: env.EMAIL_FROM_INFO || 'info@runwaysystems.cloud',
        fromName: 'Runway Systems',
        subject: `[TEST PREVIEW] ${personalizedSubject}`,
        html,
      })

      await writeAuditLog(env, request, ownerUser, 'marketing.test_email', { entityType: 'campaign', entityId: 'test', details: { recipient, subject } })
      return json(request, env, { ok: true, message: `Test email sent to ${recipient}` }, 200, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/marketing/campaigns/broadcast' && request.method === 'POST') {
      const body = await readJson(request)
      const title = cleanText(body.title, 100, 'Campaign Title', { required: false }) || cleanText(body.subject, 100, 'Subject')
      const subject = cleanText(body.subject, 150, 'Subject')
      const eyebrow = cleanText(body.eyebrow, 80, 'Eyebrow', { required: false }) || 'RUNWAY SYSTEMS · VIP ANNOUNCEMENT'
      const rawMessage = cleanText(body.message, 5000, 'Message')
      const targetSegment = cleanText(body.targetSegment, 40, 'Target segment', { required: false }) || 'all'
      if (!['all', 'leads', 'customers', 'waitlist'].includes(targetSegment)) throw new HttpError(400, 'Invalid campaign target segment')
      const targetProductKey = cleanText(body.targetProductKey, 60, 'Target product key', { required: false }) || ''
      const discountCode = cleanText(body.discountCode, 30, 'Discount code', { required: false }) || ''
      const ctaLabel = cleanText(body.ctaLabel, 60, 'CTA Label', { required: false }) || ''
      const rawCtaUrl = cleanText(body.ctaUrl, 500, 'CTA URL', { required: false }) || ''
      const ctaUrl = rawCtaUrl ? validHttpUrl(rawCtaUrl, 'CTA URL') : ''
      const idempotencyKey = cleanText(body.idempotencyKey, 100, 'Idempotency key')

      let product = null
      if (targetProductKey) {
        try {
          const pRow = await env.DB.prepare('SELECT * FROM products WHERE key = ?').bind(targetProductKey).first()
          if (pRow) product = productRowToConfig(pRow)
        } catch {}
      }

      let query = "SELECT id, email, name, user_id, products_owned FROM audience_contacts WHERE status = 'subscribed' AND marketing_opt_in_at != ''"
      const params = []
      if (targetSegment === 'leads') {
        query += ' AND is_customer = 0'
      } else if (targetSegment === 'customers') {
        query += ' AND is_customer = 1'
      } else if (targetSegment === 'waitlist') {
        if (targetProductKey) {
          query += ' AND waitlists_joined LIKE ?'
          params.push(`%${targetProductKey}%`)
        } else {
          query += " AND waitlists_joined != '[]' AND waitlists_joined != ''"
        }
      }

      const rows = params.length > 0
        ? await env.DB.prepare(query).bind(...params).all()
        : await env.DB.prepare(query).all()
      const recipients = rows.results || []
      if (!recipients.length) throw new HttpError(400, 'No explicitly opted-in recipients found for this target segment.')

      const campaignId = `campaign_${(await sha256Hex(`${ownerUser.id}:${idempotencyKey}`)).slice(0, 32)}`
      const existingCampaign = await env.DB.prepare('SELECT id, recipient_count AS recipientCount, sent_count AS sentCount, status FROM marketing_campaigns WHERE id = ?').bind(campaignId).first()
      if (existingCampaign) {
        return json(request, env, { ok: true, campaignId, totalQueued: Number(existingCampaign.recipientCount || 0), sentCount: Number(existingCampaign.sentCount || 0), status: existingCampaign.status, duplicate: true }, 202, { 'Cache-Control': 'no-store' })
      }

      const queuedAt = nowIso()
      await env.DB.prepare(`
        INSERT INTO marketing_campaigns (
          id, title, subject, preview_text, target_segment, target_product_key,
          cta_label, cta_url, discount_code, body_html, recipient_count,
          sent_by, sent_at, status, sent_count, failed_count, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, 0, ?)
      `).bind(
        campaignId, title, subject, eyebrow, targetSegment, targetProductKey,
        ctaLabel, ctaUrl, discountCode, rawMessage, recipients.length,
        ownerUser.email || 'owner', queuedAt,
        JSON.stringify({ idempotencyKey, consentPolicyVersion: 'marketing-v1' }),
      ).run()

      const apiOrigin = new URL(request.url).origin
      const origin = getPrimaryOrigin(env)
      const jobs = []
      for (const contact of recipients) {
        const unsubscribeToken = await createUnsubscribeToken(env, contact.email)
        const unsubscribeUrl = `${apiOrigin}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
        const personalizedSubject = renderMarketingTemplate(subject, contact, product)
        const personalizedMessage = renderMarketingTemplate(rawMessage, contact, product)
        const footerText = `You received this because you explicitly opted in to Runway Systems marketing.\nFrom: ${env.EMAIL_FROM_INFO || 'info@runwaysystems.cloud'}`
        const html = marketingEmailLayout({
          title: personalizedSubject,
          eyebrow,
          bodyHtml: formatMarketingBodyToHtml(personalizedMessage),
          discountCode,
          actionLabel: ctaLabel,
          actionUrl: ctaUrl || origin,
          footerText,
          unsubscribeUrl,
        })
        jobs.push({
          campaignId,
          kind: 'campaign',
          email: contact.email,
          subject: personalizedSubject,
          html,
          unsubscribeUrl,
          createdAt: queuedAt,
          dedupeKey: `campaign:${campaignId}:${contact.id}`,
        })
      }
      await enqueueMarketingDeliveries(env, jobs)

      await writeAuditLog(env, request, ownerUser, 'marketing.broadcast_queued', {
        entityType: 'campaign',
        entityId: campaignId,
        details: { title, targetSegment, totalQueued: recipients.length },
      })
      ctx.waitUntil(processMarketingQueue(env, 5))

      return json(request, env, {
        ok: true,
        campaignId,
        sentCount: 0,
        totalQueued: recipients.length,
        status: 'queued',
        message: `Campaign queued for ${recipients.length} opted-in recipients.`,
      }, 202, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/testimonials' && request.method === 'GET') {
      const status = url.searchParams.get('status') || 'all'
      const allowed = ['all', 'pending', 'approved', 'rejected']
      if (!allowed.includes(status)) throw new HttpError(400, 'Invalid testimonial status')
      const query = status === 'all'
        ? 'SELECT id, name, rating, text, status, created_at AS createdAt FROM testimonials ORDER BY created_at DESC'
        : 'SELECT id, name, rating, text, status, created_at AS createdAt FROM testimonials WHERE status = ? ORDER BY created_at DESC'
      const result = status === 'all'
        ? await env.DB.prepare(query).all()
        : await env.DB.prepare(query).bind(status).all()
      return json(request, env, result.results || [], 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/testimonials\/([^/]+)$/)
    if (match && request.method === 'PATCH') {
      const body = await readJson(request)
      if (!['pending', 'approved', 'rejected'].includes(body.status)) throw new HttpError(400, 'Invalid testimonial status')
      const moderatedAt = nowIso()
      const result = await env.DB.prepare(`
        UPDATE testimonials SET status = ?, moderated_at = ? WHERE id = ? RETURNING id, name, rating, text, status, created_at AS createdAt
      `).bind(body.status, moderatedAt, decodeURIComponent(match[1])).first()
      if (!result) throw new HttpError(404, 'Testimonial not found')
      await invalidatePublicCaches()
      await writeAuditLog(env, request, ownerUser, 'testimonial.moderate', { entityType: 'testimonial', entityId: decodeURIComponent(match[1]), details: { status: body.status } })
      return json(request, env, result, 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/analytics' && request.method === 'GET') return json(request, env, await getAnalytics(env), 200, { 'Cache-Control': 'no-store' })
    if (path === '/admin/settings' && request.method === 'GET') return json(request, env, await getSettings(env), 200, { 'Cache-Control': 'no-store' })
    if (path === '/admin/settings' && request.method === 'PUT') {
      const before = await getSettings(env)
      const result = await saveSettings(env, await readJson(request))
      await writeAuditLog(env, request, ownerUser, 'settings.update', { entityType: 'settings', entityId: 'site', details: { changed: Object.keys(result) } })
      return json(request, env, result, 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/integrations/status' && request.method === 'GET') return json(request, env, await getIntegrationStatus(env), 200, { 'Cache-Control': 'no-store' })

    // Exchange a current authenticator or recovery code for a signed,
    // session-bound five-minute challenge. The browser stores this challenge,
    // never the reusable raw authenticator code.
    if (path === '/admin/totp/challenge' && request.method === 'POST') {
      const body = await readJson(request)
      const row = await env.DB.prepare('SELECT secret, verified_at FROM admin_totp WHERE id = 1').first()
      if (!row?.verified_at) throw new HttpError(409, 'Two-factor authentication is not fully enrolled.')
      const code = cleanText(body.code, 16, 'Security code', { required: false })
      const recoveryCode = cleanText(body.recoveryCode, 16, 'Recovery code', { required: false })
      let ok = false
      let method = ''
      if (code && await verifyTotp(await readTotpSecret(env, row.secret), code)) {
        ok = true
        method = 'totp'
      }
      if (!ok && recoveryCode && await consumeRecoveryCode(env, recoveryCode)) {
        ok = true
        method = 'recovery'
      }
      if (!ok) {
        await writeAuditLog(env, request, ownerUser, 'totp.challenge_failed', { entityType: 'admin_totp', entityId: '1' })
        throw new HttpError(401, 'The authenticator or recovery code is incorrect.')
      }
      await env.DB.prepare('UPDATE admin_totp SET last_used_at = ? WHERE id = 1').bind(nowIso()).run()
      const issued = await createAdminChallenge(env, request, ownerUser)
      await writeAuditLog(env, request, ownerUser, 'totp.challenge_issued', { entityType: 'admin_totp', entityId: '1', details: { method } })
      return json(request, env, issued, 200, { 'Cache-Control': 'no-store' })
    }

    // TOTP enrolment. The first response returns the secret and recovery
    // codes (so the owner can scan/print them). The second request confirms
    // enrolment by sending a valid code from the authenticator app; only
    // then do we flip the row to "verified". An interrupted unverified
    // enrolment can safely be restarted.
    if (path === '/admin/totp/enrol' && request.method === 'POST') {
      const existing = await env.DB.prepare('SELECT 1 AS one, verified_at FROM admin_totp WHERE id = 1').first()
      if (existing?.one && existing.verified_at) {
        throw new HttpError(409, 'Two-factor authentication is already enrolled. Reset from the admin dashboard to re-enrol.')
      }
      const secretBytes = crypto.getRandomValues(new Uint8Array(20))
      const secret = bytesToBase32(secretBytes)
      const recoveryCodes = await generateRecoveryCodes(10)
      const recoveryHashes = await hashRecoveryCodes(recoveryCodes)
      const encryptedSecret = await encryptSensitiveValue(env, 'admin-totp-secret', secret)
      const now = nowIso()
      await env.DB.prepare(`
        INSERT INTO admin_totp (id, secret, enrolled_at, recovery_codes_hash)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET secret = excluded.secret, enrolled_at = excluded.enrolled_at,
          recovery_codes_hash = excluded.recovery_codes_hash, verified_at = NULL, last_used_at = NULL
      `).bind(encryptedSecret, now, recoveryHashes).run()
      await writeAuditLog(env, request, ownerUser, 'totp.enrol_start', { entityType: 'admin_totp', entityId: '1' })
      return json(request, env, {
        secret,
        otpauthUrl: `otpauth://totp/Runway%20Systems%20Admin?secret=${secret}&issuer=Runway%20Systems&algorithm=SHA1&digits=6&period=30`,
        recoveryCodes,
      }, 201, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/totp/verify' && request.method === 'POST') {
      const body = await readJson(request)
      const candidate = cleanText(body.code, 10, 'TOTP code')
      const row = await env.DB.prepare('SELECT secret FROM admin_totp WHERE id = 1').first()
      if (!row) throw new HttpError(409, 'Two-factor authentication has not been enrolled yet.')
      const ok = await verifyTotp(await readTotpSecret(env, row.secret), candidate)
      if (!ok) {
        await writeAuditLog(env, request, ownerUser, 'totp.verify_failed', { entityType: 'admin_totp', entityId: '1' })
        throw new HttpError(401, 'The code is incorrect.')
      }
      const verifiedAt = nowIso()
      await env.DB.prepare('UPDATE admin_totp SET verified_at = ?, last_used_at = ? WHERE id = 1').bind(verifiedAt, verifiedAt).run()
      await writeAuditLog(env, request, ownerUser, 'totp.verify_ok', { entityType: 'admin_totp', entityId: '1' })
      return json(request, env, { verified: true, ...(await createAdminChallenge(env, request, ownerUser)) }, 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/totp/status' && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT enrolled_at, verified_at, last_used_at FROM admin_totp WHERE id = 1').first()
      return json(request, env, { enrolled: Boolean(row), enrolledAt: row?.enrolled_at || '', verified: Boolean(row?.verified_at), lastUsedAt: row?.last_used_at || '' }, 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/totp/reset' && request.method === 'POST') {
      await env.DB.prepare('DELETE FROM admin_totp WHERE id = 1').run()
      await writeAuditLog(env, request, ownerUser, 'totp.reset', { entityType: 'admin_totp', entityId: '1' })
      return json(request, env, { reset: true }, 200, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/audit-log' && request.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') || 100)
      const entityType = cleanText(url.searchParams.get('entityType') || '', 40, 'entityType', { required: false })
      const subjectId = cleanText(url.searchParams.get('subjectId') || '', 80, 'subjectId', { required: false })
      return json(request, env, await getAdminAuditLog(env, { limit, entityType, subjectId }), 200, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/client-errors' && request.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') || 50)
      return json(request, env, await getAdminClientErrors(env, { limit }), 200, { 'Cache-Control': 'no-store' })
    }

    if (path === '/admin/delivery-issues' && request.method === 'GET') {
      return json(request, env, await getDeliveryIssues(env), 200, { 'Cache-Control': 'no-store' })
    }

    // Owner-triggered redelivery for a purchase that exhausted automatic
    // retries. Being a POST under /admin/ it automatically requires the
    // fresh-JWT + TOTP gate, and the action is written to the audit log.
    match = routeMatch(path, /^\/admin\/delivery-issues\/([^/]+)\/retry$/)
    if (match && request.method === 'POST') {
      const purchaseId = decodeURIComponent(match[1])
      await rateLimit(request, env, 'admin-delivery-retry', 30, 3600, ownerUser.id)
      const reset = await env.DB.prepare(`
        UPDATE purchases
        SET delivery_email_status = 'pending',
            delivery_email_attempts = 0,
            delivery_email_next_eligible_at = '',
            delivery_email_last_error = NULL,
            updated_at = ?
        WHERE id = ? AND payment_status = 'paid' AND access_source = 'paid'
          AND access_status = 'active' AND delivery_email_status != 'sent'
        RETURNING id, product_key
      `).bind(nowIso(), purchaseId).first()
      if (!reset) throw new HttpError(404, 'No undelivered paid purchase with that id')
      await writeAuditLog(env, request, ownerUser, 'delivery.retry', { entityType: 'purchase', entityId: purchaseId, details: { productKey: reset.product_key } })
      // Try the send immediately instead of waiting for the next cron tick;
      // deliverPurchaseEmail re-claims the row itself, so a { id } is enough.
      ctx.waitUntil(deliverPurchaseEmail(env, { id: purchaseId }))
      return json(request, env, { retried: true, purchaseId }, 200, { 'Cache-Control': 'no-store' })
    }
  }

  throw new HttpError(404, 'Endpoint not found')
}

export default {
  async fetch(request, env, ctx) {
    // Every response carries a correlation id. Clients can report it to
    // support; the detailed error (redacted of personal data) stays in the
    // server logs only and never reaches the client.
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID()
    try {
      const response = await handleRequest(request, env, ctx)
      response.headers.set('X-Correlation-Id', correlationId)
      return response
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      if (status >= 500) {
        console.error('Worker error', { correlationId, name: error?.name || 'Error', message: redactPii(error?.message), stack: redactPii(error?.stack) })
      }
      const message = status >= 500 && !(error instanceof HttpError) ? 'Unexpected server error' : error.message
      return json(request, env, { message, correlationId }, status, { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId })
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runScheduledTasks(env))
  },
}

// One cron tick, two jobs: drive the email queues forward, then prune
// telemetry rows past their retention window so client_errors cannot grow
// without bound. Both are idempotent, so a retried tick is harmless.
async function runScheduledTasks(env) {
  try {
    await processScheduledBlogPosts(env)
    await processBlogOutbox(env)
    await cleanupBlogTrash(env)
  } catch (error) {
    logEvent('warn', 'blog_automation_failed', { error: error?.message })
  }
  await processEmailQueues(env)
  if (!env.DB) return
  try {
    const cutoff = new Date(Date.now() - CLIENT_ERROR_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const auditCutoff = new Date(Date.now() - ADMIN_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    await env.DB.batch([
      env.DB.prepare('DELETE FROM client_errors WHERE created_at < ?').bind(cutoff),
      env.DB.prepare('DELETE FROM admin_audit_log WHERE created_at < ?').bind(auditCutoff),
      env.DB.prepare('DELETE FROM newsletter_confirmations WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)').bind(nowIso(), cutoff),
    ])
  } catch (error) {
    logEvent('warn', 'retention_prune_failed', { error: error?.message })
  }
}
