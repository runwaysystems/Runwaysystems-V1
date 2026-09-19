import { useId, useState } from 'react'
import { ArrowRight, CheckCircle2, LoaderCircle, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { subscribeBlogNewsletter } from '../api/platformApi'

export default function NewsletterSignup({ source = 'site_footer' }) {
  const fieldId = useId()
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setMessage('')
    if (!consent) {
      setStatus('error')
      setMessage('Confirm that you want to receive Runway Systems Blog emails.')
      return
    }
    setStatus('submitting')
    try {
      const result = await subscribeBlogNewsletter({ email, consent, source, company })
      setStatus('pending')
      setMessage(result.message || 'Check your inbox to confirm your subscription.')
      setEmail('')
      setConsent(false)
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'The confirmation email could not be requested. Please try again.')
    }
  }

  return (
    <section className="footer-newsletter" id="blog-newsletter" aria-labelledby="footer-newsletter-title">
      <div className="shell footer-newsletter__inner">
        <div className="footer-newsletter__copy">
          <span><Mail /> RUNWAY SYSTEMS BLOG · EMAIL UPDATES</span>
          <h2 id="footer-newsletter-title">Useful ideas, sent only when they are ready.</h2>
          <p>Occasional articles on money, clients, projects, and calmer business operations. No content quota. No inbox clutter.</p>
        </div>
        {status === 'pending' ? (
          <div className="footer-newsletter__success" role="status" aria-live="polite">
            <CheckCircle2 />
            <div><strong>Check your inbox.</strong><p>{message}</p></div>
          </div>
        ) : (
          <form className="footer-newsletter__form" onSubmit={submit} noValidate>
            <label htmlFor={fieldId}>Email address</label>
            <div className="footer-newsletter__field">
              <input id={fieldId} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={status === 'submitting'} />
              <button type="submit" disabled={status === 'submitting' || !email.trim()}>{status === 'submitting' ? <LoaderCircle className="spin" /> : <>Get new articles <ArrowRight /></>}</button>
            </div>
            <label className="footer-newsletter__consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={status === 'submitting'} /><span>I agree to receive Runway Systems Blog emails. Unsubscribe at any time. <Link to="/terms#privacy">Privacy Policy</Link>.</span></label>
            <label className="footer-newsletter__honeypot" aria-hidden="true">Company<input tabIndex="-1" autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} /></label>
            <p className={status === 'error' ? 'footer-newsletter__message is-error' : 'footer-newsletter__message'} role={status === 'error' ? 'alert' : 'status'} aria-live="polite">{message || 'Double opt-in protects your address. The confirmation link expires after 48 hours.'}</p>
          </form>
        )}
      </div>
    </section>
  )
}
