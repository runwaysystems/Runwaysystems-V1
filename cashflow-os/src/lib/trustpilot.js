// Loads the third-party Trustpilot widget script. The script is only ever
// injected after the visitor accepts optional content, so no Trustpilot
// request or cookie happens before consent.
import { hasOptionalConsent } from './consent'

const SCRIPT_ID = 'trustpilot-widget-script'
const SCRIPT_URL = 'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js'

export function loadTrustpilot() {
  if (!hasOptionalConsent()) return
  if (document.getElementById(SCRIPT_ID)) return
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.src = SCRIPT_URL
  script.async = true
  document.head.appendChild(script)
}
