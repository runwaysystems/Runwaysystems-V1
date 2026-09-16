// Build-time SEO artifacts plus the Cloudflare Pages SPA fallback shell.
//
// The static sitemap covers every route that exists in code. Products added
// later through the admin panel are covered by the dynamic sitemap served by
// the Worker at /sitemap.xml on the Worker hostname. Cloudflare Pages
// _redirects cannot 200-proxy external hosts, so functions/sitemap.xml.js
// serves the Worker XML when configured and falls back to this generated file.
import { writeFile, mkdir, copyFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { CATALOG } from '../src/data/catalog.js'

const SITE_URL = String(process.env.SITE_URL || 'https://runwaysystems.cloud').replace(/\/$/, '')
if (!process.env.SITE_URL) {
  console.warn(`[seo] SITE_URL not set; using default ${SITE_URL}. Override with SITE_URL to target a different (e.g. staging) domain.`)
}

const today = new Date().toISOString().slice(0, 10)

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// Products hidden from the storefront must not be advertised to crawlers.
// This static file cannot see the database, so SITEMAP_EXCLUDE lets the build
// drop retired keys; the Worker's dynamic /sitemap.xml already filters on
// active = 1 and is the authoritative list once the Pages proxy is enabled.
const excluded = new Set(
  String(process.env.SITEMAP_EXCLUDE || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean),
)
if (excluded.size) console.warn(`[seo] excluding hidden products from sitemap: ${[...excluded].join(', ')}`)

const urls = [
  { loc: `${SITE_URL}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE_URL}/terms`, changefreq: 'monthly', priority: '0.4' },
  ...Object.keys(CATALOG).filter((key) => !excluded.has(key)).map((key) => ({
    loc: `${SITE_URL}/products/${key}`,
    lastmod: today,
    changefreq: 'weekly',
    priority: '0.9',
  })),
]

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((url) => `  <url><loc>${escapeXml(url.loc)}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}<changefreq>${url.changefreq}</changefreq><priority>${url.priority}</priority></url>`),
  '</urlset>',
  '',
].join('\n')

const robots = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /account',
  'Disallow: /feedback',
  'Disallow: /admin',
  'Disallow: /success',
  'Disallow: /cart',
  '',
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  '',
].join('\n')

await mkdir(dirname('dist/sitemap.xml'), { recursive: true })
await writeFile('dist/sitemap.xml', xml)
await writeFile('dist/robots.txt', robots)

// Cloudflare Pages normalizes /index.html to /, which turns a 200 rewrite to
// /index.html into a path-losing 308 redirect. Keep a second copy of the same
// SPA shell under an extensionless route target used by public/_redirects.
await copyFile('dist/index.html', 'dist/app-shell.html')

console.log(`[seo] dist/sitemap.xml (${urls.length} urls), dist/robots.txt, and dist/app-shell.html written for ${SITE_URL}`)
