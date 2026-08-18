import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Copy,
  Cloud,
  Eye,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MousePointerClick,
  Save,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import {
  IS_PREVIEW_DATA,
  createAdminBundle,
  createAdminProduct,
  createProductFeature,
  deleteAdminBundle,
  deleteAdminProduct,
  deleteProductFeature,
  getAdminBundles,
  getAdminProducts,
  getAdminSettings,
  getAnalytics,
  getIntegrationStatus,
  getTestimonials,
  updateAdminBundle,
  updateAdminProduct,
  updateAdminSettings,
  updateProductFeature,
  updateTestimonialStatus,
  uploadProductImage,
} from '../api/platformApi'
import { CATALOG_ORDER } from '../data/catalog'
import { processImageFile } from '../lib/imageProcessing'
import AdminBundlesPanel from './AdminBundlesPanel'
import ProductPreviewPane from './ProductPreviewPane'
import AdminContentPanel from './AdminContentPanel'
import AdminOffersPanel from './AdminOffersPanel'
import { AccountButton } from '../components/AuthUI'
import { Logo } from '../components/Brand'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Seo from '../components/Seo'

const metricConfig = [
  { key: 'totalSales', label: 'Sales', icon: ShoppingBag, format: (value) => value.toLocaleString() },
  { key: 'revenue', label: 'Revenue', icon: CircleDollarSign, format: (value) => `$${value.toLocaleString()}` },
  { key: 'conversionRate', label: 'Conversion', icon: MousePointerClick, format: (value) => `${value}%` },
  { key: 'pageViews', label: 'Page views', icon: Eye, format: (value) => value.toLocaleString() },
  { key: 'averageRating', label: 'Avg. rating', icon: Star, format: (value) => `${value} / 5` },
  { key: 'reviewSubmissionRate', label: 'Review rate', icon: BarChart3, format: (value) => `${value}%` },
]

function AdminLoading() {
  return (
    <div className="admin-route-loading" role="status">
      <LoaderCircle className="spin" />
      <span>Verifying owner access...</span>
    </div>
  )
}

export function OwnerRoute({ children }) {
  const { user, isOwner, loading } = useAuth()
  // Without Supabase credentials there is no sign-in at all, so the redirect
  // below would bounce the owner to the homepage with no explanation. Say so
  // instead: this is a build configuration problem, not an access problem.
  if (!isSupabaseConfigured) {
    return (
      <div className="admin-route-loading" role="alert">
        <AlertTriangle />
        <span>
          Sign-in is not configured in this build. Set <code>VITE_SUPABASE_URL</code> and
          {' '}<code>VITE_SUPABASE_ANON_KEY</code> in the Pages build variables and redeploy.
        </span>
      </div>
    )
  }
  if (loading) return <AdminLoading />
  if (!user || !isOwner) return <Navigate to="/" replace state={{ ownerAccessDenied: true }} />
  return children
}

function MetricCard({ metric, value }) {
  const Icon = metric.icon
  return (
    <article className="admin-metric-card">
      <span className="metric-icon"><Icon size={18} /></span>
      <span>{metric.label}</span>
      <strong>{metric.format(value)}</strong>
      <small><b>+8.4%</b> vs previous period</small>
    </article>
  )
}

function RevenueChart({ analytics }) {
  const max = Math.max(...analytics.revenueSeries)
  return (
    <article className="admin-chart-card admin-bar-chart">
      <header>
        <div><span className="eyebrow">REVENUE</span><h2>Monthly signal</h2></div>
        <span className="chart-chip">Mock data</span>
      </header>
      <div className="bar-chart-plot" aria-label="Monthly revenue bar chart">
        {analytics.revenueSeries.map((value, index) => (
          <div className="bar-column" key={analytics.labels[index]}>
            <div className="bar-value">${value}</div>
            <div className="bar-track"><span style={{ height: `${(value / max) * 100}%`, '--bar-delay': `${index * 70}ms` }} /></div>
            <small>{analytics.labels[index]}</small>
          </div>
        ))}
      </div>
    </article>
  )
}

function ConversionChart({ analytics }) {
  const points = analytics.conversionSeries.map((value, index) => {
    const x = (index / (analytics.conversionSeries.length - 1)) * 500
    const y = 150 - ((value - 2.5) / 3) * 120
    return `${x},${y}`
  }).join(' ')

  return (
    <article className="admin-chart-card admin-line-chart">
      <header>
        <div><span className="eyebrow">CONVERSION</span><h2>Intent over time</h2></div>
        <strong>{analytics.conversionRate}%</strong>
      </header>
      <div className="line-chart-wrap">
        <svg viewBox="0 0 500 170" role="img" aria-label="Monthly conversion line chart" preserveAspectRatio="none">
          <defs>
            <linearGradient id="conversion-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity=".3" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="chart-grid-line" d="M0 35H500M0 90H500M0 145H500" />
          <polygon points={`0,165 ${points} 500,165`} fill="url(#conversion-fill)" />
          <polyline className="conversion-line" points={points} />
        </svg>
        <div className="line-chart-labels">
          {analytics.labels.map((label) => <small key={label}>{label}</small>)}
        </div>
      </div>
    </article>
  )
}

function TestimonialTable({ items, onModerate, pendingId }) {
  const [filter, setFilter] = useState('all')
  const visible = filter === 'all' ? items : items.filter((item) => item.status === filter)

  return (
    <section className="admin-section-card" id="moderation">
      <header className="admin-section-head">
        <div>
          <span className="eyebrow">MODERATION</span>
          <h2>Testimonials</h2>
        </div>
        <div className="moderation-filters" aria-label="Filter testimonials">
          {['all', 'pending', 'approved', 'rejected'].map((status) => (
            <button className={filter === status ? 'is-active' : ''} type="button" onClick={() => setFilter(status)} key={status}>
              {status} <span>{status === 'all' ? items.length : items.filter((item) => item.status === status).length}</span>
            </button>
          ))}
        </div>
      </header>
      <div className="testimonial-table-wrap">
        <table className="testimonial-table">
          <thead><tr><th>Customer</th><th>Rating</th><th>Testimonial</th><th>Status</th><th>Moderate</th></tr></thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td data-label="Customer"><strong>{item.name}</strong><small>{new Date(item.createdAt).toLocaleDateString()}</small></td>
                <td data-label="Rating"><span className="table-rating"><Star size={13} fill="currentColor" /> {item.rating}</span></td>
                <td data-label="Testimonial"><p>{item.text}</p></td>
                <td data-label="Status"><span className={`status-pill status-${item.status}`}>{item.status}</span></td>
                <td data-label="Moderate">
                  <div className="moderation-actions">
                    <button type="button" title="Approve" aria-label={`Approve testimonial from ${item.name}`} disabled={item.status === 'approved' || pendingId === item.id} onClick={() => onModerate(item.id, 'approved')}><Check size={15} /></button>
                    <button type="button" title="Return to pending" aria-label={`Return testimonial from ${item.name} to pending`} disabled={item.status === 'pending' || pendingId === item.id} onClick={() => onModerate(item.id, 'pending')}><Activity size={15} /></button>
                    <button type="button" title="Reject" aria-label={`Reject testimonial from ${item.name}`} disabled={item.status === 'rejected' || pendingId === item.id} onClick={() => onModerate(item.id, 'rejected')}><X size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <p className="table-empty">No testimonials in this state.</p>}
      </div>
    </section>
  )
}

function SettingsPanel({ settings, onSave, saving }) {
  const [form, setForm] = useState(settings)
  useEffect(() => setForm(settings), [settings])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <section className="admin-section-card" id="settings">
      <header className="admin-section-head">
        <div><span className="eyebrow">NON-SENSITIVE CONFIG</span><h2>Store settings</h2></div>
        <LockKeyhole size={20} />
      </header>
      <form className="admin-settings-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
        <fieldset className="admin-settings-group admin-settings-group--payments">
          <legend>Lemon Squeezy payments</legend>
          <p className="admin-settings-group-copy">Lemon Squeezy acts as the merchant of record: it collects payment and handles global sales tax and remittance, which suits sellers based in India.</p>
          <div className="admin-settings-group-grid">
            <label className="portal-field">
              <span>Lemon Squeezy store ID</span>
              <input maxLength="30" value={form.lemonSqueezyStoreId || ''} onChange={(event) => update('lemonSqueezyStoreId', event.target.value)} placeholder="12345" />
              <small>Found under Lemon Squeezy Settings. Variant IDs are set per product in the Products tab.</small>
            </label>
            <label className="portal-field">
              <span>Bundle variant ID (optional)</span>
              <input maxLength="20" value={form.lemonSqueezyBundleVariantId || ''} onChange={(event) => update('lemonSqueezyBundleVariantId', event.target.value)} placeholder="12345" />
              <small>Multi-product carts check out once as a "Runway Systems Suite Bundle". Create a bundle product in Lemon Squeezy and paste its variant ID here so receipts show the bundle name; without it, the first product anchors the bundle checkout.</small>
            </label>
          </div>
        </fieldset>

        <fieldset className="admin-settings-group admin-settings-group--display">
          <legend>What customers see</legend>
          <p className="admin-settings-group-copy">Display copy only. Confirm the visible price matches the amount behind the Lemon Squeezy variant.</p>
          <div className="admin-settings-group-grid">
            <label className="toggle-setting">
              <span><b>Offer active</b><small>Shows the offer ribbon and struck-through original price.</small></span>
              <input type="checkbox" checked={Boolean(form.offerActive)} onChange={(event) => update('offerActive', event.target.checked)} />
              <i aria-hidden="true" />
            </label>
            <label className="portal-field">
              <span>Offer ribbon label</span>
              <input required maxLength="80" value={form.offerLabel || ''} onChange={(event) => update('offerLabel', event.target.value)} placeholder="Launch Offer" />
              <small>Free text, such as Launch Offer or Black Friday.</small>
            </label>
            <label className="portal-field">
              <span>Displayed original price</span>
              <input required maxLength="32" value={form.displayOriginalPrice || ''} onChange={(event) => update('displayOriginalPrice', event.target.value)} placeholder="$69" />
              <small>Hidden automatically when the offer is inactive.</small>
            </label>
            <label className="portal-field">
              <span>Displayed current price</span>
              <input required maxLength="32" value={form.displaySalePrice || ''} onChange={(event) => update('displaySalePrice', event.target.value)} placeholder="$39" />
              <small>Used in navigation, calls to action, and the pricing card.</small>
            </label>
          </div>
        </fieldset>

        <label className="portal-field admin-wide-field">
          <span>Review request email prompt</span>
          <textarea rows="3" value={form.emailTemplateText || ''} onChange={(event) => update('emailTemplateText', event.target.value)} />
        </label>
        <label className="portal-field admin-wide-field">
          <span>Trustpilot business review URL</span>
          <input type="url" value={form.trustpilotBusinessUrl || ''} onChange={(event) => update('trustpilotBusinessUrl', event.target.value)} placeholder="https://www.trustpilot.com/review/..." />
        </label>
        <label className="portal-field">
          <span>Support email</span>
          <input type="email" maxLength="120" value={form.supportEmail || ''} onChange={(event) => update('supportEmail', event.target.value)} placeholder="support@your-domain.com" />
          <small>Shown in the footer, FAQs, and checkout help. Overrides the VITE_SUPPORT_EMAIL fallback.</small>
        </label>
        <label className="portal-field">
          <span>Trustpilot business unit ID</span>
          <input maxLength="80" value={form.trustpilotBusinessUnitId || ''} onChange={(event) => update('trustpilotBusinessUnitId', event.target.value)} placeholder="5a9f3212b1e64c21d8b5e1ab" />
          <small>Enables the live Trustpilot reviews widget on pricing cards, subject to cookie consent.</small>
        </label>
        <div className="admin-settings-footer">
          <p><ShieldCheck size={14} /> Safe configuration only. Secrets are never shown here.</p>
          <button className="button primary" type="submit" disabled={saving}><Save size={15} /> {saving ? 'Saving...' : 'Save settings'}</button>
        </div>
      </form>
    </section>
  )
}

function IntegrationPanel({ integrations }) {
  const icons = { lemonsqueezy: CircleDollarSign, supabase: Cloud, email: Mail, trustpilot: Star, ai: Sparkles }
  return (
    <section className="admin-section-card" id="integrations">
      <header className="admin-section-head">
        <div><span className="eyebrow">CONNECTION HEALTH</span><h2>Integrations</h2></div>
        <Activity size={20} />
      </header>
      <div className="integration-grid">
        {integrations.map((integration) => {
          const Icon = icons[integration.id] || Cloud
          return (
            <article className="integration-card" key={integration.id}>
              <span className="integration-icon"><Icon size={20} /></span>
              <div><strong>{integration.label}</strong><small>{integration.detail}</small></div>
              <span className={`connection-state is-${integration.status}`}><i />{integration.status === 'connected' ? 'Connected' : 'Setup needed'}</span>
            </article>
          )
        })}
      </div>
      <div className="worker-secret-note">
        <LockKeyhole size={18} />
        <div><strong>Keep credentials outside the dashboard.</strong><p>Configure Lemon Squeezy, Supabase authentication, and email-provider credentials through Cloudflare Worker environment variables.</p></div>
      </div>
    </section>
  )
}

const cx = (...classes) => classes.filter(Boolean).join(' ')

const PRODUCT_ICON_OPTIONS = ['spreadsheet', 'users', 'gauge', 'receipt', 'folder', 'layers', 'calendar', 'kanban']
const PRODUCT_ACCENT_OPTIONS = ['lime', 'blue', 'violet', 'peach', 'mint', 'yellow', 'lavender']

const PRODUCT_ICON_LABELS = {
  spreadsheet: 'Spreadsheet',
  users: 'People',
  gauge: 'Gauge',
  receipt: 'Receipt',
  folder: 'Folder',
  layers: 'Layers',
  calendar: 'Calendar',
  kanban: 'Kanban',
}

const emptyProductDraft = (duplicateFrom = '') => ({
  isNew: true,
  duplicateFrom,
  key: '',
  name: '',
  tagline: '',
  category: '',
  icon: 'folder',
  accent: 'lime',
  lemonVariantId: '',
  deliveryUrl: '',
  originalPrice: '',
  salePrice: '',
  offerLabel: '',
  offerActive: true,
  active: true,
  featured: false,
  sortOrder: 10,
  includesText: '',
  heroImage: '',
  featureImages: [],
  features: [],
})

function draftFromProduct(product) {
  return {
    isNew: false,
    key: product.key,
    name: product.name,
    tagline: product.tagline || '',
    category: product.category || '',
    icon: product.icon || 'folder',
    accent: product.accent || 'lime',
    lemonVariantId: product.lemonVariantId || '',
    deliveryUrl: product.deliveryUrl || '',
    originalPrice: product.originalPrice || '',
    salePrice: product.salePrice || '',
    offerLabel: product.offerLabel || '',
    offerActive: Boolean(product.offerActive),
    active: Boolean(product.active),
    featured: Boolean(product.featured),
    sortOrder: product.sortOrder || 0,
    includesText: (product.includes || []).join('\n'),
    heroImage: product.heroImage || '',
    featureImages: Array.isArray(product.featureImages) ? [...product.featureImages] : [],
    features: Array.isArray(product.features) ? [...product.features] : [],
  }
}

function ProductsPanel({ products, onSave, onDelete, deletingKey, savingKey, onUploadMedia, onPatchMedia, onCreateFeature, onUpdateFeature, onDeleteFeature, mediaBusy, notify, aiStatus = 'setup' }) {
  const [showPreview, setShowPreview] = useState(true)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [draft, setDraft] = useState(null)

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

  const submit = (event) => {
    event.preventDefault()
    if (!draft.name.trim()) return
    onSave(draft)
    setDraft(null)
  }

  // Built-in catalog products are re-seeded by the Worker on every request, so
  // deleting one would silently come back. They can only be hidden.
  const isProtected = (key) => CATALOG_ORDER.includes(key)

  const askDelete = (product) => {
    setConfirmText('')
    setPendingDelete(product)
  }

  const confirmDelete = async () => {
    if (!pendingDelete || confirmText.trim() !== pendingDelete.key) return
    try {
      await onDelete(pendingDelete.key)
      if (draft && draft.key === pendingDelete.key) setDraft(null)
      setPendingDelete(null)
      setConfirmText('')
    } catch {
      // The dashboard notice already reports the failure; keep the modal open
      // so the owner can retry without retyping everything.
    }
  }

  const serverProduct = products.find((product) => product.key === draft?.key) || null

  const applyMedia = (saved) => setDraft((current) => current ? {
    ...current,
    heroImage: saved.heroImage || '',
    featureImages: Array.isArray(saved.featureImages) ? [...saved.featureImages] : [],
    features: Array.isArray(saved.features) ? [...saved.features] : current.features,
  } : current)

  const handleHeroFile = async (file) => {
    if (!file) return
    try {
      const image = await processImageFile(file)
      const saved = await onUploadMedia(draft.key, 'hero', image)
      applyMedia(saved)
    } catch (error) {
      notify(error.message || 'The hero image could not be processed.')
    }
  }

  const handleFeatureFiles = async (files) => {
    if (!files?.length) return
    let aiScanned = true
    try {
      for (const file of Array.from(files)) {
        const image = await processImageFile(file)
        const saved = await onCreateFeature(draft.key, image)
        if (saved?.feature) {
          setDraft((current) => current ? {
            ...current,
            features: [...(current.features || []), saved.feature],
            featureImages: [...(current.featureImages || []), saved.feature.imagePath],
          } : current)
        }
        if (!saved?.aiAvailable) aiScanned = false
      }
      if (!aiScanned) notify('Screenshots added. AI copy scanning is not configured here, so set the heading and subheading for each view below.')
    } catch (error) {
      notify(error.message || 'A screenshot could not be processed.')
    }
  }

  const patchServerProduct = async (patch) => {
    try {
      const saved = await onPatchMedia(draft.key, patch)
      applyMedia(saved)
    } catch (error) {
      notify(error.message || 'Product visuals could not be updated.')
    }
  }

  const removeHero = () => patchServerProduct({ ...serverProduct, heroImage: '' })

  const editFeatureLocal = (featureId, field, value) => setDraft((current) => current ? {
    ...current,
    features: (current.features || []).map((item) => item.id === featureId ? { ...item, [field]: value } : item),
  } : current)

  const persistFeature = async (featureId, field, value) => {
    try {
      await onUpdateFeature(draft.key, featureId, { [field]: value })
    } catch (error) {
      notify(error.message || 'Feature copy could not be saved.')
    }
  }

  const removeFeature = async (featureId) => {
    const target = (draft.features || []).find((item) => item.id === featureId)
    setDraft((current) => current ? {
      ...current,
      features: (current.features || []).filter((item) => item.id !== featureId),
      featureImages: (current.featureImages || []).filter((src) => src !== target?.imagePath),
    } : current)
    try {
      await onDeleteFeature(draft.key, featureId)
    } catch (error) {
      notify(error.message || 'The screenshot could not be removed.')
    }
  }

  const moveFeature = async (index, direction) => {
    const features = [...(draft.features || [])]
    const target = index + direction
    if (target < 0 || target >= features.length) return
    const [moved] = features.splice(index, 1)
    features.splice(target, 0, moved)
    const reordered = features.map((item, position) => ({ ...item, sortOrder: position }))
    setDraft((current) => current ? { ...current, features: reordered, featureImages: reordered.map((item) => item.imagePath) } : current)
    try {
      const [first, second] = direction === -1 ? [target, index] : [index, target]
      await Promise.all([
        onUpdateFeature(draft.key, reordered[first].id, { sortOrder: reordered[first].sortOrder }),
        onUpdateFeature(draft.key, reordered[second].id, { sortOrder: reordered[second].sortOrder }),
      ])
    } catch (error) {
      notify(error.message || 'The new order could not be saved.')
    }
  }

  if (draft) {
    return (
      <section className="admin-section-card" id="products">
        <header className="admin-section-head">
          <div>
            <span className="eyebrow">CATALOG</span>
            <h2>{draft.isNew ? (draft.duplicateFrom ? `Duplicate of ${draft.duplicateFrom}` : 'Add product') : `Edit ${draft.name}`}</h2>
            {draft.isNew && draft.duplicateFrom && (
              <small className="admin-duplicate-note">
                Content copied from <b>{draft.duplicateFrom}</b>. Set a new URL key, then edit the copy and
                upload this product&apos;s own screenshots.
              </small>
            )}
          </div>
          <div className="admin-preview-toggle">
            <button
              type="button"
              className={cx('button', showPreview ? 'primary' : 'text', 'button--small')}
              aria-pressed={showPreview}
              onClick={() => setShowPreview((value) => !value)}
            >
              <Eye size={14} /> {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
            <ShoppingBag size={20} />
          </div>
        </header>
        <div className={cx('product-editor-layout', showPreview && 'has-preview')}>
        <form className="admin-settings-form product-editor" onSubmit={submit}>
          <div className="admin-settings-group-grid">
            <label className="portal-field">
              <span>Product key</span>
              <input required maxLength="60" pattern="[a-z0-9][a-z0-9-]*" disabled={!draft.isNew} value={draft.key} onChange={(event) => update('key', event.target.value.toLowerCase())} placeholder="client-crm-os" />
              <small>Lowercase letters, numbers, and dashes. Used in the product URL.</small>
            </label>
            <label className="portal-field">
              <span>Name</span>
              <input required maxLength="80" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Client CRM OS" />
            </label>
            <label className="portal-field">
              <span>Tagline</span>
              <input maxLength="120" value={draft.tagline} onChange={(event) => update('tagline', event.target.value)} placeholder="Know every client, follow-up, and next step." />
            </label>
            <label className="portal-field">
              <span>Category</span>
              <input maxLength="60" value={draft.category} onChange={(event) => update('category', event.target.value)} placeholder="Client relationships" />
            </label>
            <label className="portal-field">
              <span>Icon</span>
              <select value={draft.icon} onChange={(event) => update('icon', event.target.value)}>
                {PRODUCT_ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{PRODUCT_ICON_LABELS[icon]}</option>)}
              </select>
            </label>
            <label className="portal-field">
              <span>Accent</span>
              <select value={draft.accent} onChange={(event) => update('accent', event.target.value)}>
                {PRODUCT_ACCENT_OPTIONS.map((accent) => <option key={accent} value={accent}>{accent}</option>)}
              </select>
            </label>
          </div>

          <fieldset className="admin-settings-group admin-settings-group--payments">
            <legend>Lemon Squeezy checkout</legend>
            <p className="admin-settings-group-copy">Billing configuration stays independent from the storefront price copy.</p>
            <div className="admin-settings-group-grid">
              <label className="portal-field">
                <span>Lemon Squeezy variant ID</span>
                <input maxLength="20" value={draft.lemonVariantId} onChange={(event) => update('lemonVariantId', event.target.value)} placeholder="12345" />
                <small>Created under the product in the Lemon Squeezy dashboard. This is what the checkout charges.</small>
              </label>
              <label className="portal-field">
                <span>Delivery link (Google Sheets copy URL)</span>
                <input type="url" maxLength="500" value={draft.deliveryUrl} onChange={(event) => update('deliveryUrl', event.target.value)} placeholder="https://docs.google.com/spreadsheets/.../copy" />
                <small>Must be a docs.google.com spreadsheets copy link. Sent by email and opened from the account library.</small>
              </label>
            </div>
          </fieldset>

          <fieldset className="admin-settings-group admin-settings-group--display">
            <legend>What customers see</legend>
            <p className="admin-settings-group-copy">Display copy only. Confirm the visible price matches the amount behind the Lemon Squeezy variant.</p>
            <div className="admin-settings-group-grid">
              <label className="portal-field">
                <span>Displayed original price</span>
                <input maxLength="32" value={draft.originalPrice} onChange={(event) => update('originalPrice', event.target.value)} placeholder="$59" />
              </label>
              <label className="portal-field">
                <span>Displayed current price</span>
                <input maxLength="32" value={draft.salePrice} onChange={(event) => update('salePrice', event.target.value)} placeholder="$35" />
              </label>
              <label className="portal-field">
                <span>Offer ribbon label</span>
                <input maxLength="80" value={draft.offerLabel} onChange={(event) => update('offerLabel', event.target.value)} placeholder="Launch Offer" />
              </label>
              <label className="toggle-setting">
                <span><b>Offer active</b><small>Shows the ribbon and struck-through original price.</small></span>
                <input type="checkbox" checked={draft.offerActive} onChange={(event) => update('offerActive', event.target.checked)} />
                <i aria-hidden="true" />
              </label>
              <label className="toggle-setting">
                <span><b>Visible on storefront</b><small>Turn off to hide it completely: removed from the catalog, homepage, footer and sitemap, its product page returns 404, and checkout is refused. Existing customers keep their purchase and delivery link, and all content is kept for when you turn it back on.</small></span>
                <input type="checkbox" checked={draft.active} onChange={(event) => update('active', event.target.checked)} />
                <i aria-hidden="true" />
              </label>
              <label className="toggle-setting">
                <span><b>Featured</b><small>Featured products are highlighted on the suite homepage.</small></span>
                <input type="checkbox" checked={draft.featured} onChange={(event) => update('featured', event.target.checked)} />
                <i aria-hidden="true" />
              </label>
              <label className="portal-field">
                <span>Sort order</span>
                <input type="number" min="0" max="999" value={draft.sortOrder} onChange={(event) => update('sortOrder', Number(event.target.value) || 0)} />
              </label>
            </div>
            <label className="portal-field admin-wide-field">
              <span>Included features (one per line)</span>
              <textarea rows="5" value={draft.includesText} onChange={(event) => update('includesText', event.target.value)} placeholder={'Live dashboard\nPrivate Google Sheets copy\nAll future updates'} />
            </label>
          </fieldset>

          {!draft.isNew && (
            <fieldset className="admin-settings-group admin-settings-group--media">
              <legend>Product visuals</legend>
              <p className="admin-settings-group-copy">Screenshots are processed in the browser into sharp high-resolution WebP and stored in private media storage. Uploaded visuals replace the placeholder views on the product page.</p>
              <div className="media-editor">
                <div className="media-editor__block">
                  <p className="media-editor__title">Hero dashboard screenshot</p>
                  <div className={cx('media-hero-frame', draft.heroImage && 'has-image')}>
                    {draft.heroImage
                      ? <img src={draft.heroImage} alt={`${draft.name || 'Product'} hero screenshot`} />
                      : <span className="media-empty"><ImagePlus size={20} /> Wide screenshot of the main dashboard</span>}
                    <div className="media-hero-actions">
                      {draft.heroImage && (
                        <button className="button button--dark button--small" type="button" onClick={removeHero} disabled={Boolean(mediaBusy)}>
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                      <label className="button button--small">
                        {mediaBusy === 'hero' ? 'Processing...' : draft.heroImage ? 'Replace' : 'Upload'}
                        <input type="file" hidden accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { handleHeroFile(event.target.files?.[0]); event.target.value = '' }} />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="media-editor__block">
                  <p className="media-editor__title">Feature showcase <small>(unlimited, numbered on the storefront)</small></p>
                  <div className="feature-editor-list">
                    {(draft.features || []).map((feature, index) => (
                      <div className="feature-editor-card" key={feature.id}>
                        <span className="feature-editor-card__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                        <div className="feature-editor-card__thumb">
                          <img src={feature.imagePath} alt={feature.heading || `Feature ${index + 1} screenshot`} />
                        </div>
                        <div className="feature-editor-card__fields">
                          <label className="portal-field">
                            <span>Heading</span>
                            <input
                              maxLength="100"
                              value={feature.heading || ''}
                              placeholder="Generated from the image by AI"
                              onChange={(event) => editFeatureLocal(feature.id, 'heading', event.target.value)}
                              onBlur={(event) => { if (event.target.value !== feature.heading) persistFeature(feature.id, 'heading', event.target.value) }}
                            />
                          </label>
                          <label className="portal-field">
                            <span>Subheading</span>
                            <input
                              maxLength="300"
                              value={feature.subheading || ''}
                              placeholder="One supporting sentence about this view"
                              onChange={(event) => editFeatureLocal(feature.id, 'subheading', event.target.value)}
                              onBlur={(event) => { if (event.target.value !== feature.subheading) persistFeature(feature.id, 'subheading', event.target.value) }}
                            />
                          </label>
                        </div>
                        <div className="feature-editor-card__actions">
                          <button type="button" title="Move up" aria-label={`Move feature ${index + 1} up`} disabled={index === 0 || Boolean(mediaBusy)} onClick={() => moveFeature(index, -1)}><ChevronUp size={13} /></button>
                          <button type="button" title="Remove" aria-label={`Remove feature ${index + 1}`} disabled={Boolean(mediaBusy)} onClick={() => removeFeature(feature.id)}><Trash2 size={13} /></button>
                          <button type="button" title="Move down" aria-label={`Move feature ${index + 1} down`} disabled={index === (draft.features || []).length - 1 || Boolean(mediaBusy)} onClick={() => moveFeature(index, 1)}><ChevronDown size={13} /></button>
                        </div>
                      </div>
                    ))}
                    <label className={cx('feature-editor-add', mediaBusy === 'feature' && 'is-busy')}>
                      {mediaBusy === 'feature' ? 'Processing...' : <><ImagePlus size={18} /> Add screenshots</>}
                      <input type="file" multiple hidden accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { handleFeatureFiles(event.target.files); event.target.value = '' }} />
                    </label>
                  </div>
                  <p className={`media-ai-note is-${aiStatus}`}>
                    <Sparkles size={13} />
                    {aiStatus === 'connected'
                      ? 'AI image scanning is connected. Each uploaded screenshot is analyzed and its heading and subheading are written for you. Edit any field afterwards.'
                      : 'AI image scanning is not configured yet. Uploaded screenshots keep empty headings until you write them, or connect the AI binding to have the copy generated.'}
                  </p>
                </div>
              </div>
            </fieldset>
          )}

          <div className="admin-settings-footer">
            <p><ShieldCheck size={14} /> Secrets stay in Worker environment variables.</p>
            <div className="product-editor-actions">
              <button className="button text" type="button" onClick={() => setDraft(null)}>Cancel</button>
              <button className="button primary" type="submit" disabled={savingKey === (draft.key || 'new') || !draft.name.trim()}>
                <Save size={15} /> {savingKey === (draft.key || 'new') ? 'Saving...' : draft.isNew ? 'Create product' : 'Save product'}
              </button>
            </div>
          </div>
        </form>
        {showPreview && <ProductPreviewPane draft={draft} />}
        </div>
      </section>
    )
  }

  return (
    <section className="admin-section-card" id="products">
      <header className="admin-section-head">
        <div><span className="eyebrow">CATALOG</span><h2>Products</h2></div>
        <button className="button primary button--small" type="button" onClick={() => setDraft(emptyProductDraft())}>Add product</button>
      </header>
      <p className="admin-section-hint">
        <b>Add product</b> starts from a blank template. <b>Duplicate</b> copies a product&apos;s written
        content into a new one, so you edit strong copy instead of writing every section from scratch.
        The Lemon Squeezy variant, delivery link and images are never copied.
      </p>
      <div className="product-admin-list">
        {products.map((product) => (
          <article className="product-admin-row" key={product.key}>
            <span className={`product-admin-icon is-${product.accent}`} aria-hidden="true">{product.icon === 'spreadsheet' ? '▦' : product.icon === 'users' ? '◎' : product.icon === 'gauge' ? '◔' : product.icon === 'receipt' ? '▤' : '▣'}</span>
            <div className="product-admin-identity"><strong>{product.name}</strong><small>/{product.key} · {product.category || 'No category'}</small></div>
            <div className="product-admin-price"><b>{product.salePrice || 'Unpriced'}</b>{product.offerActive && <s>{product.originalPrice}</s>}</div>
            <span className={`status-pill ${product.lemonVariantId && product.lemonVariantId !== '' ? 'status-approved' : 'status-rejected'}`}>{product.lemonVariantId && product.lemonVariantId !== '' ? 'checkout ready' : 'needs variant'}</span>
            <span className={`status-pill ${product.active ? 'status-approved' : 'status-pending'}`}>{product.active ? 'visible' : 'hidden'}</span>
            <button className="button text button--small" type="button" onClick={() => setDraft(draftFromProduct(product))}>Edit</button>
            <button
              className="button text button--small"
              type="button"
              title={`Start a new product from ${product.name}'s content`}
              onClick={() => setDraft({
                ...emptyProductDraft(product.key),
                name: `${product.name} copy`,
                tagline: product.tagline || '',
                category: product.category || '',
                icon: product.icon || 'spreadsheet',
                accent: product.accent || 'lime',
                includesText: (product.includes || []).join('\n'),
                sortOrder: Number(product.sortOrder || 0) + 1,
              })}
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              className="button text button--small product-admin-delete"
              type="button"
              title={isProtected(product.key) ? 'Built-in catalog products cannot be deleted. Edit it and set it to hidden instead.' : `Delete ${product.name}`}
              aria-label={`Delete ${product.name}`}
              disabled={isProtected(product.key) || deletingKey === product.key}
              onClick={() => askDelete(product)}
            >
              <Trash2 size={13} /> {deletingKey === product.key ? 'Deleting...' : 'Delete'}
            </button>
          </article>
        ))}
        {!products.length && <p className="table-empty">No products yet. Add one to open the catalog.</p>}
      </div>

      {pendingDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPendingDelete(null)}>
          <div className="checkout-modal admin-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-product-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setPendingDelete(null)} aria-label="Cancel deletion"><X size={18} /></button>
            <span className="modal-icon modal-icon--danger"><Trash2 size={21} /></span>
            <p className="eyebrow">PERMANENT ACTION</p>
            <h2 id="delete-product-title">Delete {pendingDelete.name}?</h2>
            <p>
              This removes the product, its uploaded hero image, and every feature screenshot from the database and media storage.
              Existing customer purchases and delivery history are kept.
            </p>
            <label className="portal-field admin-wide-field">
              <span>Type <b>{pendingDelete.key}</b> to confirm</span>
              <input
                value={confirmText}
                autoFocus
                placeholder={pendingDelete.key}
                onChange={(event) => setConfirmText(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') confirmDelete() }}
              />
            </label>
            <div className="product-editor-actions">
              <button className="button text" type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button
                className="button button--danger"
                type="button"
                disabled={confirmText.trim() !== pendingDelete.key || deletingKey === pendingDelete.key}
                onClick={confirmDelete}
              >
                <Trash2 size={15} /> {deletingKey === pendingDelete.key ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default function AdminDashboard() {
  const { profile, session } = useAuth()
  const [analytics, setAnalytics] = useState(null)
  const [testimonials, setTestimonials] = useState([])
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState({})
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [moderatingId, setModeratingId] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingProductKey, setSavingProductKey] = useState('')
  const [deletingProductKey, setDeletingProductKey] = useState('')
  const [bundles, setBundles] = useState([])
  const [savingBundleKey, setSavingBundleKey] = useState('')
  const [deletingBundleKey, setDeletingBundleKey] = useState('')
  const [mediaBusy, setMediaBusy] = useState('')
  const token = session?.access_token

  const authOptions = useMemo(() => ({ token }), [token])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const [analyticsData, testimonialData, productData, settingsData, integrationData, bundleData] = await Promise.all([
        getAnalytics(authOptions),
        getTestimonials(authOptions),
        getAdminProducts(authOptions),
        getAdminSettings(authOptions),
        getIntegrationStatus(authOptions),
        getAdminBundles(authOptions),
      ])
      setAnalytics(analyticsData)
      setTestimonials(testimonialData)
      setProducts(productData)
      setBundles(bundleData)
      setSettings(settingsData)
      setIntegrations(integrationData)
    } catch (error) {
      setNotice(error.message || 'Dashboard data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [authOptions])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const moderate = async (id, status) => {
    setModeratingId(id)
    setNotice('')
    try {
      const updated = await updateTestimonialStatus(id, status, authOptions)
      setTestimonials((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item))
      setNotice(`Testimonial moved to ${status}.`)
    } catch (error) {
      setNotice(error.message || 'The moderation change could not be saved.')
    } finally {
      setModeratingId('')
    }
  }

  const saveSettings = async (nextSettings) => {
    setSavingSettings(true)
    setNotice('')
    try {
      const saved = await updateAdminSettings(nextSettings, authOptions)
      setSettings(saved)
      setNotice('Settings saved through the platform API.')
    } catch (error) {
      setNotice(error.message || 'Settings could not be saved.')
    } finally {
      setSavingSettings(false)
    }
  }

  const saveProductContent = async (productKey, content) => {
    setSavingProductKey(`content:${productKey}`)
    setNotice('')
    try {
      const saved = await updateAdminProduct(productKey, { content }, authOptions)
      setProducts((current) => current.map((product) => product.key === saved.key ? { ...product, content: saved.content || {} } : product))
      setNotice('Product content saved through the platform API.')
    } catch (error) {
      setNotice(error.message || 'Product content could not be saved.')
      throw error
    } finally {
      setSavingProductKey('')
    }
  }

  const saveSiteContent = async (partial) => {
    setSavingSettings(true)
    setNotice('')
    try {
      const saved = await updateAdminSettings({ ...settings, ...partial }, authOptions)
      setSettings(saved)
      setNotice('Site content saved through the platform API.')
    } catch (error) {
      setNotice(error.message || 'Site content could not be saved.')
      throw error
    } finally {
      setSavingSettings(false)
    }
  }

  const saveSuiteContent = (suiteContent) => saveSiteContent({ suiteContent })
  const savePolicies = (policies) => saveSiteContent({ policies })
  const saveAnnouncement = async (announcement) => {
    setSavingProductKey('announcement')
    try {
      await saveSiteContent({ announcement })
    } finally {
      setSavingProductKey('')
    }
  }
  const saveDefaultOffer = async (defaultOffer) => {
    setSavingProductKey('default-offer')
    try {
      await saveSiteContent({ defaultOffer })
    } finally {
      setSavingProductKey('')
    }
  }

  const saveProductOffer = async (productKey, patch) => {
    setSavingProductKey(`offer:${productKey}`)
    setNotice('')
    try {
      const saved = await updateAdminProduct(productKey, patch, authOptions)
      setProducts((current) => current.map((product) => product.key === saved.key ? saved : product))
      setNotice(`Offer updated for ${saved.name}.`)
    } catch (error) {
      setNotice(error.message || 'The offer could not be saved.')
    } finally {
      setSavingProductKey('')
    }
  }

  const saveProduct = async (draft) => {
    const workingKey = draft.isNew ? 'new' : draft.key
    setSavingProductKey(workingKey)
    setNotice('')
    try {
      const input = {
        name: draft.name,
        tagline: draft.tagline,
        category: draft.category,
        icon: draft.icon,
        accent: draft.accent,
        lemonVariantId: draft.lemonVariantId,
        deliveryUrl: draft.deliveryUrl,
        originalPrice: draft.originalPrice,
        salePrice: draft.salePrice,
        offerLabel: draft.offerLabel,
        offerActive: draft.offerActive,
        active: draft.active,
        featured: draft.featured,
        sortOrder: Number(draft.sortOrder) || 0,
        includes: String(draft.includesText || '').split('\n').map((item) => item.trim()).filter(Boolean),
      }
      const saved = draft.isNew
        ? await createAdminProduct({ ...input, key: draft.key, ...(draft.duplicateFrom ? { duplicateFrom: draft.duplicateFrom } : {}) }, authOptions)
        : await updateAdminProduct(draft.key, input, authOptions)
      setProducts((current) => draft.isNew ? [...current, saved] : current.map((product) => product.key === saved.key ? saved : product))
      setNotice(`Product ${saved.name} saved through the platform API.`)
    } catch (error) {
      setNotice(error.message || 'Product could not be saved.')
    } finally {
      setSavingProductKey('')
    }
  }

  const removeProduct = async (key) => {
    setDeletingProductKey(key)
    setNotice('')
    try {
      const removed = await deleteAdminProduct(key, authOptions)
      setProducts((current) => current.filter((product) => product.key !== key))
      setNotice(`Product ${removed?.name || key} was permanently deleted.`)
    } catch (error) {
      setNotice(error.message || 'The product could not be deleted.')
      throw error
    } finally {
      setDeletingProductKey('')
    }
  }

  const saveBundle = async (draft) => {
    const workingKey = draft.isNew ? 'new' : draft.key
    setSavingBundleKey(workingKey)
    setNotice('')
    try {
      const input = {
        name: draft.name,
        tagline: draft.tagline,
        productKeys: draft.productKeys,
        discountPercent: Number(draft.discountPercent) || 0,
        lemonVariantId: draft.lemonVariantId,
        active: draft.active,
        sortOrder: Number(draft.sortOrder) || 0,
      }
      const saved = draft.isNew
        ? await createAdminBundle({ ...input, key: draft.key }, authOptions)
        : await updateAdminBundle(draft.key, input, authOptions)
      setBundles((current) => draft.isNew ? [...current, saved] : current.map((bundle) => bundle.key === saved.key ? saved : bundle))
      setNotice(`Bundle ${saved.name} saved.`)
    } catch (error) {
      setNotice(error.message || 'The bundle could not be saved.')
    } finally {
      setSavingBundleKey('')
    }
  }

  const removeBundle = async (key) => {
    setDeletingBundleKey(key)
    setNotice('')
    try {
      const removed = await deleteAdminBundle(key, authOptions)
      setBundles((current) => current.filter((bundle) => bundle.key !== key))
      setNotice(`Bundle ${removed?.name || key} deleted.`)
    } catch (error) {
      setNotice(error.message || 'The bundle could not be deleted.')
      throw error
    } finally {
      setDeletingBundleKey('')
    }
  }

  const uploadMedia = async (productKey, slot, image) => {
    setMediaBusy(slot === 'hero' ? 'hero' : 'feature')
    setNotice('')
    try {
      const saved = await uploadProductImage(productKey, { slot, image }, authOptions)
      setProducts((current) => current.map((product) => product.key === saved.key ? saved : product))
      setNotice(slot === 'hero' ? 'Hero image uploaded and applied to the product.' : 'Screenshot added to the feature showcase.')
      return saved
    } catch (error) {
      setNotice(error.message || 'The image could not be uploaded.')
      throw error
    } finally {
      setMediaBusy('')
    }
  }

  const createFeature = async (productKey, image) => {
    setMediaBusy('feature')
    setNotice('')
    try {
      const saved = await createProductFeature(productKey, { image }, authOptions)
      setProducts((current) => current.map((product) => product.key === productKey
        ? { ...product, features: [...(product.features || []), saved.feature], featureImages: [...(product.featureImages || []), saved.feature.imagePath] }
        : product))
      return saved
    } catch (error) {
      setNotice(error.message || 'The screenshot could not be uploaded.')
      throw error
    } finally {
      setMediaBusy('')
    }
  }

  const updateFeature = async (productKey, featureId, input) => {
    try {
      const saved = await updateProductFeature(productKey, featureId, input, authOptions)
      setProducts((current) => current.map((product) => product.key === productKey ? {
        ...product,
        features: (product.features || []).map((item) => item.id === featureId ? { ...item, ...saved } : item),
      } : product))
      return saved
    } catch (error) {
      setNotice(error.message || 'Feature copy could not be saved.')
      throw error
    }
  }

  const removeFeature = async (productKey, featureId) => {
    const target = (products.find((product) => product.key === productKey)?.features || []).find((item) => item.id === featureId)
    try {
      await deleteProductFeature(productKey, featureId, authOptions)
      setProducts((current) => current.map((product) => product.key === productKey ? {
        ...product,
        features: (product.features || []).filter((item) => item.id !== featureId),
        featureImages: (product.featureImages || []).filter((src) => src !== target?.imagePath),
      } : product))
    } catch (error) {
      setNotice(error.message || 'The screenshot could not be removed.')
      throw error
    }
  }

  const patchMedia = async (productKey, patch) => {
    setMediaBusy('media')
    setNotice('')
    try {
      const saved = await updateAdminProduct(productKey, patch, authOptions)
      setProducts((current) => current.map((product) => product.key === saved.key ? saved : product))
      setNotice('Product visuals updated.')
      return saved
    } catch (error) {
      setNotice(error.message || 'Product visuals could not be updated.')
      throw error
    } finally {
      setMediaBusy('')
    }
  }

  if (loading || !analytics) return <AdminLoading />

  return (
    <div className="admin-page">
      <Seo
        title="Owner dashboard | Runway Systems"
        description="Runway Systems account area. Google Sheets products for independent business."
        canonicalPath={window.location.pathname}
        noindex
      />
      <header className="admin-header">
        <Logo />
        <div className="admin-header-center">
          <ShieldCheck size={15} /> OWNER CONTROL ROOM
        </div>
        <div className="admin-header-actions">
          <Link to="/" className="portal-home-link"><ArrowLeft size={15} /> Runway Systems</Link>
          <AccountButton compact />
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-titlebar">
          <div><p className="eyebrow">RUNWAY SYSTEMS</p><h1>Owner dashboard</h1><p>Good morning, {profile?.name?.split(' ')[0]}. Here is the current storefront signal.</p></div>
          <div className="admin-live-chip"><i /> Platform API live</div>
        </section>

        <nav className="admin-section-nav" aria-label="Dashboard sections">
          {[
            ['#products', 'Products'],
            ['#content', 'Content studio'],
            ['#bundles', 'Bundles'],
            ['#offers', 'Offers'],
            ['#moderation', 'Reviews'],
            ['#settings', 'Store settings'],
            ['#integrations', 'Integrations'],
          ].map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>

        {IS_PREVIEW_DATA && (
          <div className="admin-preview-warning" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Preview data — this dashboard is not connected to your database.</strong>
              <span>
                Every number below is seeded demo data, and product edits are saved only to this browser,
                so they will never appear on the live site. This build was compiled without
                <code>VITE_API_BASE_URL</code>. Set it to your Worker URL in the Cloudflare Pages build
                variables (Settings → Environment variables) and redeploy to connect the real database.
              </span>
            </div>
          </div>
        )}

        {notice && <div className="admin-notice" role="status"><CheckCircle2 size={15} /> {notice}</div>}

        <section className="admin-metrics" aria-label="Store metrics">
          {metricConfig.map((metric) => <MetricCard key={metric.key} metric={metric} value={analytics[metric.key]} />)}
        </section>

        <section className="admin-chart-grid">
          <RevenueChart analytics={analytics} />
          <ConversionChart analytics={analytics} />
        </section>

        <ProductsPanel
          products={products}
          onSave={saveProduct}
          onDelete={removeProduct}
          deletingKey={deletingProductKey}
          savingKey={savingProductKey}
          onUploadMedia={uploadMedia}
          onPatchMedia={patchMedia}
          onCreateFeature={createFeature}
          onUpdateFeature={updateFeature}
          onDeleteFeature={removeFeature}
          mediaBusy={mediaBusy}
          notify={setNotice}
          aiStatus={(integrations || []).find((item) => item.id === 'ai')?.status || 'setup'}
        />
        <AdminBundlesPanel
          bundles={bundles}
          products={products}
          onSave={saveBundle}
          onDelete={removeBundle}
          savingKey={savingBundleKey}
          deletingKey={deletingBundleKey}
        />
        <AdminOffersPanel
          products={products}
          settings={settings}
          onSaveProductOffer={saveProductOffer}
          onSaveDefaultOffer={saveDefaultOffer}
          savingKey={savingProductKey}
        />
        <AdminContentPanel
          products={products}
          settings={settings}
          onSaveProductContent={saveProductContent}
          onSaveSuiteContent={saveSuiteContent}
          onSavePolicies={savePolicies}
          onSaveAnnouncement={saveAnnouncement}
          savingKey={savingProductKey}
          notify={setNotice}
        />
        <TestimonialTable items={testimonials} onModerate={moderate} pendingId={moderatingId} />
        <div className="admin-bottom-grid">
          <SettingsPanel settings={settings} onSave={saveSettings} saving={savingSettings} />
          <IntegrationPanel integrations={integrations} />
        </div>
      </main>
    </div>
  )
}
