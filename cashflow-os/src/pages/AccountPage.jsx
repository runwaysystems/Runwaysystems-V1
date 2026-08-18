import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, CheckCircle2, Mail, MessageSquareText, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { deleteAccount, getAccountPurchases, getPurchaseDelivery, getPurchaseFeedbackLink } from '../api/platformApi'
import { AccountButton } from '../components/AuthUI'
import { Logo } from '../components/Brand'
import { SUPPORT_EMAIL } from '../components/StorefrontShell'
import { sectionIcon } from '../components/ProductSections'
import { friendlyName } from '../data/catalog'
import { useAuth } from '../context/AuthContext'
import Seo from '../components/Seo'

function PortalHeader() {
  return (
    <header className="portal-header">
      <Logo />
      <div className="portal-header-actions">
        <Link to="/" className="portal-home-link"><ArrowLeft size={15} /> Runway Systems</Link>
        <AccountButton />
      </div>
    </header>
  )
}

function formatAmount(cents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
    maximumFractionDigits: 2,
  }).format(Number(cents || 0) / 100)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
}

export default function AccountPage() {
  const { session, profile, loading, openAuth, signOut } = useAuth()
  const [purchases, setPurchases] = useState([])
  const [fetching, setFetching] = useState(false)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const loadPurchases = useCallback(async () => {
    if (!session?.access_token) return
    setFetching(true)
    setError('')
    try {
      setPurchases(await getAccountPurchases({ token: session.access_token }))
    } catch (loadError) {
      setError(loadError.message || 'Your purchase library could not be loaded.')
    } finally {
      setFetching(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  const openDelivery = async (purchaseId) => {
    setWorkingId(`delivery:${purchaseId}`)
    setError('')
    try {
      const delivery = await getPurchaseDelivery(purchaseId, { token: session.access_token })
      if (!delivery?.url) throw new Error('The delivery link is temporarily unavailable.')
      window.location.assign(delivery.url)
    } catch (deliveryError) {
      setError(deliveryError.message || 'Your private copy could not be opened.')
      setWorkingId('')
    }
  }

  const confirmDelete = async () => {
    if (!session?.access_token) return
    setDeleting(true)
    setError('')
    try {
      await deleteAccount({ token: session.access_token })
      setDeleted(true)
      setPurchases([])
      setDeleteConfirm(false)
      await signOut()
    } catch (deleteError) {
      setError(deleteError.message || 'Your account data could not be deleted.')
    } finally {
      setDeleting(false)
    }
  }

  const openFeedback = async (purchaseId) => {
    setWorkingId(`feedback:${purchaseId}`)
    setError('')
    try {
      const destination = await getPurchaseFeedbackLink(purchaseId, { token: session.access_token })
      if (!destination?.url?.startsWith('/feedback?token=')) throw new Error('The feedback link could not be verified.')
      window.location.assign(destination.url)
    } catch (feedbackError) {
      setError(feedbackError.message || 'The feedback form could not be opened.')
      setWorkingId('')
    }
  }

  return (
    <div className="portal-page account-page">
      <Seo
        title="Account library | Runway Systems"
        description="Runway Systems account area. Google Sheets products for independent business."
        canonicalPath={window.location.pathname}
        noindex
      />
      <PortalHeader />
      <main className="account-main">
        <section className="account-hero">
          <p className="eyebrow">PROTECTED LIBRARY</p>
          <h1>Your systems, ready when you are.</h1>
          <p>Access is tied to the Google account used at checkout. Private delivery links are requested securely and are never stored in this website's frontend.</p>
        </section>

        {deleted ? (
          <section className="account-state account-deleted-state">
            <CheckCircle2 />
            <h2>Your storefront data has been deleted.</h2>
            <p>Purchases are detached from this account, testimonial text has been withdrawn, and your email address has been removed from our delivery and review records. Aggregate metrics remain anonymous.</p>
            <p className="account-deleted-note">To also remove your Google sign-in record from our authentication provider, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the connected address. Payment records are retained by Lemon Squeezy as required by financial regulations.</p>
            <Link className="button primary" to="/">Return to the storefront</Link>
          </section>
        ) : loading ? (
          <section className="account-state" aria-live="polite"><span className="auth-spinner" /> Checking your account...</section>
        ) : !profile ? (
          <section className="account-state account-signin-state">
            <ShieldCheck />
            <h2>Sign in to open your library.</h2>
            <p>Use the same Google account you used before checkout.</p>
            <button className="google-auth-button" type="button" onClick={openAuth}>Continue with Google</button>
          </section>
        ) : fetching ? (
          <section className="account-state" aria-live="polite"><span className="auth-spinner" /> Loading verified purchases...</section>
        ) : purchases.length === 0 ? (
          <section className="account-state account-empty-state">
            {(() => { const EmptyIcon = sectionIcon('spreadsheet'); return <span className="account-state-icon" aria-hidden="true"><EmptyIcon /></span> })()}
            <h2>No verified purchases yet.</h2>
            <p>If you just completed checkout, refresh after a few seconds while Lemon Squeezy confirms the payment.</p>
            <div className="account-state-actions">
              <button className="button button--dark" type="button" onClick={loadPurchases}><RefreshCw size={15} /> Refresh</button>
              <Link className="button primary" to="/">Browse products</Link>
            </div>
          </section>
        ) : (
          <section className="purchase-library" aria-label="Verified purchases">
            <div className="library-heading">
              <div><p className="eyebrow">VERIFIED PURCHASES</p><h2>{purchases.length} {purchases.length === 1 ? 'system' : 'systems'} in your library</h2></div>
              <button className="library-refresh" type="button" onClick={loadPurchases} disabled={fetching} aria-label="Refresh purchases"><RefreshCw size={16} /></button>
            </div>
            <div className="purchase-grid">
              {purchases.map((purchase) => {
                const productName = purchase.product?.name || friendlyName(purchase.productKey)
                const accent = purchase.product?.accent || 'lime'
                const ArtIcon = sectionIcon(purchase.product?.icon || 'spreadsheet')
                return (
                  <article className={`purchase-card purchase-card--${accent}`} key={purchase.id}>
                    <div className="purchase-art" aria-hidden="true"><ArtIcon /><span>{productName.toUpperCase()}</span><i /></div>
                    <div className="purchase-details">
                      <div className="purchase-kicker"><CheckCircle2 size={14} /> Payment verified</div>
                      <h3>{productName}</h3>
                      <p className="purchase-meta">Purchased {formatDate(purchase.createdAt)} · {formatAmount(purchase.amountTotal, purchase.currency)}</p>
                      <p className="purchase-delivery-status"><Mail size={14} /> Delivery email {purchase.deliveryEmailStatus === 'sent' ? 'sent' : 'is being prepared'}</p>
                      <div className="purchase-actions">
                        <button className="button primary" type="button" onClick={() => openDelivery(purchase.id)} disabled={Boolean(workingId)}>
                          {workingId === `delivery:${purchase.id}` ? 'Verifying...' : 'Create private Google Sheets copy'} <ArrowUpRight size={15} />
                        </button>
                        <button className="button text" type="button" onClick={() => openFeedback(purchase.id)} disabled={Boolean(workingId)}>
                          <MessageSquareText size={15} /> {workingId === `feedback:${purchase.id}` ? 'Preparing...' : 'Share feedback'}
                        </button>
                      </div>
                      <small>Google Sheets only. Do not open in Excel or other spreadsheet software.</small>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {!deleted && profile && (
          <section className="account-danger-zone" aria-label="Data and privacy">
            <div className="account-danger-zone__copy">
              <p className="eyebrow">DATA & PRIVACY</p>
              <h2>Delete your storefront data</h2>
              <p>Removes your email and name from purchases and review records, withdraws testimonials, and detaches your library access. This cannot be undone.</p>
            </div>
            <div className="account-danger-zone__actions">
              {deleteConfirm ? (
                <>
                  <span>Are you sure? Everything listed above is removed permanently.</span>
                  <button className="button text" type="button" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Cancel</button>
                  <button className="button button--danger" type="button" onClick={confirmDelete} disabled={deleting}>
                    <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Yes, delete everything'}
                  </button>
                </>
              ) : (
                <button className="button button--danger" type="button" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 size={14} /> Delete my account data
                </button>
              )}
            </div>
          </section>
        )}

        {error && <p className="portal-error account-error" role="alert">{error}</p>}
      </main>
    </div>
  )
}
