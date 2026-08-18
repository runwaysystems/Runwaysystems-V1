// Simulates the browser module graph of the storefront inside jsdom to catch
// module-evaluation crashes that would produce a blank white page.
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})

const { window } = dom

// Polyfills the app expects at module scope / during render.
window.matchMedia = window.matchMedia || ((query) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent() { return false },
}))
window.scrollTo = () => {}
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16)
window.cancelAnimationFrame = (id) => clearTimeout(id)
window.IntersectionObserver = class {
  constructor(cb) { this.cb = cb }
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'Element', 'Node', 'location', 'history', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver', 'ResizeObserver', 'CustomEvent', 'Event']) {
  try {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true })
  } catch {
    // Some globals (like navigator) are read-only in modern Node.
  }
}
try { globalThis.window = window } catch { /* already set */ }
try { globalThis.document = window.document } catch { /* already set */ }

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false },
  appType: 'spa',
  logLevel: 'info',
})

const failures = []
const load = async (name, id) => {
  console.log(`... loading ${name}`)
  try {
    await Promise.race([
      vite.ssrLoadModule(id),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout after 25s')), 25000)),
    ])
    console.log(`OK   ${name}`)
  } catch (error) {
    failures.push(`${name}: ${error.message}`)
    console.error(`FAIL ${name}: ${error.message}`)
    if (error.stack) {
      const firstFrame = String(error.stack).split('\n').slice(1, 4).join('\n')
      console.error(firstFrame)
    }
  }
}

await load('catalog data', '/src/data/catalog.js')
await load('policies data', '/src/data/policies.js')
await load('public config cache', '/src/lib/publicConfigCache.js')
await load('intro state', '/src/lib/introState.js')
await load('consent state', '/src/lib/consent.js')
await load('trustpilot loader', '/src/lib/trustpilot.js')
await load('platform api', '/src/api/platformApi.js')
await load('auth context', '/src/context/AuthContext.jsx')
await load('cart context', '/src/context/CartContext.jsx')
await load('brand', '/src/components/Brand.jsx')
await load('error boundary', '/src/components/AppErrorBoundary.jsx')
await load('consent banner', '/src/components/ConsentBanner.jsx')
await load('announcement bar', '/src/components/AnnouncementBar.jsx')
await load('scroll to top', '/src/components/ScrollToTop.jsx')
await load('seo head manager', '/src/components/Seo.jsx')
await load('hero 3d background', '/src/components/Hero3DBackground.jsx')
await load('auth ui', '/src/components/AuthUI.jsx')
await load('product mocks', '/src/components/ProductMockVisual.jsx')
await load('product sections', '/src/components/ProductSections.jsx')
await load('storefront shell', '/src/components/StorefrontShell.jsx')
await load('testimonials', '/src/components/TestimonialsSection.jsx')
await load('account page', '/src/pages/AccountPage.jsx')
await load('cart page', '/src/pages/CartPage.jsx')
await load('admin content panel', '/src/pages/AdminContentPanel.jsx')
await load('admin offers panel', '/src/pages/AdminOffersPanel.jsx')
await load('admin dashboard', '/src/pages/AdminDashboard.jsx')
await load('feedback page', '/src/pages/FeedbackPage.jsx')
await load('catalog home', '/src/pages/CatalogHome.jsx')
await load('product page', '/src/pages/ProductPage.jsx')
await load('not found page', '/src/pages/NotFound.jsx')
await load('app', '/src/App.jsx')

await vite.close()

if (failures.length) {
  console.error(`\n${failures.length} module(s) crashed:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('\nAll modules evaluate cleanly in a simulated browser.')
