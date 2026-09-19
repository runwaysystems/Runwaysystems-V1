const XML_HEADERS = { 'Content-Type': 'application/rss+xml; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }

function sourceUrl(env, requestUrl) {
  const base = String(env.JOURNAL_SOURCE_URL || env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
  if (!base) return null
  try {
    const source = new URL(`${base}/blog/feed.xml`, requestUrl)
    if (source.origin === new URL(requestUrl).origin) return null
    return source
  } catch { return null }
}

export async function onRequestGet(context) {
  const source = sourceUrl(context.env || {}, context.request.url)
  if (source) {
    try {
      const response = await fetch(source, { headers: { Accept: 'application/rss+xml, application/xml;q=.9' }, signal: AbortSignal.timeout(5000) })
      const text = await response.text()
      if (response.ok && text.includes('<rss') && text.includes('</rss>')) return new Response(text, { headers: { ...XML_HEADERS, 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } })
    } catch { /* fall through to an empty but valid feed */ }
  }
  const origin = new URL(context.request.url).origin
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Runway Systems Blog</title><link>${origin}/blog</link><description>Practical field notes for independent business.</description></channel></rss>\n`, { headers: { ...XML_HEADERS, 'Cache-Control': 'public, max-age=60' } })
}

export async function onRequestHead(context) { const response = await onRequestGet(context); return new Response(null, { status: response.status, headers: response.headers }) }
