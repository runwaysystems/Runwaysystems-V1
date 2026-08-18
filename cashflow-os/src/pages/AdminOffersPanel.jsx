import { useState } from 'react'
import { BadgePercent, Save } from 'lucide-react'

const cx = (...classes) => classes.filter(Boolean).join(' ')

const offerPatchFromProduct = (product) => ({
  offerActive: Boolean(product.offerActive),
  offerLabel: product.offerLabel || '',
  originalPrice: product.originalPrice || '',
  salePrice: product.salePrice || '',
})

function OfferRow({ product, onSave, saving }) {
  const [form, setForm] = useState(() => offerPatchFromProduct(product))
  const dirty = JSON.stringify(form) !== JSON.stringify(offerPatchFromProduct(product))

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <article className="offer-admin-row">
      <span className={`product-admin-icon is-${product.accent}`} aria-hidden="true">
        {product.icon === 'spreadsheet' ? '▦' : product.icon === 'users' ? '◎' : product.icon === 'gauge' ? '◔' : product.icon === 'receipt' ? '▤' : '▣'}
      </span>
      <div className="offer-admin-identity">
        <strong>{product.name}</strong>
        <small>/{product.key} · {form.offerActive ? 'offer running' : 'no offer'}</small>
      </div>
      <div className="offer-admin-prices">
        {form.offerActive && <s>{form.originalPrice}</s>}
        <b>{form.salePrice || 'Unpriced'}</b>
      </div>
      <label className="toggle-setting offer-admin-toggle">
        <span><b>Offer active</b><small>Ribbon and struck-through original price.</small></span>
        <input type="checkbox" checked={form.offerActive} onChange={(event) => update('offerActive', event.target.checked)} />
        <i aria-hidden="true" />
      </label>
      <div className="offer-admin-fields">
        <input maxLength="80" value={form.offerLabel} onChange={(event) => update('offerLabel', event.target.value)} placeholder="Offer label (e.g. Launch Offer)" aria-label={`${product.name} offer label`} />
        <input maxLength="32" value={form.originalPrice} onChange={(event) => update('originalPrice', event.target.value)} placeholder="$69" aria-label={`${product.name} original price`} />
        <input maxLength="32" value={form.salePrice} onChange={(event) => update('salePrice', event.target.value)} placeholder="$39" aria-label={`${product.name} sale price`} />
      </div>
      <button className="button primary button--small" type="button" disabled={!dirty || saving} onClick={() => onSave(form)}>
        <Save size={13} /> {saving ? 'Saving...' : 'Save'}
      </button>
    </article>
  )
}

export default function AdminOffersPanel({ products, settings, onSaveProductOffer, onSaveDefaultOffer, savingKey }) {
  const [defaultForm, setDefaultForm] = useState(() => ({
    offerActive: Boolean(settings?.defaultOffer?.offerActive),
    offerLabel: settings?.defaultOffer?.offerLabel || '',
    displayOriginalPrice: settings?.defaultOffer?.displayOriginalPrice || '',
    displaySalePrice: settings?.defaultOffer?.displaySalePrice || '',
  }))
  const defaultDirty = JSON.stringify(defaultForm) !== JSON.stringify({
    offerActive: Boolean(settings?.defaultOffer?.offerActive),
    offerLabel: settings?.defaultOffer?.offerLabel || '',
    displayOriginalPrice: settings?.defaultOffer?.displayOriginalPrice || '',
    displaySalePrice: settings?.defaultOffer?.displaySalePrice || '',
  })

  const updateDefault = (key, value) => setDefaultForm((current) => ({ ...current, [key]: value }))

  return (
    <section className="admin-section-card" id="offers">
      <header className="admin-section-head">
        <div><span className="eyebrow">OFFERS & PRICING</span><h2>Offers</h2></div>
        <BadgePercent size={20} />
      </header>

      <div className="offer-default-card">
        <div className="offer-default-card__copy">
          <p className="eyebrow">DEFAULT OFFER FOR NEW PRODUCTS</p>
          <p>Every product you create in the future starts with this offer. You can still change each product individually above or from its editor.</p>
        </div>
        <div className="offer-admin-fields">
          <input maxLength="80" value={defaultForm.offerLabel} onChange={(event) => updateDefault('offerLabel', event.target.value)} placeholder="Launch Offer" aria-label="Default offer label" />
          <input maxLength="32" value={defaultForm.displayOriginalPrice} onChange={(event) => updateDefault('displayOriginalPrice', event.target.value)} placeholder="$69" aria-label="Default original price" />
          <input maxLength="32" value={defaultForm.displaySalePrice} onChange={(event) => updateDefault('displaySalePrice', event.target.value)} placeholder="$39" aria-label="Default sale price" />
        </div>
        <label className="toggle-setting offer-admin-toggle">
          <span><b>Enabled by default</b><small>New products ship with the offer ribbon on.</small></span>
          <input type="checkbox" checked={defaultForm.offerActive} onChange={(event) => updateDefault('offerActive', event.target.checked)} />
          <i aria-hidden="true" />
        </label>
        <button className="button primary button--small" type="button" disabled={!defaultDirty || savingKey === 'default-offer'} onClick={() => onSaveDefaultOffer(defaultForm)}>
          <Save size={13} /> {savingKey === 'default-offer' ? 'Saving...' : 'Save default offer'}
        </button>
      </div>

      <div className="offer-admin-list">
        {products.map((product) => (
          <OfferRow
            key={product.key}
            product={product}
            onSave={(patch) => onSaveProductOffer(product.key, patch)}
            saving={savingKey === `offer:${product.key}`}
          />
        ))}
        {!products.length && <p className="table-empty">No products yet. Create one first.</p>}
      </div>
    </section>
  )
}
