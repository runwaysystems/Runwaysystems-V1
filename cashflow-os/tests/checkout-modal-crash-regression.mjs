// Regression coverage for the "X is not defined" storefront crash.
//
// Clicking "Get instant access" (ProductSections) or "Checkout securely"
// (CartPage) runs useSecureCheckout. When the checkout session cannot be
// created, startCheckout stores a message, App renders <CheckoutModal open>,
// and that modal paints a lucide <X /> close button. StorefrontShell used <X />
// without importing it, so the ReferenceError escaped the render and the root
// AppErrorBoundary replaced the whole storefront with its crash screen.
//
// The same missing import broke the Navbar mobile menu toggle, whose open state
// renders the other <X /> branch.
//
// Run with: npm run test:checkout-modal
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import * as react from 'react'

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

// --- Part 1: static sweep for JSX tags that are never bound in their file ---
// A capitalized <Tag /> that is neither imported nor declared resolves to a
// bare global at runtime and throws ReferenceError the moment it renders.
async function collectSources(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await collectSources(full))
    else if (/\.(jsx|js)$/.test(entry.name)) files.push(full)
  }
  return files
}

function bindingsInScope(source) {
  const names = new Set(['React'])
  // Named specifiers: import { A, B as C } from '...'
  // (also covers the trailing braces of `import D, { A } from '...'`)
  for (const match of source.matchAll(/\{([^{}]*)\}\s*from\s*['"][^'"]+['"]/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim()
      if (name) names.add(name)
    }
  }
  // Default / namespace / bare default+named: import D from, import * as E from,
  // import D, { ... } from
  for (const match of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{|\s*,\s*\*\s+as\s+([A-Za-z_$][\w$]*)\s+from|\s+from)/g)) {
    if (match[1] && match[1] !== 'type') names.add(match[1])
    if (match[2]) names.add(match[2])
  }
  // local declarations anywhere in the module
  for (const match of source.matchAll(/\b(?:const|let|var|function|class)\s+([A-Z][\w$]*)/g)) names.add(match[1])
  // const { A, B } = ... destructuring of capitalized names
  for (const match of source.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(':').pop().split('=').shift().trim()
      if (/^[A-Z][\w$]*$/.test(name)) names.add(name)
    }
  }
  // function/component parameters such as ({ Icon }) or (Icon)
  for (const match of source.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(':').pop().split('=').shift().replace(/[{}\s]/g, '')
      if (/^[A-Z][\w$]*$/.test(name)) names.add(name)
    }
  }
  return names
}

const files = await collectSources('src')
const unbound = []
for (const file of files) {
  const source = await readFile(file, 'utf8')
  const scope = bindingsInScope(source)
  for (const match of source.matchAll(/<([A-Z][\w$]*)(?:\.[\w$]+)*[\s/>]/g)) {
    if (!scope.has(match[1])) unbound.push(`${relative(process.cwd(), file)}: <${match[1]} />`)
  }
}
check(
  'every capitalized JSX tag resolves to an import or declaration in its own file',
  unbound.length === 0,
  unbound.join('; '),
)

const shellSource = await readFile('src/components/StorefrontShell.jsx', 'utf8')
const lucideImport = shellSource.match(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/)
check(
  'StorefrontShell imports the X icon from lucide-react',
  Boolean(lucideImport) && lucideImport[1].split(',').map((part) => part.trim()).includes('X'),
)

// --- Part 2: render the components that actually crashed ---
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})
const { window } = dom

window.matchMedia = window.matchMedia || ((query) => ({
  matches: false, media: query, addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {}, dispatchEvent() { return false },
}))
window.scrollTo = () => {}
// gsap's ticker pumps requestAnimationFrame forever; give it a switch so the
// process can drain once the assertions are done.
let rafActive = true
window.requestAnimationFrame = (cb) => (rafActive ? setTimeout(() => cb(Date.now()), 16) : 0)
window.cancelAnimationFrame = (id) => clearTimeout(id)
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'HTMLElement', 'Element', 'Node', 'location', 'history', 'getComputedStyle', 'CustomEvent', 'Event', 'MouseEvent', 'KeyboardEvent', 'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver', 'ResizeObserver']) {
  try {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true })
  } catch { /* read-only global */ }
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let renderHarnessError = null
const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false },
  appType: 'spa',
  logLevel: 'error',
})

// Capture render-time crashes the way the app does, instead of letting them
// surface as an unhandled rejection.
const caughtErrors = []
const reactConsoleError = console.error
console.error = (...args) => { caughtErrors.push(args.map(String).join(' ')) }

try {
  const shell = await vite.ssrLoadModule('/src/components/StorefrontShell.jsx')
  const { CartProvider } = await vite.ssrLoadModule('/src/context/CartContext.jsx')
  const { AuthProvider } = await vite.ssrLoadModule('/src/context/AuthContext.jsx')
  // Vite externalizes node_modules under SSR, so this resolves to the very
  // same router instance StorefrontShell imported (its useLocation needs it).
  const { MemoryRouter } = await import('react-router-dom')
  const { createRoot } = await import('react-dom/client')
  const { act, createElement } = react

  const mount = window.document.createElement('div')
  window.document.body.appendChild(mount)
  const root = createRoot(mount)

  // 1. The exact failure path from the report: a failed buy click sets
  //    checkoutError, App opens CheckoutModal, the modal paints its <X />.
  await act(async () => {
    root.render(createElement(shell.CheckoutModal, {
      open: true,
      onClose: () => {},
      message: 'Lemon Squeezy did not return a checkout URL.',
      supportEmail: 'support@example.com',
    }))
  })

  const modalHtml = mount.innerHTML
  const modalCrash = caughtErrors.find((entry) => /X is not defined/.test(entry))
  check('CheckoutModal renders without crashing', !modalCrash, modalCrash || '')
  check(
    'CheckoutModal paints the secure checkout dialog and its close button',
    modalHtml.includes('checkout-modal') && modalHtml.includes('modal-close') && modalHtml.includes('SECURE CHECKOUT'),
  )
  check(
    'CheckoutModal surfaces the checkout failure message to the visitor',
    modalHtml.includes('Lemon Squeezy did not return a checkout URL.'),
  )

  // 2. The Navbar mobile menu toggle, whose open state renders the other <X />.
  caughtErrors.length = 0
  await act(async () => {
    root.render(createElement(MemoryRouter, null,
      createElement(AuthProvider, null,
        createElement(CartProvider, null,
          createElement(shell.Navbar, { onBuy: () => {}, theme: 'dark', onToggleTheme: () => {} }),
        ),
      ),
    ))
  })
  const menuButton = mount.querySelector('.menu-button')
  check('Navbar renders a mobile menu toggle', Boolean(menuButton))
  await act(async () => {
    menuButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
  const menuCrash = caughtErrors.find((entry) => /X is not defined/.test(entry))
  check('opening the Navbar mobile menu renders without crashing', !menuCrash, menuCrash || '')
  check(
    'the open menu toggle shows the close icon',
    mount.querySelector('.menu-button svg') && mount.querySelector('#mobile-menu').className.includes('is-open'),
  )

  await act(async () => root.unmount())
} catch (error) {
  renderHarnessError = error
} finally {
  console.error = reactConsoleError
  await vite.close()
}

check(
  'the crashed components render through Vite without throwing',
  renderHarnessError === null,
  renderHarnessError?.message || '',
)

rafActive = false
console.log(`\n${passed} passed, ${failures.length} failed`)
// Exit explicitly: gsap/ScrollTrigger keep timers alive in this fake browser.
process.exit(failures.length ? 1 : 0)
