import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { confirmBlogNewsletter } from '../api/platformApi'
import { Logo } from '../components/Brand'
import Seo from '../components/Seo'

const PENDING_KEY = 'runway.pending-newsletter-confirmation.v1'

function readToken() {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || ''
  if (token) {
    try { window.sessionStorage.setItem(PENDING_KEY, token) } catch { /* state below still keeps this tab usable */ }
    window.history.replaceState(null, '', '/newsletter/confirm')
    return token
  }
  try { return window.sessionStorage.getItem(PENDING_KEY) || '' } catch { return '' }
}

export default function NewsletterConfirmPage() {
  const [token] = useState(readToken)
  const [status, setStatus] = useState(token ? 'ready' : 'error')
  const [message, setMessage] = useState(token ? '' : 'This confirmation link is missing or has already been cleared from this browser.')

  const confirm = async () => {
    if (!token || status === 'confirming') return
    setStatus('confirming'); setMessage('')
    try {
      const result = await confirmBlogNewsletter(token)
      try { window.sessionStorage.removeItem(PENDING_KEY) } catch { /* token is already consumed server-side */ }
      setMessage(result.message || 'You are subscribed to Runway Systems Blog email updates.')
      setStatus('confirmed')
    } catch (error) {
      setMessage(error.message || 'This confirmation link could not be used.')
      setStatus('error')
    }
  }

  return (
    <div className="newsletter-confirm-page">
      <Seo title="Confirm Blog emails | Runway Systems" description="Confirm a request to receive Runway Systems Blog email updates." canonicalPath="/newsletter/confirm" noindex />
      <header className="portal-header"><Logo /><Link to="/blog" className="portal-home-link"><ArrowLeft /> Blog</Link></header>
      <main className="newsletter-confirm-main">
        <section className="newsletter-confirm-card" aria-live="polite">
          {status === 'confirmed' ? <CheckCircle2 className="newsletter-confirm-card__success" /> : <span className="newsletter-confirm-card__icon"><MailCheck /></span>}
          <p className="eyebrow">RUNWAY SYSTEMS BLOG · EMAIL UPDATES</p>
          {status === 'ready' && <><h1>Confirm your email updates.</h1><p>Confirm that you want occasional Runway Systems Blog articles. This action subscribes only this email address and can be reversed from any message.</p><button className="button primary" type="button" onClick={confirm}>Confirm subscription <ArrowRight /></button><div className="newsletter-confirm-security"><ShieldCheck /><span>The link is single-use. Merely opening this page does not subscribe you.</span></div></>}
          {status === 'confirming' && <><h1>Confirming your request…</h1><p>Securely adding your address to the consented Blog audience.</p><RefreshCw className="spin newsletter-confirm-spinner" /></>}
          {status === 'confirmed' && <><h1>You’re on the list.</h1><p>{message}</p><Link className="button primary" to="/blog">Read the latest articles <ArrowRight /></Link></>}
          {status === 'error' && <><h1>This link needs attention.</h1><p>{message}</p><Link className="button primary" to="/blog#blog-newsletter">Request a new confirmation</Link></>}
        </section>
      </main>
    </div>
  )
}
