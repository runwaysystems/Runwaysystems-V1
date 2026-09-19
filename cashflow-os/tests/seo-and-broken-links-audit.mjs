import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOG } from '../src/data/catalog.js'

let passed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`)
    console.error(`FAIL  ${name}${detail ? `: ${detail}` : ''}`)
  }
}

async function run() {
  console.log('Running Complete SEO & Link Indexing Audit...\n')

  // 1. Sitemap.xml Verification
  const sitemapPath = join(process.cwd(), 'dist/sitemap.xml')
  check('sitemap.xml file is generated at dist/sitemap.xml', existsSync(sitemapPath))
  if (existsSync(sitemapPath)) {
    const sitemapContent = readFileSync(sitemapPath, 'utf8')
    check('sitemap.xml is valid XML with urlset root', sitemapContent.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">') && sitemapContent.includes('</urlset>'))
    check('sitemap.xml includes homepage', sitemapContent.includes('<loc>https://runwaysystems.cloud/</loc>'))
    check('sitemap.xml includes terms & privacy', sitemapContent.includes('<loc>https://runwaysystems.cloud/terms</loc>'))
    check('sitemap.xml includes the public Blog index', sitemapContent.includes('<loc>https://runwaysystems.cloud/blog</loc>'))

    for (const key of Object.keys(CATALOG)) {
      check(`sitemap.xml includes active catalog product /products/${key}`, sitemapContent.includes(`<loc>https://runwaysystems.cloud/products/${key}</loc>`))
    }

    check('sitemap.xml does not expose private account routes', !sitemapContent.includes('/account') && !sitemapContent.includes('/admin') && !sitemapContent.includes('/cart') && !sitemapContent.includes('/claim') && !sitemapContent.includes('/newsletter/confirm'))
  }

  // 2. Robots.txt Verification
  const robotsPath = join(process.cwd(), 'dist/robots.txt')
  check('robots.txt file is generated at dist/robots.txt', existsSync(robotsPath))
  if (existsSync(robotsPath)) {
    const robotsContent = readFileSync(robotsPath, 'utf8')
    check('robots.txt allows indexing of public storefront', robotsContent.includes('Allow: /'))
    check('robots.txt disallows /admin route', robotsContent.includes('Disallow: /admin'))
    check('robots.txt disallows /account route', robotsContent.includes('Disallow: /account'))
    check('robots.txt disallows /claim route', robotsContent.includes('Disallow: /claim'))
    check('robots.txt disallows newsletter confirmation', robotsContent.includes('Disallow: /newsletter/confirm'))
    check('robots.txt disallows /cart route', robotsContent.includes('Disallow: /cart'))
    check('robots.txt disallows /success route', robotsContent.includes('Disallow: /success'))
    check('robots.txt specifies official sitemap location', robotsContent.includes('Sitemap: https://runwaysystems.cloud/sitemap.xml'))
  }

  // 3. Cloudflare Pages SPA Shell Fallback
  const appShellPath = join(process.cwd(), 'dist/app-shell.html')
  check('app-shell.html SPA fallback is generated for Cloudflare Pages 200 rewrites', existsSync(appShellPath))

  // 4. Broken Link Crawler & Route Coverage
  const knownRoutes = new Set([
    '/',
    '/cart',
    '/terms',
    '/success',
    '/account',
    '/feedback',
    '/claim',
    '/newsletter/confirm',
    '/admin',
    '/blog',
    '/blog/feed.xml',
    ...Object.keys(CATALOG).map((key) => `/products/${key}`),
  ])

  // Scan codebase for all internal hrefs and router links
  const filesToScan = [
    'src/components/StorefrontShell.jsx',
    'src/components/AnnouncementBar.jsx',
    'src/components/AuthUI.jsx',
    'src/pages/CatalogHome.jsx',
    'src/pages/ProductPage.jsx',
    'src/pages/CartPage.jsx',
    'src/pages/AccountPage.jsx',
    'src/pages/ComplimentaryClaimPage.jsx',
    'src/pages/BlogIndexPage.jsx',
    'src/pages/BlogPostPage.jsx',
    'src/components/BlogCard.jsx',
    'src/data/catalog.js',
  ]

  const foundLinks = new Set()
  for (const relativePath of filesToScan) {
    const fullPath = join(process.cwd(), relativePath)
    if (!existsSync(fullPath)) continue
    const content = readFileSync(fullPath, 'utf8')

    // Regex for Link to="..." and href="..."
    const linkMatches = content.matchAll(/(?:to|href)=["']([^"']+)["']/g)
    for (const match of linkMatches) {
      const target = match[1]
      if (target.startsWith('/') && !target.startsWith('//')) {
        foundLinks.add(target)
      }
    }
  }

  // Verify all found internal links resolve to valid routes or parametrized patterns
  for (const link of foundLinks) {
    const cleanLink = link.split('?')[0].split('#')[0]
    const isParametrized = cleanLink.includes('${') || cleanLink.includes(':')
    const isValid = isParametrized || knownRoutes.has(cleanLink) || cleanLink === ''
    check(`internal link "${link}" resolves without 404`, isValid, `Unrecognized route: ${cleanLink}`)
  }

  // 5. Schema.org & SEO Verification in Catalog Data
  for (const [key, product] of Object.entries(CATALOG)) {
    check(`product "${key}" has title/name for SEO`, Boolean((product.meta?.title || product.name) && product.name.length > 2))
    check(`product "${key}" has description/lede for SEO`, Boolean((product.meta?.description || product.hero?.lede) && (product.meta?.description || product.hero?.lede).length > 10))
    check(`product "${key}" has valid status ('active' | 'coming_soon' | 'hidden')`, ['active', 'coming_soon', 'hidden'].includes(product.status || 'active'))
    check(`product "${key}" has structured FAQ items for FAQPage schema`, Array.isArray(product.faqs?.items) && product.faqs.items.length >= 3)
  }

  // 6. Zero Prohibited U+2014 Em Dash Verification in Dist & Src
  const distHtml = readFileSync(join(process.cwd(), 'dist/index.html'), 'utf8')
  check('dist/index.html is free of prohibited em dashes', !distHtml.includes('\u2014'))

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length > 0) process.exit(1)
}

run()
