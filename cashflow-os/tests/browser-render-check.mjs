// Renders the real app entry (main.jsx) inside jsdom and confirms the React
// tree mounts into #root, catching render-time crashes that produce a blank page.
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><head><meta name="theme-color" content="#0A0C10"></head><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})
const { window } = dom

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
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'HTMLElement', 'Element', 'Node', 'location', 'history', 'getComputedStyle', 'CustomEvent', 'Event', 'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver', 'ResizeObserver']) {
  try {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true })
  } catch { /* read-only global */ }
}

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false },
  appType: 'spa',
  logLevel: 'warn',
})

let renderError = null
try {
  await vite.ssrLoadModule('/src/main.jsx')
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const root = window.document.getElementById('root')
  const html = root.innerHTML
  if (!html || html.length < 200) {
    renderError = `root did not receive content (${html.length} chars)`
  } else {
    const hasBrand = html.includes('brand-intro') || html.includes('navbar') || html.includes('products-grid')
    if (!hasBrand) renderError = 'root rendered but expected storefront markup is missing'
  }
} catch (error) {
  renderError = error.message
} finally {
  await vite.close()
}

if (renderError) {
  console.error(`RENDER FAIL: ${renderError}`)
  process.exit(1)
}
console.log('App rendered into #root successfully in a simulated browser.')
