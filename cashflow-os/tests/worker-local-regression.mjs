import { createHmac } from 'node:crypto'
import process from 'node:process'

const BASE_URL = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787'
const APP_ORIGIN = process.env.WORKER_APP_ORIGIN || 'https://regression-store.test'
// A fresh source IP per minute bucket keeps the per-IP auth-gate counter
// isolated across repeated runs of this suite.
const TEST_IP = process.env.WORKER_TEST_IP || `198.51.100.${(Math.floor(Date.now() / 60000) % 200) + 1}`
const LS_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
const OWNER_TOKEN = process.env.WORKER_OWNER_TOKEN || ''

if (!LS_WEBHOOK_SECRET) {
  console.error('Set LEMONSQUEEZY_WEBHOOK_SECRET to the safe local value configured in worker/.dev.vars.')
  process.exit(1)
}

const results = []

async function request(path, { method = 'GET', origin = APP_ORIGIN, body, headers = {} } = {}) {
  const finalHeaders = new Headers(headers)
  if (origin) finalHeaders.set('Origin', origin)
  finalHeaders.set('CF-Connecting-IP', TEST_IP)
  if (body !== undefined && !finalHeaders.has('Content-Type')) finalHeaders.set('Content-Type', 'application/json')
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { response, payload, text }
}

function check(name, condition, detail = '') {
  results.push({ name, condition: Boolean(condition), detail })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition || !detail ? '' : `: ${detail}`}`)
}

function signedLemonWebhook(event) {
  const body = JSON.stringify(event)
  const signature = createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '').update(body).digest('hex')
  return request('/webhooks/lemonsqueezy', {
    method: 'POST',
    origin: null,
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
    },
  })
}

const health = await request('/health')
check('health reports full readiness when configuration is complete', health.response.status === 200 && health.payload?.ok === true
  && health.payload?.ready === true && Array.isArray(health.payload?.missing) && health.payload.missing.length === 0, `${health.response.status} ${health.text.slice(0, 200)}`)
check('allowed CORS origin is exact', health.response.headers.get('Access-Control-Allow-Origin') === APP_ORIGIN)

check('security headers are applied to every response', (() => {
  const headers = health.response.headers
  return headers.get('X-Content-Type-Options') === 'nosniff'
    && headers.get('X-Frame-Options') === 'DENY'
    && /max-age=31536000/.test(headers.get('Strict-Transport-Security') || '')
    && /default-src 'none'/.test(headers.get('Content-Security-Policy') || '')
    && /frame-ancestors 'none'/.test(headers.get('Content-Security-Policy') || '')
    && headers.get('Referrer-Policy') === 'no-referrer'
})())

check('correlation ids ride on every response', /^[0-9a-f-]{36}$/i.test(health.response.headers.get('X-Correlation-Id') || ''))

const hostileOrigin = await request('/health', { origin: 'https://attacker.example' })
check('unapproved CORS origin is denied', hostileOrigin.response.status === 200 && !hostileOrigin.response.headers.has('Access-Control-Allow-Origin'))

const publicConfig = await request('/config/public')
const publicKeys = Object.keys(publicConfig.payload || {}).sort().join(',')
check('public configuration exposes only safe storefront settings', publicConfig.response.status === 200
  && publicKeys === 'announcement,bundles,paymentProvider,policies,products,reviewPolicy,suiteContent,supportEmail,trustpilotBusinessUnitId,trustpilotBusinessUrl'
  && publicConfig.payload?.reviewPolicy === 'neutral-all-verified-buyers'
  && typeof publicConfig.payload?.suiteContent === 'object'
  && typeof publicConfig.payload?.policies === 'object'
  && typeof publicConfig.payload?.announcement === 'object'
  && publicConfig.payload?.announcement?.active === false, publicConfig.text.slice(0, 200))
check('public configuration lists active products with safe shapes', Array.isArray(publicConfig.payload?.products)
  && publicConfig.payload.products.length >= 4
  && publicConfig.payload.products.every((product) => typeof product.key === 'string'
    && typeof product.name === 'string'
    && typeof product.checkoutReady === 'boolean'
    && !Object.hasOwn(product, 'lemonVariantId')
    && !Object.hasOwn(product, 'deliveryUrl')), publicConfig.text)
const cashflowPublic = (publicConfig.payload?.products || []).find((product) => product.key === 'cashflow-os')
check('cashflow-os defaults remain the anchor offer', Boolean(cashflowPublic)
  && cashflowPublic.offerActive === true
  && cashflowPublic.offerLabel === 'Launch Offer'
  && cashflowPublic.originalPrice === '$69'
  && cashflowPublic.salePrice === '$39', publicConfig.text)
// Banned names must appear as JSON keys (or secret-style identifiers), so
// legitimate values such as paymentProvider:"lemonsqueezy" stay allowed.
check('public configuration leaks no privileged names', !/"BREVO|GOOGLE_SHEETS|SUPABASE_ANON|FEEDBACK_SIGNING|"activePriceId"|"lemonVariantId"|"deliveryUrl"/i.test(publicConfig.text))

if (OWNER_TOKEN) {
  const ownerHeaders = { Authorization: `Bearer ${OWNER_TOKEN}` }
  // Reset persisted settings first so the run is idempotent across repeats.
  await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: {
      offerActive: true,
      offerLabel: 'Launch Offer',
      displayOriginalPrice: '$69',
      displaySalePrice: '$39',
      emailTemplateText: "How's CASHFLOW OS working for you?",
      trustpilotBusinessUrl: 'https://www.trustpilot.com/review/your-domain.com',
      lemonSqueezyStoreId: '12345',
      lemonSqueezyBundleVariantId: '',
    },
  })
  await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { name: 'Cash Flow OS', tagline: '', category: 'Finance', icon: 'spreadsheet', accent: 'lime', lemonVariantId: '', deliveryUrl: '', offerActive: true, offerLabel: 'Launch Offer', originalPrice: '$69', salePrice: '$39', active: true, featured: true, sortOrder: 0, includes: ['Live finance dashboard', 'Private Google Sheets copy', 'All future updates'] },
  })
  const adminSettings = await request('/admin/settings', { headers: ownerHeaders })
  check('owner settings keep Lemon Squeezy billing and public offer fields distinct', adminSettings.response.status === 200
    && typeof adminSettings.payload?.lemonSqueezyStoreId === 'string'
    && adminSettings.payload?.offerActive === true
    && adminSettings.payload?.offerLabel === 'Launch Offer', `${adminSettings.response.status} ${adminSettings.text}`)

  const updatedSettings = {
    ...adminSettings.payload,
    lemonSqueezyStoreId: '54321',
    offerActive: false,
    offerLabel: 'Worker Test Offer',
    displayOriginalPrice: '$91',
    displaySalePrice: '$47',
  }
  const savedSettings = await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: updatedSettings,
  })
  check('owner settings persist all customer-facing offer values', savedSettings.response.status === 200
    && savedSettings.payload?.lemonSqueezyStoreId === '54321'
    && savedSettings.payload?.offerActive === false
    && savedSettings.payload?.offerLabel === 'Worker Test Offer'
    && savedSettings.payload?.displayOriginalPrice === '$91'
    && savedSettings.payload?.displaySalePrice === '$47', `${savedSettings.response.status} ${savedSettings.text}`)

  const invalidSettings = await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: { ...updatedSettings, offerLabel: ' '.repeat(3) },
  })
  check('offer display text is validated before settings are persisted', invalidSettings.response.status === 400
    && /Offer label/i.test(invalidSettings.payload?.message || ''), `${invalidSettings.response.status} ${invalidSettings.text}`)

  const adminProducts = await request('/admin/products', { headers: ownerHeaders })
  check('owner can list the full product catalog', adminProducts.response.status === 200
    && Array.isArray(adminProducts.payload)
    && adminProducts.payload.length >= 4
    && adminProducts.payload.some((product) => product.key === 'cashflow-os'
      && typeof product.lemonVariantId === 'string'
      && typeof product.deliveryUrl === 'string'), `${adminProducts.response.status} ${adminProducts.text}`)

  const badProductKey = await request('/admin/products', {
    method: 'POST',
    headers: ownerHeaders,
    body: { key: 'Bad Key!', name: 'Nope' },
  })
  check('product keys are validated before creation', badProductKey.response.status === 400
    && /Product key/i.test(badProductKey.payload?.message || ''), `${badProductKey.response.status} ${badProductKey.text}`)

  const badProductIcon = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { name: 'Cash Flow OS', icon: 'not-an-icon' },
  })
  check('product updates validate icon choices', badProductIcon.response.status === 400
    && /icon/i.test(badProductIcon.payload?.message || ''), `${badProductIcon.response.status} ${badProductIcon.text}`)

  const savedProduct = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: {
      name: 'Cash Flow OS',
      tagline: '',
      category: 'Finance',
      icon: 'spreadsheet',
      accent: 'lime',
      deliveryUrl: '',
      offerActive: false,
      offerLabel: 'Worker Test Offer',
      originalPrice: '$91',
      salePrice: '$47',
      active: true,
      featured: true,
      sortOrder: 0,
      includes: ['Private Google Sheets copy', 'All future updates'],
    },
  })
  check('owner product updates persist all customer-facing offer values', savedProduct.response.status === 200
    && savedProduct.payload?.offerActive === false
    && savedProduct.payload?.offerLabel === 'Worker Test Offer'
    && savedProduct.payload?.originalPrice === '$91'
    && savedProduct.payload?.salePrice === '$47', `${savedProduct.response.status} ${savedProduct.text}`)

  const updatedPublicConfig = await request('/config/public')
  const updatedCashflow = (updatedPublicConfig.payload?.products || []).find((product) => product.key === 'cashflow-os')
  check('public configuration reflects saved product values without exposing secrets', updatedPublicConfig.response.status === 200
    && updatedCashflow?.offerActive === false
    && updatedCashflow?.offerLabel === 'Worker Test Offer'
    && updatedCashflow?.originalPrice === '$91'
    && updatedCashflow?.salePrice === '$47'
    && !updatedPublicConfig.text.includes('price_worker_regression_charge')
    && !updatedPublicConfig.text.includes('lemonVariantId'), `${updatedPublicConfig.response.status} ${updatedPublicConfig.text}`)

  const invalidProductOffer = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { name: 'Cash Flow OS', icon: 'spreadsheet', accent: 'lime', offerLabel: ' '.repeat(3) },
  })
  check('offer display text is validated before product persistence', invalidProductOffer.response.status === 400
    && /Offer label/i.test(invalidProductOffer.payload?.message || ''), `${invalidProductOffer.response.status} ${invalidProductOffer.text}`)

  const cashflowBase = {
    name: 'Cash Flow OS',
    tagline: '',
    category: 'Finance',
    icon: 'spreadsheet',
    accent: 'lime',
    deliveryUrl: '',
    offerActive: true,
    offerLabel: 'Launch Offer',
    originalPrice: '$69',
    salePrice: '$39',
    active: true,
    featured: true,
    sortOrder: 0,
    includes: ['Live finance dashboard', 'Private Google Sheets copy', 'All future updates'],
  }
  await request('/admin/products/cashflow-os', { method: 'PATCH', headers: ownerHeaders, body: cashflowBase })

  const mediaReset = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, heroImage: '', featureImages: [] },
  })
  check('product media fields can be reset for clean test runs', mediaReset.response.status === 200
    && mediaReset.payload?.heroImage === ''
    && Array.isArray(mediaReset.payload?.featureImages)
    && mediaReset.payload.featureImages.length === 0, `${mediaReset.response.status} ${mediaReset.text}`)

  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  const badImage = await request('/admin/products/cashflow-os/upload', {
    method: 'POST',
    headers: ownerHeaders,
    body: { slot: 'hero', image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' },
  })
  check('unsupported upload formats are rejected', badImage.response.status === 400
    && /PNG, JPEG, or WebP/i.test(badImage.payload?.message || ''), `${badImage.response.status} ${badImage.text}`)

  const fakeImage = await request('/admin/products/cashflow-os/upload', {
    method: 'POST',
    headers: ownerHeaders,
    body: { slot: 'hero', image: `data:image/png;base64,${Buffer.from('this is definitely not a png image despite the label, long enough to pass the size floor for the signature check').toString('base64')}` },
  })
  check('upload content is verified against its declared format', fakeImage.response.status === 400
    && /does not match its declared format/i.test(fakeImage.payload?.message || ''), `${fakeImage.response.status} ${fakeImage.text}`)

  const heroUpload = await request('/admin/products/cashflow-os/upload', {
    method: 'POST',
    headers: ownerHeaders,
    body: { slot: 'hero', image: tinyPng },
  })
  check('owner uploads a hero image into media storage', heroUpload.response.status === 201
    && /^\/media\/cashflow-os\/[a-f0-9-]{36}\.webp$/.test(heroUpload.payload?.heroImage || ''), `${heroUpload.response.status} ${heroUpload.text}`)

  const mediaFetch = await request(heroUpload.payload?.heroImage || '/media/cashflow-os/missing.webp')
  check('uploaded media is served with immutable caching', mediaFetch.response.status === 200
    && /image\//.test(mediaFetch.response.headers.get('content-type') || '')
    && (mediaFetch.response.headers.get('cache-control') || '').includes('immutable'), `${mediaFetch.response.status} ${mediaFetch.text.slice(0, 80)}`)

  const featureUpload = await request('/admin/products/cashflow-os/upload', {
    method: 'POST',
    headers: ownerHeaders,
    body: { slot: 'feature', image: tinyPng },
  })
  check('owner attaches feature screenshots in order', featureUpload.response.status === 201
    && Array.isArray(featureUpload.payload?.featureImages)
    && featureUpload.payload.featureImages.length === 1
    && /^\/media\/cashflow-os\/[a-f0-9-]{36}\.webp$/.test(featureUpload.payload.featureImages[0] || '')
    && featureUpload.payload.heroImage === heroUpload.payload.heroImage, `${featureUpload.response.status} ${featureUpload.text}`)

  const invalidMediaPath = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, heroImage: 'https://evil.example/x.webp' },
  })
  check('media paths are validated on product updates', invalidMediaPath.response.status === 400
    && /media path/i.test(invalidMediaPath.payload?.message || ''), `${invalidMediaPath.response.status} ${invalidMediaPath.text}`)

  const missingMedia = await request('/media/cashflow-os/00000000-0000-4000-8000-000000000000.webp')
  check('missing media returns a sanitized not found', missingMedia.response.status === 404 && missingMedia.payload?.message === 'Media not found', `${missingMedia.response.status} ${missingMedia.text}`)

  const integrations = await request('/admin/integrations/status', { headers: ownerHeaders })
  check('integration health reports AI image scanning state', integrations.response.status === 200
    && Array.isArray(integrations.payload)
    && integrations.payload.some((item) => item.id === 'ai' && ['connected', 'setup'].includes(item.status) && typeof item.detail === 'string'), `${integrations.response.status} ${integrations.text.slice(0, 200)}`)

  // Storefront content management: product content, suite content, policies,
  // support email, and the Trustpilot unit id are all owner-editable.
  const contentSaved = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, content: { hero: { h1: ['Numbers, owned.', 'Confidence, shipped.'], lede: 'Content edited from the owner dashboard.' }, finalCta: { h2: ['Start clear.', 'Stay clear.'] } } },
  })
  check('product marketing content is owner-editable', contentSaved.response.status === 200
    && contentSaved.payload?.content?.hero?.h1?.[0] === 'Numbers, owned.'
    && contentSaved.payload?.content?.finalCta?.h2?.[0] === 'Start clear.', `${contentSaved.response.status} ${contentSaved.text.slice(0, 160)}`)

  const badContent = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, content: 'not-an-object' },
  })
  check('product content is validated as a JSON object', badContent.response.status === 400
    && /must be a JSON object/i.test(badContent.payload?.message || ''), `${badContent.response.status} ${badContent.text}`)

  const siteContentSaved = await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: {
      ...adminSettings.payload,
      suiteContent: { hero: { h1: ['Suite, owned.', 'Suite, shipped.'] } },
      policies: { intro: 'Policies edited from the owner dashboard.' },
      supportEmail: 'support@runway-systems.example',
      trustpilotBusinessUnitId: 'unit-id-from-admin',
      announcement: { active: true, message: 'Launch week: everything is on sale.', linkText: 'Shop now', linkUrl: 'https://runway-systems.example/sale', dismissible: true },
      defaultOffer: { offerActive: true, offerLabel: 'Founding Offer', displayOriginalPrice: '$99', displaySalePrice: '$59' },
    },
  })
  check('suite content, policies, identity, announcement, and default offer are owner-editable', siteContentSaved.response.status === 200
    && siteContentSaved.payload?.suiteContent?.hero?.h1?.[0] === 'Suite, owned.'
    && siteContentSaved.payload?.policies?.intro === 'Policies edited from the owner dashboard.'
    && siteContentSaved.payload?.supportEmail === 'support@runway-systems.example'
    && siteContentSaved.payload?.trustpilotBusinessUnitId === 'unit-id-from-admin'
    && siteContentSaved.payload?.announcement?.message === 'Launch week: everything is on sale.'
    && siteContentSaved.payload?.defaultOffer?.offerLabel === 'Founding Offer'
    && siteContentSaved.payload?.defaultOffer?.displaySalePrice === '$59', `${siteContentSaved.response.status} ${siteContentSaved.text.slice(0, 240)}`)

  const badAnnouncementLink = await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: { ...siteContentSaved.payload, announcement: { ...siteContentSaved.payload.announcement, linkUrl: 'javascript:alert(1)' } },
  })
  check('announcement links are validated as HTTPS URLs', badAnnouncementLink.response.status === 400
    && /must be a valid HTTPS URL/i.test(badAnnouncementLink.payload?.message || ''), `${badAnnouncementLink.response.status} ${badAnnouncementLink.text}`)

  const publicAfterContent = await request('/config/public')
  check('edited content and announcement flow to the public storefront config', publicAfterContent.response.status === 200
    && publicAfterContent.payload?.suiteContent?.hero?.h1?.[0] === 'Suite, owned.'
    && publicAfterContent.payload?.policies?.intro === 'Policies edited from the owner dashboard.'
    && publicAfterContent.payload?.supportEmail === 'support@runway-systems.example'
    && publicAfterContent.payload?.trustpilotBusinessUnitId === 'unit-id-from-admin'
    && publicAfterContent.payload?.announcement?.active === true
    && publicAfterContent.payload?.announcement?.message === 'Launch week: everything is on sale.'
    && publicAfterContent.payload?.announcement?.linkUrl === 'https://runway-systems.example/sale', `${publicAfterContent.response.status} ${publicAfterContent.text.slice(0, 240)}`)

  // Future products inherit the default offer template at creation, so new
  // products ship sell-ready without extra configuration.
  const futureKey = `future-product-${Date.now() % 100000}`
  const futureCreated = await request('/admin/products', {
    method: 'POST',
    headers: ownerHeaders,
    body: { key: futureKey, name: 'Future Product', category: 'Planning', icon: 'folder', accent: 'lime', active: false },
  })
  check('future products inherit the default offer at creation', futureCreated.response.status === 201
    && futureCreated.payload?.offerActive === true
    && futureCreated.payload?.offerLabel === 'Founding Offer'
    && futureCreated.payload?.originalPrice === '$99'
    && futureCreated.payload?.salePrice === '$59', `${futureCreated.response.status} ${futureCreated.text.slice(0, 240)}`)

  // Restore defaults for idempotent runs.
  await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, content: {} },
  })
  await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: {
      ...adminSettings.payload,
      suiteContent: {},
      policies: {},
      supportEmail: '',
      trustpilotBusinessUnitId: '',
      announcement: { active: false, message: '', linkText: '', linkUrl: '', dismissible: true },
      defaultOffer: { offerActive: true, offerLabel: 'Launch Offer', displayOriginalPrice: '', displaySalePrice: '' },
    },
  })

  const featureCreated = await request('/admin/products/cashflow-os/features', {
    method: 'POST',
    headers: ownerHeaders,
    body: { image: tinyPng },
  })
  check('feature uploads return media, metadata, and AI scan status', featureCreated.response.status === 201
    && /^\/media\/cashflow-os\/[a-f0-9-]{36}\.webp$/.test(featureCreated.payload?.feature?.imagePath || '')
    && typeof featureCreated.payload?.feature?.heading === 'string'
    && typeof featureCreated.payload?.feature?.subheading === 'string'
    && typeof featureCreated.payload?.aiAvailable === 'boolean', `${featureCreated.response.status} ${featureCreated.text}`)

  const featureId = featureCreated.payload?.feature?.id || ''

  const featureEdited = await request(`/admin/products/cashflow-os/features/${encodeURIComponent(featureId)}`, {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { heading: 'Live revenue dashboard', subheading: 'Every money metric refreshes in one view.' },
  })
  check('feature headings and subheadings are editable', featureEdited.response.status === 200
    && featureEdited.payload?.heading === 'Live revenue dashboard'
    && /money metric/.test(featureEdited.payload?.subheading || ''), `${featureEdited.response.status} ${featureEdited.text}`)

  // The unlimited-upload proof only uploads as many features as needed to
  // exceed eight, so repeated runs of the suite reuse persisted rows
  // instead of exhausting the hourly media-upload rate limit.
  const adminBeforeUploads = await request('/admin/products', { headers: ownerHeaders })
  const cashflowBeforeUploads = (adminBeforeUploads.payload || []).find((product) => product.key === 'cashflow-os')
  const existingFeatures = Array.isArray(cashflowBeforeUploads?.features) ? cashflowBeforeUploads.features.length : 0
  const uploadsNeeded = Math.max(0, 11 - existingFeatures)
  const unlimited = []
  for (let count = 0; count < uploadsNeeded; count += 1) {
    unlimited.push(await request('/admin/products/cashflow-os/features', {
      method: 'POST',
      headers: ownerHeaders,
      body: { image: tinyPng, heading: `View ${count}`, subheading: 'Uploaded without a cap.' },
    }))
  }
  check('feature showcases accept unlimited screenshots beyond eight', unlimited.every((entry) => entry.response.status === 201)
    && existingFeatures + unlimited.length >= 11, unlimited.map((entry) => entry.response.status).join(','))

  const adminProductsAfter = await request('/admin/products', { headers: ownerHeaders })
  const cashflowAfter = (adminProductsAfter.payload || []).find((product) => product.key === 'cashflow-os')
  check('admin catalog exposes ordered feature metadata', Array.isArray(cashflowAfter?.features)
    && cashflowAfter.features.length >= 11
    && cashflowAfter.features.every((feature) => typeof feature.heading === 'string' && /^\/media\//.test(feature.imagePath)), adminProductsAfter.text.slice(0, 160))

  const publicAfter = await request('/config/public')
  const cashflowPublicAfter = (publicAfter.payload?.products || []).find((product) => product.key === 'cashflow-os')
  check('public config carries features without leaking storage internals', Array.isArray(cashflowPublicAfter?.features)
    && cashflowPublicAfter.features.length >= 11
    && cashflowPublicAfter.features.every((feature) => /^\/media\//.test(feature.imagePath) && typeof feature.heading === 'string')
    && !publicAfter.text.includes('product-media/'), publicAfter.text.slice(0, 160))

  const featureDeleted = await request(`/admin/products/cashflow-os/features/${encodeURIComponent(featureId)}`, {
    method: 'DELETE',
    headers: ownerHeaders,
  })
  check('features can be removed', featureDeleted.response.status === 200 && featureDeleted.payload?.removed === true, `${featureDeleted.response.status} ${featureDeleted.text}`)

  // Multi-product checkout: one paid Lemon Squeezy order carrying several
  // product keys must grant one entitlement per product, with the order
  // total split across the keys.
  const analyticsBefore = await request('/admin/analytics', { headers: ownerHeaders })
  const salesBefore = Number(analyticsBefore.payload?.totalSales || 0)
  const revenueBefore = Number(analyticsBefore.payload?.revenue || 0)

  const suiteOrderIdentifier = `ls-suite-${Date.now()}`
  const suiteEvent = {
    meta: { event_name: 'order_created' },
    data: {
      id: String(2000 + (Date.now() % 100000)),
      type: 'orders',
      attributes: {
        identifier: suiteOrderIdentifier,
        order_number: 2001,
        user_email: 'suite-buyer@example.com',
        user_name: 'Suite Buyer',
        status: 'paid',
        subtotal: 6100,
        total: 7000,
        currency: 'USD',
        created_at: new Date().toISOString(),
        custom: { user_id: 'regression-suite-user', product_keys: ['cashflow-os', 'client-crm-os'] },
        first_order_item: { variant_id: 99999, price: 6100 },
      },
    },
  }
  const suiteWebhook = await signedLemonWebhook(suiteEvent)
  check('multi-product orders are accepted by the payment webhook', suiteWebhook.response.status === 200 && suiteWebhook.payload?.received === true, `${suiteWebhook.response.status} ${suiteWebhook.text}`)

  const analyticsAfterSuite = await request('/admin/analytics', { headers: ownerHeaders })
  check('multi-product orders grant one entitlement per product', Number(analyticsAfterSuite.payload?.totalSales || 0) === salesBefore + 2
    && Number(analyticsAfterSuite.payload?.revenue || 0) === revenueBefore + 70, `${analyticsAfterSuite.response.status} ${analyticsAfterSuite.text.slice(0, 160)}`)

  const suiteReplay = {
    ...suiteEvent,
    data: { ...suiteEvent.data, id: String(3000 + (Date.now() % 100000)) },
  }
  const suiteReplayed = await signedLemonWebhook(suiteReplay)
  const analyticsAfterReplay = await request('/admin/analytics', { headers: ownerHeaders })
  check('replayed multi-product orders do not duplicate entitlements', suiteReplayed.response.status === 200
    && Number(analyticsAfterReplay.payload?.totalSales || 0) === salesBefore + 2, `${suiteReplayed.response.status} ${analyticsAfterReplay.text.slice(0, 160)}`)

  const legacyEvent = {
    meta: { event_name: 'order_created' },
    data: {
      id: String(4000 + (Date.now() % 100000)),
      type: 'orders',
      attributes: {
        identifier: `ls-legacy-${Date.now()}`,
        order_number: 4001,
        user_email: 'legacy-buyer@example.com',
        user_name: 'Legacy Buyer',
        status: 'paid',
        subtotal: 3400,
        total: 3900,
        currency: 'USD',
        created_at: new Date().toISOString(),
        custom: { user_id: 'regression-legacy-user' },
        first_order_item: { variant_id: 99999, price: 3400 },
      },
    },
  }
  const legacyWebhook = await signedLemonWebhook(legacyEvent)
  const analyticsAfterLegacy = await request('/admin/analytics', { headers: ownerHeaders })
  check('orders without product keys still grant the anchor entitlement', legacyWebhook.response.status === 200
    && Number(analyticsAfterLegacy.payload?.totalSales || 0) === salesBefore + 3
    && Number(analyticsAfterLegacy.payload?.revenue || 0) === revenueBefore + 109, `${legacyWebhook.response.status} ${legacyWebhook.text.slice(0, 160)}`)

  // Account deletion: the owner user buys something, then deletes their data.
  // Personal fields must be wiped while aggregate metrics survive.
  const deleteFlowEvent = {
    meta: { event_name: 'order_created' },
    data: {
      id: String(5000 + (Date.now() % 100000)),
      type: 'orders',
      attributes: {
        identifier: `ls-delete-${Date.now()}`,
        order_number: 5001,
        user_email: 'delete-me@example.com',
        user_name: 'Delete Me',
        status: 'paid',
        subtotal: 3400,
        total: 3900,
        currency: 'USD',
        created_at: new Date().toISOString(),
        custom: { user_id: 'local-owner-user-id', product_keys: ['cashflow-os'] },
        first_order_item: { variant_id: 99999, price: 3400 },
      },
    },
  }
  const deleteFlowWebhook = await signedLemonWebhook(deleteFlowEvent)
  const analyticsBeforeDelete = await request('/admin/analytics', { headers: ownerHeaders })
  const purchasesBeforeDelete = await request('/account/purchases', { headers: ownerHeaders })
  check('deletion flow purchases are visible to the signed-in owner', deleteFlowWebhook.response.status === 200
    && Array.isArray(purchasesBeforeDelete.payload)
    && purchasesBeforeDelete.payload.length >= 1, `${purchasesBeforeDelete.response.status} ${purchasesBeforeDelete.text.slice(0, 140)}`)

  const accountDeleted = await request('/account', { method: 'DELETE', headers: ownerHeaders })
  check('authenticated account deletion is accepted', accountDeleted.response.status === 200
    && accountDeleted.payload?.deleted === true, `${accountDeleted.response.status} ${accountDeleted.text}`)

  const purchasesAfterDelete = await request('/account/purchases', { headers: ownerHeaders })
  const analyticsAfterDelete = await request('/admin/analytics', { headers: ownerHeaders })
  check('deletion detaches every purchase and removes personal fields', Array.isArray(purchasesAfterDelete.payload)
    && purchasesAfterDelete.payload.length === 0, `${purchasesAfterDelete.response.status} ${purchasesAfterDelete.text.slice(0, 140)}`)
  check('deletion keeps aggregate metrics anonymous but intact', Number(analyticsAfterDelete.payload?.totalSales || 0) === Number(analyticsBeforeDelete.payload?.totalSales || 0)
    && Number(analyticsAfterDelete.payload?.revenue || 0) === Number(analyticsBeforeDelete.payload?.revenue || 0), `${analyticsAfterDelete.response.status} ${analyticsAfterDelete.text.slice(0, 140)}`)

  // Lemon Squeezy merchant-of-record path: store configuration, variant
  // guard, graceful network guard, signed order webhooks, idempotency, and
  // refunds.
  const lsSettingsSaved = await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: { ...adminSettings.payload, lemonSqueezyStoreId: '12345', lemonSqueezyBundleVariantId: '99998' },
  })
  check('the Lemon Squeezy store ID and bundle variant persist in owner settings', lsSettingsSaved.response.status === 200
    && lsSettingsSaved.payload?.lemonSqueezyStoreId === '12345'
    && lsSettingsSaved.payload?.lemonSqueezyBundleVariantId === '99998', `${lsSettingsSaved.response.status} ${lsSettingsSaved.text.slice(0, 160)}`)

  const badBundleVariant = await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: { ...adminSettings.payload, lemonSqueezyBundleVariantId: 'not-a-number' },
  })
  check('Lemon Squeezy bundle variant values are validated', badBundleVariant.response.status === 400
    && /bundle variant/i.test(badBundleVariant.payload?.message || ''), `${badBundleVariant.response.status} ${badBundleVariant.text}`)

  const badStoreId = await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: { ...adminSettings.payload, lemonSqueezyStoreId: 'not-a-number' },
  })
  check('Lemon Squeezy store ID values are validated', badStoreId.response.status === 400
    && /store ID/i.test(badStoreId.payload?.message || ''), `${badStoreId.response.status} ${badStoreId.text}`)

  const lsPublic = await request('/config/public')
  check('the payment provider is always Lemon Squeezy in the public config', lsPublic.response.status === 200
    && lsPublic.payload?.paymentProvider === 'lemonsqueezy', `${lsPublic.response.status} ${lsPublic.text.slice(0, 140)}`)

  const lsVariantGuard = await request('/checkout/session', {
    method: 'POST',
    headers: ownerHeaders,
    body: { productKeys: ['cashflow-os'], consent: true },
  })
  check('Lemon Squeezy checkout refuses a product without a variant', lsVariantGuard.response.status === 503
    && /Lemon Squeezy variant/i.test(lsVariantGuard.payload?.message || ''), `${lsVariantGuard.response.status} ${lsVariantGuard.text.slice(0, 160)}`)

  const lsBundleGuard = await request('/checkout/session', {
    method: 'POST',
    headers: ownerHeaders,
    body: { productKeys: ['cashflow-os', 'client-crm-os'], consent: true },
  })
  check('multi-product carts fail cleanly while their variants are missing', lsBundleGuard.response.status === 503
    && /Lemon Squeezy variant/i.test(lsBundleGuard.payload?.message || ''), `${lsBundleGuard.response.status} ${lsBundleGuard.text.slice(0, 160)}`)

  await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, lemonVariantId: '99999' },
  })
  const lsNetworkGuard = await request('/checkout/session', {
    method: 'POST',
    headers: ownerHeaders,
    body: { productKeys: ['cashflow-os'], consent: true },
  })
  check('Lemon Squeezy checkout degrades gracefully when unreachable', lsNetworkGuard.response.status >= 400
    && /Lemon Squeezy/i.test(lsNetworkGuard.payload?.message || ''), `${lsNetworkGuard.response.status} ${lsNetworkGuard.text.slice(0, 160)}`)

  await request('/admin/products/client-crm-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { name: 'Client CRM OS', tagline: '', category: 'Client relationships', icon: 'users', accent: 'blue', lemonVariantId: '99997', deliveryUrl: '', offerActive: true, offerLabel: 'Launch Offer', originalPrice: '$59', salePrice: '$35', active: true, featured: true, sortOrder: 1, includes: ['Private Google Sheets copy'] },
  })
  const lsBundleNetwork = await request('/checkout/session', {
    method: 'POST',
    headers: ownerHeaders,
    body: { productKeys: ['cashflow-os', 'client-crm-os'], consent: true },
  })
  check('multi-product carts bundle into one checkout that reaches Lemon Squeezy', lsBundleNetwork.response.status >= 400
    && /Lemon Squeezy/i.test(lsBundleNetwork.payload?.message || '')
    && !/one product at a time/i.test(lsBundleNetwork.payload?.message || ''), `${lsBundleNetwork.response.status} ${lsBundleNetwork.text.slice(0, 160)}`)

  await request('/admin/products/client-crm-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { name: 'Client CRM OS', tagline: '', category: 'Client relationships', icon: 'users', accent: 'blue', lemonVariantId: '', deliveryUrl: '', offerActive: true, offerLabel: 'Launch Offer', originalPrice: '$59', salePrice: '$35', active: true, featured: true, sortOrder: 1, includes: ['Private Google Sheets copy'] },
  })

  const analyticsBeforeLs = await request('/admin/analytics', { headers: ownerHeaders })
  const lsOrderIdentifier = `ls-order-${Date.now()}`
  const lsOrderEvent = {
    meta: { event_name: 'order_created' },
    data: {
      id: String(1000 + (Date.now() % 100000)),
      type: 'orders',
      attributes: {
        identifier: lsOrderIdentifier,
        order_number: 1001,
        user_email: 'ls-buyer@example.com',
        user_name: 'LS Buyer',
        status: 'paid',
        subtotal: 3400,
        total: 3900,
        currency: 'USD',
        created_at: new Date().toISOString(),
        custom: { user_id: 'local-owner-user-id', product_keys: ['cashflow-os'] },
        first_order_item: { variant_id: 99999, price: 3400 },
      },
    },
  }
  const lsWebhook = await signedLemonWebhook(lsOrderEvent)
  check('signed Lemon Squeezy order webhook is accepted', lsWebhook.response.status === 200
    && lsWebhook.payload?.received === true, `${lsWebhook.response.status} ${lsWebhook.text}`)

  const analyticsAfterLs = await request('/admin/analytics', { headers: ownerHeaders })
  check('Lemon Squeezy orders grant entitlements with the order total', Number(analyticsAfterLs.payload?.totalSales || 0) === Number(analyticsBeforeLs.payload?.totalSales || 0) + 1
    && Number(analyticsAfterLs.payload?.revenue || 0) === Number(analyticsBeforeLs.payload?.revenue || 0) + 39, `${analyticsAfterLs.response.status} ${analyticsAfterLs.text.slice(0, 160)}`)

  const lsReplay = await signedLemonWebhook(lsOrderEvent)
  const analyticsAfterLsReplay = await request('/admin/analytics', { headers: ownerHeaders })
  check('replayed Lemon Squeezy webhooks do not duplicate entitlements', lsReplay.response.status === 200
    && lsReplay.payload?.duplicate === true
    && Number(analyticsAfterLsReplay.payload?.totalSales || 0) === Number(analyticsAfterLs.payload?.totalSales || 0), `${lsReplay.response.status} ${lsReplay.text.slice(0, 120)}`)

  const lsRefundEvent = {
    meta: { event_name: 'order_refunded' },
    data: { id: String(1000 + (Date.now() % 100000)), type: 'orders', attributes: { identifier: lsOrderIdentifier, order_number: 1001, refunded: true } },
  }
  const lsRefund = await signedLemonWebhook(lsRefundEvent)
  const analyticsAfterLsRefund = await request('/admin/analytics', { headers: ownerHeaders })
  check('Lemon Squeezy refunds revoke the entitlement', lsRefund.response.status === 200
    && Number(analyticsAfterLsRefund.payload?.totalSales || 0) === Number(analyticsBeforeLs.payload?.totalSales || 0), `${lsRefund.response.status} ${lsRefund.text.slice(0, 120)}`)

  const lsBadSignature = await request('/webhooks/lemonsqueezy', {
    method: 'POST',
    origin: null,
    body: JSON.stringify(lsOrderEvent),
    headers: { 'Content-Type': 'application/json', 'X-Signature': '0'.repeat(64) },
  })
  check('Lemon Squeezy webhooks reject invalid signatures', lsBadSignature.response.status === 400
    && /signature/i.test(lsBadSignature.payload?.message || ''), `${lsBadSignature.response.status} ${lsBadSignature.text}`)

  const nonOrderEvent = {
    meta: { event_name: 'order_created' },
    data: { id: String(7000 + (Date.now() % 100000)), type: 'subscriptions', attributes: { identifier: `ls-nonorder-${Date.now()}` } },
  }
  const nonOrderWebhook = await signedLemonWebhook(nonOrderEvent)
  check('Lemon Squeezy webhooks accept order events only', nonOrderWebhook.response.status === 400
    && /Invalid Lemon Squeezy event/i.test(nonOrderWebhook.payload?.message || ''), `${nonOrderWebhook.response.status} ${nonOrderWebhook.text}`)

  await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, lemonVariantId: '' },
  })

  await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, heroImage: '', featureImages: [] },
  })

  await request('/admin/settings', {
    method: 'PUT',
    headers: ownerHeaders,
    body: {
      activePriceId: 'price_replace_with_test_price',
      discountEnabled: true,
      offerActive: true,
      offerLabel: 'Launch Offer',
      displayOriginalPrice: '$69',
      displaySalePrice: '$39',
      emailTemplateText: "How's CASHFLOW OS working for you?",
      trustpilotBusinessUrl: 'https://www.trustpilot.com/review/your-domain.com',
    },
  })
}

const sitemap = await request('/sitemap.xml', { origin: null })
check('sitemap exposes active product urls for crawlers', sitemap.response.status === 200
  && /application\/xml/.test(sitemap.response.headers.get('content-type') || '')
  && sitemap.text.includes('/products/cashflow-os')
  && sitemap.text.includes('/products/client-crm-os')
  && sitemap.text.includes('/products/project-os')
  && sitemap.text.includes('/products/invoice-os')
  && sitemap.text.includes('<urlset')
  && !sitemap.text.includes('/account')
  && !sitemap.text.includes('/admin'), `${sitemap.response.status} ${sitemap.text.slice(0, 200)}`)
check('sitemap leaks no pricing or personal data', !/\$\d+|delivery|email/i.test(sitemap.text))

const testimonials = await request('/testimonials')
check('approved testimonial query works', testimonials.response.status === 200 && Array.isArray(testimonials.payload), `${testimonials.response.status} ${testimonials.text}`)

const telemetry = await request('/events/page-view', { method: 'POST', body: { path: '/worker-local-regression' } })
check('anonymous telemetry writes through D1', telemetry.response.status === 202 && telemetry.payload?.accepted === true, `${telemetry.response.status} ${telemetry.text}`)

const invalidContentType = await request('/events/page-view', {
  method: 'POST',
  body: '{}',
  headers: { 'Content-Type': 'text/plain' },
})
check('non-JSON mutation is rejected', invalidContentType.response.status === 415 && /application\/json/i.test(invalidContentType.payload?.message || ''), `${invalidContentType.response.status} ${invalidContentType.text}`)

const oversizedBody = await request('/events/page-view', {
  method: 'POST',
  body: `{"path":"/${'a'.repeat(8 * 1024 * 1024)}"}`,
})
check('oversized JSON bodies are rejected before parsing', oversizedBody.response.status === 413 && /too large/i.test(oversizedBody.payload?.message || ''), `${oversizedBody.response.status} ${oversizedBody.text.slice(0, 100)}`)

for (const [path, method] of [
  ['/account/purchases', 'GET'],
  ['/account', 'DELETE'],
  ['/checkout/session', 'POST'],
  ['/admin/analytics', 'GET'],
  ['/admin/products/cashflow-os/upload', 'POST'],
  ['/feedback/access?token=unsigned', 'GET'],
]) {
  const protectedResponse = await request(path, { method, body: method === 'POST' ? {} : undefined })
  check(`${path} rejects missing authentication`, protectedResponse.response.status === 401 && protectedResponse.payload?.message === 'Authentication required', `${protectedResponse.response.status} ${protectedResponse.text}`)
}

const unsignedWebhook = await request('/webhooks/lemonsqueezy', { method: 'POST', body: {} })
check('Lemon Squeezy webhook rejects a missing signature', unsignedWebhook.response.status === 400 && /signature/i.test(unsignedWebhook.payload?.message || ''), `${unsignedWebhook.response.status} ${unsignedWebhook.text}`)

const preflight = await request('/account/purchases', {
  method: 'OPTIONS',
  headers: {
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization',
  },
})
check('allowed CORS preflight is explicit', preflight.response.status === 204
  && preflight.response.headers.get('Access-Control-Allow-Origin') === APP_ORIGIN
  && /Authorization/.test(preflight.response.headers.get('Access-Control-Allow-Headers') || ''))

const missingRoute = await request('/does-not-exist')
check('unknown route returns a sanitized response', missingRoute.response.status === 404 && missingRoute.payload?.message === 'Endpoint not found', `${missingRoute.response.status} ${missingRoute.text}`)
check('error responses carry a correlation id and no internal details', typeof missingRoute.payload?.correlationId === 'string'
  && /^[0-9a-f-]{36}$/i.test(missingRoute.payload.correlationId)
  && /^[0-9a-f-]{36}$/i.test(missingRoute.response.headers.get('X-Correlation-Id') || '')
  && !/at |stack|\.js:|\.sql|node_modules|internal/i.test(missingRoute.text)
  && missingRoute.response.headers.get('X-Frame-Options') === 'DENY', `${missingRoute.response.status} ${missingRoute.text.slice(0, 140)}`)

const cron = await request('/cdn-cgi/local/scheduled', { origin: null })
check('Cron handler executes against local bindings', cron.response.status === 200, `${cron.response.status} ${cron.text}`)

const otherEvent = {
  meta: { event_name: 'order_updated' },
  data: {
    id: String(6000 + (Date.now() % 100000)),
    type: 'orders',
    attributes: { identifier: `ls-other-${Date.now()}`, order_number: 6001, status: 'paid' },
  },
}
const firstOtherWebhook = await signedLemonWebhook(otherEvent)
check('other Lemon Squeezy events are acknowledged without side effects', firstOtherWebhook.response.status === 200 && firstOtherWebhook.payload?.received === true && !firstOtherWebhook.payload?.duplicate, `${firstOtherWebhook.response.status} ${firstOtherWebhook.text}`)
const replayedOtherWebhook = await signedLemonWebhook(otherEvent)
check('replayed Lemon Squeezy events are idempotent', replayedOtherWebhook.response.status === 200 && replayedOtherWebhook.payload?.duplicate === true, `${replayedOtherWebhook.response.status} ${replayedOtherWebhook.text}`)

// ---------------------------------------------------------------- bundles
// Bundles discount real money, so the guarantees under test are: the price is
// computed server-side from D1, a cart that does not match the bundle cannot
// claim the discount, and no operational field leaks into the public config.
if (OWNER_TOKEN) {
  const ownerHeaders = { Authorization: `Bearer ${OWNER_TOKEN}` }
  const bundleKey = `regression-bundle-${Date.now()}`

  const created = await request('/admin/bundles', {
    method: 'POST',
    headers: ownerHeaders,
    body: { key: bundleKey, name: 'Regression Bundle', tagline: 'Two systems', productKeys: ['cashflow-os', 'invoice-os'], discountPercent: 25, lemonVariantId: '4242', active: true, sortOrder: 0 },
  })
  check('owner can create a bundle', created.response.status === 201 && created.payload?.key === bundleKey, `${created.response.status} ${created.text.slice(0, 160)}`)

  const tooFew = await request('/admin/bundles', {
    method: 'POST',
    headers: ownerHeaders,
    body: { key: `${bundleKey}-tiny`, name: 'Too small', productKeys: ['cashflow-os'], discountPercent: 20 },
  })
  check('a bundle needs at least two products', tooFew.response.status === 400, `${tooFew.response.status} ${tooFew.text.slice(0, 120)}`)

  const badPercent = await request('/admin/bundles', {
    method: 'POST',
    headers: ownerHeaders,
    body: { key: `${bundleKey}-pct`, name: 'Bad percent', productKeys: ['cashflow-os', 'invoice-os'], discountPercent: 99 },
  })
  check('bundle discount is capped at 90 percent', badPercent.response.status === 400, `${badPercent.response.status} ${badPercent.text.slice(0, 120)}`)

  const unknownMember = await request('/admin/bundles', {
    method: 'POST',
    headers: ownerHeaders,
    body: { key: `${bundleKey}-ghost`, name: 'Ghost member', productKeys: ['cashflow-os', 'does-not-exist'], discountPercent: 20 },
  })
  check('bundles reject unknown member products', unknownMember.response.status === 400, `${unknownMember.response.status} ${unknownMember.text.slice(0, 120)}`)

  const anonBundleWrite = await request('/admin/bundles', { method: 'POST', body: { key: 'anon', name: 'Anon', productKeys: ['cashflow-os', 'invoice-os'], discountPercent: 20 } })
  check('bundle creation rejects missing authentication', anonBundleWrite.response.status === 401, `${anonBundleWrite.response.status}`)

  const publicBundles = await request('/config/public')
  const listed = (publicBundles.payload?.bundles || []).find((item) => item.key === bundleKey)
  check('bundle reaches the public config priced server-side', Boolean(listed) && listed.discountPercent === 25
    && typeof listed.bundlePrice === 'string' && typeof listed.fullPrice === 'string' && typeof listed.saving === 'string',
  JSON.stringify(listed || null).slice(0, 200))
  check('public bundle never exposes operational fields', Boolean(listed)
    && !Object.hasOwn(listed, 'lemonVariantId')
    && !Object.hasOwn(listed, 'active'), JSON.stringify(listed || null).slice(0, 200))

  const hiddenBundle = await request(`/admin/bundles/${bundleKey}`, {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { name: 'Regression Bundle', productKeys: ['cashflow-os', 'invoice-os'], discountPercent: 25, active: false },
  })
  const afterHide = await request('/config/public')
  check('hiding a bundle removes it from the storefront', hiddenBundle.response.status === 200
    && !(afterHide.payload?.bundles || []).some((item) => item.key === bundleKey), `${hiddenBundle.response.status}`)

  const removed = await request(`/admin/bundles/${bundleKey}`, { method: 'DELETE', headers: ownerHeaders })
  check('owner can delete a bundle', removed.response.status === 200 && removed.payload?.removed === true, `${removed.response.status} ${removed.text.slice(0, 120)}`)

  const missingBundle = await request(`/admin/bundles/${bundleKey}`, { method: 'DELETE', headers: ownerHeaders })
  check('deleting a missing bundle is a clean 404', missingBundle.response.status === 404, `${missingBundle.response.status}`)
}

// ------------------------------------------------------------- consent
// Consent gates payment, so it is enforced server-side and recorded, not
// merely rendered as a checkbox.
if (OWNER_TOKEN) {
  const ownerHeaders = { Authorization: `Bearer ${OWNER_TOKEN}` }
  const noConsent = await request('/checkout/session', { method: 'POST', headers: ownerHeaders, body: { productKeys: ['cashflow-os'] } })
  check('checkout is refused when consent is absent', noConsent.response.status === 400
    && /accept the terms/i.test(noConsent.payload?.message || ''), `${noConsent.response.status} ${noConsent.text.slice(0, 140)}`)

  const falseConsent = await request('/checkout/session', { method: 'POST', headers: ownerHeaders, body: { productKeys: ['cashflow-os'], consent: false } })
  check('checkout is refused when consent is false', falseConsent.response.status === 400, `${falseConsent.response.status}`)

  const truthyConsent = await request('/checkout/session', { method: 'POST', headers: ownerHeaders, body: { productKeys: ['cashflow-os'], consent: 'yes' } })
  check('a truthy string does not count as consent', truthyConsent.response.status === 400, `${truthyConsent.response.status}`)
}

// ----------------------------------------------------------- duplication
// Duplicating a product copies its written content but must never inherit
// commercial wiring or media, which are per-product.
if (OWNER_TOKEN) {
  const ownerHeaders = { Authorization: `Bearer ${OWNER_TOKEN}` }
  const dupKey = `dup-target-${Date.now()}`

  const dup = await request('/admin/products', {
    method: 'POST',
    headers: ownerHeaders,
    body: { key: dupKey, name: 'Duplicated Product', duplicateFrom: 'cashflow-os', active: true, includes: ['Private Google Sheets copy'], sortOrder: 20 },
  })
  check('owner can duplicate a product', dup.response.status === 201 && dup.payload?.key === dupKey
    && dup.payload?.duplicatedFrom === 'cashflow-os', `${dup.response.status} ${dup.text.slice(0, 160)}`)
  check('duplicate never inherits payment or delivery wiring', dup.payload?.lemonVariantId === ''
    && dup.payload?.deliveryUrl === '', JSON.stringify({ v: dup.payload?.lemonVariantId, d: dup.payload?.deliveryUrl }))
  check('duplicate never inherits media', (dup.payload?.heroImage || '') === ''
    && (dup.payload?.featureImages || []).length === 0, JSON.stringify(dup.payload?.heroImage))

  const ghost = await request('/admin/products', {
    method: 'POST',
    headers: ownerHeaders,
    body: { key: `${dupKey}-ghost`, name: 'Ghost', duplicateFrom: 'no-such-product', active: true, includes: ['x'] },
  })
  check('duplicating an unknown product is a clean 404', ghost.response.status === 404, `${ghost.response.status}`)

  const clash = await request('/admin/products', {
    method: 'POST',
    headers: ownerHeaders,
    body: { key: dupKey, name: 'Clash', duplicateFrom: 'cashflow-os', active: true, includes: ['x'] },
  })
  check('duplicating onto an existing key is refused', clash.response.status === 409, `${clash.response.status}`)

  const removed = await request(`/admin/products/${dupKey}`, { method: 'DELETE', headers: ownerHeaders })
  check('a duplicated product can be deleted again', removed.response.status === 200, `${removed.response.status}`)
}

const failures = results.filter((result) => !result.condition)
console.log(`\nWorker local regression: ${results.length - failures.length}/${results.length} checks passed`)
if (failures.length) process.exit(1)
