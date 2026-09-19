// Local mock of the Supabase auth endpoint used by the Worker's
// authenticate() helper. Only for local regression runs.
import http from 'node:http'

let checkoutCounter = 0
const sentEmails = []
const deletedAuthUsers = []

const server = http.createServer((req, res) => {
  if (req.url === '/test/emails' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(sentEmails))
    return
  }
  if (req.url === '/test/deleted-users' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(deletedAuthUsers))
    return
  }
  if (req.url === '/v3/smtp/email' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let payload = null
      try { payload = JSON.parse(body) } catch { /* request validation belongs to the Worker */ }
      if (payload?.to?.[0]?.email === 'newsletter-provider-failure@suite.test') {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'Fixture provider outage' }))
        return
      }
      if (payload) sentEmails.push(payload)
      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ messageId: `local-email-${sentEmails.length}` }))
    })
    return
  }
  if (req.url === '/v1/checkouts' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try { JSON.parse(body) } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ errors: [{ detail: 'Invalid checkout JSON' }] }))
        return
      }
      checkoutCounter += 1
      const payload = JSON.stringify({
        data: {
          id: `local-checkout-${checkoutCounter}`,
          type: 'checkouts',
          attributes: { url: `https://store.lemonsqueezy.com/checkout/buy/local-${checkoutCounter}` },
        },
      })
      res.writeHead(201, { 'Content-Type': 'application/vnd.api+json' })
      res.end(payload)
    })
    return
  }
  if (req.url === '/auth/v1/user') {
    // Distinct identities per bearer token, like the real Supabase: the
    // buyer token exists so rate-limited user flows (checkout consumes a
    // per-email daily budget) can be exercised without draining the
    // owner's buckets. Every other token maps to the owner.
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    const isOwner = token === 'ci-local-owner-token'
    const isBuyer = token === 'local-buyer-token'
    const fixtureKey = token.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'anonymous'
    const body = JSON.stringify({
      id: isOwner ? 'local-owner-user-id' : (isBuyer ? 'local-buyer-user-id' : `local-${fixtureKey}`),
      email: isOwner ? 'owner@your-domain.com' : (isBuyer ? 'buyer@suite.test' : `${fixtureKey}@suite.test`),
      // A fresh issued-at so the admin mutation recency gate (max 30
      // minutes old) treats this fixture like a just-signed-in owner.
      iat: Math.floor(Date.now() / 1000),
      email_confirmed_at: new Date().toISOString(),
      app_metadata: isOwner ? { role: 'owner', provider: 'google' } : { provider: 'google' },
      user_metadata: { name: isOwner ? 'Owner' : 'Buyer', avatar_url: '' },
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(body)
    return
  }
  // The Lemon Squeezy webhook flow re-verifies custom.user_id against the
  // Supabase admin endpoint before granting entitlements. Account deletion
  // uses the same path with DELETE; capture it so the regression can prove
  // provider-side identity deletion was requested.
  if (/^\/auth\/v1\/admin\/users\/[^/]+$/.test(req.url || '')) {
    if (req.method === 'DELETE') deletedAuthUsers.push(decodeURIComponent(req.url.split('/').pop() || ''))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end('{}')
})

server.listen(9876, '127.0.0.1', () => console.log('mock supabase on 9876'))
