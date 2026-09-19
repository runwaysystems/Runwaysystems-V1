function sourceUrl(env, requestUrl) {
  const base = String(env.JOURNAL_SOURCE_URL || env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
  if (!base) return null
  try { const url = new URL(`${base}/llms.txt`, requestUrl); return url.origin === new URL(requestUrl).origin ? null : url } catch { return null }
}

export async function onRequestGet(context) {
  const source = sourceUrl(context.env || {}, context.request.url)
  if (source) {
    try {
      const response = await fetch(source, { headers: { Accept: 'text/plain' }, signal: AbortSignal.timeout(5000) })
      const text = await response.text()
      if (response.ok && text.startsWith('# Runway Systems')) return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600', 'X-Content-Type-Options': 'nosniff' } })
    } catch { /* preserve the checked-in public fallback */ }
  }
  return context.next()
}

export async function onRequestHead(context) { const response = await onRequestGet(context); return new Response(null, { status: response.status, headers: response.headers }) }
