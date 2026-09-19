import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/blog' })
for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', 'Event', 'DOMParser', 'navigator']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true })
}
localStorage.clear()

const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
const api = await vite.ssrLoadModule('/src/api/platformApi.js')
let passed = 0
const failures = []

async function test(name, callback) {
  try { await callback(); passed += 1; console.log(`PASS  ${name}`) }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL  ${name}: ${error.message}`) }
}
const source = (path) => readFileSync(path, 'utf8')

await test('Blog adapter exports the complete public and owner API', () => {
  for (const name of ['subscribeBlogNewsletter', 'confirmBlogNewsletter', 'getPublicBlogPosts', 'getPublicBlogPost', 'getPublicBlogCategories', 'createAdminBlogCategory', 'updateAdminBlogCategory', 'getAdminBlogPosts', 'getAdminBlogPost', 'createAdminBlogPost', 'updateAdminBlogPost', 'importAdminBlogPost', 'transitionAdminBlogPost', 'changeAdminBlogSlug', 'permanentlyDeleteAdminBlogPost', 'getAdminBlogMedia', 'uploadAdminBlogMedia', 'getAdminBlogRevisions']) {
    if (typeof api[name] !== 'function') throw new Error(`${name} is missing`)
  }
})

await test('preview adapter begins with a polished published Blog article', async () => {
  const result = await api.getPublicBlogPosts()
  if (result.posts.length !== 1 || result.posts[0].status !== 'published' || !result.posts[0].excerpt) throw new Error(JSON.stringify(result))
})

let imported
await test('AI content import creates a private draft in the dashboard adapter', async () => {
  const result = await api.importAdminBlogPost({ format: 'html', content: '<h1>AI draft title</h1><script>window.bad=true</script><p>Safe writing remains.</p>', layout: 'editorial' })
  imported = result.post
  if (imported.status !== 'draft' || imported.publishedAt || /<script/i.test(imported.bodyMarkdown)) throw new Error(JSON.stringify(imported))
  let privateVisible = true
  try { await api.getPublicBlogPost(imported.slug) } catch { privateVisible = false }
  if (privateVisible) throw new Error('private draft leaked through the public API')
})

await test('optimistic versions protect dashboard autosaves', async () => {
  const body = '## A useful operating view\n\n' + 'Practical financial and operational guidance. '.repeat(12)
  const saved = await api.updateAdminBlogPost(imported.id, {
    version: imported.version, title: 'A complete preview Blog article', slug: 'complete-preview-journal-article',
    excerpt: 'A complete excerpt that explains what an independent operator can apply after reading this field note.',
    bodyMarkdown: body, categoryId: 'blog-category-finance', tags: ['Finance', 'Planning'], layout: 'field-note',
  })
  let rejected = false
  try { await api.updateAdminBlogPost(imported.id, { version: imported.version, title: 'Stale overwrite' }) } catch { rejected = true }
  if (!rejected) throw new Error('stale save was accepted')
  imported = saved.post
})

await test('publishing immediately creates a stable public article without a build', async () => {
  const result = await api.transitionAdminBlogPost(imported.id, 'publish', { version: imported.version })
  imported = result.post
  const publicResult = await api.getPublicBlogPost(imported.slug)
  if (publicResult.post.id !== imported.id || publicResult.post.status !== 'published') throw new Error(JSON.stringify(publicResult))
})

await test('App, owner dashboard, navigation, and direct Pages routes include Blog', () => {
  const app = source('src/App.jsx')
  const dashboard = source('src/pages/AdminDashboard.jsx')
  const shell = source('src/components/StorefrontShell.jsx')
  const redirects = source('public/_redirects')
  if (!app.includes('path="/blog/:slug"') || !app.includes('path="/blog"')) throw new Error('public routes missing')
  if (!dashboard.includes('<AdminBlogPanel') || !dashboard.includes("['#blog', 'Blog']")) throw new Error('owner workspace missing')
  if (!shell.includes('to="/blog"')) throw new Error('Blog navigation missing')
  if (!redirects.includes('/blog/:slug /app-shell 200') || !redirects.includes('/blog /app-shell 200')) throw new Error('direct Pages rewrites missing')
})

await test('Pages returns semantic article HTML and metadata in the first response', async () => {
  const renderer = await import('../functions/blog/[slug].js')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ post: imported, relatedPosts: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  try {
    const response = await renderer.onRequestGet({
      request: new Request(`https://runwaysystems.cloud/blog/${imported.slug}`), params: { slug: imported.slug },
      env: { JOURNAL_SOURCE_URL: 'https://journal-api.example' },
      next: async (request) => {
        if (new URL(request.url).pathname !== '/') throw new Error('renderer did not request the storefront shell')
        return new Response('<!doctype html><html><head><meta name="description" content="old" /><meta name="robots" content="index, follow" /><link rel="canonical" href="https://runwaysystems.cloud/" /><meta property="og:title" content="old" /><meta property="og:description" content="old" /><meta property="og:type" content="website" /><meta property="og:url" content="https://runwaysystems.cloud/" /><meta property="og:image" content="old" /><meta property="og:image:alt" content="old" /><meta name="twitter:title" content="old" /><meta name="twitter:description" content="old" /><meta name="twitter:image" content="old" /><meta name="twitter:image:alt" content="old" /><title>old</title></head><body><div id="root"></div></body></html>', { headers: { 'Content-Type': 'text/html' } })
      },
    })
    const html = await response.text()
    if (response.status !== 200 || !html.includes('<article') || !html.includes('itemprop="articleBody"')) throw new Error('semantic article projection missing')
    if (!html.includes(`<link rel="canonical" href="https://runwaysystems.cloud/blog/${imported.slug}"`)) throw new Error('article canonical missing')
    if (!html.includes('application/ld+json') || !html.includes('BlogPosting') || !html.includes('og:type" content="article"')) throw new Error('article metadata missing')
  } finally { globalThis.fetch = originalFetch }
})

await test('public Markdown rendering never executes imported HTML or remote image trackers', () => {
  const renderer = source('src/components/BlogMarkdown.jsx')
  if (!renderer.includes('skipHtml')) throw new Error('raw HTML is not disabled')
  if (renderer.includes('dangerouslySetInnerHTML')) throw new Error('unsafe HTML insertion is present')
  if (!renderer.includes('/blog-media\\/')) throw new Error('media allowlist missing')
  if (!renderer.includes("value.startsWith('//')")) throw new Error('protocol-relative link defense missing')
})

await test('newsletter functionality sits above the original footer design on approved routes', () => {
  const app = source('src/App.jsx')
  const footer = source('src/components/StorefrontShell.jsx')
  const signup = source('src/components/NewsletterSignup.jsx')
  const confirmation = source('src/pages/NewsletterConfirmPage.jsx')
  const blog = source('src/pages/BlogIndexPage.jsx')
  const article = source('src/pages/BlogPostPage.jsx')
  const notFound = source('src/pages/NotFound.jsx')
  const redirects = source('public/_redirects')
  const headers = source('public/_headers')
  if (!app.includes('path="/newsletter/confirm"') || !redirects.includes('/newsletter/confirm /app-shell 200')) throw new Error('confirmation route missing')
  if (!headers.includes('/newsletter/confirm*') || !headers.includes('X-Robots-Tag: noindex, nofollow')) throw new Error('confirmation response noindex header missing')
  if (!signup.includes('consent') || !signup.includes('subscribeBlogNewsletter') || !confirmation.includes('confirmBlogNewsletter')) throw new Error('double opt-in UI missing')
  if (!footer.includes("pathname === '/' || pathname.startsWith('/products/')") || !footer.includes('<NewsletterSignup source={newsletterSource}') || !notFound.includes('newsletter={false}')) throw new Error('route-aware footer signup missing')
  if (!blog.includes('newsletter={!error}') || !article.includes('newsletter={loading || Boolean(post)}')) throw new Error('Blog error-state newsletter guards missing')
  if (!footer.includes('<b>Legal</b>') || !footer.includes('footer-socials') || !footer.includes('footer-original') || !footer.includes('footer-3d-horizon') || footer.includes('footer-utility')) throw new Error('original site footer design was not preserved')
  if (!footer.includes('to="/blog">Runway Systems Blog</Link>') || !footer.includes('Newsletter</') || !footer.includes('href="/blog/feed.xml">RSS</a>')) throw new Error('Blog, newsletter, and RSS footer navigation missing')
  if (!blog.includes('feedPath="/blog/feed.xml"') || blog.includes('journal-rss')) throw new Error('RSS was not retained as quiet technical discovery')
  if (!blog.includes('RUNWAY SYSTEMS BLOG') || blog.includes('RUNWAY JOURNAL')) throw new Error('public Blog naming is inconsistent')
})

await test('Blog discovery endpoints are routed dynamically and keep private routes blocked', () => {
  const routes = JSON.parse(source('public/_routes.json'))
  for (const path of ['/blog/feed.xml', '/llms.txt', '/llms-full.txt']) if (!routes.include.includes(path)) throw new Error(`${path} Pages Function missing`)
  const robots = source('functions/robots.txt.js')
  if (!robots.includes("'Disallow: /admin'") || !robots.includes("'Disallow: /claim'") || !robots.includes("'Disallow: /newsletter/confirm'")) throw new Error('private crawler rules missing')
})

await test('Runway Editorial styles cover tiny phones, tablets, desktops, both workspace themes, taxonomy, and reduced motion', () => {
  const css = source('src/journal.css')
  const studio = source('src/pages/AdminBlogPanel.jsx')
  const editor = source('src/components/BlogEditor.jsx')
  const media = source('src/components/BlogMediaLibrary.jsx')
  const article = source('src/pages/BlogPostPage.jsx')
  for (const rule of ["[data-theme='dark'] .journal-page", "[data-theme='dark'] .journal-admin", '.journal-category-manager', '.journal-mobile-nav', '.journal-readiness', '@media (max-width: 1180px)', '@media (max-width: 900px)', '@media (max-width: 680px)', '@media (max-width: 370px)', '@media (prefers-reduced-motion: reduce)']) {
    if (!css.includes(rule)) throw new Error(`${rule} missing`)
  }
  if (!studio.includes('updateAdminBlogCategory') || !studio.includes('Manage categories')) throw new Error('owner taxonomy management is incomplete')
  if (!studio.includes("setSavedState(offline ? 'offline' : 'conflict')") || !studio.includes('PUBLISH READINESS')) throw new Error('offline and publish-readiness states are incomplete')
  if (!editor.includes('application/x-runway-blog-media') || !media.includes('application/x-runway-blog-media')) throw new Error('media library drag and drop is incomplete')
  if (!article.includes('<details><summary>ON THIS PAGE</summary>')) throw new Error('mobile table of contents is not expandable')
})

await vite.close()
console.log(`\nBlog UI regression: ${passed}/${passed + failures.length} checks passed`)
if (failures.length) process.exit(1)
