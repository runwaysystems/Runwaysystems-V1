// Local mock of the Supabase auth endpoint used by the Worker's
// authenticate() helper. Only for local regression runs.
import http from 'node:http'

const server = http.createServer((req, res) => {
  if (req.url === '/auth/v1/user') {
    const body = JSON.stringify({
      id: 'local-owner-user-id',
      email: 'owner@your-domain.com',
      app_metadata: { role: 'owner', provider: 'google' },
      user_metadata: { name: 'Owner', avatar_url: '' },
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(body)
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end('{}')
})

server.listen(9876, '127.0.0.1', () => console.log('mock supabase on 9876'))
