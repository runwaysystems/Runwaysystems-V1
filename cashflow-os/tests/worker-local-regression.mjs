import { createHmac } from 'node:crypto'
import process from 'node:process'

const BASE_URL = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787'
const APP_ORIGIN = process.env.WORKER_APP_ORIGIN || 'https://regression-store.test'
// A fresh source IP per minute bucket keeps the per-IP auth-gate counter
// isolated across repeated runs of this suite.
const TEST_IP = process.env.WORKER_TEST_IP || `198.51.100.${(Math.floor(Date.now() / 60000) % 200) + 1}`
const LS_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
const OWNER_TOKEN = process.env.WORKER_OWNER_TOKEN || ''
const MOCK_PROVIDER_URL = process.env.WORKER_MOCK_PROVIDER_URL || 'http://127.0.0.1:9876'

if (!LS_WEBHOOK_SECRET) {
  console.error('Set LEMONSQUEEZY_WEBHOOK_SECRET to the safe local value configured in worker/.dev.vars.')
  process.exit(1)
}

const results = []
let ADMIN_CHALLENGE = ''

function base32Bytes(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of String(secret || '').replace(/=+$/g, '').toUpperCase()) {
    const value = alphabet.indexOf(char)
    if (value < 0) continue
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2))
  return Buffer.from(bytes)
}

function currentTotp(secret) {
  const counter = Math.floor(Date.now() / 30000)
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', base32Bytes(secret)).update(message).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000
  return String(value).padStart(6, '0')
}

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

async function createCheckoutFixture(token, productKeys, bundleKey = '') {
  const fixtureKey = token.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const response = await request('/checkout/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { productKeys, bundleKey, consent: true, consentSource: 'cart' },
  })
  return {
    response,
    checkoutId: response.payload?.sessionId || '',
    userId: token === OWNER_TOKEN ? 'local-owner-user-id' : `local-${fixtureKey}`,
    email: token === OWNER_TOKEN ? 'owner@your-domain.com' : `${fixtureKey}@suite.test`,
  }
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
  && publicKeys === 'announcement,bundles,infoEmail,paymentProvider,policies,products,reviewPolicy,suiteContent,supportEmail,trustpilotBusinessUnitId,trustpilotBusinessUrl'
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
  const baseOwnerHeaders = { Authorization: `Bearer ${OWNER_TOKEN}` }
  const enrollment = await request('/admin/totp/enrol', { method: 'POST', headers: baseOwnerHeaders, body: {} })
  check('owner can begin pending TOTP enrollment', enrollment.response.status === 201 && typeof enrollment.payload?.secret === 'string', `${enrollment.response.status} ${enrollment.text.slice(0, 160)}`)
  const verification = await request('/admin/totp/verify', {
    method: 'POST',
    headers: baseOwnerHeaders,
    body: { code: currentTotp(enrollment.payload?.secret) },
  })
  ADMIN_CHALLENGE = verification.payload?.challenge || ''
  check('TOTP verification returns a short-lived signed challenge', verification.response.status === 200 && ADMIN_CHALLENGE.length > 40, `${verification.response.status} ${verification.text.slice(0, 160)}`)
  const ownerHeaders = { ...baseOwnerHeaders, 'X-Admin-Challenge': ADMIN_CHALLENGE }

  // Blog newsletter: a public request needs explicit consent, sends a
  // scanner-safe fragment link, and becomes marketing-eligible only after a
  // one-time POST confirmation.
  const newsletterNoConsent = await request('/newsletter/subscribe', {
    method: 'POST', body: { email: 'blog-reader@suite.test', source: 'blog_index' },
  })
  check('Blog newsletter requires explicit consent', newsletterNoConsent.response.status === 400, `${newsletterNoConsent.response.status} ${newsletterNoConsent.text}`)
  const newsletterRequest = await request('/newsletter/subscribe', {
    method: 'POST', body: { email: 'blog-reader@suite.test', consent: true, source: 'blog_index', company: '' },
  })
  check('Blog newsletter request returns a generic confirmation response', newsletterRequest.response.status === 202
    && newsletterRequest.payload?.accepted === true && !newsletterRequest.text.includes('blog-reader@suite.test'), `${newsletterRequest.response.status} ${newsletterRequest.text}`)
  const newsletterProviderFailure = await request('/newsletter/subscribe', {
    method: 'POST', body: { email: 'newsletter-provider-failure@suite.test', consent: true, source: 'home', company: '' },
  })
  check('newsletter provider failures cannot reveal whether an address already exists', newsletterProviderFailure.response.status === 202
    && newsletterProviderFailure.payload?.accepted === true
    && !newsletterProviderFailure.text.includes('newsletter-provider-failure@suite.test'), `${newsletterProviderFailure.response.status} ${newsletterProviderFailure.text}`)
  const newsletterEmails = await fetch(`${MOCK_PROVIDER_URL}/test/emails`).then((response) => response.json())
  const confirmationEmail = [...newsletterEmails].reverse().find((email) => email?.to?.[0]?.email === 'blog-reader@suite.test')
  const confirmationMatch = /\/newsletter\/confirm#token=([A-Za-z0-9_-]{40,100})/.exec(String(confirmationEmail?.htmlContent || ''))
  const newsletterToken = confirmationMatch?.[1] || ''
  check('newsletter confirmation email contains a fragment token but no automatic action', Boolean(newsletterToken)
    && String(confirmationEmail?.subject || '').includes('Confirm') && !String(confirmationEmail?.htmlContent || '').includes('/newsletter/confirm?token='), JSON.stringify(confirmationEmail || {}).slice(0, 240))
  const newsletterGet = await request('/newsletter/confirm')
  check('email scanners cannot confirm Blog subscriptions with GET', newsletterGet.response.status === 404, `${newsletterGet.response.status} ${newsletterGet.text}`)
  const newsletterConfirm = await request('/newsletter/confirm', { method: 'POST', body: { token: newsletterToken } })
  check('one-time confirmation activates Blog email consent', newsletterConfirm.response.status === 200 && newsletterConfirm.payload?.confirmed === true, `${newsletterConfirm.response.status} ${newsletterConfirm.text}`)
  const newsletterReplay = await request('/newsletter/confirm', { method: 'POST', body: { token: newsletterToken } })
  check('Blog newsletter confirmation token cannot be replayed', newsletterReplay.response.status === 410, `${newsletterReplay.response.status} ${newsletterReplay.text}`)
  const newsletterAudience = await request('/admin/marketing/audience?search=blog-reader%40suite.test', { headers: ownerHeaders })
  check('confirmed Blog subscriber enters the consented lead audience', newsletterAudience.response.status === 200
    && newsletterAudience.payload?.contacts?.length === 1
    && newsletterAudience.payload.contacts[0].status === 'subscribed'
    && newsletterAudience.payload.contacts[0].isCustomer === false
    && newsletterAudience.payload.contacts[0].marketingOptInSource === 'newsletter_blog_index'
    && Boolean(newsletterAudience.payload.contacts[0].marketingOptInAt), `${newsletterAudience.response.status} ${newsletterAudience.text}`)

  // Blog publishing: imported content stays private, executable HTML is
  // discarded, media is reusable and usage-protected, publication updates all
  // discovery surfaces, and URL changes retain a permanent public redirect.
  const blogCategories = await request('/admin/blog/categories', { headers: ownerHeaders })
  const financeCategory = blogCategories.payload?.categories?.find((category) => category.slug === 'finance')
  check('Blog categories are seeded for the owner workspace', blogCategories.response.status === 200
    && blogCategories.payload?.categories?.length >= 5 && Boolean(financeCategory?.id), `${blogCategories.response.status} ${blogCategories.text}`)

  const unauthorizedBlogCreate = await request('/admin/blog/posts', {
    method: 'POST', body: { title: 'Unauthorized Blog article' },
  })
  check('Blog mutations require an authenticated owner', unauthorizedBlogCreate.response.status === 401, `${unauthorizedBlogCreate.response.status} ${unauthorizedBlogCreate.text}`)

  const importedBlog = await request('/admin/blog/import', {
    method: 'POST', headers: ownerHeaders,
    body: {
      format: 'html', layout: 'editorial',
      content: '<h1>Unsafe AI Page</h1><script>window.stolen=true</script><style>body{display:none}</style><iframe src="https://attacker.example"></iframe><form><input name="card"></form><h2>Useful section</h2><p>Safe editorial content survives this import.</p>',
    },
  })
  const importedPost = importedBlog.payload?.post
  check('AI HTML import always creates a private draft', importedBlog.response.status === 201
    && importedPost?.status === 'draft' && !importedPost?.publishedAt, `${importedBlog.response.status} ${importedBlog.text}`)
  check('AI HTML import strips executable and embedded webpage code', !/<\/?(?:script|style|iframe|form|input)\b/i.test(importedPost?.bodyMarkdown || '')
    && !String(importedPost?.bodyMarkdown || '').includes('window.stolen'), importedPost?.bodyMarkdown || '')
  const remoteImageImport = await request('/admin/blog/import', {
    method: 'POST', headers: ownerHeaders,
    body: { format: 'markdown', content: '# Remote image draft\n\nUseful imported text.\n\n![tracking pixel](https://tracker.example/pixel.png)' },
  })
  check('safe AI import omits remote image trackers without losing the private draft', remoteImageImport.response.status === 201
    && remoteImageImport.payload?.post?.status === 'draft' && !remoteImageImport.payload?.post?.bodyMarkdown?.includes('https://tracker.example')
    && remoteImageImport.payload?.warnings?.some((warning) => /Remote Markdown images/i.test(warning)), remoteImageImport.text)

  const importedPrivate = await request(`/blog/posts/${encodeURIComponent(importedPost?.slug || 'missing')}`)
  check('private Blog drafts never appear on public article routes', importedPrivate.response.status === 404, `${importedPrivate.response.status} ${importedPrivate.text}`)

  const mediaUpload = await request('/admin/blog/media', {
    method: 'POST', headers: ownerHeaders,
    body: {
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      altText: 'A single test pixel representing an editorial cover', caption: 'Regression fixture', originalName: 'journal-cover.png',
    },
  })
  check('owner can add validated reusable Blog media', mediaUpload.response.status === 201
    && mediaUpload.payload?.media?.mimeType === 'image/png' && mediaUpload.payload?.media?.width === 1 && mediaUpload.payload?.media?.height === 1,
  `${mediaUpload.response.status} ${mediaUpload.text}`)

  const completeBody = [
    '## Build one reliable operating view',
    '',
    'Independent businesses make better decisions when cash, commitments, and client work can be understood in one calm operating rhythm. This article explains a practical weekly review without adding unnecessary reporting work.',
    '',
    '## Ask the questions that change decisions',
    '',
    'Start with available cash, upcoming commitments, overdue invoices, project capacity, and the next decision each signal creates. Keep the model focused on action rather than decorative complexity.',
    '',
    '> A useful business system reduces decision friction and makes the next responsible action visible.',
  ].join('\n')
  const completedBlog = await request(`/admin/blog/posts/${encodeURIComponent(importedPost?.id || '')}`, {
    method: 'PATCH', headers: ownerHeaders,
    body: {
      version: importedPost?.version, title: 'A complete Blog publishing regression field note', slug: 'journal-publishing-regression',
      excerpt: 'A complete field note used to verify secure drafting, reusable media, publication, discovery, revisions, and stable redirects.',
      bodyMarkdown: completeBody, categoryId: financeCategory?.id, coverMediaId: mediaUpload.payload?.media?.id,
      tags: ['Operations', 'Testing'], authorName: 'Runway Systems', layout: 'field-note', featured: true,
    },
  })
  const completedPost = completedBlog.payload?.post
  check('owner can save canonical Markdown with editorial metadata', completedBlog.response.status === 200
    && completedPost?.category?.slug === 'finance' && completedPost?.tags?.includes('Testing') && completedPost?.cover?.altText,
  `${completedBlog.response.status} ${completedBlog.text}`)

  const externalTrackerSave = await request(`/admin/blog/posts/${encodeURIComponent(importedPost?.id || '')}`, {
    method: 'PATCH', headers: ownerHeaders,
    body: { version: completedPost?.version, bodyMarkdown: `${completeBody}\n\n![remote pixel](https://tracker.example/pixel.png)` },
  })
  check('Blog content rejects remote image trackers in favor of validated media', externalTrackerSave.response.status === 400
    && /media library/i.test(externalTrackerSave.payload?.message || ''), `${externalTrackerSave.response.status} ${externalTrackerSave.text}`)

  const staleBlogSave = await request(`/admin/blog/posts/${encodeURIComponent(importedPost?.id || '')}`, {
    method: 'PATCH', headers: ownerHeaders,
    body: { version: importedPost?.version, title: 'A stale article save must fail' },
  })
  check('Blog autosaves reject stale versions instead of overwriting edits', staleBlogSave.response.status === 409, `${staleBlogSave.response.status} ${staleBlogSave.text}`)

  const publishedBlog = await request(`/admin/blog/posts/${encodeURIComponent(completedPost?.id || '')}/publish`, {
    method: 'POST', headers: ownerHeaders, body: { version: completedPost?.version },
  })
  const publishedPost = publishedBlog.payload?.post
  check('owner can publish a validated Blog draft without a deployment', publishedBlog.response.status === 200
    && publishedPost?.status === 'published' && Boolean(publishedPost?.publishedAt), `${publishedBlog.response.status} ${publishedBlog.text}`)

  const publicBlogList = await request('/blog/posts')
  const publicBlogPost = await request('/blog/posts/journal-publishing-regression')
  check('published Blog articles appear in the public index and stable article route', publicBlogList.response.status === 200
    && publicBlogList.payload?.posts?.some((post) => post.slug === 'journal-publishing-regression')
    && publicBlogPost.response.status === 200 && publicBlogPost.payload?.post?.bodyMarkdown === completeBody,
  `${publicBlogList.response.status} ${publicBlogPost.response.status}`)

  const usedMediaDelete = await request(`/admin/blog/media/${encodeURIComponent(mediaUpload.payload?.media?.id || '')}`, {
    method: 'DELETE', headers: ownerHeaders,
  })
  check('Blog media cannot be deleted while an article uses it', usedMediaDelete.response.status === 409, `${usedMediaDelete.response.status} ${usedMediaDelete.text}`)

  const changedSlug = await request(`/admin/blog/posts/${encodeURIComponent(publishedPost?.id || '')}/change-slug`, {
    method: 'POST', headers: ownerHeaders, body: { version: publishedPost?.version, slug: 'journal-publishing-regression-v2' },
  })
  const redirectedArticle = await request('/blog/posts/journal-publishing-regression')
  const currentArticle = await request('/blog/posts/journal-publishing-regression-v2')
  check('published URL changes preserve an old-slug redirect', changedSlug.response.status === 200
    && redirectedArticle.response.status === 200 && redirectedArticle.payload?.redirectTo === '/blog/journal-publishing-regression-v2'
    && currentArticle.response.status === 200, `${changedSlug.response.status} ${redirectedArticle.text}`)

  const blogRss = await request('/blog/feed.xml')
  const blogLlms = await request('/llms.txt')
  const blogSitemap = await request('/sitemap.xml')
  check('RSS updates automatically from published Blog records', blogRss.response.status === 200
    && blogRss.text.includes('/blog/journal-publishing-regression-v2') && !blogRss.text.includes('<script'), blogRss.text.slice(0, 220))
  check('LLM discovery lists published Blog records only', blogLlms.response.status === 200
    && blogLlms.text.includes('/blog/journal-publishing-regression-v2') && !blogLlms.text.includes('Unsafe AI Page'), blogLlms.text.slice(0, 220))
  check('dynamic sitemap includes the current published slug, not its redirect', blogSitemap.response.status === 200
    && blogSitemap.text.includes('/blog/journal-publishing-regression-v2') && !blogSitemap.text.includes('/blog/journal-publishing-regression</loc>'), blogSitemap.text.slice(-350))

  const changedPublishedPost = changedSlug.payload?.post
  const editedPublishedBlog = await request(`/admin/blog/posts/${encodeURIComponent(publishedPost?.id || '')}`, {
    method: 'PATCH', headers: ownerHeaders,
    body: { version: changedPublishedPost?.version, bodyMarkdown: `${completeBody}\n\nTemporary published edit.`, tags: ['Temporary'] },
  })
  const blogRevisions = await request(`/admin/blog/posts/${encodeURIComponent(publishedPost?.id || '')}/revisions`, { headers: ownerHeaders })
  check('publication and URL changes create immutable Blog revisions', blogRevisions.response.status === 200
    && blogRevisions.payload?.revisions?.length >= 3, `${blogRevisions.response.status} ${blogRevisions.text}`)
  const publishedUpdateRevision = blogRevisions.payload?.revisions?.find((revision) => revision.reason === 'published-update')
  const restoredBlog = await request(`/admin/blog/posts/${encodeURIComponent(publishedPost?.id || '')}/revisions/${encodeURIComponent(publishedUpdateRevision?.id || '')}/restore`, {
    method: 'POST', headers: ownerHeaders, body: { version: editedPublishedBlog.payload?.post?.version },
  })
  check('owner can restore content and associations from an immutable revision', restoredBlog.response.status === 200
    && restoredBlog.payload?.post?.bodyMarkdown === completeBody && restoredBlog.payload?.post?.tags?.includes('Testing'),
  `${restoredBlog.response.status} ${restoredBlog.text}`)

  const scheduledDraft = await request('/admin/blog/posts', {
    method: 'POST', headers: ownerHeaders,
    body: { title: 'A scheduled Blog field note for regression', slug: 'scheduled-journal-regression', excerpt: 'This complete excerpt verifies that future Blog records remain private until the server publication time.', bodyMarkdown: completeBody, categoryId: financeCategory?.id, tags: ['Scheduling'], layout: 'tutorial' },
  })
  const scheduledAt = new Date(Date.now() + 700).toISOString()
  const scheduledBlog = await request(`/admin/blog/posts/${encodeURIComponent(scheduledDraft.payload?.post?.id || '')}/schedule`, {
    method: 'POST', headers: ownerHeaders, body: { version: scheduledDraft.payload?.post?.version, scheduledAt },
  })
  const futurePrivate = await request('/blog/posts/scheduled-journal-regression')
  check('future scheduled Blog articles remain private', scheduledBlog.response.status === 200
    && scheduledBlog.payload?.post?.status === 'scheduled' && futurePrivate.response.status === 404,
  `${scheduledBlog.response.status} ${futurePrivate.response.status}`)
  await new Promise((resolve) => setTimeout(resolve, 850))
  await request('/cdn-cgi/local/scheduled', { origin: null })
  await request('/cdn-cgi/local/scheduled', { origin: null })
  const publishedSchedule = await request(`/admin/blog/posts/${encodeURIComponent(scheduledDraft.payload?.post?.id || '')}`, { headers: ownerHeaders })
  const publicSchedule = await request('/blog/posts/scheduled-journal-regression')
  check('scheduled Blog publication is automatic and idempotent', publishedSchedule.payload?.post?.status === 'published'
    && publishedSchedule.payload?.post?.version === scheduledBlog.payload?.post?.version + 1 && publicSchedule.response.status === 200,
  `${publishedSchedule.response.status} ${publishedSchedule.text}`)

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
    body: { name: 'Cash Flow OS', tagline: '', category: 'Finance', icon: 'spreadsheet', accent: 'lime', lemonVariantId: '', deliveryUrl: 'https://docs.google.com/spreadsheets/d/local-cashflow-template/copy', offerActive: true, offerLabel: 'Launch Offer', originalPrice: '$69', salePrice: '$39', active: true, featured: true, sortOrder: 0, includes: ['Live finance dashboard', 'Private Google Sheets copy', 'All future updates'] },
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
    deliveryUrl: 'https://docs.google.com/spreadsheets/d/local-cashflow-template/copy',
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

  // Webhook entitlements must correlate to a checkout created by an
  // authenticated account. Configure authoritative prices/variants first.
  await request('/admin/products/cashflow-os', { method: 'PATCH', headers: ownerHeaders, body: { ...cashflowBase, lemonVariantId: '99999', priceCents: 3900, currency: 'USD' } })
  await request('/admin/products/client-crm-os', {
    method: 'PATCH', headers: ownerHeaders,
    body: { name: 'Client CRM OS', tagline: '', category: 'Client relationships', icon: 'users', accent: 'blue', lemonVariantId: '99997', deliveryUrl: 'https://docs.google.com/spreadsheets/d/local-crm-template/copy', offerActive: true, offerLabel: 'Launch Offer', originalPrice: '$59', salePrice: '$35', priceCents: 3500, currency: 'USD', active: true, featured: true, sortOrder: 1, includes: ['Private Google Sheets copy'] },
  })
  await request('/admin/products/invoice-os', {
    method: 'PATCH', headers: ownerHeaders,
    body: { name: 'Invoice OS', tagline: '', category: 'Invoicing', icon: 'receipt', accent: 'peach', lemonVariantId: '99996', deliveryUrl: '', offerActive: true, offerLabel: 'Launch Offer', originalPrice: '$49', salePrice: '$29', priceCents: 2900, currency: 'USD', active: true, featured: true, sortOrder: 3, includes: ['Private Google Sheets copy'] },
  })

  // Multi-product checkout: one paid Lemon Squeezy order carrying several
  // product keys must grant one entitlement per product, with the order
  // total split across the keys.
  const analyticsBefore = await request('/admin/analytics', { headers: ownerHeaders })
  const salesBefore = Number(analyticsBefore.payload?.totalSales || 0)
  const revenueBefore = Number(analyticsBefore.payload?.revenue || 0)

  const suiteCheckout = await createCheckoutFixture('suite-checkout-token', ['cashflow-os', 'client-crm-os'])
  check('multi-product checkout returns an exact correlation id', suiteCheckout.response.response.status === 201 && Boolean(suiteCheckout.checkoutId), `${suiteCheckout.response.response.status} ${suiteCheckout.response.text}`)
  const suiteOrderIdentifier = `ls-suite-${Date.now()}`
  const suiteEvent = {
    meta: { event_name: 'order_created' },
    data: {
      id: String(2000 + (Date.now() % 100000)),
      type: 'orders',
      attributes: {
        identifier: suiteOrderIdentifier,
        order_number: 2001,
        user_email: suiteCheckout.email,
        user_name: 'Suite Buyer',
        status: 'paid',
        subtotal: 7400,
        total: 7400,
        currency: 'USD',
        checkout_id: suiteCheckout.checkoutId,
        created_at: new Date().toISOString(),
        custom: { user_id: suiteCheckout.userId, product_keys: ['cashflow-os', 'client-crm-os'] },
        first_order_item: { variant_id: 99999, price: 7400, checkout_id: suiteCheckout.checkoutId },
      },
    },
  }
  const suiteWebhook = await signedLemonWebhook(suiteEvent)
  check('multi-product orders are accepted by the payment webhook', suiteWebhook.response.status === 200 && suiteWebhook.payload?.received === true, `${suiteWebhook.response.status} ${suiteWebhook.text}`)

  const analyticsAfterSuite = await request('/admin/analytics', { headers: ownerHeaders })
  check('multi-product orders grant one entitlement per product', Number(analyticsAfterSuite.payload?.totalSales || 0) === salesBefore + 2
    && Number(analyticsAfterSuite.payload?.revenue || 0) === revenueBefore + 74, `${analyticsAfterSuite.response.status} ${analyticsAfterSuite.text.slice(0, 160)}`)

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
  check('orders without authenticated product metadata are rejected', legacyWebhook.response.status === 400
    && Number(analyticsAfterLegacy.payload?.totalSales || 0) === salesBefore + 2
    && Number(analyticsAfterLegacy.payload?.revenue || 0) === revenueBefore + 74, `${legacyWebhook.response.status} ${legacyWebhook.text.slice(0, 160)}`)

  const officialCheckout = await createCheckoutFixture('official-checkout-token', ['cashflow-os', 'invoice-os'])
  const officialCustomEvent = {
    meta: {
      event_name: 'order_created',
      custom_data: { user_id: officialCheckout.userId, product_keys: 'cashflow-os,invoice-os' },
    },
    data: {
      id: String(4500 + (Date.now() % 100000)),
      type: 'orders',
      attributes: {
        identifier: `ls-official-custom-${Date.now()}`,
        order_number: 4501,
        user_email: officialCheckout.email,
        user_name: 'Official Custom',
        status: 'paid',
        subtotal: 6800,
        total: 6800,
        currency: 'USD',
        checkout_id: officialCheckout.checkoutId,
        created_at: new Date().toISOString(),
        first_order_item: { variant_id: 99999, price: 6800, checkout_id: officialCheckout.checkoutId },
      },
    },
  }
  const officialCustomWebhook = await signedLemonWebhook(officialCustomEvent)
  const analyticsAfterOfficial = await request('/admin/analytics', { headers: ownerHeaders })
  check('official Lemon Squeezy custom_data strings grant every listed product', officialCustomWebhook.response.status === 200
    && Number(analyticsAfterOfficial.payload?.totalSales || 0) === salesBefore + 4, `${officialCustomWebhook.response.status} ${officialCustomWebhook.text.slice(0, 160)}`)

  // Complimentary access: an owner can bypass checkout without creating a
  // fake sale. The opaque invitation remains useless until the exact verified
  // recipient signs in, and the token is consumed when access is materialized.
  const complimentaryInput = {
    email: 'complimentary-friend-token@suite.test',
    productKeys: ['cashflow-os', 'client-crm-os'],
    idempotencyKey: `complimentary-regression-${Date.now()}`,
  }
  const complimentaryWithoutElevation = await request('/admin/complimentary-grants', {
    method: 'POST',
    headers: baseOwnerHeaders,
    body: complimentaryInput,
  })
  check('complimentary grants require an elevated owner challenge', complimentaryWithoutElevation.response.status === 401, `${complimentaryWithoutElevation.response.status} ${complimentaryWithoutElevation.text.slice(0, 160)}`)

  const analyticsBeforeComplimentary = await request('/admin/analytics', { headers: ownerHeaders })
  const comingSoonComplimentaryProduct = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, status: 'coming_soon', lemonVariantId: '99999', priceCents: 3900, currency: 'USD' },
  })
  const inactiveComplimentaryGrant = await request('/admin/complimentary-grants', {
    method: 'POST',
    headers: ownerHeaders,
    body: {
      email: 'future-product@example.com',
      productKeys: ['cashflow-os'],
      idempotencyKey: 'complimentary-future-inactive-001',
    },
  })
  check('complimentary grants are limited to active products', comingSoonComplimentaryProduct.response.status === 200
    && inactiveComplimentaryGrant.response.status === 409
    && /must be active/i.test(inactiveComplimentaryGrant.payload?.message || ''), `${comingSoonComplimentaryProduct.response.status} ${inactiveComplimentaryGrant.response.status} ${inactiveComplimentaryGrant.text.slice(0, 140)}`)

  const clearedComplimentaryDelivery = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, status: 'active', lemonVariantId: '99999', priceCents: 3900, currency: 'USD', deliveryUrl: '' },
  })
  const missingComplimentaryDelivery = await request('/admin/complimentary-grants', {
    method: 'POST',
    headers: ownerHeaders,
    body: {
      email: 'missing-delivery@example.com',
      productKeys: ['cashflow-os'],
      idempotencyKey: 'complimentary-missing-delivery-001',
    },
  })
  const restoredComplimentaryDelivery = await request('/admin/products/cashflow-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { ...cashflowBase, status: 'active', lemonVariantId: '99999', priceCents: 3900, currency: 'USD', deliveryUrl: 'https://docs.google.com/spreadsheets/d/test-cashflow/copy' },
  })
  check('complimentary grants reject products without delivery configuration', clearedComplimentaryDelivery.response.status === 200
    && missingComplimentaryDelivery.response.status === 503
    && restoredComplimentaryDelivery.response.status === 200, `${clearedComplimentaryDelivery.response.status} ${missingComplimentaryDelivery.response.status} ${restoredComplimentaryDelivery.response.status}`)

  const complimentaryCreated = await request('/admin/complimentary-grants', {
    method: 'POST',
    headers: ownerHeaders,
    body: complimentaryInput,
  })
  check('owner can queue a multi-product-capable complimentary invitation', complimentaryCreated.response.status === 202
    && complimentaryCreated.payload?.grant?.status === 'pending'
    && complimentaryCreated.payload?.grant?.products?.[0]?.productKey === 'cashflow-os'
    && !Object.hasOwn(complimentaryCreated.payload?.grant || {}, 'token')
    && !Object.hasOwn(complimentaryCreated.payload?.grant || {}, 'tokenHash')
    && !Object.hasOwn(complimentaryCreated.payload?.grant || {}, 'tokenCiphertext'), `${complimentaryCreated.response.status} ${complimentaryCreated.text.slice(0, 240)}`)

  const complimentaryDuplicate = await request('/admin/complimentary-grants', {
    method: 'POST',
    headers: ownerHeaders,
    body: complimentaryInput,
  })
  check('complimentary grant creation is idempotent', complimentaryDuplicate.response.status === 200
    && complimentaryDuplicate.payload?.duplicate === true
    && complimentaryDuplicate.payload?.grant?.id === complimentaryCreated.payload?.grant?.id, `${complimentaryDuplicate.response.status} ${complimentaryDuplicate.text.slice(0, 160)}`)

  const complimentaryPendingOverlap = await request('/admin/complimentary-grants', {
    method: 'POST',
    headers: ownerHeaders,
    body: {
      email: complimentaryInput.email,
      productKeys: complimentaryInput.productKeys,
      idempotencyKey: 'complimentary-overlap-001',
    },
  })
  check('duplicate pending complimentary products are rejected', complimentaryPendingOverlap.response.status === 409, `${complimentaryPendingOverlap.response.status} ${complimentaryPendingOverlap.text.slice(0, 180)}`)

  await request('/cdn-cgi/local/scheduled', { origin: null })
  const complimentaryEmails = await fetch(`${MOCK_PROVIDER_URL}/test/emails`).then((response) => response.json())
  const complimentaryEmail = [...complimentaryEmails].reverse().find((email) => email.to?.[0]?.email === complimentaryInput.email && /complimentary/i.test(email.subject || ''))
  const complimentaryEmailHtml = String(complimentaryEmail?.htmlContent || '')
  const complimentaryToken = complimentaryEmailHtml.match(/\/claim#token=([A-Za-z0-9_-]+)/)?.[1] || ''
  check('complimentary email contains an opaque claim link but no product delivery URL', complimentaryToken.length >= 40
    && !/docs\.google\.com\/spreadsheets/i.test(complimentaryEmailHtml)
    && !complimentaryEmailHtml.includes(`email=${encodeURIComponent(complimentaryInput.email)}`), complimentaryEmailHtml.slice(-400))

  const scannerGet = await request('/complimentary/claim', { origin: null })
  check('email scanners cannot consume complimentary claims with GET', scannerGet.response.status === 404, `${scannerGet.response.status} ${scannerGet.text.slice(0, 120)}`)

  const complimentaryResent = await request(`/admin/complimentary-grants/${encodeURIComponent(complimentaryCreated.payload?.grant?.id || '')}/resend`, {
    method: 'POST',
    headers: ownerHeaders,
  })
  await request('/cdn-cgi/local/scheduled', { origin: null })
  const emailsAfterResend = await fetch(`${MOCK_PROVIDER_URL}/test/emails`).then((response) => response.json())
  const resentComplimentaryEmail = [...emailsAfterResend].reverse().find((email) => email.to?.[0]?.email === complimentaryInput.email && /complimentary/i.test(email.subject || ''))
  const resentComplimentaryToken = String(resentComplimentaryEmail?.htmlContent || '').match(/\/claim#token=([A-Za-z0-9_-]+)/)?.[1] || ''
  check('resend rotates the complimentary claim token', complimentaryResent.response.status === 202
    && resentComplimentaryToken.length >= 40
    && resentComplimentaryToken !== complimentaryToken, `${complimentaryResent.response.status} ${resentComplimentaryToken.length}`)

  const rotatedTokenClaim = await request('/complimentary/claim', {
    method: 'POST',
    headers: { Authorization: 'Bearer complimentary-friend-token' },
    body: { token: complimentaryToken },
  })
  check('resend invalidates the previous complimentary link', rotatedTokenClaim.response.status === 410, `${rotatedTokenClaim.response.status} ${rotatedTokenClaim.text.slice(0, 160)}`)

  const wrongEmailClaim = await request('/complimentary/claim', {
    method: 'POST',
    headers: { Authorization: 'Bearer wrong-complimentary-token' },
    body: { token: resentComplimentaryToken },
  })
  check('complimentary claims reject a different verified email', wrongEmailClaim.response.status === 403
    && /exact email/i.test(wrongEmailClaim.payload?.message || ''), `${wrongEmailClaim.response.status} ${wrongEmailClaim.text.slice(0, 160)}`)

  const complimentaryClaim = await request('/complimentary/claim', {
    method: 'POST',
    headers: { Authorization: 'Bearer complimentary-friend-token' },
    body: { token: resentComplimentaryToken },
  })
  check('exact-email claim activates zero-cost product access', complimentaryClaim.response.status === 200
    && complimentaryClaim.payload?.claimed === true
    && complimentaryClaim.payload?.products?.length === 2
    && complimentaryClaim.payload?.products?.every((product) => product.accessSource === 'complimentary' && product.amountTotal === 0)
    && complimentaryClaim.payload?.products?.[0]?.accessSource === 'complimentary'
    && complimentaryClaim.payload?.products?.[0]?.amountTotal === 0, `${complimentaryClaim.response.status} ${complimentaryClaim.text.slice(0, 220)}`)

  const complimentaryReplay = await request('/complimentary/claim', {
    method: 'POST',
    headers: { Authorization: 'Bearer complimentary-friend-token' },
    body: { token: resentComplimentaryToken },
  })
  check('complimentary claim links are one-time', complimentaryReplay.response.status === 410, `${complimentaryReplay.response.status} ${complimentaryReplay.text.slice(0, 140)}`)

  const complimentaryLibrary = await request('/account/purchases', { headers: { Authorization: 'Bearer complimentary-friend-token' } })
  const complimentaryLibraryKeys = (complimentaryLibrary.payload || [])
    .filter((purchase) => purchase.accessSource === 'complimentary')
    .map((purchase) => purchase.productKey)
    .sort()
  check('complimentary library contains exactly the owner-selected products', complimentaryLibrary.response.status === 200
    && JSON.stringify(complimentaryLibraryKeys) === JSON.stringify([...complimentaryInput.productKeys].sort())
    && !complimentaryLibraryKeys.includes('content-calendar'), `${complimentaryLibrary.response.status} ${complimentaryLibrary.text.slice(0, 220)}`)

  const complimentaryAlreadyOwned = await request('/admin/complimentary-grants', {
    method: 'POST',
    headers: ownerHeaders,
    body: {
      email: complimentaryInput.email,
      productKeys: ['cashflow-os'],
      idempotencyKey: 'complimentary-already-owned-001',
    },
  })
  check('already-owned complimentary products are rejected', complimentaryAlreadyOwned.response.status === 409, `${complimentaryAlreadyOwned.response.status} ${complimentaryAlreadyOwned.text.slice(0, 180)}`)

  const complimentaryFeedbackLink = await request(`/account/purchases/${encodeURIComponent(complimentaryClaim.payload?.products?.[0]?.id || '')}/feedback-link`, {
    method: 'POST',
    headers: { Authorization: 'Bearer complimentary-friend-token' },
    body: {},
  })
  check('complimentary customers receive normal verified feedback access', complimentaryFeedbackLink.response.status === 200
    && /^\/feedback\?token=/.test(complimentaryFeedbackLink.payload?.url || ''), `${complimentaryFeedbackLink.response.status} ${complimentaryFeedbackLink.text.slice(0, 160)}`)

  const analyticsAfterComplimentary = await request('/admin/analytics', { headers: ownerHeaders })
  check('complimentary access is excluded from paid sales and revenue', Number(analyticsAfterComplimentary.payload?.totalSales || 0) === Number(analyticsBeforeComplimentary.payload?.totalSales || 0)
    && Number(analyticsAfterComplimentary.payload?.revenue || 0) === Number(analyticsBeforeComplimentary.payload?.revenue || 0)
    && Number(analyticsAfterComplimentary.payload?.complimentaryCustomers || 0) === Number(analyticsBeforeComplimentary.payload?.complimentaryCustomers || 0) + 1, `${analyticsAfterComplimentary.response.status} ${analyticsAfterComplimentary.text.slice(0, 220)}`)

  const complimentaryAudience = await request('/admin/marketing/audience?search=complimentary-friend-token', { headers: ownerHeaders })
  check('complimentary recipient is marked as a non-marketed customer', complimentaryAudience.response.status === 200
    && complimentaryAudience.payload?.contacts?.some((contact) => contact.email === complimentaryInput.email
      && contact.isCustomer === true
      && contact.status === 'unsubscribed'
      && contact.complimentaryStatus === 'active'), `${complimentaryAudience.response.status} ${complimentaryAudience.text.slice(0, 220)}`)

  const complimentaryReview = await request(`/admin/complimentary-grants/${encodeURIComponent(complimentaryCreated.payload?.grant?.id || '')}/review-invite`, {
    method: 'POST',
    headers: ownerHeaders,
    body: {},
  })
  check('complimentary review invitation is owner-controlled', complimentaryReview.response.status === 202
    && complimentaryReview.payload?.totalQueued === 2, `${complimentaryReview.response.status} ${complimentaryReview.text.slice(0, 160)}`)
  await request('/cdn-cgi/local/scheduled', { origin: null })
  const emailsAfterComplimentaryReview = await fetch(`${MOCK_PROVIDER_URL}/test/emails`).then((response) => response.json())
  const complimentaryReviewEmail = [...emailsAfterComplimentaryReview].reverse().find((email) => email.to?.[0]?.email === complimentaryInput.email && /experience|working/i.test(email.subject || ''))
  check('manual review email discloses complimentary access and stays neutral', /complimentary access/i.test(String(complimentaryReviewEmail?.htmlContent || ''))
    && /no particular rating is expected/i.test(String(complimentaryReviewEmail?.htmlContent || '')), String(complimentaryReviewEmail?.htmlContent || '').slice(0, 260))

  const complimentaryRevoked = await request(`/admin/complimentary-grants/${encodeURIComponent(complimentaryCreated.payload?.grant?.id || '')}/revoke`, {
    method: 'POST',
    headers: ownerHeaders,
    body: {},
  })
  const libraryAfterComplimentaryRevoke = await request('/account/purchases', { headers: { Authorization: 'Bearer complimentary-friend-token' } })
  check('revocation removes only complimentary access', complimentaryRevoked.response.status === 200
    && !libraryAfterComplimentaryRevoke.payload?.some((purchase) => purchase.accessSource === 'complimentary'), `${complimentaryRevoked.response.status} ${libraryAfterComplimentaryRevoke.text.slice(0, 180)}`)

  const cancellableComplimentary = await request('/admin/complimentary-grants', {
    method: 'POST',
    headers: ownerHeaders,
    body: {
      email: complimentaryInput.email,
      productKeys: ['cashflow-os'],
      idempotencyKey: 'complimentary-cancellation-001',
    },
  })
  await request('/cdn-cgi/local/scheduled', { origin: null })
  const emailsBeforeCancellation = await fetch(`${MOCK_PROVIDER_URL}/test/emails`).then((response) => response.json())
  const cancellationToken = String([...emailsBeforeCancellation].reverse().find((email) => email.to?.[0]?.email === complimentaryInput.email && /complimentary/i.test(email.subject || ''))?.htmlContent || '').match(/\/claim#token=([A-Za-z0-9_-]+)/)?.[1] || ''
  const complimentaryCancelled = await request(`/admin/complimentary-grants/${encodeURIComponent(cancellableComplimentary.payload?.grant?.id || '')}/cancel`, {
    method: 'POST',
    headers: ownerHeaders,
  })
  const cancelledClaim = await request('/complimentary/claim', {
    method: 'POST',
    headers: { Authorization: 'Bearer complimentary-friend-token' },
    body: { token: cancellationToken },
  })
  check('cancellation immediately invalidates an unclaimed invitation', cancellableComplimentary.response.status === 202
    && cancellationToken.length >= 40
    && complimentaryCancelled.response.status === 200
    && cancelledClaim.response.status === 410, `${cancellableComplimentary.response.status} ${complimentaryCancelled.response.status} ${cancelledClaim.response.status}`)

  const complimentaryAccountDeleted = await request('/account', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer complimentary-friend-token' },
  })
  const grantsAfterComplimentaryDeletion = await request('/admin/complimentary-grants?search=complimentary-friend-token', { headers: ownerHeaders })
  check('account deletion anonymizes complimentary invitation provenance', complimentaryAccountDeleted.response.status === 200
    && complimentaryAccountDeleted.payload?.identityDeleted === true
    && grantsAfterComplimentaryDeletion.payload?.grants?.length === 0, `${complimentaryAccountDeleted.response.status} ${grantsAfterComplimentaryDeletion.text.slice(0, 180)}`)

  // Account deletion: the owner user buys something, then deletes their data.
  // Personal fields must be wiped while aggregate metrics survive.
  const deleteCheckout = await createCheckoutFixture(OWNER_TOKEN, ['cashflow-os'])
  const deleteFlowEvent = {
    meta: { event_name: 'order_created' },
    data: {
      id: String(5000 + (Date.now() % 100000)),
      type: 'orders',
      attributes: {
        identifier: `ls-delete-${Date.now()}`,
        order_number: 5001,
        user_email: deleteCheckout.email,
        user_name: 'Delete Me',
        status: 'paid',
        subtotal: 3900,
        total: 3900,
        currency: 'USD',
        checkout_id: deleteCheckout.checkoutId,
        created_at: new Date().toISOString(),
        custom: { user_id: deleteCheckout.userId, product_keys: ['cashflow-os'] },
        first_order_item: { variant_id: 99999, price: 3900, checkout_id: deleteCheckout.checkoutId },
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
    && accountDeleted.payload?.deleted === true
    && accountDeleted.payload?.identityDeleted === true, `${accountDeleted.response.status} ${accountDeleted.text}`)
  const deletedAuthUsers = await fetch(`${MOCK_PROVIDER_URL}/test/deleted-users`).then((response) => response.json())
  check('account deletion removes the Supabase authentication identity', deletedAuthUsers.includes(deleteCheckout.userId), JSON.stringify(deletedAuthUsers))

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

  await request('/admin/products/cashflow-os', { method: 'PATCH', headers: ownerHeaders, body: { ...cashflowBase, lemonVariantId: '' } })
  await request('/admin/products/client-crm-os', {
    method: 'PATCH', headers: ownerHeaders,
    body: { name: 'Client CRM OS', tagline: '', category: 'Client relationships', icon: 'users', accent: 'blue', lemonVariantId: '', deliveryUrl: '', offerActive: true, offerLabel: 'Launch Offer', originalPrice: '$59', salePrice: '$35', priceCents: 3500, currency: 'USD', active: true, featured: true, sortOrder: 1, includes: ['Private Google Sheets copy'] },
  })

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
  check('Lemon Squeezy checkout returns a provider URL and exact session id', lsNetworkGuard.response.status === 201
    && /^https:\/\/.*\.lemonsqueezy\.com\//.test(lsNetworkGuard.payload?.url || '')
    && /^local-checkout-/.test(lsNetworkGuard.payload?.sessionId || ''), `${lsNetworkGuard.response.status} ${lsNetworkGuard.text.slice(0, 160)}`)

  await request('/admin/products/client-crm-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: { name: 'Client CRM OS', tagline: '', category: 'Client relationships', icon: 'users', accent: 'blue', lemonVariantId: '99997', deliveryUrl: '', offerActive: true, offerLabel: 'Launch Offer', originalPrice: '$59', salePrice: '$35', active: true, featured: true, sortOrder: 1, includes: ['Private Google Sheets copy'] },
  })
  const lsBundleNetwork = await request('/checkout/session', {
    method: 'POST',
    headers: { Authorization: 'Bearer bundle-network-token' },
    body: { productKeys: ['cashflow-os', 'client-crm-os'], consent: true },
  })
  check('multi-product carts create one correlated Lemon Squeezy checkout', lsBundleNetwork.response.status === 201
    && /^local-checkout-/.test(lsBundleNetwork.payload?.sessionId || ''), `${lsBundleNetwork.response.status} ${lsBundleNetwork.text.slice(0, 160)}`)

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
        user_email: 'owner@your-domain.com',
        user_name: 'LS Buyer',
        status: 'paid',
        subtotal: 3900,
        total: 3900,
        currency: 'USD',
        checkout_id: lsNetworkGuard.payload?.sessionId,
        created_at: new Date().toISOString(),
        custom: { user_id: 'local-owner-user-id', product_keys: ['cashflow-os'] },
        first_order_item: { variant_id: 99999, price: 3900, checkout_id: lsNetworkGuard.payload?.sessionId },
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

// Client-side error telemetry (Layer 12): public ingestion with validation.
const goodClientError = await request('/events/client-error', {
  method: 'POST',
  body: { kind: 'render', message: 'Checkout exploded for buyer@example.com', stack: 'Error at Checkout (app.js:1:1)', url: '/cart' },
})
check('client error events are accepted', goodClientError.response.status === 202 && goodClientError.payload?.accepted === true, `${goodClientError.response.status} ${goodClientError.text.slice(0, 160)}`)

const noMessageEvent = await request('/events/client-error', { method: 'POST', body: { kind: 'render' } })
check('client error events require a message', noMessageEvent.response.status === 400, `${noMessageEvent.response.status} ${noMessageEvent.text.slice(0, 160)}`)

const unknownKindEvent = await request('/events/client-error', { method: 'POST', body: { kind: 'made-up-kind', message: 'still accepted' } })
check('unknown client error kinds are normalised, not rejected', unknownKindEvent.response.status === 202, `${unknownKindEvent.response.status}`)

const badUrlEvent = await request('/events/client-error', { method: 'POST', body: { message: 'ok', url: 'javascript:alert(1)' } })
check('client error page URLs must be paths or http(s)', badUrlEvent.response.status === 400, `${badUrlEvent.response.status} ${badUrlEvent.text.slice(0, 160)}`)

for (const [path, method] of [
  ['/account/purchases', 'GET'],
  ['/account', 'DELETE'],
  ['/checkout/session', 'POST'],
  ['/admin/analytics', 'GET'],
  ['/admin/products/cashflow-os/upload', 'POST'],
  ['/admin/client-errors', 'GET'],
  ['/admin/delivery-issues', 'GET'],
  ['/admin/delivery-issues/pur_missing/retry', 'POST'],
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
  const ownerHeaders = { Authorization: `Bearer ${OWNER_TOKEN}`, 'X-Admin-Challenge': ADMIN_CHALLENGE }
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
  // Consent negatives run as the buyer identity, not the owner: checkout
  // consumes a per-user budget (8/10min) plus a per-email daily budget (4),
  // which the Lemon Squeezy section above rightfully exhausts for the
  // owner account. The mock Supabase maps this token to a second user.
  const buyerHeaders = { Authorization: 'Bearer local-buyer-token' }
  const noConsent = await request('/checkout/session', { method: 'POST', headers: buyerHeaders, body: { productKeys: ['cashflow-os'] } })
  check('checkout is refused when consent is absent', noConsent.response.status === 400
    && /accept the terms/i.test(noConsent.payload?.message || ''), `${noConsent.response.status} ${noConsent.text.slice(0, 140)}`)

  const falseConsent = await request('/checkout/session', { method: 'POST', headers: buyerHeaders, body: { productKeys: ['cashflow-os'], consent: false } })
  check('checkout is refused when consent is false', falseConsent.response.status === 400, `${falseConsent.response.status}`)

  const truthyConsent = await request('/checkout/session', { method: 'POST', headers: buyerHeaders, body: { productKeys: ['cashflow-os'], consent: 'yes' } })
  check('a truthy string does not count as consent', truthyConsent.response.status === 400, `${truthyConsent.response.status}`)
}

// ----------------------------------------------------------- duplication
// Duplicating a product copies its written content but must never inherit
// commercial wiring or media, which are per-product.
if (OWNER_TOKEN) {
  const ownerHeaders = { Authorization: `Bearer ${OWNER_TOKEN}`, 'X-Admin-Challenge': ADMIN_CHALLENGE }
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

  // Layer 12/13 owner visibility: the telemetry posted earlier in this run
  // must be listed, PII-redacted; delivery issues must be enumerable.
  const clientErrors = await request('/admin/client-errors?limit=20', { headers: ownerHeaders })
  const reportedError = Array.isArray(clientErrors.payload)
    ? clientErrors.payload.find((row) => typeof row.message === 'string' && row.message.includes('Checkout exploded'))
    : null
  check('owner can list reported client errors', clientErrors.response.status === 200 && Boolean(reportedError), clientErrors.text.slice(0, 200))
  check('stored client errors carry no personal email', Boolean(reportedError)
    && !reportedError.message.includes('buyer@example.com')
    && reportedError.message.includes('[REDACTED]'), reportedError?.message || 'row not found')

  const deliveryIssues = await request('/admin/delivery-issues', { headers: ownerHeaders })
  check('owner can list delivery issues', deliveryIssues.response.status === 200 && Array.isArray(deliveryIssues.payload?.issues), deliveryIssues.text.slice(0, 200))

  // Waitlist identities and poll writes are bound to verified bearer/action
  // tokens. Client-supplied user IDs are ignored.
  const waitlistProduct = await request('/admin/products/project-os', {
    method: 'PATCH',
    headers: ownerHeaders,
    body: {
      name: 'Project OS', tagline: 'Coming soon', category: 'Projects', icon: 'gauge', accent: 'violet',
      lemonVariantId: '', deliveryUrl: '', originalPrice: '$79', salePrice: '$49', priceCents: 4900, currency: 'USD',
      offerLabel: 'Launch Offer', offerActive: true, status: 'coming_soon', active: true, featured: true, sortOrder: 2,
      includes: ['Private Google Sheets copy'],
      waitlistConfig: { welcomeEmailEnabled: false, pollEnabled: true, pollQuestion: 'Most useful view?', pollOptions: ['Timeline', 'Budget'] },
    },
  })
  check('owner can configure a token-protected waitlist poll', waitlistProduct.response.status === 200, `${waitlistProduct.response.status} ${waitlistProduct.text.slice(0, 160)}`)

  const waitlistJoin = await request('/waitlist/subscribe', {
    method: 'POST',
    headers: { Authorization: 'Bearer waitlist-user-token' },
    body: { productKey: 'project-os', email: 'waitlist-user-token@suite.test', userId: 'attacker-chosen-id', marketingOptIn: true, source: 'regression' },
  })
  const pollToken = waitlistJoin.payload?.poll?.token || ''
  check('waitlist join returns an opaque poll action token', waitlistJoin.response.status === 200 && pollToken.length > 20, `${waitlistJoin.response.status} ${waitlistJoin.text}`)

  const forgedVote = await request('/waitlist/poll-vote', { method: 'POST', body: { productKey: 'project-os', token: 'forged-token-value', vote: 'Timeline' } })
  check('waitlist poll rejects forged action tokens', forgedVote.response.status === 401, `${forgedVote.response.status} ${forgedVote.text}`)
  const validVote = await request('/waitlist/poll-vote', { method: 'POST', body: { productKey: 'project-os', token: pollToken, vote: 'Timeline' } })
  check('waitlist poll accepts its one-time action token', validVote.response.status === 200, `${validVote.response.status} ${validVote.text}`)
  const replayedVote = await request('/waitlist/poll-vote', { method: 'POST', body: { productKey: 'project-os', token: pollToken, vote: 'Budget' } })
  check('waitlist poll token cannot be replayed', replayedVote.response.status === 401, `${replayedVote.response.status} ${replayedVote.text}`)

  const adminWaitlist = await request('/admin/products/project-os/waitlist', { headers: ownerHeaders })
  const waitlistRow = adminWaitlist.payload?.subscribers?.find((row) => row.email === 'waitlist-user-token@suite.test')
  check('waitlist ignores client-supplied identity and stores verified identity', waitlistRow?.userId === 'local-waitlist-user-token' && waitlistRow?.pollResponse === 'Timeline', JSON.stringify(waitlistRow || null))

  const launchQueued = await request('/admin/products/project-os/waitlist/broadcast', {
    method: 'POST', headers: ownerHeaders,
    body: { subject: 'Project OS is live', message: 'Your requested launch notice.', idempotencyKey: 'waitlist-launch-regression-001' },
  })
  const launchDuplicate = await request('/admin/products/project-os/waitlist/broadcast', {
    method: 'POST', headers: ownerHeaders,
    body: { subject: 'Project OS is live', message: 'Your requested launch notice.', idempotencyKey: 'waitlist-launch-regression-001' },
  })
  check('waitlist launch broadcast is queued asynchronously', launchQueued.response.status === 202 && launchQueued.payload?.totalQueued === 1, `${launchQueued.response.status} ${launchQueued.text}`)
  check('waitlist launch idempotency prevents duplicate delivery jobs', launchDuplicate.response.status === 202 && launchDuplicate.payload?.duplicate === true, `${launchDuplicate.response.status} ${launchDuplicate.text}`)

  // Manual audience additions require an explicit consent attestation. CSV
  // values and queued campaigns are tested through the real Worker routes.
  const noConsentContact = await request('/admin/marketing/contacts', {
    method: 'POST', headers: ownerHeaders,
    body: { email: 'no-consent@suite.test', name: 'No Consent', source: 'manual' },
  })
  check('admin cannot silently subscribe a contact without consent', noConsentContact.response.status === 400, `${noConsentContact.response.status} ${noConsentContact.text}`)

  const marketingContact = await request('/admin/marketing/contacts', {
    method: 'POST', headers: ownerHeaders,
    body: { email: 'marketing-recipient@suite.test', name: '=HYPERLINK("https://bad.example")', source: 'manual', consentConfirmed: true },
  })
  check('admin can record a consent-attested marketing contact', marketingContact.response.status === 201, `${marketingContact.response.status} ${marketingContact.text}`)

  const audienceCsv = await request('/admin/marketing/audience/export?segment=all', { headers: ownerHeaders })
  check('audience CSV neutralizes spreadsheet formulas', audienceCsv.response.status === 200 && audienceCsv.text.includes("'=HYPERLINK"), audienceCsv.text.slice(0, 200))

  const campaignInput = {
    title: 'Regression campaign', subject: 'Hello {{first_name}}', eyebrow: 'RUNWAY SYSTEMS TEST',
    message: 'This is a durable queue test.', targetSegment: 'all', targetProductKey: '', discountCode: '',
    ctaLabel: 'Open storefront', ctaUrl: 'https://runwaysystems.cloud', idempotencyKey: 'campaign-regression-001',
  }
  const campaignQueued = await request('/admin/marketing/campaigns/broadcast', { method: 'POST', headers: ownerHeaders, body: campaignInput })
  const campaignDuplicate = await request('/admin/marketing/campaigns/broadcast', { method: 'POST', headers: ownerHeaders, body: campaignInput })
  check('marketing campaign returns 202 with durable queued deliveries', campaignQueued.response.status === 202 && campaignQueued.payload?.totalQueued >= 1, `${campaignQueued.response.status} ${campaignQueued.text}`)
  check('campaign idempotency key returns the existing campaign', campaignDuplicate.response.status === 202 && campaignDuplicate.payload?.duplicate === true && campaignDuplicate.payload?.campaignId === campaignQueued.payload?.campaignId, `${campaignDuplicate.response.status} ${campaignDuplicate.text}`)

  await request('/cdn-cgi/local/scheduled', { origin: null })
  await new Promise((resolve) => setTimeout(resolve, 100))
  const campaignsAfterSend = await request('/admin/marketing/campaigns', { headers: ownerHeaders })
  const queuedCampaign = campaignsAfterSend.payload?.find((row) => row.id === campaignQueued.payload?.campaignId)
  check('campaign queue tracks completion and send counts', queuedCampaign?.status === 'completed' && queuedCampaign?.sentCount === queuedCampaign?.recipientCount, JSON.stringify(queuedCampaign || null))

  const mockEmails = await fetch('http://127.0.0.1:9876/test/emails').then((response) => response.json())
  const marketingEmail = [...mockEmails].reverse().find((email) => email.to?.[0]?.email === 'marketing-recipient@suite.test')
  const unsubscribeMatch = String(marketingEmail?.htmlContent || '').match(/\/unsubscribe\?token=([^"&<]+)/)
  const unsubscribeToken = unsubscribeMatch ? decodeURIComponent(unsubscribeMatch[1]) : ''
  check('marketing delivery uses an opaque token-only unsubscribe link', Boolean(unsubscribeToken) && !String(marketingEmail?.htmlContent || '').includes('email=marketing-recipient'), String(marketingEmail?.htmlContent || '').slice(-240))

  const unsubscribeConfirm = await request(`/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`)
  const beforeMutation = await request('/admin/marketing/audience?search=marketing-recipient', { headers: ownerHeaders })
  check('unsubscribe GET confirms without mutating consent', unsubscribeConfirm.response.status === 200
    && beforeMutation.payload?.contacts?.some((contact) => contact.email === 'marketing-recipient@suite.test' && contact.status === 'subscribed'), `${unsubscribeConfirm.response.status} ${beforeMutation.text}`)

  const unsubscribeMutation = await request(`/marketing/unsubscribe`, { method: 'POST', body: { token: unsubscribeToken } })
  const unsubscribeReplay = await request(`/marketing/unsubscribe`, { method: 'POST', body: { token: unsubscribeToken } })
  const afterMutation = await request('/admin/marketing/audience?search=marketing-recipient', { headers: ownerHeaders })
  check('unsubscribe POST creates durable suppression', unsubscribeMutation.response.status === 200
    && afterMutation.payload?.contacts?.some((contact) => contact.email === 'marketing-recipient@suite.test' && contact.status === 'unsubscribed'), `${unsubscribeMutation.response.status} ${afterMutation.text}`)
  check('opaque unsubscribe token is single use', unsubscribeReplay.response.status === 400, `${unsubscribeReplay.response.status} ${unsubscribeReplay.text}`)

  const suppressedNewsletterRequest = await request('/newsletter/subscribe', {
    method: 'POST', body: { email: 'marketing-recipient@suite.test', consent: true, source: 'product', company: '' },
  })
  const beforeReconfirmation = await request('/admin/marketing/audience?search=marketing-recipient', { headers: ownerHeaders })
  check('an unconfirmed newsletter request never clears prior suppression', suppressedNewsletterRequest.response.status === 202
    && beforeReconfirmation.payload?.contacts?.some((contact) => contact.email === 'marketing-recipient@suite.test' && contact.status === 'unsubscribed'), `${suppressedNewsletterRequest.response.status} ${beforeReconfirmation.text}`)
  const reconfirmationEmails = await fetch(`${MOCK_PROVIDER_URL}/test/emails`).then((response) => response.json())
  const reconfirmationEmail = [...reconfirmationEmails].reverse().find((email) => email?.to?.[0]?.email === 'marketing-recipient@suite.test' && /confirm/i.test(email?.subject || ''))
  const reconfirmationToken = String(reconfirmationEmail?.htmlContent || '').match(/\/newsletter\/confirm#token=([A-Za-z0-9_-]{40,100})/)?.[1] || ''
  const newsletterReconfirmed = await request('/newsletter/confirm', { method: 'POST', body: { token: reconfirmationToken } })
  const afterReconfirmation = await request('/admin/marketing/audience?search=marketing-recipient', { headers: ownerHeaders })
  check('a fresh confirmed opt-in clears prior suppression', newsletterReconfirmed.response.status === 200
    && afterReconfirmation.payload?.contacts?.some((contact) => contact.email === 'marketing-recipient@suite.test'
      && contact.status === 'subscribed' && contact.marketingOptInSource === 'newsletter_product'), `${newsletterReconfirmed.response.status} ${afterReconfirmation.text}`)
}

const failures = results.filter((result) => !result.condition)
console.log(`\nWorker local regression: ${results.length - failures.length}/${results.length} checks passed`)
if (failures.length) process.exit(1)
