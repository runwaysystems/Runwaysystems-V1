import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
const failures = []

function source(path) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`)
    console.error(`FAIL  ${name}${detail ? `: ${detail}` : ''}`)
  }
}

const app = source('src/App.jsx')
const claim = source('src/pages/ComplimentaryClaimPage.jsx')
const admin = source('src/pages/AdminComplimentaryAccess.jsx')
const dashboard = source('src/pages/AdminDashboard.jsx')
const account = source('src/pages/AccountPage.jsx')
const auth = source('src/context/AuthContext.jsx')
const api = source('src/api/platformApi.js')
const redirects = source('public/_redirects')
const sitemapGenerator = source('scripts/generate-sitemap.mjs')

check('claim page is lazy loaded on a dedicated route', /lazy\(\(\) => import\('\.\/pages\/ComplimentaryClaimPage(?:\.jsx)?'\)\)/.test(app)
  && /<Route path="\/claim"/.test(app))
check('claim page captures tokens from the URL fragment', /window\.location\.hash/.test(claim)
  && /URLSearchParams/.test(claim)
  && !/location\.search/.test(claim))
check('claim token is moved to tab-scoped storage and removed from history', /sessionStorage\.setItem/.test(claim)
  && /history\.replaceState/.test(claim))
check('claim activation uses the protected API rather than a GET link', /claimComplimentaryAccess/.test(claim)
  && /method: 'POST'/.test(api))
check('claim flow supports signing out of the wrong account', /Switch Google account/.test(claim)
  && /await signOut\(\)/.test(claim))
check('OAuth returns claim attempts to the claim page', /hasPendingComplimentaryClaim/.test(auth)
  && /hasPendingComplimentaryClaim \? '\/claim' : '\/account'/.test(auth))
check('owner console supports one email and multiple selected products', /type="email"/.test(admin)
  && /selected\.includes/.test(admin)
  && /productKeys: selected/.test(admin))
check('owner selector derives future entries from active catalog products only', /\.filter\(\(product\).*status[\s\S]*=== 'active'/.test(admin)
  && /Future products appear here automatically/.test(admin)
  && /currentlyAvailable/.test(admin))
check('owner console exposes resend, cancel, review, and revoke controls', /> Resend<\//.test(admin)
  && /> Cancel<\//.test(admin)
  && /Invite review/.test(admin)
  && /> Revoke<\//.test(admin))
check('owner dashboard includes complimentary navigation and analytics', /Complimentary access/.test(dashboard)
  && /complimentaryCustomers/.test(dashboard))
check('account library distinguishes complimentary entitlements', /accessSource === 'complimentary'/.test(account)
  && /Complimentary access/.test(account))
check('claim route has a Cloudflare Pages SPA rewrite', redirects.includes('/claim /app-shell 200')
  && redirects.includes('/claim/ /app-shell 200'))
check('claim route is excluded from crawler indexing', sitemapGenerator.includes("'Disallow: /claim'")
  && !sitemapGenerator.includes("{ path: '/claim'"))

console.log(`\nComplimentary access UI regression: ${passed}/${passed + failures.length} checks passed`)
if (failures.length) process.exit(1)
