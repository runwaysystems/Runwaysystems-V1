import { useCallback, useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Check, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { trackPageView, verifyCheckoutSession, getAccountPurchases } from './api/platformApi'
import { isPreviewRequest } from './hooks/usePreviewDraft'
import { AuthModal } from './components/AuthUI'
import { Logo } from './components/Brand'
import ConsentBanner from './components/ConsentBanner'
import AnnouncementBar from './components/AnnouncementBar'
import ScrollToTop from './components/ScrollToTop'
import Seo from './components/Seo'
import NotFound from './pages/NotFound'
import { CheckoutModal, Footer, Navbar, SUPPORT_EMAIL, readStorage, writeStorage, ThemeToggle } from './components/StorefrontShell'
import { siteCopy } from './lib/siteCopy'
import { useAuth } from './context/AuthContext'
import { usePublicProducts } from './hooks/usePublicProducts'
import { useSecureCheckout } from './hooks/useSecureCheckout'
import AccountPage from './pages/AccountPage'
import AdminDashboard, { OwnerRoute } from './pages/AdminDashboard'
import CartPage from './pages/CartPage'
import CatalogHome from './pages/CatalogHome'
import FeedbackPage from './pages/FeedbackPage'
import ProductPage from './pages/ProductPage'
import { buildPoliciesViewModel } from './data/policies'

function LegalPage({ theme, onToggleTheme, palette, onPaletteChange }) {
  const { checkoutError, clearCheckoutError } = useSecureCheckout()
  const config = usePublicProducts()
  const policies = buildPoliciesViewModel(config?.policies || {})
  const supportEmail = config?.supportEmail || SUPPORT_EMAIL

  const renderText = (text) => {
    const parts = String(text || '').split('{{support}}')
    return parts.map((part, index) => (
      <span key={index}>
        {part}
        {index < parts.length - 1 && <a href={`mailto:${supportEmail}`}>{supportEmail}</a>}
      </span>
    ))
  }

  return (
    <div className="legal-page">
      <Seo
        title="Terms & privacy | Runway Systems"
        description="Plain-language terms of use, privacy policy, refund policy, and product notices for Runway Systems."
        canonicalPath="/terms"
      />
      <Navbar theme={theme} onToggleTheme={onToggleTheme} palette={palette} onPaletteChange={onPaletteChange} />
      <main className="shell legal-main">
        <div className="legal-header"><p className="eyebrow">The clear, important stuff</p><h1>Terms & privacy</h1><p>{policies.intro}</p></div>
        <div className="legal-layout">
          <aside>{policies.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</aside>
          <div className="legal-content">
            {policies.sections.map((section) => (
              <section key={section.id} id={section.id}>
                <span>{section.number}</span>
                <h2>{section.title}</h2>
                {section.blocks.map((block, index) => (
                  <div className={block.notice ? 'legal-notice' : ''} key={index}>
                    {block.h && (block.notice ? <b>{block.h}</b> : <h3>{block.h}</h3>)}
                    <p>{renderText(block.p)}</p>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer products={(config?.products || []).map((product) => ({ key: product.key, name: product.name }))} supportEmail={supportEmail} />
      <CheckoutModal open={Boolean(checkoutError)} onClose={clearCheckoutError} message={checkoutError} supportEmail={supportEmail} />
    </div>
  )
}

function SuccessPage({ theme, onToggleTheme }) {
  const [searchParams] = useSearchParams()
  const { session, profile, loading, openAuth } = useAuth()
  const checkoutSessionId = searchParams.get('session_id') || ''
  const productKey = searchParams.get('product') || ''
  const config = usePublicProducts()
  const supportEmail = config?.supportEmail || SUPPORT_EMAIL
  const copy = siteCopy(config).success
  const fallbackName = (config?.products || []).find((product) => product.key === productKey)?.name || 'your products'
  const [status, setStatus] = useState('waiting')
  const [purchases, setPurchases] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (loading) return undefined
    if (!checkoutSessionId) {
      // Lemon Squeezy redirects without a session reference, so confirm the
      // order by polling the account library until the paid webhook lands.
      if (!session?.access_token) {
        setStatus('signin')
        return undefined
      }
      setStatus('verifying')
      setError('')
      const startedAt = Date.now() - 15 * 60 * 1000
      let attempts = 0
      const poll = async () => {
        if (!active) return
        attempts += 1
        try {
          const all = await getAccountPurchases({ token: session.access_token })
          const recent = (all || []).filter((purchase) => new Date(purchase.createdAt).getTime() >= startedAt)
          if (recent.length) {
            setPurchases(recent)
            setStatus('verified')
            return
          }
        } catch { /* keep polling */ }
        if (attempts < 10) window.setTimeout(poll, 3000)
        else {
          setError('Your payment is being processed. It usually appears within a minute. Refresh or check your account library.')
          setStatus('error')
        }
      }
      poll()
      return () => { active = false }
    }
    if (!session?.access_token) {
      setStatus('signin')
      return undefined
    }

    setStatus('verifying')
    setError('')
    verifyCheckoutSession(checkoutSessionId, { token: session.access_token })
      .then((result) => {
        if (!active) return
        const verified = Array.isArray(result?.purchases) ? result.purchases : (result?.id ? [result] : [])
        setPurchases(verified)
        setStatus('verified')
      })
      .catch((verificationError) => {
        if (!active) return
        setError(verificationError.message || 'Payment could not be verified yet.')
        setStatus('error')
      })
    return () => { active = false }
  }, [checkoutSessionId, loading, session?.access_token])

  const names = purchases.map((purchase) => purchase?.product?.name || 'your product').filter(Boolean)
  const resolvedNames = names.length
    ? names.join(', ')
    : fallbackName
  const deliveryDone = purchases.length > 0 && purchases.every((purchase) => purchase.deliveryEmailStatus === 'sent')

  return (
    <main className="success-page">
      <Seo
        title="Payment verification | Runway Systems"
        description="Verifying your secure Runway Systems purchase."
        canonicalPath="/success"
        noindex
      />
      <div className="success-noise" />
      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="success-theme-toggle" />
      <div className="success-logo"><Logo light /></div>
      <section className="success-card">
        <div className={`success-check${status !== 'verified' ? ' is-pending' : ''}`}>
          {status === 'verified' ? <Check /> : <RefreshCw className={status === 'verifying' ? 'is-spinning' : ''} />}
        </div>

        {status === 'verified' ? (
          <>
            <p className="eyebrow">PAYMENT VERIFIED</p>
            <h1>{copy.verifiedTitle}</h1>
            <p>We sent your private Google Sheets copy {purchases.length > 1 ? 'links' : 'link'} for {resolvedNames} to your checkout email. {purchases.length > 1 ? 'Every product is also available' : 'Your verified purchase is also available'} in your protected account library.</p>
            <Link className="button button--lime button--xl button--full" to="/account">Open my account library <ArrowUpRight /></Link>
            {purchases.length > 1 && (
              <div className="success-purchase-list" aria-label="Delivered products">
                {purchases.map((purchase) => <span key={purchase.id}>{purchase?.product?.name || 'A Runway Systems product'}</span>)}
              </div>
            )}
            <div className="success-delivery-grid">
              <div><Mail /><p><b>Check your inbox</b><span>Brevo delivers each private copy link after verified payment. Check spam if it has not arrived.</span></p></div>
              <div><ShieldCheck /><p><b>Protected backup access</b><span>Sign in with {profile?.email || 'your checkout account'} whenever you need to request a link again.</span></p></div>
            </div>
            <div className="success-followup"><Mail /><p><b>A neutral check-in follows in about three days.</b><span>Every verified buyer receives the same invitation to share an honest Trustpilot review or private feedback.</span></p></div>
            {!deliveryDone && <p className="delivery-pending-note">Email delivery is still processing. Your account entitlements are already active.</p>}
          </>
        ) : status === 'signin' ? (
          <>
            <p className="eyebrow">ACCOUNT VERIFICATION</p>
            <h1>Sign in to verify this purchase.</h1>
            <p>Use the same Google account you used before checkout. We do not expose delivery links on this page.</p>
            <button className="google-auth-button success-auth-button" type="button" onClick={openAuth}>Continue with Google</button>
          </>
        ) : status === 'error' ? (
          <>
            <p className="eyebrow">VERIFICATION NEEDS ATTENTION</p>
            <h1>Your payment is not lost.</h1>
            <p>{error} If Lemon Squeezy has just returned you here, wait a few seconds and refresh. You can also check your account library.</p>
            <div className="success-error-actions"><button className="button button--dark" type="button" onClick={() => window.location.reload()}><RefreshCw size={15} /> Try again</button><Link className="button primary" to="/account">Open account</Link></div>
          </>
        ) : (
          <>
            <p className="eyebrow">SECURE CONFIRMATION</p>
            <h1>{copy.verifyingTitle}</h1>
            <p>{copy.verifyingBody}</p>
          </>
        )}

        <div className="success-help"><ShieldCheck /><p><b>Your delivery link stays private.</b><span>Need help? <a href={`mailto:${supportEmail}`}>{supportEmail}</a></span></p></div>
      </section>
      <p className="success-footer">{resolvedNames} · Google Sheets only · <Link to="/terms">Terms & privacy</Link></p>
    </main>
  )
}

function PageTelemetry() {
  const location = useLocation()
  useEffect(() => {
    // The owner's product preview renders the real page in an iframe. Counting
    // those would inflate page views with the owner's own editing.
    if (isPreviewRequest()) return
    trackPageView(location.pathname).catch(() => {})
  }, [location.pathname])
  return null
}

function App() {
  const [theme, setTheme] = useState(() => {
    const saved = readStorage('runway-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const [palette, setPalette] = useState(() => readStorage('runway-palette') === 'glacier' ? 'glacier' : 'brass')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    writeStorage('runway-theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0c10' : '#f7f8fa')
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.palette = palette
    writeStorage('runway-palette', palette)
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [palette])

  const toggleTheme = useCallback(() => setTheme((current) => current === 'dark' ? 'light' : 'dark'), [])
  const changePalette = useCallback((nextPalette) => setPalette(nextPalette), [])

  return (
    <>
      <PageTelemetry />
      {!isPreviewRequest() && <AnnouncementBar />}
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<CatalogHome theme={theme} onToggleTheme={toggleTheme} palette={palette} onPaletteChange={changePalette} />} />
        <Route path="/products/:productKey" element={<ProductPage theme={theme} onToggleTheme={toggleTheme} palette={palette} onPaletteChange={changePalette} />} />
        <Route path="/cart" element={<CartPage theme={theme} onToggleTheme={toggleTheme} palette={palette} onPaletteChange={changePalette} />} />
        <Route path="/terms" element={<LegalPage theme={theme} onToggleTheme={toggleTheme} palette={palette} onPaletteChange={changePalette} />} />
        <Route path="/success" element={<SuccessPage theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/admin" element={<OwnerRoute><AdminDashboard /></OwnerRoute>} />
        <Route path="*" element={<NotFound theme={theme} onToggleTheme={toggleTheme} palette={palette} onPaletteChange={changePalette} />} />
      </Routes>
      <AuthModal />
      {/* Chrome that would sit over the preview and obscure the page the
          owner is reviewing. */}
      {!isPreviewRequest() && <ConsentBanner />}
    </>
  )
}

export default App
