import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Gift, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { claimComplimentaryAccess } from '../api/platformApi'
import { AccountButton } from '../components/AuthUI'
import { Logo } from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import Seo from '../components/Seo'

const PENDING_CLAIM_KEY = 'runway.pending-complimentary-claim.v1'

function readClaimToken() {
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || ''
  if (fromHash) {
    window.sessionStorage.setItem(PENDING_CLAIM_KEY, fromHash)
    window.history.replaceState(null, '', '/claim')
    return fromHash
  }
  return window.sessionStorage.getItem(PENDING_CLAIM_KEY) || ''
}

export default function ComplimentaryClaimPage() {
  const { session, profile, loading, openAuth, signOut } = useAuth()
  const [claimToken] = useState(readClaimToken)
  const [status, setStatus] = useState('waiting')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const attempted = useRef('')

  useEffect(() => {
    if (loading) return
    if (!claimToken) {
      setStatus('error')
      setError('This complimentary invitation is missing, invalid, or has already been cleared from this browser.')
      return
    }
    if (!session?.access_token) {
      setStatus('signin')
      return
    }
    const attemptKey = `${session.user?.id || ''}:${claimToken}`
    if (attempted.current === attemptKey) return
    attempted.current = attemptKey
    let active = true
    setStatus('claiming')
    setError('')
    claimComplimentaryAccess(claimToken, { token: session.access_token })
      .then((claimed) => {
        if (!active) return
        window.sessionStorage.removeItem(PENDING_CLAIM_KEY)
        setResult(claimed)
        setStatus('claimed')
      })
      .catch((claimError) => {
        if (!active) return
        setError(claimError.message || 'This complimentary invitation could not be claimed.')
        setStatus('error')
      })
    return () => { active = false }
  }, [claimToken, loading, session?.access_token, session?.user?.id])

  const switchAccount = async () => {
    attempted.current = ''
    await signOut()
    openAuth()
  }

  return (
    <div className="complimentary-claim-page">
      <Seo
        title="Claim complimentary access | Runway Systems"
        description="Securely claim complimentary Runway Systems product access."
        canonicalPath="/claim"
        noindex
      />
      <header className="portal-header">
        <Logo />
        <div className="portal-header-actions">
          <Link to="/" className="portal-home-link"><ArrowLeft size={15} /> Runway Systems</Link>
          <AccountButton />
        </div>
      </header>
      <main className="complimentary-claim-main">
        <section className="complimentary-claim-card" aria-live="polite">
          <span className="complimentary-claim-icon"><Gift /></span>
          {loading || status === 'waiting' || status === 'claiming' ? (
            <>
              <p className="eyebrow">SECURE COMPLIMENTARY ACCESS</p>
              <h1>{status === 'claiming' ? 'Verifying your invitation…' : 'Checking your account…'}</h1>
              <p>The backend is matching this one-time invitation to your verified Google account.</p>
              <RefreshCw className="spin complimentary-claim-spinner" />
            </>
          ) : status === 'signin' ? (
            <>
              <p className="eyebrow">PRIVATE INVITATION</p>
              <h1>Sign in to claim your products.</h1>
              <p>Use the exact Google email address that received the invitation. No payment is required.</p>
              <button className="google-auth-button" type="button" onClick={openAuth}>Continue with Google</button>
              <div className="complimentary-claim-security"><ShieldCheck /><span>The email contains no Google Sheets delivery URL. Access is released only after server-side identity verification.</span></div>
            </>
          ) : status === 'claimed' ? (
            <>
              <CheckCircle2 className="complimentary-claim-success" />
              <p className="eyebrow">ACCESS ACTIVATED</p>
              <h1>Your products are ready.</h1>
              <p>The invitation link has now expired. Your complimentary products remain available in the protected account library for {profile?.email || 'your verified account'}.</p>
              <div className="complimentary-claimed-products">
                {(result?.products || []).map((purchase) => <span key={purchase.id}>{purchase.product?.name || purchase.productKey}</span>)}
              </div>
              <Link className="button primary" to="/account">Open my product library <ArrowRight size={16} /></Link>
              <small>By claiming, you accepted the Runway Systems Terms and Privacy Policy. Complimentary access does not subscribe you to marketing.</small>
            </>
          ) : (
            <>
              <p className="eyebrow">INVITATION NEEDS ATTENTION</p>
              <h1>We could not activate this invitation.</h1>
              <p>{error}</p>
              {session?.access_token ? (
                <button className="button primary" type="button" onClick={switchAccount}>Switch Google account</button>
              ) : (
                <button className="google-auth-button" type="button" onClick={openAuth}>Sign in with the invited email</button>
              )}
              <Link className="button text" to="/">Return to the storefront</Link>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
