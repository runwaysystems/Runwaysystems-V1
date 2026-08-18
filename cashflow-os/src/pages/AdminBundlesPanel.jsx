import { useMemo, useState } from 'react'
import { Layers, Package, Percent, Save, Trash2, X } from 'lucide-react'

const cx = (...values) => values.filter(Boolean).join(' ')

const emptyDraft = () => ({
  isNew: true,
  key: '',
  name: '',
  tagline: '',
  productKeys: [],
  discountPercent: 20,
  lemonVariantId: '',
  active: true,
  sortOrder: 0,
})

const draftFromBundle = (bundle) => ({
  isNew: false,
  key: bundle.key,
  name: bundle.name || '',
  tagline: bundle.tagline || '',
  productKeys: [...(bundle.productKeys || [])],
  discountPercent: Number(bundle.discountPercent) || 0,
  lemonVariantId: bundle.lemonVariantId || '',
  active: bundle.active !== false,
  sortOrder: Number(bundle.sortOrder) || 0,
})

// Mirrors the Worker's pricing exactly so the owner sees the real number
// before saving. The Worker recomputes it at checkout regardless.
const toCents = (value) => {
  const match = String(value || '').replace(/,/g, '').match(/^[^\d]*(\d+)(?:\.(\d{1,2}))?/)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0') || 0)
}
const display = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export default function AdminBundlesPanel({ bundles, products, onSave, onDelete, savingKey, deletingKey }) {
  const [draft, setDraft] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const sellableProducts = useMemo(
    () => (products || []).filter((product) => product.active !== false),
    [products],
  )

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }))

  const toggleProduct = (key) => setDraft((current) => {
    const has = current.productKeys.includes(key)
    return { ...current, productKeys: has ? current.productKeys.filter((item) => item !== key) : [...current.productKeys, key] }
  })

  const pricing = useMemo(() => {
    if (!draft) return null
    const members = draft.productKeys
      .map((key) => sellableProducts.find((product) => product.key === key))
      .filter(Boolean)
    if (members.length < 2) return null
    let full = 0
    for (const member of members) {
      const cents = toCents(member.salePrice)
      if (cents === null) return { unpriced: member.name }
      full += cents
    }
    const bundleCents = Math.round(full * (100 - draft.discountPercent) / 100)
    return { full, bundleCents, saving: full - bundleCents }
  }, [draft, sellableProducts])

  const submit = (event) => {
    event.preventDefault()
    if (!draft.name.trim() || draft.productKeys.length < 2) return
    onSave({ ...draft, key: draft.isNew ? (draft.key.trim() || slugify(draft.name)) : draft.key })
    setDraft(null)
  }

  const confirmDelete = async () => {
    try {
      await onDelete(pendingDelete.key)
      setPendingDelete(null)
    } catch {
      // The dashboard notice reports the failure; keep the modal open.
    }
  }

  if (draft) {
    const busy = savingKey === (draft.key || 'new')
    return (
      <section className="admin-section-card" id="bundles">
        <header className="admin-section-head">
          <div><span className="eyebrow">CATALOG</span><h2>{draft.isNew ? 'New bundle' : `Edit ${draft.name || draft.key}`}</h2></div>
          <button className="button text button--small" type="button" onClick={() => setDraft(null)}>Back to bundles</button>
        </header>
        <form className="admin-settings-form" onSubmit={submit}>
          <fieldset className="admin-settings-group">
            <legend>Bundle details</legend>
            <p className="admin-settings-group-copy">
              A bundle sells two or more products together at a percentage off the sum of their prices.
              Because the discount is a percentage, the bundle price follows automatically whenever you change
              a member product&apos;s price.
            </p>
            <div className="admin-field-grid">
              <label className="portal-field">
                <span>Bundle name</span>
                <input maxLength="80" value={draft.name} required placeholder="Finance Starter" onChange={(event) => update('name', event.target.value)} />
              </label>
              <label className="portal-field">
                <span>URL key</span>
                <input
                  maxLength="60"
                  value={draft.isNew ? draft.key : draft.key}
                  disabled={!draft.isNew}
                  placeholder={slugify(draft.name) || 'finance-starter'}
                  onChange={(event) => update('key', slugify(event.target.value))}
                />
              </label>
              <label className="portal-field">
                <span>Discount percent</span>
                <input type="number" min="1" max="90" value={draft.discountPercent} onChange={(event) => update('discountPercent', Number(event.target.value) || 0)} />
              </label>
              <label className="portal-field">
                <span>Lemon Squeezy variant ID (optional)</span>
                <input maxLength="20" value={draft.lemonVariantId} placeholder="12345" onChange={(event) => update('lemonVariantId', event.target.value)} />
              </label>
              <label className="portal-toggle">
                <span>Visible on the storefront</span>
                <input type="checkbox" checked={draft.active} onChange={(event) => update('active', event.target.checked)} />
                <i aria-hidden="true" />
              </label>
              <label className="portal-field">
                <span>Sort order</span>
                <input type="number" min="0" max="999" value={draft.sortOrder} onChange={(event) => update('sortOrder', Number(event.target.value) || 0)} />
              </label>
            </div>
            <label className="portal-field admin-wide-field">
              <span>Tagline</span>
              <input maxLength="200" value={draft.tagline} placeholder="Everything you need to invoice and forecast." onChange={(event) => update('tagline', event.target.value)} />
            </label>
          </fieldset>

          <fieldset className="admin-settings-group">
            <legend>Products in this bundle</legend>
            <p className="admin-settings-group-copy">Pick at least two. Buyers receive every product listed here in one payment.</p>
            <div className="bundle-picker">
              {sellableProducts.map((product) => (
                <label key={product.key} className={cx('bundle-picker__item', draft.productKeys.includes(product.key) && 'is-selected')}>
                  <input type="checkbox" checked={draft.productKeys.includes(product.key)} onChange={() => toggleProduct(product.key)} />
                  <span className="bundle-picker__name">{product.name}</span>
                  <span className="bundle-picker__price">{product.salePrice || 'Unpriced'}</span>
                </label>
              ))}
              {!sellableProducts.length && <p className="table-empty">No active products to bundle yet.</p>}
            </div>

            {pricing?.unpriced && (
              <p className="bundle-price-preview is-warning">
                {pricing.unpriced} has no sale price, so this bundle cannot be sold until that is set.
              </p>
            )}
            {pricing && !pricing.unpriced && (
              <div className="bundle-price-preview">
                <div><span>Sum of products</span><s>{display(pricing.full)}</s></div>
                <div><span>Bundle price</span><strong>{display(pricing.bundleCents)}</strong></div>
                <div><span>Customer saves</span><b>{display(pricing.saving)} ({draft.discountPercent}%)</b></div>
              </div>
            )}
            {draft.productKeys.length < 2 && <p className="bundle-price-preview is-warning">Select at least two products to see the bundle price.</p>}
          </fieldset>

          <div className="admin-settings-footer">
            <p><Percent size={14} /> The discount is applied by the Worker at checkout, never by the browser.</p>
            <div className="product-editor-actions">
              <button className="button text" type="button" onClick={() => setDraft(null)}>Cancel</button>
              <button className="button primary" type="submit" disabled={busy || !draft.name.trim() || draft.productKeys.length < 2}>
                <Save size={15} /> {busy ? 'Saving...' : draft.isNew ? 'Create bundle' : 'Save bundle'}
              </button>
            </div>
          </div>
        </form>
      </section>
    )
  }

  return (
    <section className="admin-section-card" id="bundles">
      <header className="admin-section-head">
        <div><span className="eyebrow">CATALOG</span><h2>Bundles</h2></div>
        <button className="button primary button--small" type="button" onClick={() => setDraft(emptyDraft())}>Add bundle</button>
      </header>
      <div className="product-admin-list">
        {(bundles || []).map((bundle) => (
          <article className="product-admin-row" key={bundle.key}>
            <span className="product-admin-icon is-violet" aria-hidden="true"><Layers size={16} /></span>
            <div className="product-admin-identity">
              <strong>{bundle.name}</strong>
              <small>/{bundle.key} · {(bundle.productKeys || []).length} products</small>
            </div>
            <div className="product-admin-price"><b>{bundle.discountPercent}% off</b></div>
            <span className={`status-pill ${bundle.active ? 'status-approved' : 'status-pending'}`}>{bundle.active ? 'visible' : 'hidden'}</span>
            <button className="button text button--small" type="button" onClick={() => setDraft(draftFromBundle(bundle))}>Edit</button>
            <button
              className="button text button--small product-admin-delete"
              type="button"
              aria-label={`Delete ${bundle.name}`}
              disabled={deletingKey === bundle.key}
              onClick={() => setPendingDelete(bundle)}
            >
              <Trash2 size={13} /> {deletingKey === bundle.key ? 'Deleting...' : 'Delete'}
            </button>
          </article>
        ))}
        {!(bundles || []).length && (
          <p className="table-empty">
            No bundles yet. Create one to sell two or more products together at a discount.
          </p>
        )}
      </div>

      {pendingDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPendingDelete(null)}>
          <div className="checkout-modal admin-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-bundle-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setPendingDelete(null)} aria-label="Cancel deletion"><X size={18} /></button>
            <span className="modal-icon modal-icon--danger"><Package size={21} /></span>
            <p className="eyebrow">DELETE BUNDLE</p>
            <h2 id="delete-bundle-title">Delete {pendingDelete.name}?</h2>
            <p>This removes the bundle only. The products inside it are not affected and stay on sale individually.</p>
            <div className="product-editor-actions">
              <button className="button text" type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="button button--danger" type="button" disabled={deletingKey === pendingDelete.key} onClick={confirmDelete}>
                <Trash2 size={15} /> {deletingKey === pendingDelete.key ? 'Deleting...' : 'Delete bundle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
