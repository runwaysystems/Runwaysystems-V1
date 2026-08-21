// Local mock of the Supabase auth endpoint used by the Worker's
// authenticate() helper. Only for local regression runs.
import http from 'node:http'

const server = http.createServer((req, res) => {
  if (req.url === '/auth/v1/user') {
    // Distinct identities per bearer token, like the real Supabase: the
    // buyer token exists so rate-limited user flows (checkout consumes a
    // per-email daily budget) can be exercised without draining the
    // owner's buckets. Every other token maps to the owner.
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    const isBuyer = token === 'local-buyer-token'
    const body = JSON.stringify({
      id: isBuyer ? 'local-buyer-user-id' : 'local-owner-user-id',
      email: isBuyer ? 'buyer@suite.test' : 'owner@your-domain.com',
      // A fresh issued-at so the admin mutation recency gate (max 30
      // minutes old) treats this fixture like a just-signed-in owner.
      iat: Math.floor(Date.now() / 1000),
      app_metadata: isBuyer ? { provider: 'google' } : { role: 'owner', provider: 'google' },
      user_metadata: isBuyer ? { name: 'Buyer', avatar_url: '' } : { name: 'Owner', avatar_url: '' },
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(body)
    return
  }
  // The Lemon Squeezy webhook flow re-verifies custom.user_id against the
  // Supabase admin endpoint before granting entitlements. Answer 200 with
  // no email: the user exists, and the worker skips its optional
  // email-equality cross-check when the user record carries none.
  if (/^\/auth\/v1\/admin\/users\/[^/]+$/.test(req.url || '')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end('{}')
})

server.listen(9876, '127.0.0.1', () => console.log('mock supabase on 9876'))
