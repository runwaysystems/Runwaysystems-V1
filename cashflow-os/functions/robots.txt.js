// Storefront-host robots.txt.
//
// Keeping this as a Pages Function prevents /robots.txt from ever falling into
// the React NotFound page and makes the sitemap URL match the current host.

function cleanOrigin(value) {
  const first = String(value || '').split(',')[0].trim().replace(/\/+$/, '')
  if (!first) return ''
  try {
    return new URL(first).origin
  } catch {
    return ''
  }
}

function robotsText(origin) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /account',
    'Disallow: /feedback',
    'Disallow: /admin',
    'Disallow: /success',
    'Disallow: /cart',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

export async function onRequestGet(context) {
  const requestOrigin = new URL(context.request.url).origin
  const origin = cleanOrigin(context.env?.ROBOTS_SITE_URL || context.env?.SITE_URL || context.env?.APP_ORIGIN) || requestOrigin

  return new Response(robotsText(origin), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function onRequestHead(context) {
  const response = await onRequestGet(context)
  return new Response(null, { status: response.status, headers: response.headers })
}
