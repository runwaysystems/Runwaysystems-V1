// Regression coverage for the strict Pages CSP and authenticated avatar UI.
// Run with: npm run test:csp
import { readFile } from 'node:fs/promises'

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

function headerValue(source, name) {
  const line = source.split(/\r?\n/).find((entry) => entry.trimStart().startsWith(`${name}:`))
  return line?.trim().slice(name.length + 1).trim() || ''
}

function directiveValue(policy, name) {
  return policy
    .split(';')
    .map((directive) => directive.trim())
    .find((directive) => directive === name || directive.startsWith(`${name} `))
    ?.split(/\s+/)
    .slice(1) || []
}

const headers = await readFile('public/_headers', 'utf8')
const authUi = await readFile('src/components/AuthUI.jsx', 'utf8')
const csp = headerValue(headers, 'Content-Security-Policy')
const scriptSrc = directiveValue(csp, 'script-src')
const imageSrc = directiveValue(csp, 'img-src')

check('Pages CSP is present', Boolean(csp))
check(
  'the consent-gated Trustpilot loader is permitted by script-src',
  scriptSrc.includes('https://widget.trustpilot.com'),
)
check(
  'script-src stays strict rather than allowing arbitrary inline JavaScript',
  !scriptSrc.includes("'unsafe-inline'"),
)
check(
  'automatic Cloudflare HTML mutation is disabled instead of allowlisting its injected script',
  headerValue(headers, 'Cache-Control').split(',').map((value) => value.trim()).includes('no-transform')
    && !scriptSrc.some((value) => value.includes('static.cloudflareinsights.com')),
)
check(
  'Google OAuth avatar hosts are allowed by img-src',
  imageSrc.includes('https://*.googleusercontent.com'),
)
check(
  'cross-origin isolation can display public avatars without third-party credentials',
  headerValue(headers, 'Cross-Origin-Embedder-Policy') === 'credentialless',
)
check(
  'avatar rendering has an error fallback instead of leaving a broken image glyph',
  authUi.includes('function UserAvatar')
    && authUi.includes('onError={() => setAvatarFailed(true)}')
    && authUi.includes('setAvatarFailed(false)')
    && authUi.includes('fallbackClassName="account-initials"'),
)
check(
  'Google avatar requests remain referrer-free',
  authUi.includes('referrerPolicy="no-referrer"'),
)

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
