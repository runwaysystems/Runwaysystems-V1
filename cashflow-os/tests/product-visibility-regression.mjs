// Regression suite for product visibility.
//
// Two separate bugs are locked down here.
//
//   1. Unticking "Visible on storefront" left the product live on the
//      storefront. The public config correctly dropped it, but the pages
//      treated "missing from the config" as "the config has not loaded" and
//      topped the catalog back up from the static src/data/catalog.js, which
//      resurrected the hidden product on the homepage and left its product
//      page fully readable at its direct URL.
//
//   2. The same untick made the product vanish from the owner dashboard, as
//      if it had been deleted. The preview data adapter served the dashboard
//      from the storefront (active-only) list, so hiding a product removed
//      the only UI that could turn it back on.
//
// Run with: npm run test:visibility
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' })
for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', 'Event']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true })
}

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

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const {
    CONFIG_READY,
    CONFIG_UNAVAILABLE,
    catalogIsAuthoritative,
    productIsUnavailable,
    storefrontProducts,
  } = await vite.ssrLoadModule('/src/lib/catalogAvailability.js')

  const platformApi = await vite.ssrLoadModule('/src/api/platformApi.js')
  const { CATALOG_ORDER } = await vite.ssrLoadModule('/src/data/catalog.js')

  // ---------------------------------------------------------- availability
  const loaded = { configStatus: CONFIG_READY, products: [{ key: 'invoice-os', name: 'Invoice OS' }] }
  const offline = { configStatus: CONFIG_UNAVAILABLE, products: [] }

  check('a loaded config is authoritative', catalogIsAuthoritative(loaded) === true)
  check('a failed config load is not authoritative', catalogIsAuthoritative(offline) === false)
  check('a config that has not resolved yet is not authoritative', catalogIsAuthoritative(null) === false)

  check(
    'a product absent from a loaded config counts as hidden',
    productIsUnavailable(loaded, 'cashflow-os') === true,
  )
  check(
    'a product present in a loaded config stays available',
    productIsUnavailable(loaded, 'invoice-os') === false,
  )
  check(
    'nothing is hidden while the config is unavailable',
    productIsUnavailable(offline, 'cashflow-os') === false
      && productIsUnavailable(null, 'cashflow-os') === false,
  )

  // The critical case: the owner hid every product. That is a real state and
  // must NOT be papered over with the built-in catalog.
  const allHidden = { configStatus: CONFIG_READY, products: [] }
  check(
    'hiding every product yields an empty storefront, not the static catalog',
    storefrontProducts(allHidden, [{ key: 'cashflow-os' }]).length === 0,
  )
  check(
    'an unreachable config falls back to the static catalog so an outage is survivable',
    storefrontProducts(offline, [{ key: 'cashflow-os' }]).length === 1,
  )

  // ------------------------------------------------------- preview adapter
  // The preview adapter is the data source whenever VITE_API_BASE_URL is
  // unset, which is how the dashboard is normally exercised locally.
  const hiddenKey = CATALOG_ORDER[0]
  await platformApi.updateAdminProduct(hiddenKey, {
    name: 'Cash Flow OS',
    icon: 'spreadsheet',
    accent: 'lime',
    active: false,
  })

  const adminList = await platformApi.getAdminProducts()
  const adminEntry = adminList.find((product) => product.key === hiddenKey)
  check(
    'a hidden product is still listed in the owner dashboard',
    Boolean(adminEntry),
    'hiding a product must never remove it from the dashboard, only deleting should',
  )
  check(
    'the dashboard reports the hidden product as hidden',
    adminEntry?.active === false,
    `active was ${adminEntry?.active}`,
  )

  const publicConfig = await platformApi.getPublicConfig()
  check(
    'a hidden product is absent from the public storefront config',
    !(publicConfig.products || []).some((product) => product.key === hiddenKey),
  )

  // Turning it back on restores it everywhere.
  await platformApi.updateAdminProduct(hiddenKey, {
    name: 'Cash Flow OS',
    icon: 'spreadsheet',
    accent: 'lime',
    active: true,
  })
  const restored = await platformApi.getPublicConfig()
  check(
    'making the product visible again puts it back on the storefront',
    (restored.products || []).some((product) => product.key === hiddenKey),
  )

  // ------------------------------------------------------- call-site guards
  // These keep the pages wired to the shared helper, so a future edit cannot
  // quietly reintroduce the static-catalog fallback that caused the bug.
  const source = async (path) => vite.transformRequest(path).then((result) => result?.code || '')

  const home = await source('/src/pages/CatalogHome.jsx')
  check(
    'the homepage only tops up from the static catalog when the config failed to load',
    home.includes('catalogIsAuthoritative') && home.includes('storefrontProducts'),
  )

  const productPage = await source('/src/pages/ProductPage.jsx')
  check(
    'the product page decides visibility through the shared helper',
    productPage.includes('productIsUnavailable'),
  )

  const cart = await source('/src/pages/CartPage.jsx')
  check(
    'the cart drops products that are no longer purchasable',
    cart.includes('productIsUnavailable'),
  )
} finally {
  await vite.close()
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
