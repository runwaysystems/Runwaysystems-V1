import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Gift, Mail, RefreshCw, RotateCcw, Send, ShieldCheck, Star, UserCheck, XCircle } from 'lucide-react'
import {
  cancelAdminComplimentaryGrant,
  createAdminComplimentaryGrant,
  getAdminComplimentaryGrants,
  resendAdminComplimentaryGrant,
  revokeAdminComplimentaryGrant,
  sendComplimentaryReviewInvite,
} from '../api/platformApi'

function formatDate(value) {
  if (!value) return 'Not yet'
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function statusLabel(status) {
  return {
    pending: 'Pending claim',
    claimed: 'Active',
    cancelled: 'Cancelled',
    expired: 'Expired',
    revoked: 'Revoked',
  }[status] || status
}

export default function AdminComplimentaryAccess({ products, notify, authOptions }) {
  const [data, setData] = useState({ grants: [], stats: { total: 0, pending: 0, claimed: 0, revoked: 0 } })
  const [email, setEmail] = useState('')
  const [selected, setSelected] = useState([])
  const [idempotencyKey, setIdempotencyKey] = useState(() => `complimentary:${crypto.randomUUID()}`)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')

  // This is derived from the live admin catalog rather than a hardcoded list,
  // so newly published products appear immediately and products moved to
  // coming-soon/hidden disappear from the grant selector.
  const availableProducts = useMemo(() => (products || [])
    .filter((product) => (product.status || (product.active === false ? 'hidden' : 'active')) === 'active' && product.active !== false)
    .map((product) => ({
      ...product,
      deliveryConfigured: product.deliveryConfigured ?? Boolean(product.deliveryUrl),
    })), [products])

  useEffect(() => {
    const currentlyAvailable = new Set(availableProducts.map((product) => product.key))
    setSelected((current) => {
      const next = current.filter((key) => currentlyAvailable.has(key))
      return next.length === current.length ? current : next
    })
  }, [availableProducts])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await getAdminComplimentaryGrants({}, authOptions))
    } catch (loadError) {
      setError(loadError.message || 'Complimentary access history could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [authOptions])

  useEffect(() => { load() }, [load])

  const toggleProduct = (productKey) => {
    setIdempotencyKey(`complimentary:${crypto.randomUUID()}`)
    setSelected((current) => current.includes(productKey)
      ? current.filter((key) => key !== productKey)
      : [...current, productKey])
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!selected.length) {
      setError('Select at least one configured product.')
      return
    }
    setSending(true)
    setError('')
    try {
      const result = await createAdminComplimentaryGrant({
        email: email.trim().toLowerCase(),
        productKeys: selected,
        idempotencyKey,
      }, authOptions)
      setEmail('')
      setSelected([])
      setIdempotencyKey(`complimentary:${crypto.randomUUID()}`)
      const skipped = result.skippedProductKeys?.length
        ? ` ${result.skippedProductKeys.length} already-owned or pending product(s) were skipped.`
        : ''
      notify?.(`Complimentary invitation queued for ${result.grant.recipientEmail}.${skipped}`)
      await load()
    } catch (sendError) {
      setError(sendError.message || 'The complimentary invitation could not be created.')
    } finally {
      setSending(false)
    }
  }

  const runAction = async (grant, action, confirmation, successMessage) => {
    if (confirmation && !window.confirm(confirmation)) return
    setWorkingId(`${action.name}:${grant.id}`)
    setError('')
    try {
      await action(grant.id, authOptions)
      notify?.(successMessage)
      await load()
    } catch (actionError) {
      setError(actionError.message || 'The complimentary access action failed.')
    } finally {
      setWorkingId('')
    }
  }

  return (
    <section className="admin-section-card complimentary-panel" id="complimentary">
      <header className="admin-section-head">
        <div><span className="eyebrow">ZERO-COST CUSTOMER ACCESS</span><h2>Complimentary access</h2></div>
        <Gift size={20} />
      </header>
      <p className="admin-section-hint">
        Invite an exact email to claim one or more products without checkout. The email contains a one-time claim link, never a Google Sheets URL. Complimentary customers stay separate from paid revenue and marketing consent.
      </p>

      <div className="complimentary-stats" aria-label="Complimentary access summary">
        <div><Gift /><strong>{data.stats.total}</strong><span>Total invitations</span></div>
        <div><Mail /><strong>{data.stats.pending}</strong><span>Pending claim</span></div>
        <div><UserCheck /><strong>{data.stats.claimed}</strong><span>Active customers</span></div>
        <div><XCircle /><strong>{data.stats.revoked}</strong><span>Revoked</span></div>
      </div>

      <form className="complimentary-form" onSubmit={submit}>
        <div className="complimentary-email-field">
          <label htmlFor="complimentary-recipient">Recipient email</label>
          <input
            id="complimentary-recipient"
            type="email"
            maxLength="254"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setIdempotencyKey(`complimentary:${crypto.randomUUID()}`)
            }}
            placeholder="friend@example.com"
          />
          <small>The recipient must sign in with this exact verified address.</small>
        </div>
        <fieldset className="complimentary-products">
          <legend>Select active products</legend>
          <small className="complimentary-products-note">Future products appear here automatically when their status is set to Active.</small>
          <div>
            {availableProducts.length === 0 && <p className="table-empty">No active products are available. Publish a product first.</p>}
            {availableProducts.map((product) => (
              <label className={!product.deliveryConfigured ? 'is-disabled' : ''} key={product.key}>
                <input
                  type="checkbox"
                  checked={selected.includes(product.key)}
                  disabled={!product.deliveryConfigured}
                  onChange={() => toggleProduct(product.key)}
                />
                <span><b>{product.name}</b><small>{product.deliveryConfigured ? `${product.status || 'active'} · delivery ready` : 'Delivery link must be configured first'}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="complimentary-send-row">
          <p><ShieldCheck size={15} /> Requires your active admin security challenge.</p>
          <button className="button primary" type="submit" disabled={sending || !email || !selected.length}>
            {sending ? <RefreshCw className="spin" size={15} /> : <Send size={15} />}
            {sending ? 'Queueing invitation…' : 'Send complimentary access'}
          </button>
        </div>
      </form>

      {error && <div className="admin-inline-error" role="alert">{error}</div>}

      <div className="complimentary-history-head">
        <div><h3>Invitation history</h3><p>Pending invitations expire after seven days. Resending rotates and invalidates the old link.</p></div>
        <button className="button text" type="button" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      </div>

      {loading ? (
        <div className="admin-loading-inline" role="status"><RefreshCw className="spin" /> Loading complimentary customers…</div>
      ) : data.grants.length === 0 ? (
        <p className="table-empty">No complimentary invitations yet.</p>
      ) : (
        <div className="complimentary-table-wrap">
          <table className="admin-table complimentary-table">
            <thead><tr><th>Recipient</th><th>Products</th><th>Access</th><th>Email</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {data.grants.map((grant) => (
                <tr key={grant.id}>
                  <td data-label="Recipient"><strong>{grant.recipientEmail}</strong>{grant.claimedAt && <small>Claimed {formatDate(grant.claimedAt)}</small>}</td>
                  <td data-label="Products"><div className="complimentary-product-tags">{grant.products.map((product) => <span key={product.productKey}>{product.productName}</span>)}</div></td>
                  <td data-label="Access"><span className={`complimentary-status is-${grant.status}`}>{statusLabel(grant.status)}</span></td>
                  <td data-label="Email"><span className={`complimentary-email-status is-${grant.emailStatus}`}>{grant.emailStatus}</span>{grant.emailLastError && <small>{grant.emailLastError}</small>}</td>
                  <td data-label="Created"><span>{formatDate(grant.createdAt)}</span>{grant.status === 'pending' && <small>Expires {formatDate(grant.tokenExpiresAt)}</small>}</td>
                  <td data-label="Actions">
                    <div className="complimentary-actions">
                      {['pending', 'expired'].includes(grant.status) && <button type="button" onClick={() => runAction(grant, resendAdminComplimentaryGrant, '', `A new invitation was queued for ${grant.recipientEmail}.`)} disabled={Boolean(workingId)}><RotateCcw size={13} /> Resend</button>}
                      {['pending', 'expired'].includes(grant.status) && <button className="is-danger" type="button" onClick={() => runAction(grant, cancelAdminComplimentaryGrant, `Cancel the invitation for ${grant.recipientEmail}?`, 'Complimentary invitation cancelled.')} disabled={Boolean(workingId)}><XCircle size={13} /> Cancel</button>}
                      {grant.status === 'claimed' && <button type="button" onClick={() => runAction(grant, sendComplimentaryReviewInvite, '', `Neutral review invitation queued for ${grant.recipientEmail}.`)} disabled={Boolean(workingId) || Boolean(grant.reviewInvitedAt)}><Star size={13} /> {grant.reviewInvitedAt ? 'Review invited' : 'Invite review'}</button>}
                      {grant.status === 'claimed' && <button className="is-danger" type="button" onClick={() => runAction(grant, revokeAdminComplimentaryGrant, `Revoke complimentary product access for ${grant.recipientEmail}? This does not affect any products they paid for.`, 'Complimentary access revoked.')} disabled={Boolean(workingId)}><XCircle size={13} /> Revoke</button>}
                      {['cancelled', 'revoked'].includes(grant.status) && <span className="complimentary-action-complete"><CheckCircle2 size={13} /> Closed</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
