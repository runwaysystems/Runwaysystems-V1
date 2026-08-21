import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { Cookie, ShieldCheck } from 'lucide-react'
import { clearConsent, getConsent, setConsent, subscribeConsent } from '../lib/consent'
import { getPublicConfigCache, subscribePublicConfig } from '../lib/publicConfigCache'

const defaultDescription = 'Essential storage keeps your cart, theme, and sign-in working. No optional third-party content is loaded on this site.'

// Cookie and privacy consent banner. Essential storefront storage (cart,
// theme, sign-in) always stays active. The choice is remembered until the
// visitor reopens preferences from the footer.
export default function ConsentBanner() {
  const bannerRef = useRef(null)
  const [visible, setVisible] = useState(() => !getConsent())
  const [configVersion, setConfigVersion] = useState(0)

  useEffect(() => subscribeConsent((value) => {
    if (!value) setVisible(true)
  }), [])
  useEffect(() => subscribePublicConfig(() => setConfigVersion((current) => current + 1)), [])

  // GSAP entrance: the compact card rises in once per appearance and skips
  // motion entirely for reduced-motion visitors.
  useLayoutEffect(() => {
    const banner = bannerRef.current
    if (!visible || !banner) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const tween = gsap.fromTo(banner, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, ease: 'power3.out' })
    return () => {
      tween.kill()
    }
  }, [visible])

  const choose = (value) => {
    setConsent(value)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className="consent-banner" role="dialog" aria-label="Cookie preferences" ref={bannerRef}>
      <div className="consent-banner__card">
        <div className="consent-banner__copy">
          <p className="eyebrow"><Cookie size={12} /> COOKIES & PRIVACY</p>
          <p>{getPublicConfigCache()?.suiteContent?.consent?.description || defaultDescription} <Link to="/terms#privacy">Privacy policy</Link>.</p>
        </div>
        <div className="consent-banner__actions">
          <button className="button button--dark" type="button" onClick={() => choose('essential')}>
            <ShieldCheck size={14} /> Essential only
          </button>
          <button className="button button--lime" type="button" onClick={() => choose('all')}>
            Accept all
          </button>
        </div>
      </div>
    </aside>
  )
}

// Reopens the banner from anywhere, such as the footer preferences link.
export function openConsentPreferences() {
  clearConsent()
}
