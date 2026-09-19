// First-response Blog rendering for crawlers, link previews, and readers
// without JavaScript. React replaces this semantic projection after booting.
const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

function apiBase(env) {
  const value = String(env.JOURNAL_SOURCE_URL || env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
  try { return value ? new URL(value).toString().replace(/\/$/, '') : '' } catch { return '' }
}

function markdownProjection(markdown) {
  const output = []
  let paragraph = []
  let list = ''
  let inCode = false
  let code = []
  const closeParagraph = () => { if (paragraph.length) { output.push(`<p>${escapeHtml(paragraph.join(' '))}</p>`); paragraph = [] } }
  const closeList = () => { if (list) { output.push(`</${list}>`); list = '' } }
  for (const rawLine of String(markdown || '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('```')) {
      closeParagraph(); closeList()
      if (inCode) { output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = [] }
      inCode = !inCode
      continue
    }
    if (inCode) { code.push(rawLine); continue }
    if (!line) { closeParagraph(); closeList(); continue }
    const heading = /^(#{2,4})\s+(.+)$/.exec(line)
    if (heading) { closeParagraph(); closeList(); const level = heading[1].length; output.push(`<h${level}>${escapeHtml(heading[2].replace(/[*_`]/g, ''))}</h${level}>`); continue }
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    const ordered = /^\d+\.\s+(.+)$/.exec(line)
    if (bullet || ordered) {
      closeParagraph(); const wanted = bullet ? 'ul' : 'ol'; if (list !== wanted) { closeList(); output.push(`<${wanted}>`); list = wanted }
      output.push(`<li>${escapeHtml((bullet || ordered)[1])}</li>`); continue
    }
    if (line.startsWith('> ')) { closeParagraph(); closeList(); output.push(`<blockquote><p>${escapeHtml(line.slice(2))}</p></blockquote>`); continue }
    if (/^!\[[^\]]*\]\(/.test(line)) continue
    paragraph.push(line)
  }
  closeParagraph(); closeList()
  if (inCode && code.length) output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
  return output.join('\n')
}

function setMeta(html, attribute, key, value) {
  const escaped = escapeHtml(value)
  const pattern = new RegExp(`<meta\\s+${attribute}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content="[^"]*"\\s*\\/?>`, 'i')
  const tag = `<meta ${attribute}="${key}" content="${escaped}" />`
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

function projectArticle(post, relatedPosts, origin, base) {
  const canonical = `${origin}/blog/${encodeURIComponent(post.slug)}`
  const cover = post.cover?.path ? `${base}${post.cover.path}` : `${origin}/og-default.png`
  const category = post.category?.name || 'Blog'
  const related = (relatedPosts || []).map((item) => `<li><a href="/blog/${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a></li>`).join('')
  return `<div class="journal-page journal-article-page journal-ssr layout-${escapeHtml(post.layout || 'editorial')}">
    <main><article class="journal-article" itemscope itemtype="https://schema.org/BlogPosting">
      <header class="article-hero"><div class="shell article-hero__inner">
        <nav class="article-breadcrumb" aria-label="Breadcrumb"><a href="/">Runway Systems</a><span>/</span><a href="/blog">Blog</a><span>/</span><span>${escapeHtml(category)}</span></nav>
        <div class="article-kicker"><span>${escapeHtml(category)}</span></div>
        <h1 itemprop="headline">${escapeHtml(post.title)}</h1><p class="article-deck" itemprop="description">${escapeHtml(post.excerpt)}</p>
        <div class="article-byline"><span class="article-author-mark">RS</span><div><strong itemprop="author">${escapeHtml(post.authorName || 'Runway Systems')}</strong><span><time itemprop="datePublished" datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(new Date(post.publishedAt).toLocaleDateString('en', { dateStyle: 'long' }))}</time> · ${Number(post.readingMinutes || 1)} min read</span></div></div>
      </div></header>
      ${post.cover?.path ? `<figure class="article-cover shell"><img itemprop="image" src="${escapeHtml(cover)}" alt="${escapeHtml(post.cover.altText || '')}" width="${Number(post.cover.width || 0) || 1600}" height="${Number(post.cover.height || 0) || 900}" /><figcaption>${escapeHtml(post.cover.caption || '')}</figcaption></figure>` : ''}
      <div class="article-reading shell"><div class="blog-prose article-body" itemprop="articleBody">${markdownProjection(post.bodyMarkdown)}</div></div>
      ${related ? `<footer class="article-end shell"><h2>Related articles</h2><ul>${related}</ul><a href="/blog">Return to the Runway Systems Blog</a></footer>` : ''}
    </article></main>
  </div>`
}

function renderShell(html, { post, relatedPosts, origin, base }) {
  const title = post.seoTitle || `${post.title} | Runway Systems Blog`
  const description = post.seoDescription || post.excerpt
  const canonical = `${origin}/blog/${encodeURIComponent(post.slug)}`
  const image = post.cover?.path ? `${base}${post.cover.path}` : `${origin}/og-default.png`
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
  for (const [attribute, key, value] of [
    ['name', 'description', description], ['name', 'robots', 'index, follow'],
    ['property', 'og:title', title], ['property', 'og:description', description], ['property', 'og:type', 'article'], ['property', 'og:url', canonical],
    ['property', 'og:image', image], ['property', 'og:image:alt', post.cover?.altText || post.title],
    ['name', 'twitter:title', title], ['name', 'twitter:description', description], ['name', 'twitter:image', image], ['name', 'twitter:image:alt', post.cover?.altText || post.title],
  ]) html = setMeta(html, attribute, key, value)
  const schemas = [
    { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description, image: [image], datePublished: post.publishedAt, dateModified: post.updatedAt, mainEntityOfPage: canonical, author: { '@type': 'Organization', name: post.authorName || 'Runway Systems' }, publisher: { '@type': 'Organization', name: 'Runway Systems', url: origin }, keywords: (post.tags || []).join(', ') },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Runway Systems', item: origin }, { '@type': 'ListItem', position: 2, name: 'Runway Systems Blog', item: `${origin}/blog` }, { '@type': 'ListItem', position: 3, name: post.title, item: canonical }] },
  ]
  const head = `<link rel="alternate" type="application/rss+xml" title="Runway Systems Blog" href="${origin}/blog/feed.xml" />\n    ${schemas.map((schema) => `<script type="application/ld+json">${safeJson(schema)}</script>`).join('\n    ')}`
  html = html.replace('</head>', `    ${head}\n  </head>`)
  return html.replace('<div id="root"></div>', `<div id="root">${projectArticle(post, relatedPosts, origin, base)}</div>`)
}

function errorPage(status, title, message, origin) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${escapeHtml(title)} | Runway Systems Blog</title><link rel="canonical" href="${escapeHtml(origin)}/blog"></head><body><main><article><p>RUNWAY SYSTEMS BLOG</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/blog">Browse the Blog</a></article></main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': status === 404 ? 'public, max-age=60' : 'no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' } })
}

export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin
  const slug = String(context.params?.slug || '').toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return errorPage(404, 'Article not found', 'This field note is not publicly available.', origin)
  const base = apiBase(context.env || {})
  if (!base) return errorPage(503, 'Blog temporarily unavailable', 'The publishing service is not configured for this deployment.', origin)
  let upstream
  try { upstream = await fetch(`${base}/blog/posts/${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }) }
  catch { return errorPage(503, 'Blog temporarily unavailable', 'The publishing service could not be reached. Please try again shortly.', origin) }
  let payload
  try { payload = await upstream.json() } catch { return errorPage(503, 'Blog temporarily unavailable', 'The publishing service returned an invalid response.', origin) }
  if (payload?.redirectTo) return new Response(null, { status: 308, headers: { Location: `${origin}${payload.redirectTo}`, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } })
  if (upstream.status === 404 || !payload?.post) return errorPage(404, 'Article not found', 'This field note may be a draft, archived, or removed.', origin)
  if (!upstream.ok) return errorPage(503, 'Blog temporarily unavailable', 'The publishing service could not complete this request.', origin)
  const shellRequest = new Request(`${origin}/`, { method: 'GET', headers: context.request.headers })
  const shellResponse = await context.next(shellRequest)
  const html = await shellResponse.text()
  if (!shellResponse.ok || !html.includes('<div id="root"></div>')) return errorPage(503, 'Blog temporarily unavailable', 'The storefront shell could not be loaded.', origin)
  const rendered = renderShell(html, { post: payload.post, relatedPosts: payload.relatedPosts || [], origin, base })
  const headers = new Headers(shellResponse.headers)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(rendered, { status: 200, headers })
}

export async function onRequestHead(context) { const response = await onRequestGet(context); return new Response(null, { status: response.status, headers: response.headers }) }
