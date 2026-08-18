import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, CheckCircle2, ExternalLink, LockKeyhole, MessageSquareText, Send, Star } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { getPublicConfig, submitFeedback, submitTestimonial, verifyFeedbackAccess } from '../api/platformApi'
import { AccountButton } from '../components/AuthUI'
import { Logo } from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import Seo from '../components/Seo'

function PortalHeader() {
  return (
    <header className="portal-header">
      <Logo />
      <div className="portal-header-actions">
        <Link to="/account" className="portal-home-link"><ArrowLeft size={15} /> Account library</Link>
        <AccountButton />
      </div>
    </header>
  )
}

function RatingPicker({ value, onChange }) {
  return (
    <fieldset className="rating-picker">
      <legend>Choose a rating</legend>
      <div className="rating-buttons">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            className={value === rating ? 'is-selected' : ''}
            type="button"
            onClick={() => onChange(rating)}
            aria-label={`${rating} out of 5 stars`}
            aria-pressed={value === rating}
          >
            <Star fill={value >= rating ? 'currentColor' : 'none'} aria-hidden="true" />
            <span>{rating}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export default function FeedbackPage() {
  const { session, profile, loading: authLoading, openAuth } = useAuth()
  const [searchParams] = useSearchParams()
  const feedbackToken = searchParams.get('token') || ''
  const [accessState, setAccessState] = useState('checking')
  const [productName, setProductName] = useState('')
  const [stage, setStage] = useState('choice')
  const [rating, setRating] = useState(0)
  const [privateText, setPrivateText] = useState('')
  const [name, setName] = useState(profile?.name || '')
  const [testimonialText, setTestimonialText] = useState('')
  const [trustpilotUrl, setTrustpilotUrl] = useState('https://www.trustpilot.com/review/your-domain.com')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getPublicConfig().then((config) => {
      if (config?.trustpilotBusinessUrl) setTrustpilotUrl(config.trustpilotBusinessUrl)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (profile?.name && !name) setName(profile.name)
  }, [profile, name])

  useEffect(() => {
    let active = true
    if (authLoading) return undefined
    if (!feedbackToken) {
      setAccessState('invalid')
      return undefined
    }
    if (!session?.access_token) {
      setAccessState('signin')
      return undefined
    }

    setAccessState('checking')
    verifyFeedbackAccess(feedbackToken, { token: session.access_token })
      .then((access) => {
        if (!active) return
        if (access?.productName) setProductName(access.productName)
        setAccessState('ready')
      })
      .catch((error) => {
        if (!active) return
        setMessage(error.message || 'This feedback link could not be verified.')
        setAccessState('invalid')
      })
    return () => { active = false }
  }, [authLoading, feedbackToken, session?.access_token])

  const ratingLabel = useMemo(() => {
    if (!rating) return 'Select the number that best matches your experience.'
    return ['Very difficult', 'Needs work', 'It is okay', 'Working well', 'Excellent'][rating - 1]
  }, [rating])

  const sendPrivateFeedback = async (event) => {
    event.preventDefault()
    if (!rating || !privateText.trim()) return
    setSubmitting(true)
    setMessage('')
    try {
      await submitFeedback({ rating, text: privateText, kind: 'private', feedbackToken }, { token: session.access_token })
      setStage('private-success')
    } catch (error) {
      setMessage(error.message || 'Your feedback could not be saved. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const sendTestimonial = async (event) => {
    event.preventDefault()
    if (!rating || !name.trim() || !testimonialText.trim()) return
    setSubmitting(true)
    setMessage('')
    try {
      await submitTestimonial({ name, rating, text: testimonialText, feedbackToken }, { token: session.access_token })
      setStage('testimonial-success')
    } catch (error) {
      setMessage(error.message || 'Your testimonial could not be saved. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const chooseStage = (nextStage) => {
    setRating(0)
    setMessage('')
    setStage(nextStage)
  }

  const renderAccessState = () => {
    if (accessState === 'checking') {
      return <div className="feedback-access-state" aria-live="polite"><span className="auth-spinner" /><h1>Verifying your invitation...</h1><p>We are checking the signed link against your purchase account.</p></div>
    }
    if (accessState === 'signin') {
      return <div className="feedback-access-state"><LockKeyhole /><p className="eyebrow">ACCOUNT CHECK</p><h1>Sign in to continue.</h1><p>This protects your invitation and confirms that feedback comes from a verified buyer.</p><button className="google-auth-button" type="button" onClick={openAuth}>Continue with Google</button></div>
    }
    if (accessState === 'invalid') {
      return <div className="feedback-access-state"><LockKeyhole /><p className="eyebrow">LINK NOT VERIFIED</p><h1>Open feedback from your account.</h1><p>The invitation may be invalid or expired. Your protected library can create a fresh signed link.</p><Link className="button primary" to="/account">Open account library</Link></div>
    }
    return null
  }

  return (
    <div className="portal-page feedback-page">
      <Seo
        title="Share your experience | Runway Systems"
        description="Runway Systems account area. Google Sheets products for independent business."
        canonicalPath={window.location.pathname}
        noindex
      />
      <PortalHeader />
      <main className="feedback-main">
        <div className="feedback-orbit orbit-one" aria-hidden="true" />
        <div className="feedback-orbit orbit-two" aria-hidden="true" />
        <section className="feedback-panel">
          {accessState !== 'ready' ? renderAccessState() : (
            <>
              <div className="feedback-progress" aria-hidden="true">
                <span className="is-active" />
                <span className={stage !== 'choice' ? 'is-active' : ''} />
                <span className={stage.includes('success') ? 'is-active' : ''} />
              </div>

              {stage === 'choice' && (
                <>
                  <p className="eyebrow">VERIFIED BUYER CHECK-IN</p>
                  <h1>Share what is true for you.</h1>
                  <p className="feedback-lead">Every verified buyer receives the same neutral invitation. Choose an independent Trustpilot review, a private note to our team, or an optional on-site testimonial.</p>
                  <div className="feedback-choice-grid">
                    <a className="feedback-choice feedback-choice--trustpilot" href={trustpilotUrl} target="_blank" rel="noopener noreferrer">
                      <span><ExternalLink /></span><strong>Independent Trustpilot review</strong><small>Share your honest experience on Trustpilot, regardless of rating.</small><b>Open Trustpilot <ArrowUpRight /></b>
                    </a>
                    <button className="feedback-choice" type="button" onClick={() => chooseStage('private')}>
                      <span><LockKeyhole /></span><strong>Private feedback</strong><small>Send a direct note to Runway Systems. It will never be published.</small><b>Write privately <ArrowUpRight /></b>
                    </button>
                    <button className="feedback-choice" type="button" onClick={() => chooseStage('testimonial')}>
                      <span><MessageSquareText /></span><strong>On-site testimonial</strong><small>Submit a story for moderation before it can appear publicly.</small><b>Share a story <ArrowUpRight /></b>
                    </button>
                  </div>
                </>
              )}

              {stage === 'private' && (
                <form className="private-feedback-form" onSubmit={sendPrivateFeedback}>
                  <span className="feedback-route-icon private"><LockKeyhole /></span>
                  <p className="eyebrow">PRIVATE CHANNEL</p>
                  <h1>Tell us what would make it better.</h1>
                  <p className="feedback-lead">This goes directly to Runway Systems and will never be published as a testimonial.</p>
                  <RatingPicker value={rating} onChange={setRating} />
                  <p className="rating-description" aria-live="polite">{ratingLabel}</p>
                  <label className="portal-field">
                    <span>Private feedback</span>
                    <textarea value={privateText} onChange={(event) => setPrivateText(event.target.value)} rows="6" required maxLength="2500" placeholder="What felt useful, unclear, or different from what you expected?" />
                  </label>
                  <div className="feedback-form-actions">
                    <button className="button text" type="button" onClick={() => setStage('choice')}>Back to choices</button>
                    <button className="button primary" type="submit" disabled={submitting || !rating || !privateText.trim()}>
                      <Send size={15} /> {submitting ? 'Sending...' : 'Send privately'}
                    </button>
                  </div>
                </form>
              )}

              {stage === 'testimonial' && (
                <form className="testimonial-form" onSubmit={sendTestimonial}>
                  <span className="feedback-route-icon positive"><MessageSquareText /></span>
                  <p className="eyebrow">OPTIONAL TESTIMONIAL</p>
                  <h1>Share your {productName || 'product'} story.</h1>
                  <p className="feedback-lead">All ratings are welcome. Nothing appears publicly until Runway Systems approves it.</p>
                  <RatingPicker value={rating} onChange={setRating} />
                  <p className="rating-description" aria-live="polite">{ratingLabel}</p>
                  <div className="portal-field-row">
                    <label className="portal-field">
                      <span>Name</span>
                      <input value={name} onChange={(event) => setName(event.target.value)} required maxLength="80" placeholder="Your name" />
                    </label>
                  </div>
                  <label className="portal-field">
                    <span>Testimonial</span>
                    <textarea value={testimonialText} onChange={(event) => setTestimonialText(event.target.value)} rows="5" required maxLength="1800" placeholder="What changed once you could see your numbers clearly?" />
                  </label>
                  <p className="pending-note"><LockKeyhole size={13} /> Submissions stay pending until approved by Runway Systems.</p>
                  <div className="feedback-form-actions">
                    <button className="button text" type="button" onClick={() => setStage('choice')}>Back to choices</button>
                    <button className="button primary" type="submit" disabled={submitting || !rating || !name.trim() || !testimonialText.trim()}>
                      <Send size={15} /> {submitting ? 'Submitting...' : 'Submit testimonial'}
                    </button>
                  </div>
                </form>
              )}

              {stage === 'private-success' && (
                <div className="feedback-success">
                  <span className="feedback-route-icon positive"><CheckCircle2 /></span>
                  <p className="eyebrow">RECEIVED PRIVATELY</p>
                  <h1>Thank you for being direct.</h1>
                  <p className="feedback-lead">Your note is saved for the Runway Systems team. It will not appear publicly.</p>
                  <Link className="button primary" to="/account">Return to your library</Link>
                </div>
              )}

              {stage === 'testimonial-success' && (
                <div className="feedback-success">
                  <span className="feedback-route-icon positive"><CheckCircle2 /></span>
                  <p className="eyebrow">PENDING REVIEW</p>
                  <h1>Your story is in the queue.</h1>
                  <p className="feedback-lead">We will review it before it can appear on the storefront. Thank you for helping other owners.</p>
                  <Link className="button primary" to="/account">Return to your library</Link>
                </div>
              )}
            </>
          )}
          {message && <p className="portal-error" role="alert">{message}</p>}
        </section>
      </main>
    </div>
  )
}
