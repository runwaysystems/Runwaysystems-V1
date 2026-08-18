const PRODUCT_KEY = 'cashflow-os'
const REVIEW_DELAY_MS = 72 * 60 * 60 * 1000

// The exact agreement a buyer accepts at checkout, stored verbatim with each
// consent so a later wording change cannot rewrite what past buyers agreed to.
// Bump the version whenever CONSENT_TEXT changes; it must stay in step with
// src/components/CheckoutConsent.jsx.
const CONSENT_POLICY_VERSION = '2026-08-17'
const CONSENT_TEXT = 'I agree to the Terms, Privacy Policy and Refund Policy, and I understand these are digital products delivered instantly, so my right to cancel ends once I access my copy.'
const FEEDBACK_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

const PRODUCT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/
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
  const settings = await getSettings(env)
  const required = [
    ['APP_ORIGIN', 'Storefront origin allowlist'],
    ['SUPABASE_URL', 'Supabase project URL'],
    ['SUPABASE_ANON_KEY', 'Supabase anon key secret'],
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
  return { ready: missing.length === 0, missing }
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const allowed = getAllowedOrigins(env)
  if (!origin || !allowed.includes(origin.replace(/\/$/, ''))) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Correlation-Id',
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

function productRowToConfig(row) {
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
    offerLabel: row.offer_label || '',
    offerActive: Boolean(row.offer_active),
    includes: parseStringList(row.includes),
    lemonVariantId: row.lemon_variant_id || '',
    heroImage: row.hero_image || '',
    featureImages: parseStringList(row.feature_images),
    content: parseContentJson(row.content),
    updatedAt: row.updated_at || '',
    active: Boolean(row.active),
    featured: Boolean(row.featured),
    sortOrder: Number(row.sort_order || 0),
  }
}

async function ensureProductsSeeded(env) {
  const seededAt = nowIso()
  const statements = SEED_PRODUCTS.map((product) => env.DB.prepare(`
    INSERT OR IGNORE INTO products (
      key, name, tagline, category, icon, accent, delivery_url,
      original_price, sale_price, offer_label, offer_active, includes, active, featured, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, 1, ?, 1, ?, ?, ?, ?)
  `).bind(
    product.key,
    product.name,
    product.tagline,
    product.category,
    product.icon,
    product.accent,
    product.originalPrice,
    product.salePrice,
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

function publicProductShape(product, features = []) {
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
    featured: product.featured,
    sortOrder: product.sortOrder,
    includes: product.includes,
    heroImage: product.heroImage || '',
    featureImages: (features.length ? features.map((feature) => feature.imagePath) : (product.featureImages || [])),
    features,
    content: product.content || {},
    updatedAt: product.updatedAt || '',
    checkoutReady: Boolean(product.lemonVariantId && product.lemonVariantId !== ''),
  }
}

async function getActiveProducts(env) {
  await ensureProductsSeeded(env)
  const settings = await getSettings(env)
  const result = await env.DB.prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC, key ASC').all()
  const rows = result.results || []
  const featuresByKey = await featuresMapForProducts(env, rows)
  return rows.map((row) => {
    const product = productRowToConfig(row)
    if (product.key === PRODUCT_KEY) {
        product.deliveryUrl = product.deliveryUrl || env.GOOGLE_SHEETS_COPY_URL || ''
      product.originalPrice = product.originalPrice || settings.displayOriginalPrice || ''
      product.salePrice = product.salePrice || settings.displaySalePrice || ''
      product.offerLabel = product.offerLabel || settings.offerLabel || ''
    }
    return publicProductShape(product, featuresByKey.get(product.key) || [])
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
    offerLabel: cleanText(input.offerLabel, 80, 'Offer label'),
    offerActive: Boolean(input.offerActive),
    active: Boolean(input.active),
    featured: Boolean(input.featured),
    sortOrder: Math.min(999, Math.max(0, Number(input.sortOrder) || 0)),
    includes: cleanIncludes(input.includes),
  }
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
      original_price, sale_price, offer_label, offer_active, includes, active, featured, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    product.offerLabel,
    product.offerActive ? 1 : 0,
    JSON.stringify(product.includes),
    product.active ? 1 : 0,
    product.featured ? 1 : 0,
    product.sortOrder,
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
    // Never inherit payment or delivery wiring.
    lemonVariantId: '',
    deliveryUrl: '',
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
      original_price = ?, sale_price = ?, offer_label = ?, offer_active = ?, includes = ?,
      active = ?, featured = ?, sort_order = ?, updated_at = ?
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
    product.offerLabel,
    product.offerActive ? 1 : 0,
    JSON.stringify(product.includes),
    product.active ? 1 : 0,
    product.featured ? 1 : 0,
    product.sortOrder,
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
  for (const product of products) {
    const cents = priceInCents(product.salePrice)
    if (cents === null) return null
    fullCents += cents
  }
  const bundleCents = Math.round(fullCents * (100 - discountPercent) / 100)
  return { fullCents, bundleCents, savingCents: fullCents - bundleCents }
}

const centsToDisplay = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`

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
      fullPrice: centsToDisplay(pricing.fullCents),
      bundlePrice: centsToDisplay(pricing.bundleCents),
      saving: centsToDisplay(pricing.savingCents),
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

async function readJson(request) {
  const contentType = request.headers.get('Content-Type') || ''
  if (!contentType.includes('application/json')) throw new HttpError(415, 'Content-Type must be application/json')
  const text = await request.text()
  if (text.length > JSON_BODY_MAX_LENGTH) throw new HttpError(413, 'Request body is too large')
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON')
  }
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value)
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

function base64UrlToString(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
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
  await Promise.all(['config-public', 'sitemap', 'testimonials'].map((key) => cache.delete(`${PUBLIC_CACHE_ORIGIN}/${key}`).catch(() => {})))
}

async function rateLimit(request, env, bucket, limit, windowSeconds, subject = '') {
  if (!env.DB) throw new HttpError(503, 'Database is not configured')
  const address = request.headers.get('CF-Connecting-IP') || 'unknown'
  if (!subject && !env.RATE_LIMIT_SALT) throw new HttpError(503, 'Rate limiting is not configured')
  const safeSubject = subject || await sha256Hex(`${env.RATE_LIMIT_SALT}:${address}`)
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
  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
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

async function requireOwner(request, env) {
  const user = await authenticate(request, env)
  if (!userIsOwner(user, env)) throw new HttpError(403, 'Owner access required')
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

async function lemonSqueezyRequest(env, path, { method = 'GET', body } = {}) {
  if (!env.LEMONSQUEEZY_API_KEY) throw new HttpError(503, 'Lemon Squeezy API key is not configured')
  let response
  try {
    response = await fetch(`${LEMON_SQUEEZY_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
        Accept: 'application/vnd.api+json',
        ...(body ? { 'Content-Type': 'application/vnd.api+json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new HttpError(503, 'Lemon Squeezy could not be reached. Please try again.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('Lemon Squeezy request failed', response.status)
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
async function createLemonSqueezyCheckout(env, user, items, settings, bundle = null) {
  const storeId = String(settings.lemonSqueezyStoreId || '').trim()
  if (!storeId) throw new HttpError(503, 'The Lemon Squeezy store is not configured')
  const origin = getPrimaryOrigin(env)
  const productKeys = items.map((item) => item.product.key)
  const isMultiItem = items.length > 1
  let variantId = String(items[0].product.lemonVariantId || '').trim()
  if (!variantId) throw new HttpError(503, `No Lemon Squeezy variant is configured for ${items[0].product.name}`)
  const attributes = {
    store_id: Number(storeId),
    variant_id: Number(variantId),
    checkout_data: {
      email: user.email,
      custom: { user_id: user.id, product_keys: productKeys },
    },
    product_options: { redirect_url: `${origin}/success`, enabled_variants: [Number(variantId)] },
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }
  if (isMultiItem) {
    const lines = []
    let totalCents = 0
    for (const item of items) {
      const cents = priceInCents(item.product.salePrice)
      if (cents === null) throw new HttpError(503, `The displayed price is not configured for ${item.product.name}`)
      totalCents += cents
      lines.push(`${item.product.name} — ${String(item.product.salePrice || '').trim()}`)
    }
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
    attributes.variant_id = Number(variantId)
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
    if (!product.active) throw new HttpError(404, `${product.name} is not available`)
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

  const session = await createLemonSqueezyCheckout(env, user, items, settings, bundle)

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

function purchaseFromRow(row, productInfo = null) {
  const purchase = {
    id: row.id,
    productKey: row.product_key,
    amountTotal: Number(row.amount_total || 0),
    currency: row.currency || 'usd',
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    deliveryEmailStatus: row.delivery_email_status,
  }
  if (productInfo) purchase.product = productInfo(row.product_key)
  return purchase
}

async function findPurchaseForUser(env, purchaseId, userId) {
  const row = await env.DB.prepare(`
    SELECT * FROM purchases WHERE id = ? AND user_id = ? AND payment_status = 'paid'
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
async function sendBrevo(env, message) {
  if (!env.BREVO_API_KEY || !message.from) throw new Error('Brevo is not configured')
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
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
      ...(message.idempotencyKey ? { headers: { 'X-Runway-Idempotency-Key': message.idempotencyKey } } : {}),
    }),
  })
  if (!response.ok) {
    console.error('Brevo request failed', response.status)
    throw new Error(`Brevo returned ${response.status}`)
  }
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
    RETURNING *
  `).bind(claimedAt, purchase.id, staleBefore).first()

  if (!claimed) return false

  try {
    const product = await resolveProductConfig(env, claimed.product_key)
    await sendDeliveryEmail(env, claimed, product)
    await env.DB.prepare(`
      UPDATE purchases
      SET delivery_email_status = 'sent', delivery_email_sent_at = ?,
          delivery_email_last_error = NULL, updated_at = ?
      WHERE id = ? AND delivery_email_status = 'sending'
    `).bind(nowIso(), nowIso(), purchase.id).run()
    return true
  } catch (error) {
    await env.DB.prepare(`
      UPDATE purchases
      SET delivery_email_status = 'failed', delivery_email_last_error = ?, updated_at = ?
      WHERE id = ? AND delivery_email_status = 'sending'
    `).bind(String(error.message || error).slice(0, 500), nowIso(), purchase.id).run()
    console.error('Delivery email failed', purchase.id, redactPii(error?.message))
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
  const prompt = settings.emailTemplateText || `How's ${productName.toUpperCase()} working for you?`
  const intro = 'Your honest experience helps Runway Systems improve. Every verified buyer receives this same neutral invitation, regardless of their experience or rating. You can leave an independent Trustpilot review or send private feedback directly to our team.'
  const footer = `This invitation is sent consistently to verified buyers. The private feedback link expires after 30 days. Need help? ${env.SUPPORT_EMAIL || 'Contact Runway Systems support.'}`
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

async function processEmailQueues(env) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const pendingDeliveries = await env.DB.prepare(`
    SELECT * FROM purchases
    WHERE payment_status = 'paid'
      AND (delivery_email_status IN ('pending', 'failed') OR (delivery_email_status = 'sending' AND updated_at <= ?))
      AND delivery_email_attempts < 5
    ORDER BY created_at ASC LIMIT 20
  `).bind(staleBefore).all()
  for (const purchase of pendingDeliveries.results || []) await deliverPurchaseEmail(env, purchase)

  const settings = await getSettings(env)
  const dueReviews = await env.DB.prepare(`
    SELECT * FROM review_requests
    WHERE (status IN ('pending', 'failed') OR (status = 'sending' AND updated_at <= ?))
      AND attempts < 5 AND send_at <= ?
    ORDER BY send_at ASC LIMIT 20
  `).bind(staleBefore, nowIso()).all()
  for (const request of dueReviews.results || []) {
    const claimedAt = nowIso()
    const feedbackExpiresAt = new Date(Date.now() + FEEDBACK_TOKEN_TTL_SECONDS * 1000).toISOString()
    const claimed = await env.DB.prepare(`
      UPDATE review_requests
      SET status = 'sending', attempts = attempts + 1, feedback_expires_at = COALESCE(feedback_expires_at, ?),
          last_error = NULL, updated_at = ?
      WHERE id = ? AND attempts < 5
        AND (status IN ('pending', 'failed') OR (status = 'sending' AND updated_at <= ?))
        AND EXISTS (SELECT 1 FROM purchases WHERE purchases.id = review_requests.purchase_id AND purchases.payment_status = 'paid')
      RETURNING *
    `).bind(feedbackExpiresAt, claimedAt, request.id, staleBefore).first()
    if (!claimed) continue

    try {
      await sendReviewEmail(env, claimed, settings)
      await env.DB.prepare(`
        UPDATE review_requests
        SET status = 'sent', sent_at = ?, last_error = NULL, updated_at = ?
        WHERE id = ? AND status = 'sending'
      `).bind(nowIso(), nowIso(), request.id).run()
    } catch (error) {
      await env.DB.prepare(`
        UPDATE review_requests SET status = 'failed', last_error = ?, updated_at = ?
        WHERE id = ? AND status = 'sending'
      `).bind(String(error.message || error).slice(0, 500), nowIso(), request.id).run()
      console.error('Review email failed', request.id, redactPii(error?.message))
    }
  }

  await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(nowIso()).run()
}

async function recordLemonOrder(env, data, eventKey, eventName) {
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
  const custom = attributes.custom || {}
  const userId = String(custom.user_id || '').trim()
  const keys = Array.isArray(custom.product_keys) ? custom.product_keys : (custom.product_key ? [custom.product_key] : [])
  if (!identifier || !userId || !email) throw new HttpError(400, 'Lemon Squeezy order is missing account ownership metadata')
  const items = []
  for (const rawKey of keys.slice(0, 10)) {
    const productKey = String(rawKey).trim()
    if (!productKey) continue
    if (!(await isKnownProductKey(env, productKey))) throw new HttpError(400, 'Lemon Squeezy order is not for a known product')
    items.push(productKey)
  }
  if (!items.length) items.push(PRODUCT_KEY)

  const totalAmount = Number(attributes.total ?? attributes.subtotal ?? 0)
  const fallbackBase = Math.floor(totalAmount / items.length)
  const createdAt = attributes.created_at ? new Date(attributes.created_at).toISOString() : nowIso()
  const updatedAt = nowIso()
  const reviewSendAt = new Date(new Date(createdAt).getTime() + REVIEW_DELAY_MS).toISOString()
  // Look up the consent recorded when this checkout was created so the
  // purchase itself carries proof. Matched on the Lemon Squeezy checkout id
  // when present, else the most recent consent from this buyer.
  const checkoutId = String(attributes.checkout_id || attributes.first_order_item?.checkout_id || '')
  const consentRow = checkoutId
    ? await env.DB.prepare('SELECT created_at, policy_version FROM checkout_consents WHERE checkout_id = ? ORDER BY created_at DESC LIMIT 1').bind(checkoutId).first()
    : await env.DB.prepare('SELECT created_at, policy_version FROM checkout_consents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(userId).first()
  const consentAt = consentRow?.created_at || ''
  const consentPolicyVersion = consentRow?.policy_version || ''

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
        consent_at, consent_policy_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
        CASE WHEN EXISTS (SELECT 1 FROM revoked_orders WHERE order_identifier = ?) THEN 'refunded' ELSE 'paid' END,
        ?, 'pending', 0, ?, ?, ?, ?)
      ON CONFLICT(order_identifier, product_key) DO UPDATE SET
        user_id = excluded.user_id,
        customer_email = excluded.customer_email,
        customer_name = excluded.customer_name,
        variant_id = excluded.variant_id,
        amount_total = excluded.amount_total,
        currency = excluded.currency,
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
    ))
    statements.push(env.DB.prepare(`
      INSERT INTO review_requests (
        id, purchase_id, user_id, email, customer_name, send_at, status, attempts, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?
      WHERE EXISTS (SELECT 1 FROM purchases WHERE id = ? AND payment_status = 'paid')
      ON CONFLICT(purchase_id) DO NOTHING
    `).bind(makeId('review_request'), purchaseId, userId, email, String(attributes.user_name || ''), reviewSendAt, updatedAt, updatedAt, purchaseId))
  }
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO processed_webhooks (event_id, event_type, processed_at) VALUES (?, ?, ?)').bind(eventKey, eventName, updatedAt))
  await env.DB.batch(statements)

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
    env.DB.prepare('UPDATE purchases SET payment_status = ?, updated_at = ? WHERE order_identifier = ?').bind('refunded', updatedAt, identifier),
    env.DB.prepare(`
      UPDATE review_requests SET status = 'cancelled', updated_at = ?
      WHERE purchase_id IN (SELECT id FROM purchases WHERE order_identifier = ?) AND status != 'sent'
    `).bind(updatedAt, identifier),
    env.DB.prepare('INSERT OR IGNORE INTO processed_webhooks (event_id, event_type, processed_at) VALUES (?, ?, ?)').bind(eventKey, eventName, updatedAt),
  ])
}

async function handleLemonSqueezyWebhook(request, env, ctx) {
  if (!env.LEMONSQUEEZY_WEBHOOK_SECRET) throw new HttpError(503, 'Lemon Squeezy webhook verification is not configured')
  const rawBody = await request.text()
  const signature = String(request.headers.get('X-Signature') || '').toLowerCase()
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) throw new HttpError(400, 'Invalid Lemon Squeezy signature')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.LEMONSQUEEZY_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  if (!constantTimeEqual(signature, expected)) throw new HttpError(400, 'Invalid Lemon Squeezy signature')

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
    const purchases = await recordLemonOrder(env, event.data, eventKey, eventName)
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
  const result = await env.DB.prepare(`
    SELECT * FROM purchases
    WHERE user_id = ? AND payment_status = 'paid'
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

  // Purchases: detach ownership and clear email and name. Order
  // identifiers stay for refund revocation, and amount/currency stay for
  // aggregate reporting.
  const purchasesResult = await env.DB.prepare(`
    UPDATE purchases
    SET user_id = 'deleted:' || id,
        customer_email = '',
        customer_name = '',
        updated_at = ?
    WHERE user_id = ?
  `).bind(updatedAt, user.id).run()

  // Review requests hold delivery email addresses: delete outright.
  await env.DB.prepare('DELETE FROM review_requests WHERE user_id = ?').bind(user.id).run()

  // Testimonials: withdraw from public display and clear name and text.
  await env.DB.prepare(`
    UPDATE testimonials
    SET name = '', text = '', status = 'rejected', moderated_at = ?
    WHERE user_id = ?
  `).bind(updatedAt, user.id).run()

  // Feedback: clear free text; keep the numeric rating for aggregate
  // averages only.
  await env.DB.prepare('UPDATE feedback SET text = \'\' WHERE user_id = ?').bind(user.id).run()

  // Rate-limit rows keyed by the user id.
  await env.DB.prepare('DELETE FROM rate_limits WHERE key LIKE ?').bind(`%:${user.id}:%`).run()

  await invalidatePublicCaches()
  return { deleted: true, purchasesDetached: Number(purchasesResult.meta?.changes || 0) }
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
  const [sales, views, reviews, revenueByMonth, viewsByMonth] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(amount_total), 0) AS revenue FROM purchases WHERE payment_status = 'paid'`).first(),
    env.DB.prepare('SELECT COALESCE(SUM(page_views), 0) AS total FROM daily_metrics').first(),
    env.DB.prepare('SELECT COUNT(DISTINCT purchase_id) AS total, COALESCE(AVG(rating), 0) AS average FROM feedback').first(),
    env.DB.prepare(`
      SELECT substr(created_at, 1, 7) AS month, COALESCE(SUM(amount_total), 0) AS revenue, COUNT(*) AS sales
      FROM purchases WHERE payment_status = 'paid' GROUP BY month
    `).all(),
    env.DB.prepare(`
      SELECT substr(date, 1, 7) AS month, COALESCE(SUM(page_views), 0) AS views
      FROM daily_metrics GROUP BY month
    `).all(),
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

async function getIntegrationStatus(env) {
  const aiMode = env.AI ? 'binding' : (env.AI_ACCOUNT_ID && env.AI_API_TOKEN ? 'rest' : '')
  return [
    { id: 'lemonsqueezy', label: 'Lemon Squeezy', status: env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_WEBHOOK_SECRET ? 'connected' : 'setup', detail: 'Merchant of record: Lemon Squeezy handles global sales tax and remittance for your orders' },
    { id: 'supabase', label: 'Supabase', status: env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? 'connected' : 'setup', detail: 'Google OAuth and account verification' },
    { id: 'email', label: 'Brevo', status: env.BREVO_API_KEY && env.EMAIL_FROM_DELIVERY && env.EMAIL_FROM_INFO ? 'connected' : 'setup', detail: 'Delivery and neutral review invitations' },
    { id: 'trustpilot', label: 'Trustpilot', status: env.TRUSTPILOT_REVIEW_URL ? 'connected' : 'setup', detail: 'Neutral invitation for every verified buyer' },
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
        suiteContent: settings.suiteContent || {},
        policies: settings.policies || {},
        announcement: { ...(settings.announcement || {}), active: Boolean(settings.announcement?.message && settings.announcement?.active) },
        paymentProvider: 'lemonsqueezy',
        reviewPolicy: 'neutral-all-verified-buyers',
      })
    })
    return json(request, env, JSON.parse(bodyText), 200, { 'Cache-Control': 'public, max-age=60' })
  }
  if (path === '/sitemap.xml' && request.method === 'GET') {
    const origin = getPrimaryOrigin(env)
    const products = await getActiveProducts(env)
    const escapeXml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    const urls = [
      `<url><loc>${escapeXml(origin)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${escapeXml(origin)}/terms</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>`,
      ...products.map((product) => `<url><loc>${escapeXml(origin)}/products/${escapeXml(product.key)}</loc>${product.updatedAt ? `<lastmod>${escapeXml(product.updatedAt.slice(0, 10))}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>0.9</priority></url>`),
    ]
    const xml = await getCachedPublic('sitemap', 3600, async () => `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n${urls.join('\n')}\n</urlset>`)
    return new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', ...SECURITY_HEADERS, 'Cache-Control': 'public, max-age=3600' },
    })
  }
  if (path === '/events/page-view' && request.method === 'POST') {
    await trackPageView(request, env)
    return json(request, env, { accepted: true }, 202)
  }
  if (path === '/testimonials' && request.method === 'GET') {
    const bodyText = await getCachedPublic('testimonials', 60, async () => JSON.stringify(await getApprovedTestimonials(env)))
    return json(request, env, JSON.parse(bodyText), 200, { 'Cache-Control': 'public, max-age=60' })
  }

  if (path === '/checkout/session' && request.method === 'POST') {
    const user = await authenticate(request, env)
    return json(request, env, await createCheckoutSession(request, env, user), 201, { 'Cache-Control': 'no-store' })
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
  let match = routeMatch(path, /^\/account\/purchases\/([^/]+)\/delivery$/)
  if (match && request.method === 'POST') {
    const user = await authenticate(request, env)
    await rateLimit(request, env, 'delivery', 20, 3600, user.id)
    const purchase = await findPurchaseForUser(env, decodeURIComponent(match[1]), user.id)
    const product = await resolveProductConfig(env, purchase.product_key)
    return json(request, env, { url: productDeliveryUrl(env, product) }, 200, { 'Cache-Control': 'no-store' })
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
    const ownerUser = await requireOwner(request, env)
    if (path === '/admin/products' && request.method === 'GET') {
      await ensureProductsSeeded(env)
      const result = await env.DB.prepare('SELECT * FROM products ORDER BY sort_order ASC, key ASC').all()
      const rows = result.results || []
      const featuresByKey = await featuresMapForProducts(env, rows)
      return json(request, env, rows.map((row) => ({ ...productRowToConfig(row), features: featuresByKey.get(row.key) || [] })), 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/products' && request.method === 'POST') {
      const body = await readJson(request)
      // An optional duplicateFrom copies an existing product's content into the
      // new key; without it this is an ordinary create.
      const source = cleanText(String(body.duplicateFrom || ''), 60, 'Source product key', { required: false })
      if (source) {
        return json(request, env, await duplicateProduct(env, source, body), 201, { 'Cache-Control': 'no-store' })
      }
      return json(request, env, await createProduct(env, body), 201, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/bundles' && request.method === 'GET') {
      const result = await env.DB.prepare('SELECT * FROM bundles ORDER BY sort_order ASC, key ASC').all()
      return json(request, env, (result.results || []).map(bundleRowToConfig), 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/bundles' && request.method === 'POST') {
      return json(request, env, await createBundle(env, await readJson(request)), 201, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/bundles\/([^/]+)$/)
    if (match && request.method === 'PATCH') {
      return json(request, env, await updateBundle(env, decodeURIComponent(match[1]), await readJson(request)), 200, { 'Cache-Control': 'no-store' })
    }
    if (match && request.method === 'DELETE') {
      return json(request, env, await deleteBundle(env, decodeURIComponent(match[1])), 200, { 'Cache-Control': 'no-store' })
    }
    match = routeMatch(path, /^\/admin\/products\/([^/]+)$/)
    if (match && request.method === 'PATCH') {
      return json(request, env, await updateProduct(env, decodeURIComponent(match[1]), await readJson(request)), 200, { 'Cache-Control': 'no-store' })
    }
    if (match && request.method === 'DELETE') {
      return json(request, env, await deleteProduct(env, decodeURIComponent(match[1])), 200, { 'Cache-Control': 'no-store' })
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
      return json(request, env, result, 200, { 'Cache-Control': 'no-store' })
    }
    if (path === '/admin/analytics' && request.method === 'GET') return json(request, env, await getAnalytics(env), 200, { 'Cache-Control': 'no-store' })
    if (path === '/admin/settings' && request.method === 'GET') return json(request, env, await getSettings(env), 200, { 'Cache-Control': 'no-store' })
    if (path === '/admin/settings' && request.method === 'PUT') return json(request, env, await saveSettings(env, await readJson(request)), 200, { 'Cache-Control': 'no-store' })
    if (path === '/admin/integrations/status' && request.method === 'GET') return json(request, env, await getIntegrationStatus(env), 200, { 'Cache-Control': 'no-store' })
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
    ctx.waitUntil(processEmailQueues(env))
  },
}
