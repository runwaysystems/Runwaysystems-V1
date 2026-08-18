import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LockKeyhole, X } from 'lucide-react'

// Explicit purchase consent, shown immediately above every checkout button.
//
// Digital goods are non-refundable once accessed, so the buyer has to actively
// tick this rather than be opted in: an unticked box by default is what makes
// the agreement meaningful, and UK/EU consumer rules expect the loss of the
// cancellation right to be acknowledged before payment, not buried in a
// footer link. The checkbox gates the button, and the Worker still enforces
// everything server-side regardless of what the browser sends.
export default function CheckoutConsent({ id = 'checkout-consent', checked, onChange, disabled = false }) {
  return (
    <label className="checkout-consent" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        I agree to the <Link to="/terms#terms">Terms</Link>, <Link to="/terms#privacy">Privacy Policy</Link>{' '}
        and <Link to="/terms#refunds">Refund Policy</Link>, and I understand these are digital products
        delivered instantly, so my right to cancel ends once I access my copy.
      </span>
    </label>
  )
}

// Confirm step for the product page, whose buy buttons skip the cart. Wraps
// the same consent control so the wording can never drift between the two
// paths. Consent resets whenever the dialog reopens.
export function CheckoutConsentModal({ open, productName, price, onCancel, onConfirm }) {
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (open) setChecked(false)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="checkout-modal checkout-consent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onCancel} aria-label="Cancel checkout"><X size={18} /></button>
        <span className="modal-icon"><LockKeyhole size={21} /></span>
        <p className="eyebrow">BEFORE YOU PAY</p>
        <h2 id="consent-title">{productName}{price ? ` — ${price}` : ''}</h2>
        <p>One-time payment. Lemon Squeezy processes it as merchant of record and handles sales tax.</p>
        <CheckoutConsent id="consent-modal-check" checked={checked} onChange={setChecked} />
        <div className="product-editor-actions">
          <button className="button text" type="button" onClick={onCancel}>Cancel</button>
          <button className="button button--lime" type="button" disabled={!checked} onClick={onConfirm}>
            Agree and continue
          </button>
        </div>
      </div>
    </div>
  )
}
