// Storefront-host health check.
//
// /health used to fall through to the React app and show the NotFound page on
// the Pages hostname. This function keeps the URL machine-readable and, when a
// Worker URL is configured, reports the real platform readiness result.

const DEFAULT_API_BASE_URL = 'https://cashflow-os-platform.runwaysystems-cloud.workers.dev'

function stripTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function platformUrl(env, requestUrl, path) {
  const explicit = stripTrailingSlash(env.HEALTH_SOURCE_URL)
  const apiBase = stripTrailingSlash(env.VITE_API_BASE_URL)
  const raw = explicit || (apiBase ? `${apiBase}${path}` : `${DEFAULT_API_BASE_URL}${path}`)

  let source
  try {
    source = new URL(raw, requestUrl)
  } catch {
    return null
  }
  if (explicit && source.pathname === '/') source.pathname = path

  const request = new URL(requestUrl)
  if (source.origin === request.origin && source.pathname.replace(/\/+$/, '') === path) return null
  return source
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function onRequestGet(context) {
  const source = platformUrl(context.env || {}, context.request.url, '/health')
  if (!source) {
    return jsonResponse({ ok: true, service: 'runway-systems-storefront', platform: 'not-configured' })
  }

  try {
    const upstream = await fetch(source, { headers: { Accept: 'application/json' } })
    const text = await upstream.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      return jsonResponse({ ok: false, service: 'runway-systems-storefront', platform: 'invalid-health-response' }, 502)
    }

    return jsonResponse({ service: 'runway-systems-storefront', platformUrl: source.origin, ...payload }, upstream.status)
  } catch (error) {
    return jsonResponse({
      ok: false,
      service: 'runway-systems-storefront',
      platformUrl: source.origin,
      message: 'Platform health check could not be reached.',
      error: error?.message || 'fetch failed',
    }, 503)
  }
}

export async function onRequestHead(context) {
  const response = await onRequestGet(context)
  return new Response(null, { status: response.status, headers: response.headers })
}
