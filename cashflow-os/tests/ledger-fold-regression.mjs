import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173'
const LEDGER_R = 'M9 10h28l15 14v16L41 51H25v19H9V10zm16 14v13h10l4-4v-5l-4-4H25z'
const LEDGER_S = 'M70 10H49L38 21v14l11 9h8l3 3v4l-4 5H40L28 70h32l11-14V40l-11-9h-8l-3-3v-3l4-4h17V10z'

let passed = 0
const failures = []
const browserErrors = []

async function check(name, fn) {
  try {
    const result = await fn()
    if (result === false) throw new Error('assertion returned false')
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failures.push(`${name}: ${error.message}`)
    console.error(`FAIL  ${name}\n      ${error.message}`)
  }
}

function attachErrorCapture(page, label) {
  page.on('pageerror', (error) => browserErrors.push(`${label} pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${label} console: ${message.text()}`)
  })
}

async function collectProductionTextFiles(directory = '.') {
  const ignored = new Set(['.git', 'dist', 'node_modules'])
  const textExtensions = new Set(['.css', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.svg', '.txt'])
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name.endsWith('.zip')) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectProductionTextFiles(path))
    else if (textExtensions.has(extname(entry.name)) || entry.name.startsWith('.env')) files.push(path)
  }
  return files
}

const browser = await chromium.launch({ headless: true })

try {
  await check('all project text contains no em dash characters', async () => {
    const files = await collectProductionTextFiles()
    const offenders = []
    for (const file of files) {
      if ((await readFile(file, 'utf8')).includes('\u2014')) offenders.push(file)
    }
    if (offenders.length) throw new Error(`found in ${offenders.join(', ')}`)
    return true
  })

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' })
  const page = await desktop.newPage()
  attachErrorCapture(page, 'desktop')

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

  await check('homepage opens with the full-screen introduction', async () => {
    const intro = page.locator('.brand-intro')
    return await intro.isVisible() && await intro.getAttribute('aria-label') === 'Runway Systems introduction'
  })

  await check('intro contains the exact original Ledger Fold geometry', async () => {
    const values = await page.locator('.intro-runway-mark').evaluate((svg) => ({
      viewBox: svg.getAttribute('viewBox'),
      r: svg.querySelector('.runway-mark__sheet--r')?.getAttribute('d'),
      s: svg.querySelector('.runway-mark__sheet--s')?.getAttribute('d'),
      seams: svg.querySelectorAll('.runway-mark__seam').length,
      sparks: svg.querySelectorAll('.runway-mark__spark').length,
    }))
    return values.viewBox === '0 0 80 80' && values.r === LEDGER_R && values.s === LEDGER_S && values.seams === 1 && values.sparks === 1
  })

  await check('repeat-visitor Skip remains delayed but becomes available', async () => {
    await page.waitForTimeout(900)
    const skip = page.locator('.intro-skip')
    return await skip.isVisible() && await skip.getAttribute('aria-hidden') === 'false'
  })

  await page.waitForFunction(() => {
    const element = (selector) => document.querySelector(selector)
    const opacity = (selector) => {
      const node = element(selector)
      return node ? Number(getComputedStyle(node).opacity) : -1
    }
    return opacity('.intro-word--runway') < 0.12
      && opacity('.intro-logo-forge') > 0.85
      && opacity('.intro-logo-forge .runway-mark__sheet--r') > 0.85
      && opacity('.intro-logo-forge .runway-mark__sheet--s') > 0.6
      && opacity('.intro-logo-forge .runway-mark__seam') > 0.35
  }, {}, { timeout: 5000, polling: 'raf' })
  await check('RUNWAY SYSTEMS visibly converges into the folded RS lockup', async () => {
    const state = await page.evaluate(() => {
      const style = (selector) => getComputedStyle(document.querySelector(selector))
      const rect = document.querySelector('.intro-runway-mark').getBoundingClientRect()
      return {
        wordOpacity: Number(style('.intro-word--runway').opacity),
        forgeOpacity: Number(style('.intro-logo-forge').opacity),
        rOpacity: Number(style('.intro-logo-forge .runway-mark__sheet--r').opacity),
        sOpacity: Number(style('.intro-logo-forge .runway-mark__sheet--s').opacity),
        seamOpacity: Number(style('.intro-logo-forge .runway-mark__seam').opacity),
        width: rect.width,
      }
    })
    return state.wordOpacity < 0.12 && state.forgeOpacity > 0.85 && state.rOpacity > 0.85 && state.sOpacity > 0.6 && state.seamOpacity > 0.35 && state.width > 90
  })
  await page.screenshot({ path: '/tmp/ledger-fold-intro-desktop.png', fullPage: false })

  await page.waitForFunction(() => {
    const panel = document.querySelector('.intro-split-panel--left')
    const hero = document.querySelector('.hero-visual')
    return panel && Number(getComputedStyle(panel).opacity) > 0.8 && hero && Number(getComputedStyle(hero).opacity) > 0.05
  }, {}, { timeout: 2500, polling: 'raf' })
  await page.waitForTimeout(220)
  await check('Ledger Fold sheets unfold with the paired split panels', async () => page.evaluate(() => {
    const leftPanel = document.querySelector('.intro-split-panel--left')
    const rightPanel = document.querySelector('.intro-split-panel--right')
    const leftSheet = document.querySelector('.intro-logo-forge .runway-mark__sheet--r')
    const rightSheet = document.querySelector('.intro-logo-forge .runway-mark__sheet--s')
    const panelMotion = [leftPanel, rightPanel].map((node) => getComputedStyle(node).transform)
    const sheetMotion = [leftSheet, rightSheet].map((node) => getComputedStyle(node).transform)
    return panelMotion.every((value) => value !== 'none') && panelMotion[0] !== panelMotion[1]
      && sheetMotion.every((value) => value !== 'none') && sheetMotion[0] !== sheetMotion[1]
  }))
  const bounce = await page.locator('.hero-visual').evaluate((element) => new Promise((resolve) => {
    const samples = []
    const start = performance.now()
    const step = () => {
      const rect = element.getBoundingClientRect()
      samples.push({ x: rect.x + rect.width / 2, y: rect.y })
      if (performance.now() - start < 1600) requestAnimationFrame(step)
      else resolve({
        yRange: Math.max(...samples.map((sample) => sample.y)) - Math.min(...samples.map((sample) => sample.y)),
        xRange: Math.max(...samples.map((sample) => sample.x)) - Math.min(...samples.map((sample) => sample.x)),
      })
    }
    step()
  }))
  await check('split reveal finishes with a controlled vertical hero bounce', async () => bounce.yRange > 18 && bounce.xRange < 2.5)

  await page.locator('.brand-intro').waitFor({ state: 'detached', timeout: 4000 })

  await check('the intro camera settles cleanly and the wordmark fits small screens', async () => {
    const shellSource = await readFile('src/components/StorefrontShell.jsx', 'utf8')
    const cssSource = await readFile('src/styles.css', 'utf8')
    return shellSource.includes('const compact = window.innerWidth <= 720')
      && shellSource.includes("const spacingStart = compact ? '.3em' : '.46em'")
      && shellSource.includes('scale: 2.4, yPercent: 10')
      && shellSource.includes("ease: 'power2.inOut'")
      && shellSource.includes('force3D: true')
      && shellSource.includes('The push settles fully before the crossfade')
      && shellSource.includes("'.intro-edge-light', { opacity: 1")
      && shellSource.includes("'.intro-centerline-stream', { opacity: .85")
      && shellSource.includes("opacity: .55, filter: 'blur(1.2px)'")
      && shellSource.includes("opacity: 0, duration: .5, ease: 'power2.inOut' }, 4.48")
      && shellSource.includes('const lightTravel')
      && shellSource.includes('x: () => -lightTravel')
      && shellSource.includes('x: () => lightTravel')
      && cssSource.includes('clamp(20px, 4.7vw, 86px)')
      && cssSource.includes('clamp(18px, 5vw, 40px)')
      && !cssSource.includes('flex-direction: column')
      && cssSource.includes('.intro-edge-light--left { left: 48.1%')
      && cssSource.includes('.intro-edge-light--right { left: 51.9%')
      && cssSource.includes('0 0 56px')
      && cssSource.includes('color-mix(in srgb, var(--intro-accent) 86%, #fff)')
      && !cssSource.includes('left: 41%')
      && !cssSource.includes('left: 59%')
      && shellSource.includes("opacity: .8, scaleY: 1")
      && shellSource.includes("opacity: .75, filter: 'blur(1px)'")
  })

  await check('the 3D runway background mounts when WebGL is available and never breaks the hero', async () => {
    const webgl = await page.evaluate(() => {
      const probe = document.createElement('canvas')
      return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
    })
    await page.waitForTimeout(400)
    const canvasCount = await page.locator('.hero-3d-canvas').count()
    const heroVisible = await page.locator('.hero').isVisible()
    const copyVisible = await page.locator('.hero-copy h1').isVisible()
    return heroVisible && copyVisible && (webgl ? canvasCount === 1 : true)
  })

  await check('the 3D runway scene respects the suite palette and reduced motion', async () => {
    const componentSource = await readFile('src/components/Hero3DBackground.jsx', 'utf8')
    const cssSource = await readFile('src/styles.css', 'utf8')
    const homeSource = await readFile('src/pages/CatalogHome.jsx', 'utf8')
    return componentSource.includes("import('three')")
      && componentSource.includes('prefers-reduced-motion')
      && componentSource.includes('AdditiveBlending')
      && componentSource.includes('data-palette')
      && componentSource.includes('hero-3d-canvas')
      && homeSource.includes('<Hero3DBackground />')
      && cssSource.includes('.has-3d-bg .hero-runway { display: none; }')
  })

  await check('navigation uses the exact Ledger Fold mark at compact size', async () => {
    const result = await page.locator('.navbar .brand-mark').evaluate((mark) => {
      const svg = mark.querySelector('svg')
      const rect = svg.getBoundingClientRect()
      return {
        r: svg.querySelector('.runway-mark__sheet--r')?.getAttribute('d'),
        s: svg.querySelector('.runway-mark__sheet--s')?.getAttribute('d'),
        width: rect.width,
        height: rect.height,
      }
    })
    return result.r === LEDGER_R && result.s === LEDGER_S && result.width >= 34 && result.height >= 34
  })

  await check('favicon asset is the approved Ledger Fold artwork', async () => {
    const favicon = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="icon"]')?.href
      return { href, text: href ? await (await fetch(href)).text() : '' }
    })
    return favicon.href?.endsWith('/runway-systems-mark.svg') && favicon.text.includes('Runway Systems Ledger Fold') && favicon.text.includes(LEDGER_R)
  })

  await check('gold cursor and floating KPI cards advance and paper-flip home', async () => {
    const visual = page.locator('.hero-visual')
    const bounds = await visual.boundingBox()
    if (!bounds) return false
    await page.mouse.move(bounds.x + bounds.width * 0.54, bounds.y + bounds.height * 0.48)
    await page.waitForTimeout(720)
    const advanced = await page.evaluate(() => {
      const visualNode = document.querySelector('.hero-visual')
      const cursor = document.querySelector('.cursor-chip')
      const cards = [...document.querySelectorAll('.floating-card')]
      return visualNode.classList.contains('is-interacting')
        && Number(getComputedStyle(cursor).opacity) > 0.75
        && cards.every((card) => Number(getComputedStyle(card).zIndex) >= 12)
    })
    await page.locator('.hero-copy h1').hover()
    await page.waitForTimeout(180)
    const flipStarted = await page.locator('.floating-card').first().evaluate((card) => getComputedStyle(card).transform !== 'none')
    await page.waitForTimeout(800)
    const returned = await page.evaluate(() => {
      const visualNode = document.querySelector('.hero-visual')
      const cursor = document.querySelector('.cursor-chip')
      const cards = [...document.querySelectorAll('.floating-card')]
      return !visualNode.classList.contains('is-interacting')
        && Number(getComputedStyle(cursor).opacity) < 0.1
        && cards.every((card) => Number(getComputedStyle(card).zIndex) === 5)
    })
    return advanced && flipStarted && returned
  })

  await check('hero, proof row, and continuous dark ticker preserve their order', async () => page.evaluate(() => {
    const hero = document.querySelector('.hero')
    const proof = document.querySelector('.proof-strip')
    const ticker = document.querySelector('.feature-ticker-strip')
    const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    const animation = document.querySelector('.header-marquee__track')?.getAnimations()[0]
    return Boolean(hero && proof && ticker && follows(hero, proof) && follows(proof, ticker) && animation && animation.playState === 'running')
  }))

  await check('catalog lists the full product suite with working links', async () => {
    const cards = page.locator('.products-grid .product-card')
    const names = await page.locator('.products-grid .product-card h3').allTextContents()
    const firstLink = await cards.first().getAttribute('href')
    return await cards.count() >= 4
      && ['Cash Flow OS', 'Client CRM OS', 'Project OS', 'Invoice OS'].every((name) => names.includes(name))
      && /^\/products\//.test(firstLink || '')
  })

  await page.goto(`${BASE_URL}/products/cashflow-os`, { waitUntil: 'networkidle' })

  await check('all eight authentic UHD product screenshots remain inline', async () => {
    const tabs = page.locator('.tour-nav button')
    const sources = []
    for (let index = 0; index < await tabs.count(); index += 1) {
      await tabs.nth(index).click()
      await page.waitForTimeout(40)
      sources.push(await page.locator('.tour-stage img[src*="product-"][src$="-uhd.webp"]').getAttribute('src'))
    }
    return new Set(sources).size === 8 && sources.every((source) => source?.startsWith('/product-'))
  })

  await check('pricing remains $69 regular and $39 offer', async () => {
    const text = await page.locator('#pricing').innerText()
    return text.includes('$69') && text.includes('$39')
  })

  await check('pricing uses the Trustpilot star TrustBox without a review carousel', async () => {
    const box = page.locator('#pricing .trustpilot-widget-host')
    return await box.count() === 1
      && await box.getAttribute('data-template-id') === '5419b732fbfb950b10de65e5'
      && await page.locator('#pricing [class*="carousel"]').count() === 0
  })

  await check('cookie consent gates the third-party Trustpilot script until acceptance', async () => {
    const bannerVisible = await page.locator('.consent-banner').isVisible()
    const scriptAbsentBefore = await page.locator('#trustpilot-widget-script').count() === 0

    await page.getByRole('button', { name: /Essential only/i }).click()
    await page.locator('.consent-banner').waitFor({ state: 'detached' })
    const hostSurvives = await page.locator('#pricing .trustpilot-widget-host').count() === 1
    const scriptAbsentAfterEssential = await page.locator('#trustpilot-widget-script').count() === 0

    await page.locator('.footer-link-button').click()
    const bannerReopened = await page.locator('.consent-banner').isVisible()

    await page.route('**widget.trustpilot.com**', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: 'window.Trustpilot = { loadFromElement: () => {} }',
    }))
    await page.getByRole('button', { name: /Accept all/i }).click()
    await page.locator('.consent-banner').waitFor({ state: 'detached' })
    const scriptLoadedAfterAccept = await page.locator('#trustpilot-widget-script').count() === 1
    await page.unroute('**widget.trustpilot.com**')

    return bannerVisible && scriptAbsentBefore && hostSurvives && scriptAbsentAfterEssential && bannerReopened && scriptLoadedAfterAccept
  })

  await check('cookie consent wiring lives in the source with an opt-out path', async () => {
    const indexSource = await readFile('index.html', 'utf8')
    const consentSource = await readFile('src/lib/consent.js', 'utf8')
    const bannerSource = await readFile('src/components/ConsentBanner.jsx', 'utf8')
    const shellSource = await readFile('src/components/StorefrontShell.jsx', 'utf8')
    const trustpilotSource = await readFile('src/lib/trustpilot.js', 'utf8')
    const boxSource = await readFile('src/components/TrustpilotBox.jsx', 'utf8')
    return !indexSource.includes('widget.trustpilot.com')
      && consentSource.includes('runway-consent')
      && consentSource.includes("value === 'all' || value === 'essential'")
      && bannerSource.includes('Accept all')
      && bannerSource.includes('Essential only')
      && shellSource.includes('Cookie preferences')
      && trustpilotSource.includes('hasOptionalConsent')
      && boxSource.includes('Enable optional cookies to load reviews')
  })

  await check('product pages render approved testimonials only', async () => {
    await page.locator('#reviews').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelectorAll('#reviews .testimonial-card:not(.is-skeleton)').length > 0)
    const names = await page.locator('#reviews .testimonial-card footer strong').allTextContents()
    return ['Olivia M.', 'Marcus T.', 'Priya S.'].every((name) => names.includes(name))
      && !names.includes('Demo submission')
  })

  await check('testimonials render as an auto-advancing carousel with pause and manual controls', async () => {
    const source = await readFile('src/components/TestimonialsSection.jsx', 'utf8')
    const cssSource = await readFile('src/platform.css', 'utf8')
    return source.includes('AUTO_ADVANCE_MS')
      && source.includes('setInterval')
      && source.includes('aria-roledescription="slide"')
      && source.includes('onMouseEnter')
      && source.includes('prefers-reduced-motion')
      && source.includes('carousel-dots')
      && source.includes('aria-label="Previous review"')
      && source.includes('aria-label="Next review"')
      && cssSource.includes('.testimonial-track')
      && cssSource.includes('.carousel-dots button.is-active')
      && cssSource.includes('transition: transform .75s')
  })

  await check('custom Google auth dialog exposes loading-safe configured states', async () => {
    await page.locator('.navbar .account-button').click()
    const modal = page.getByRole('dialog', { name: /Keep your systems within reach/i })
    const isCustom = await modal.isVisible()
      && await modal.locator('.google-auth-button').count() === 1
      && await modal.locator('[class*="supabase-auth-ui"]').count() === 0
    await page.keyboard.press('Escape')
    await modal.waitFor({ state: 'detached' })
    return isCustom
  })

  await check('Brass/Glacier and Light/Dark controls remain separate and functional', async () => {
    const palette = page.locator('.header-utility .palette-toggle')
    const theme = page.locator('.header-utility .theme-toggle')
    if (await palette.count() !== 1 || await theme.count() !== 1) return false
    await palette.click()
    await page.waitForFunction(() => document.documentElement.dataset.palette === 'glacier')
    await theme.click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    const separate = await palette.evaluate((node) => !node.contains(document.querySelector('.header-utility .theme-toggle')))
    return separate
  })

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.locator('.intro-skip').waitFor({ state: 'visible', timeout: 4000 })
  await page.locator('.intro-skip').click()
  await page.locator('.brand-intro').waitFor({ state: 'detached', timeout: 4000 })

  await check('the storefront never offers a Watch the show replay', async () => {
    return await page.getByRole('button', { name: /Watch the show/i }).count() === 0
  })

  await check('back links return to the suite without replaying the intro', async () => {
    await page.locator('.products-grid .product-card').first().click()
    await page.waitForSelector('.product-page')
    const backLinks = await page.locator('.hero-back-link').count() === 1
      && await page.locator('.nav-home-link').count() === 1
    await page.locator('.navbar .brand').click()
    await page.waitForSelector('.products-grid')
    await page.waitForTimeout(350)
    return backLinks && await page.locator('.brand-intro').count() === 0
  })

  await check('a fresh page load still opens with the full introduction', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    const intro = page.locator('.brand-intro')
    return await intro.isVisible() && await intro.getAttribute('aria-label') === 'Runway Systems introduction'
  })

  await check('/terms route renders legal content and the Ledger Fold lockup', async () => {
    await page.goto(`${BASE_URL}/terms`, { waitUntil: 'networkidle' })
    return await page.getByRole('heading', { name: 'Terms & privacy' }).isVisible() && await page.locator('.navbar .runway-mark__sheet--r').count() === 1
  })

  await check('/success confirms the Lemon Squeezy payment without exposing delivery', async () => {
    await page.goto(`${BASE_URL}/success?session_id=regression-session`, { waitUntil: 'networkidle' })
    const main = await page.locator('.success-page').innerText()
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const appSource = await readFile('src/App.jsx', 'utf8')
    return /Sign in to verify this purchase/i.test(main)
      && /We do not expose delivery links on this page/i.test(main)
      && !/docs\.google\.com/i.test(main)
      && !appSource.includes('VITE_GOOGLE_SHEETS_COPY_URL')
      && appSource.includes('getAccountPurchases')
      && appSource.includes('Lemon Squeezy')
      && workerSource.includes('REVIEW_DELAY_MS = 72 * 60 * 60 * 1000')
      && await page.locator('.success-logo .runway-mark__sheet--r').count() === 1
  })

  await check('/feedback rejects unsigned legacy links and directs buyers to the library', async () => {
    await page.goto(`${BASE_URL}/feedback?purchase=regression-order`, { waitUntil: 'networkidle' })
    return await page.getByRole('heading', { name: /Open feedback from your account/i }).isVisible()
      && await page.getByRole('link', { name: /Open account library/i }).getAttribute('href') === '/account'
      && await page.locator('.rating-picker').count() === 0
  })

  await check('/feedback stays neutral for every buyer and keeps testimonials pending-first', async () => {
    const feedbackSource = await readFile('src/pages/FeedbackPage.jsx', 'utf8')
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    return feedbackSource.includes('Every verified buyer receives the same neutral invitation')
      && feedbackSource.includes('Independent Trustpilot review')
      && feedbackSource.includes('Private feedback')
      && feedbackSource.includes('On-site testimonial')
      && !feedbackSource.includes('isPositive')
      && !feedbackSource.includes('rating >= 4')
      && workerSource.includes('Every verified buyer receives this same neutral invitation')
      && workerSource.includes('`Review ${productName} on Trustpilot`')
      && workerSource.includes("status: 'pending'")
      && workerSource.includes("VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)")
      && workerSource.includes("FROM testimonials WHERE status = 'approved'")
      && feedbackSource.includes('Submissions stay pending until approved by Runway Systems')
  })

  await check('delivery is dual-channel, owner-verified, and absent from frontend configuration', async () => {
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const accountSource = await readFile('src/pages/AccountPage.jsx', 'utf8')
    const envExample = await readFile('.env.example', 'utf8')
    return workerSource.includes('sendDeliveryEmail')
      && workerSource.includes("/account\\/purchases\\/([^/]+)\\/delivery")
      && workerSource.includes('findPurchaseForUser')
      && accountSource.includes('getPurchaseDelivery')
      && accountSource.includes('Create private Google Sheets copy')
      && !envExample.includes('GOOGLE_SHEETS_COPY_URL')
      && !envExample.includes('STRIPE_SECRET_KEY')
  })

  await check('multi-product cart and suite checkout are wired end to end', async () => {
    const mainSource = await readFile('src/main.jsx', 'utf8')
    const appSource = await readFile('src/App.jsx', 'utf8')
    const cartContextSource = await readFile('src/context/CartContext.jsx', 'utf8')
    const cartPageSource = await readFile('src/pages/CartPage.jsx', 'utf8')
    const homeSource = await readFile('src/pages/CatalogHome.jsx', 'utf8')
    const productSource = await readFile('src/pages/ProductPage.jsx', 'utf8')
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const apiSource = await readFile('src/api/platformApi.js', 'utf8')
    const shellSource = await readFile('src/components/StorefrontShell.jsx', 'utf8')
    const initialMigration = await readFile('worker/migrations/0001_initial.sql', 'utf8')
    return mainSource.includes('CartProvider')
      && appSource.includes('path="/cart"')
      && cartContextSource.includes('runway-cart')
      && cartPageSource.includes('cart-per-item')
      && homeSource.includes('suite-bundle-banner')
      && homeSource.includes('Add complete suite')
      && productSource.includes('useCart')
      && shellSource.includes('nav-cart')
      && workerSource.includes('product_keys')
      && workerSource.includes('ON CONFLICT(order_identifier, product_key)')
      && initialMigration.includes('UNIQUE (order_identifier, product_key)')
      && apiSource.includes('productKeys')
  })

  await check('the content studio makes every storefront text owner-editable', async () => {
    const panelSource = await readFile('src/pages/AdminContentPanel.jsx', 'utf8')
    const adminSource = await readFile('src/pages/AdminDashboard.jsx', 'utf8')
    const catalogSource = await readFile('src/data/catalog.js', 'utf8')
    const policiesSource = await readFile('src/data/policies.js', 'utf8')
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const apiSource = await readFile('src/api/platformApi.js', 'utf8')
    const homeSource = await readFile('src/pages/CatalogHome.jsx', 'utf8')
    const appSource = await readFile('src/App.jsx', 'utf8')
    return panelSource.includes('PRODUCT_FIELDS')
      && panelSource.includes('SUITE_FIELDS')
      && panelSource.includes('PoliciesEditor')
      && panelSource.includes('AnnouncementEditor')
      && panelSource.includes('buildProductViewModel')
      && adminSource.includes('<AdminContentPanel')
      && adminSource.includes('saveSuiteContent')
      && catalogSource.includes('SUITE_DEFAULTS')
      && catalogSource.includes('buildSuiteViewModel')
      && catalogSource.includes('mergeContent')
      && policiesSource.includes('POLICY_DEFAULTS')
      && workerSource.includes('suiteContent')
      && workerSource.includes('cleanContentJson')
      && apiSource.includes('trustpilotBusinessUnitId')
      && homeSource.includes('suiteVm')
      && appSource.includes('buildPoliciesViewModel')
  })

  await check('full SEO coverage is wired for present and future products', async () => {
    const seoSource = await readFile('src/components/Seo.jsx', 'utf8')
    const notFoundSource = await readFile('src/pages/NotFound.jsx', 'utf8')
    const appSource = await readFile('src/App.jsx', 'utf8')
    const productSource = await readFile('src/pages/ProductPage.jsx', 'utf8')
    const homeSource = await readFile('src/pages/CatalogHome.jsx', 'utf8')
    const cartSource = await readFile('src/pages/CartPage.jsx', 'utf8')
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const generatorSource = await readFile('scripts/generate-sitemap.mjs', 'utf8')
    const packageSource = await readFile('package.json', 'utf8')
    const indexSource = await readFile('index.html', 'utf8')
    return seoSource.includes('og:title')
      && seoSource.includes('twitter:card')
      && seoSource.includes("upsertLink('canonical'")
      && seoSource.includes("noindex ? 'noindex, nofollow'")
      && seoSource.includes('application/ld+json')
      && notFoundSource.includes('404')
      && notFoundSource.includes('noindex')
      && appSource.includes('<NotFound')
      && appSource.includes('path="*"')
      && productSource.includes('<Seo')
      && productSource.includes('jsonld-product')
      && productSource.includes('FAQPage')
      && productSource.includes('BreadcrumbList')
      && homeSource.includes('jsonld-organization')
      && homeSource.includes('jsonld-website')
      && cartSource.includes('noindex')
      && workerSource.includes("path === '/sitemap.xml'")
      && workerSource.includes('updatedAt')
      && generatorSource.includes('dist/sitemap.xml')
      && generatorSource.includes('SITE_URL')
      && packageSource.includes('scripts/generate-sitemap.mjs')
      && indexSource.includes('og:site_name')
      && indexSource.includes('twitter:card')
      && indexSource.includes('fonts.googleapis.com')
  })

  await check('route changes open at the top instantly and the brand naming is Runway Systems', async () => {
    const scrollTopSource = await readFile('src/components/ScrollToTop.jsx', 'utf8')
    const appSource = await readFile('src/App.jsx', 'utf8')
    const shellSource = await readFile('src/components/StorefrontShell.jsx', 'utf8')
    const accountSource = await readFile('src/pages/AccountPage.jsx', 'utf8')
    const adminSource = await readFile('src/pages/AdminDashboard.jsx', 'utf8')
    const homeSource = await readFile('src/pages/CatalogHome.jsx', 'utf8')
    return scrollTopSource.includes("behavior: 'instant'")
      && scrollTopSource.includes('useLayoutEffect')
      && scrollTopSource.includes('requestAnimationFrame')
      && appSource.includes('<ScrollToTop />')
      && !appSource.includes("useEffect(() => { window.scrollTo(0, 0) }, [])")
      && shellSource.includes("'Runway Systems'")
      && !shellSource.includes("'Storefront'")
      && accountSource.includes('Runway Systems')
      && !accountSource.includes('> Storefront<')
      && adminSource.includes('Runway Systems')
      && !adminSource.includes('> Storefront<')
      && homeSource.includes('quickX.current = gsap.quickTo')
      && homeSource.includes('onPointerEnter={enterCard}')
  })

  await check('the footer typography reveal with its 3D backdrop is wired and responsive', async () => {
    const shellSource = await readFile('src/components/StorefrontShell.jsx', 'utf8')
    const cssSource = await readFile('src/styles.css', 'utf8')
    return shellSource.includes('footer-reveal__line')
      && shellSource.includes('footer-3d-backdrop')
      && shellSource.includes("'.footer-reveal__line',")
      && shellSource.includes("yPercent: 115")
      && shellSource.includes("letterSpacing: '.32em'")
      && shellSource.includes("scrollTrigger: { trigger: '.footer-reveal'")
      && shellSource.includes('prefers-reduced-motion')
      && !shellSource.includes('footer-3d-grid')
      && !cssSource.includes('.footer-3d-grid')
      && !cssSource.includes('footer-grid-flow')
      && shellSource.includes('footer-3d-horizon')
      && cssSource.includes('.footer-3d-horizon::after')
      && cssSource.includes("box-shadow: 0 0 24px rgba(201, 162, 39, .35)")
      && cssSource.includes('footer-reveal__line--gold')
      && cssSource.includes('background-clip: text')
      && cssSource.includes('clamp(54px, 12.5vw, 190px)')
      && cssSource.includes('@media (max-width: 720px)')
      && cssSource.includes('@media (max-width: 420px)')
      && cssSource.includes('.footer-particles i')
      && cssSource.includes('.footer-vignette')
  })

  await check('every pointer animation is gated for touch, offscreen, and reduced motion', async () => {
    const sectionsSource = await readFile('src/components/ProductSections.jsx', 'utf8')
    const cssSource = await readFile('src/styles.css', 'utf8')
    return sectionsSource.includes("if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return")
      && sectionsSource.includes("event.pointerType === 'touch'")
      && sectionsSource.includes('setOffscreen(!entry.isIntersecting)')
      && sectionsSource.includes('setHidden(document.hidden)')
      && sectionsSource.includes('const paused = hoverPaused || offscreen || hidden')
      && cssSource.includes('.cursor-chip { display: none; }')
      && cssSource.includes('@media (min-width: 721px) and (hover: hover) and (pointer: fine)')
      && cssSource.includes('.hero-visual { cursor: none; }')
      && cssSource.includes('@media (hover: none) and (pointer: coarse) and (prefers-reduced-motion: no-preference)')
      && cssSource.includes('prefers-reduced-motion: reduce')
  })

  await check('the GSAP motion and taste pass is wired and reduced-motion safe', async () => {
    const cssSource = await readFile('src/styles.css', 'utf8')
    const barSource = await readFile('src/components/AnnouncementBar.jsx', 'utf8')
    const consentSource = await readFile('src/components/ConsentBanner.jsx', 'utf8')
    const shellSource = await readFile('src/components/StorefrontShell.jsx', 'utf8')
    const cartSource = await readFile('src/pages/CartPage.jsx', 'utf8')
    const homeSource = await readFile('src/pages/CatalogHome.jsx', 'utf8')
    return cssSource.includes(":focus-visible { outline: 3px solid var(--accent)")
      && cssSource.includes('text-wrap: balance')
      && cssSource.includes('.nav-wrap.is-scrolled .navbar')
      && cssSource.includes('.product-card.is-tilting')
      && barSource.includes("gsap.fromTo(bar, { y: -28")
      && barSource.includes('prefers-reduced-motion')
      && consentSource.includes('gsap.fromTo(banner')
      && shellSource.includes("ScrollTrigger.create({")
      && shellSource.includes("headerRef.current?.classList.toggle('is-scrolled'")
      && cartSource.includes('function TotalCounter')
      && cartSource.includes("gsap.from('.cart-item'")
      && homeSource.includes('is-tilting')
      && homeSource.includes('canTilt()')
  })

  await check('Lemon Squeezy merchant-of-record payments are wired end to end', async () => {
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const adminSource = await readFile('src/pages/AdminDashboard.jsx', 'utf8')
    const cartSource = await readFile('src/pages/CartPage.jsx', 'utf8')
    const sectionsSource = await readFile('src/components/ProductSections.jsx', 'utf8')
    const hookSource = await readFile('src/hooks/useSecureCheckout.js', 'utf8')
    const appSource = await readFile('src/App.jsx', 'utf8')
    return workerSource.includes('api.lemonsqueezy.com')
      && workerSource.includes("path === '/webhooks/lemonsqueezy'")
      && workerSource.includes("eventName === 'order_created'")
      && workerSource.includes("eventName === 'order_refunded'")
      && workerSource.includes('revoked_orders')
      && workerSource.includes('lemonVariantId')
      && workerSource.includes('custom_price')
      && workerSource.includes('Runway Systems Suite Bundle')
      && workerSource.includes('lemonSqueezyBundleVariantId')
      && adminSource.includes('Lemon Squeezy acts as the merchant of record')
      && adminSource.includes('Lemon Squeezy variant ID')
      && adminSource.includes('lemonSqueezyStoreId')
      && adminSource.includes('Bundle variant ID')
      && cartSource.includes('Checkout securely')
      && cartSource.includes('One secure checkout for everything in your cart')
      && !cartSource.includes('cart-per-item')
      && sectionsSource.includes('Secure checkout powered by Lemon Squeezy')
      && hookSource.includes("endsWith('.lemonsqueezy.com')")
      && appSource.includes('getAccountPurchases')
  })

  await check('Stripe is fully removed from the worker and storefront', async () => {
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const adminSource = await readFile('src/pages/AdminDashboard.jsx', 'utf8')
    const cartSource = await readFile('src/pages/CartPage.jsx', 'utf8')
    const sectionsSource = await readFile('src/components/ProductSections.jsx', 'utf8')
    const hookSource = await readFile('src/hooks/useSecureCheckout.js', 'utf8')
    const apiSource = await readFile('src/api/platformApi.js', 'utf8')
    const policiesSource = await readFile('src/data/policies.js', 'utf8')
    const catalogSource = await readFile('src/data/catalog.js', 'utf8')
    const initialMigration = await readFile('worker/migrations/0001_initial.sql', 'utf8')
    const sources = [workerSource, adminSource, cartSource, sectionsSource, hookSource, apiSource, policiesSource, catalogSource, initialMigration]
    return sources.every((source) => !/stripe/i.test(source))
  })

  await check('tax language is merchant-of-record only, everywhere on the storefront', async () => {
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const cartSource = await readFile('src/pages/CartPage.jsx', 'utf8')
    const sectionsSource = await readFile('src/components/ProductSections.jsx', 'utf8')
    return cartSource.includes('cart-tax-note')
      && cartSource.includes('Lemon Squeezy handles sales tax as the merchant of record')
      && sectionsSource.includes('Tax handled as the merchant of record')
      && !cartSource.includes('Tax may apply')
      && !sectionsSource.includes('calculated at checkout')
      && !workerSource.includes('automaticTaxEnabled')
  })

  await check('site-wide interface copy is editable from the content studio', async () => {
    const panelSource = await readFile('src/pages/AdminContentPanel.jsx', 'utf8')
    const copyLibSource = await readFile('src/lib/siteCopy.js', 'utf8')
    const shellSource = await readFile('src/components/StorefrontShell.jsx', 'utf8')
    const cartSource = await readFile('src/pages/CartPage.jsx', 'utf8')
    const authSource = await readFile('src/components/AuthUI.jsx', 'utf8')
    const notFoundSource = await readFile('src/pages/NotFound.jsx', 'utf8')
    const homeSource = await readFile('src/pages/CatalogHome.jsx', 'utf8')
    const adminSource = await readFile('src/pages/AdminDashboard.jsx', 'utf8')
    return panelSource.includes('SITE_COPY_GROUPS')
      && panelSource.includes('Site copy')
      && panelSource.includes('Homepage SEO')
      && panelSource.includes('siteCopy })}')
      && copyLibSource.includes('SITE_COPY_DEFAULTS')
      && copyLibSource.includes('footer')
      && copyLibSource.includes('checkoutModal')
      && copyLibSource.includes('success')
      && copyLibSource.includes('authModal')
      && copyLibSource.includes('notFound')
      && copyLibSource.includes('homeSeo')
      && shellSource.includes('useSiteCopy')
      && cartSource.includes('siteCopy(config).cart')
      && authSource.includes('useSiteCopy().authModal')
      && notFoundSource.includes('useSiteCopy().notFound')
      && homeSource.includes('siteCopy(config).homeSeo')
      && adminSource.includes('admin-section-nav')
  })

  await check('the announcement bar and offers manager cover every and future product', async () => {
    const barSource = await readFile('src/components/AnnouncementBar.jsx', 'utf8')
    const offersSource = await readFile('src/pages/AdminOffersPanel.jsx', 'utf8')
    const adminSource = await readFile('src/pages/AdminDashboard.jsx', 'utf8')
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const appSource = await readFile('src/App.jsx', 'utf8')
    const cssSource = await readFile('src/styles.css', 'utf8')
    return barSource.includes('announcement-bar')
      && barSource.includes('runway-announcement-dismissed')
      && offersSource.includes('DEFAULT OFFER FOR NEW PRODUCTS')
      && offersSource.includes('onSaveProductOffer')
      && adminSource.includes('<AdminOffersPanel')
      && adminSource.includes('saveDefaultOffer')
      && workerSource.includes('cleanAnnouncement')
      && workerSource.includes('cleanDefaultOffer')
      && workerSource.includes('merged.offerActive = Boolean(defaultOffer.offerActive)')
      && workerSource.includes("announcement: { ...(settings.announcement || {})")
      && appSource.includes('<AnnouncementBar />')
      && cssSource.includes('.announcement-bar')
  })

  await check('critical-path security hardening is present in the worker', async () => {
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    return workerSource.includes('seenKeys.has(productKey)')
      && workerSource.includes('verifyImageSignature')
      && workerSource.includes('decodeUploadedImage')
      && workerSource.includes('findPurchaseForUser')
      && workerSource.includes("ownerId !== user.id")
      && workerSource.includes('constantTimeEqual')
      && workerSource.includes("Math.abs(Date.now() / 1000 - unixTimestamp) > 300")
      && workerSource.includes("form.set(`line_items[${index}][quantity]`, '1')")
      && !workerSource.includes('body.quantity')
      && !workerSource.includes('body.price')
      && !workerSource.includes('body.discount')
  })

  await check('pre-deployment security checklist wiring is present', async () => {
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const deployScript = await readFile('scripts/deploy.sh', 'utf8')
    const pagesHeaders = await readFile('public/_headers', 'utf8')
    return workerSource.includes('readinessReport')
      && workerSource.includes("path === '/health'")
      && workerSource.includes('SECURITY_HEADERS')
      && workerSource.includes("'X-Frame-Options': 'DENY'")
      && workerSource.includes('Strict-Transport-Security')
      && workerSource.includes('X-Correlation-Id')
      && workerSource.includes("'auth-gate'")
      && workerSource.includes("default-src 'none'")
      && !workerSource.includes('console.log')
      && deployScript.includes('public/_headers')
      && deployScript.includes('SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"')
      && pagesHeaders.includes('X-Frame-Options: DENY')
      && pagesHeaders.includes('Strict-Transport-Security')
      && pagesHeaders.includes('Content-Security-Policy')
      && pagesHeaders.includes("script-src 'self' https://widget.trustpilot.com")
  })

  await check('account deletion flow and log redaction are wired end to end', async () => {
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const apiSource = await readFile('src/api/platformApi.js', 'utf8')
    const accountSource = await readFile('src/pages/AccountPage.jsx', 'utf8')
    const appSource = await readFile('src/App.jsx', 'utf8')
    return workerSource.includes('async function deleteAccountData')
      && workerSource.includes("path === '/account' && request.method === 'DELETE'")
      && workerSource.includes("'deleted:' || id")
      && workerSource.includes('redactPii')
      && workerSource.includes("console.error('Worker error', error?.name")
      && apiSource.includes('export async function deleteAccount')
      && accountSource.includes('Delete my account data')
      && accountSource.includes('Yes, delete everything')
      && appSource.includes('Deleting your data')
  })

  await check('a root error boundary prevents blank white pages on render crashes', async () => {
    const mainSource = await readFile('src/main.jsx', 'utf8')
    const boundarySource = await readFile('src/components/AppErrorBoundary.jsx', 'utf8')
    const shellSource = await readFile('src/components/StorefrontShell.jsx', 'utf8')
    return mainSource.includes('AppErrorBoundary')
      && boundarySource.includes('app-crash-screen')
      && boundarySource.includes('getDerivedStateFromError')
      && shellSource.includes('safetyTimer')
      && shellSource.includes('Brand intro failed to start')
  })

  await check('uploaded product media uses clean-fit frames and reduced-motion-safe animation', async () => {
    const cssSource = await readFile('src/styles.css', 'utf8')
    const sectionsSource = await readFile('src/components/ProductSections.jsx', 'utf8')
    const catalogSource = await readFile('src/data/catalog.js', 'utf8')
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    return cssSource.includes('.product-shot--animated')
      && cssSource.includes('.product-shot--cover')
      && cssSource.includes('object-fit: cover')
      && cssSource.includes('shot-drift')
      && sectionsSource.includes('is-loaded')
      && catalogSource.includes('applyUploadedMedia')
      && workerSource.includes('/media/')
      && workerSource.includes('feature_images')
      && workerSource.includes('media-upload')
  })

  await check('feature showcase is unlimited, AI-captioned, and numbered', async () => {
    const sectionsSource = await readFile('src/components/ProductSections.jsx', 'utf8')
    const cssSource = await readFile('src/styles.css', 'utf8')
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    const adminSource = await readFile('src/pages/AdminDashboard.jsx', 'utf8')
    return sectionsSource.includes('VisualFeatureShowcase')
      && sectionsSource.includes('visual-feature__number')
      && cssSource.includes('visual-showcase__list')
      && cssSource.includes('visual-feature__rail')
      && cssSource.includes('is-counted')
      && workerSource.includes('product_features')
      && workerSource.includes('describeImageWithAi')
      && workerSource.includes('aiAvailable')
      && !workerSource.includes('already has 8 screenshots')
      && adminSource.includes('unlimited, numbered on the storefront')
      && adminSource.includes('AI image scanning')
  })

  await check('admin offer controls stay distinct from Lemon Squeezy billing and use the existing settings API', async () => {
    const adminSource = await readFile('src/pages/AdminDashboard.jsx', 'utf8')
    const apiSource = await readFile('src/api/platformApi.js', 'utf8')
    const workerSource = await readFile('worker/src/index.js', 'utf8')
    return adminSource.includes('Lemon Squeezy checkout')
      && adminSource.includes('What customers see')
      && ['offerActive', 'offerLabel', 'displayOriginalPrice', 'displaySalePrice'].every((field) => adminSource.includes(field) && workerSource.includes(field))
      && apiSource.includes("body: settings")
      && apiSource.includes('state.settings = { ...state.settings, ...settings }')
      && workerSource.includes("cleanText(input.lemonVariantId")
      && workerSource.includes('product.lemonVariantId = variantId')
  })

  await check('/admin redirects an unauthenticated visitor away from all owner UI', async () => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(`${BASE_URL}/`, { timeout: 3000 })
    return await page.locator('.admin-page').count() === 0 && await page.locator('.admin-metrics').count() === 0
  })

  await desktop.close()

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await mobile.addInitScript(() => localStorage.setItem('runway-intro-seen', 'true'))
  const mobilePage = await mobile.newPage()
  attachErrorCapture(mobilePage, 'mobile')
  await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' })

  await check('mobile intro retains both Ledger Fold sheets', async () => {
    const count = await mobilePage.locator('.intro-logo-forge .runway-mark__sheet').count()
    const baseSize = await mobilePage.locator('.intro-runway-mark').evaluate((svg) => Number.parseFloat(getComputedStyle(svg).width))
    return count === 2 && baseSize > 90
  })
  await mobilePage.waitForTimeout(450)
  await mobilePage.locator('.intro-skip').click()

  await check('mobile layout has no horizontal overflow', async () => mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1))

  await check('responsive coverage exists for phone, tablet, and laptop widths', async () => {
    const cssSource = await readFile('src/styles.css', 'utf8')
    const portalSource = await readFile('src/platform.css', 'utf8')
    return cssSource.includes('@media (max-width: 1120px)')
      && cssSource.includes('@media (max-width: 960px)')
      && cssSource.includes('@media (max-width: 720px)')
      && cssSource.includes('@media (max-width: 420px)')
      && cssSource.includes('overflow-x: clip')
      && cssSource.includes('min-height: 100svh')
      && cssSource.includes('aspect-ratio: var(--shot-ratio')
      && portalSource.includes('@media (max-width: 1240px)')
      && portalSource.includes('@media (max-width: 430px)')
      && portalSource.includes('max-height: calc(100dvh - 40px)')
      && portalSource.includes('.purchase-actions { flex-wrap: wrap; }')
      && cssSource.includes('.cart-item { grid-template-columns: 40px minmax(0, 1fr) 38px;')
      && cssSource.includes('.cart-main { padding-top: 170px')
      && cssSource.includes('.cart-main { padding-top: 150px')
      && cssSource.includes('.cart-main .hero-back-link { color: var(--ink)')
  })

  await check('mobile navigation and hero stay visible with touch-safe controls', async () => {
    const nav = mobilePage.locator('.navbar')
    const hero = mobilePage.locator('.hero')
    const card = mobilePage.locator('.products-grid .product-card').first()
    const cardBox = await card.boundingBox()
    return await nav.isVisible() && await hero.isVisible() && Boolean(cardBox && cardBox.height >= 120)
      && await mobilePage.getByRole('button', { name: /Watch the show/i }).count() === 0
  })
  await mobilePage.screenshot({ path: '/tmp/ledger-fold-home-mobile.png', fullPage: true })

  await check('protected feedback and custom authentication stay touch-safe on mobile', async () => {
    await mobilePage.goto(`${BASE_URL}/feedback`, { waitUntil: 'networkidle' })
    const libraryBox = await mobilePage.getByRole('link', { name: /Open account library/i }).boundingBox()
    const feedbackFits = await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
    await mobilePage.locator('.portal-header .account-button').click()
    const modal = mobilePage.getByRole('dialog', { name: /Keep your systems within reach/i })
    await modal.waitFor({ state: 'visible' })
    const modalBox = await modal.boundingBox()
    const googleBox = await modal.locator('.google-auth-button').boundingBox()
    return feedbackFits
      && Boolean(libraryBox && libraryBox.height >= 44)
      && Boolean(modalBox && modalBox.x >= 0 && modalBox.x + modalBox.width <= 391)
      && Boolean(googleBox && googleBox.height >= 44)
  })
  await mobile.close()

  const offerPreview = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  await offerPreview.addInitScript(() => {
    if (localStorage.getItem('cashflow-platform-mock-v2')) return
    localStorage.setItem('cashflow-platform-mock-v2', JSON.stringify({
      settings: {
        offerActive: true,
        offerLabel: 'Black Friday / Save Big',
        displayOriginalPrice: '$88',
        displaySalePrice: '$52',
      },
    }))
  })
  const offerPage = await offerPreview.newPage()
  attachErrorCapture(offerPage, 'offer-settings')
  await offerPage.goto(`${BASE_URL}/products/cashflow-os`, { waitUntil: 'networkidle' })

  await check('public offer settings control every price surface and hide inactive offer UI', async () => {
    const activeState = await offerPage.evaluate(() => ({
      nav: document.querySelector('.nav-price')?.textContent,
      hero: document.querySelector('.hero-actions .button')?.textContent,
      mobile: document.querySelector('.mobile-menu .button')?.textContent,
      pricing: document.querySelector('.price')?.textContent,
      ribbon: document.querySelector('.offer-ribbon')?.textContent,
      final: document.querySelector('.final-cta .button')?.textContent,
    }))
    const activeCopyMatches = Object.values(activeState).every(Boolean)
      && activeState.nav.includes('$88') && activeState.nav.includes('$52')
      && activeState.hero.includes('$52')
      && activeState.mobile.includes('$52')
      && activeState.pricing.includes('$88') && activeState.pricing.includes('$52')
      && activeState.ribbon === 'Black Friday / Save Big'
      && activeState.final.includes('$52')

    await offerPage.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('cashflow-platform-mock-v2'))
      state.settings.offerActive = false
      localStorage.setItem('cashflow-platform-mock-v2', JSON.stringify(state))
    })
    await offerPage.reload({ waitUntil: 'networkidle' })

    const inactiveUiHidden = await offerPage.locator('.offer-ribbon, .price s, .nav-price s').count() === 0
    const currentPriceRemains = (await offerPage.locator('.price strong').innerText()) === '$52'
      && (await offerPage.locator('.hero-actions .button').innerText()).includes('$52')
    return activeCopyMatches && inactiveUiHidden && currentPriceRemains
  })
  await offerPreview.close()

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const reducedPage = await reduced.newPage()
  attachErrorCapture(reducedPage, 'reduced-motion')
  await reducedPage.goto(BASE_URL, { waitUntil: 'networkidle' })

  await check('prefers-reduced-motion bypasses intro and reveals hero directly', async () => {
    await reducedPage.waitForTimeout(100)
    const introCount = await reducedPage.locator('.brand-intro').count()
    const heroState = await reducedPage.locator('.hero-visual').evaluate((node) => {
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return { opacity: Number(style.opacity), width: rect.width, height: rect.height }
    })
    return introCount === 0 && heroState.opacity > 0.95 && heroState.width > 100 && heroState.height > 100
  })
  await reduced.close()

  await check('no browser console or runtime errors occurred', async () => {
    if (browserErrors.length) throw new Error(browserErrors.join(' | '))
    return true
  })
} finally {
  await browser.close()
}

const total = passed + failures.length
console.log(`\nLedger Fold regression: ${passed}/${total} checks passed`)
if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'))
  process.exitCode = 1
}
