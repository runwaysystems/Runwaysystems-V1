import { useEffect, useRef, useState } from 'react'
import { hasOptionalConsent, subscribeConsent } from '../lib/consent'
import { loadTrustpilot } from '../lib/trustpilot'
import { subscribePublicConfig, getTrustpilotBusinessUnitId, getPublicConfigCache } from '../lib/publicConfigCache'

const envBusinessUnitId = import.meta.env.VITE_TRUSTPILOT_BUSINESS_UNIT_ID || ''
const envReviewUrl = import.meta.env.VITE_TRUSTPILOT_REVIEW_URL || 'https://www.trustpilot.com/review/your-domain.com'

export default function TrustpilotBox() {
  const boxRef = useRef(null)
  const [consented, setConsented] = useState(hasOptionalConsent)
  const [configVersion, setConfigVersion] = useState(0)

  // The business unit id and review URL can be edited from the admin panel;
  // the public config feeds the widget so it updates without a redeploy.
  const config = getPublicConfigCache?.() || {}
  const businessUnitId = getTrustpilotBusinessUnitId(envBusinessUnitId) || 'YOUR_TRUSTPILOT_BUSINESS_UNIT_ID'
  const reviewUrl = config.trustpilotBusinessUrl || envReviewUrl
  const isPlaceholder = businessUnitId.startsWith('YOUR_')

  useEffect(() => subscribeConsent((value) => setConsented(value === 'all')), [])
  useEffect(() => subscribePublicConfig(() => setConfigVersion((current) => current + 1)), [])

  useEffect(() => {
    if (!consented || isPlaceholder) return undefined
    loadTrustpilot()
    // The bootstrap script initializes matching elements when it loads. For
    // boxes mounted afterwards (SPA navigation) or after consent, re-init
    // this element once the script is available.
    let attempts = 0
    const tryInit = () => {
      attempts += 1
      if (window.Trustpilot && boxRef.current) {
        try {
          window.Trustpilot.loadFromElement(boxRef.current, true)
          return true
        } catch {
          // The widget can fail in restricted contexts; the fallback stays.
        }
      }
      return false
    }
    if (tryInit()) return undefined
    const timer = window.setInterval(() => {
      if (tryInit()) window.clearInterval(timer)
    }, 700)
    const stop = window.setTimeout(() => window.clearInterval(timer), 9000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(stop)
    }
  }, [consented])

  const showWidget = consented && !isPlaceholder

  return (
    <aside className="trustpilot-shell" aria-label="Trustpilot rating">
      <div className="trustpilot-rule" />
      <div className="trustpilot-copy">
        <span className="trustpilot-kicker">INDEPENDENT REVIEWS</span>
        <div
          ref={boxRef}
          className={`trustpilot-widget-host ${showWidget ? 'trustpilot-widget' : 'trustpilot-widget-placeholder'}`}
          data-locale="en-US"
          data-template-id="5419b732fbfb950b10de65e5"
          data-businessunit-id={businessUnitId}
          data-style-height="24px"
          data-style-width="100%"
          data-theme="light"
        >
          {showWidget ? (
            <a href={reviewUrl} target="_blank" rel="noopener noreferrer">Trustpilot</a>
          ) : (
            <div className="trustpilot-placeholder" data-placeholder-business-unit="true">
              <span className="trustpilot-wordmark"><b>★</b> Trustpilot</span>
              <span className="trustpilot-stars" aria-label="Trustpilot star rating">★★★★★</span>
              <small>{isPlaceholder ? 'TrustBox ready for Business ID' : 'Enable optional cookies to load reviews'}</small>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
