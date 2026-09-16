// Cloudflare Pages Function for an optional live sitemap.
//
// The build still writes a static dist/sitemap.xml. This function serves the
// Worker-backed dynamic sitemap on the storefront hostname, using
// SITEMAP_SOURCE_URL, VITE_API_BASE_URL, or the production Worker fallback. If
// the Worker is unavailable or returns anything other than XML, the request
// falls through to the generated static sitemap instead of the React app's 404
// page.

const DEFAULT_API_BASE_URL = 'https://cashflow-os-platform.runwaysystems-cloud.workers.dev'

const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

function sitemapSourceUrl(env, requestUrl) {
  const explicit = String(env.SITEMAP_SOURCE_URL || '').trim()
  const apiBase = String(env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '')
  const raw = explicit || (apiBase ? `${apiBase}/sitemap.xml` : '')
  if (!raw) return null

  let source
  try {
    source = new URL(raw, requestUrl)
  } catch {
    return null
  }
  if (explicit && source.pathname === '/') source.pathname = '/sitemap.xml'

  // Avoid a misconfiguration that points the function back at itself.
  const request = new URL(requestUrl)
  if (source.origin === request.origin && source.pathname.replace(/\/+$/, '') === '/sitemap.xml') return null
  return source
}

function looksLikeSitemapXml(text) {
  const trimmed = String(text || '').trim()
  return trimmed.startsWith('<?xml') && trimmed.includes('<urlset') && trimmed.includes('</urlset>')
}

async function staticSitemap(context) {
  const response = await context.next()
  if (response.headers.get('content-type')?.includes('xml')) return response
  return new Response(response.body, { status: response.status, headers: { ...XML_HEADERS, 'Cache-Control': 'public, max-age=0, must-revalidate' } })
}

export async function onRequestGet(context) {
  const source = sitemapSourceUrl(context.env || {}, context.request.url)
  if (!source) return staticSitemap(context)

  try {
    const upstream = await fetch(source, {
      headers: { Accept: 'application/xml, text/xml;q=0.9, */*;q=0.1' },
    })
    const text = await upstream.text()
    if (!upstream.ok || !looksLikeSitemapXml(text)) return staticSitemap(context)

    return new Response(text, {
      status: 200,
      headers: {
        ...XML_HEADERS,
        // Keep the storefront-host sitemap fresh after dashboard changes.
        // The Worker invalidates its own cache on product writes; this tells
        // crawlers and edge caches to revalidate instead of keeping removed
        // product URLs around.
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    })
  } catch {
    return staticSitemap(context)
  }
}

export async function onRequestHead(context) {
  const response = await onRequestGet(context)
  return new Response(null, { status: response.status, headers: response.headers })
}
