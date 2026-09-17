import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Monitor,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  broadcastAdminMarketingCampaign,
  createAdminAudienceContact,
  deleteAdminAudienceContact,
  exportAdminAudienceCsv,
  getAdminAudience,
  getAdminMarketingCampaigns,
  sendAdminMarketingTestEmail,
  updateAdminAudienceContact,
} from '../api/platformApi'

const TEMPLATES = [
  {
    id: 'launch',
    label: '🚀 Product Launch',
    title: 'New Operating System Available',
    subject: 'Introducing {{product_name}} for Google Sheets',
    eyebrow: 'RUNWAY SYSTEMS · OFFICIAL LAUNCH',
    message: 'We are thrilled to announce that **{{product_name}}** is now live and available on Runway Systems.\n\nEngineered specifically for founders, operators, and consultants, this system eliminates manual spreadsheet work with automated formulas, visual dashboards, and multi-currency tracking.\n\nAs an early subscriber, your instant access is ready below.',
    ctaLabel: 'Explore {{product_name}} →',
    ctaUrl: 'https://runwaysystems.cloud',
    discountCode: '',
  },
  {
    id: 'flash-sale',
    label: '🏷️ VIP Flash Sale (20% Off)',
    title: '48-Hour VIP Founder Discount',
    subject: 'Exclusive 48-Hour VIP Access: 20% off all systems',
    eyebrow: 'RUNWAY SYSTEMS · PRIVATE OFFER',
    message: 'Hi {{first_name}},\n\nFor the next 48 hours, we are opening an exclusive **20% founder discount** across our entire catalog of Google Sheets business operating systems.\n\nWhether you need complete financial runway modeling with Cash Flow OS, client pipeline tracking with Client CRM OS, or automated billing with Invoice OS, you can upgrade your workflow today at our lowest price ever.',
    ctaLabel: 'Claim 20% Founder Discount →',
    ctaUrl: 'https://runwaysystems.cloud?discount=VIP20',
    discountCode: 'VIP20',
  },
  {
    id: 'sheets-tip',
    label: '💡 Sheets Workflow Tip',
    title: 'Cash Flow Modeling Best Practice',
    subject: '3 Google Sheets formulas every solo founder needs',
    eyebrow: 'RUNWAY SYSTEMS · VALUE GUIDE',
    message: 'Hi {{first_name}},\n\nMost founders track runway by looking at their current bank balance. But that misses upcoming quarterly taxes, annual software renewals, and delayed invoice receivables.\n\nHere are 3 dynamic formula patterns built into Runway Systems to calculate true adjusted runway in real time:\n\n1. **Dynamic Burn Rate:** Combining QUERY with DATE ranges to isolate trailing 90-day averages.\n2. **Scenario Matrix:** Toggle between Base, Bull, and Bear cases in 1 click without breaking formulas.\n3. **Tax Reserve Vault:** Automatically reserve 25% of gross invoice revenue before calculating net runway.',
    ctaLabel: 'View Full Architecture →',
    ctaUrl: 'https://runwaysystems.cloud/products/cashflow-os',
    discountCode: '',
  },
  {
    id: 'update',
    label: '📦 System Update & Formulas',
    title: 'Version 2.4 Update Available',
    subject: 'Changelog: New multi-currency forecasting added',
    eyebrow: 'RUNWAY SYSTEMS · VERSION UPDATE',
    message: 'Hi {{first_name}},\n\nWe just released a major update to our Google Sheets systems. If you already own a Runway Systems template, you can duplicate the latest build directly from your account portal.\n\n**What is new in v2.4:**\n• Multi-currency exchange rate auto-refresh with GOOGLEFINANCE\n• Retainer vs one-off revenue cohort separation\n• Streamlined mobile views for checking metrics on iOS and Android',
    ctaLabel: 'Open Your Account Portal →',
    ctaUrl: 'https://runwaysystems.cloud/account',
    discountCode: '',
  },
]

function formatHtmlPreview(text) {
  if (!text) return ''
  const paragraphs = text.split(/\n\s*\n/)
  return paragraphs.map((p) => {
    let formatted = p.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
    return `<p style="margin:0 0 14px 0;line-height:1.65;color:#cbd0d8">${formatted}</p>`
  }).join('')
}

export default function AdminMarketingPanel({ products = [], notify }) {
  const [segment, setSegment] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [audienceData, setAudienceData] = useState({ stats: {}, contacts: [], total: 0, page: 1, totalPages: 1 })
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState(false)
  const [copiedId, setCopiedId] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  // Campaign Composer State
  const [campaignForm, setCampaignForm] = useState({
    title: 'VIP Founder Announcement',
    subject: 'Exclusive 48-Hour VIP Access: 20% off all systems',
    eyebrow: 'RUNWAY SYSTEMS · PRIVATE OFFER',
    message: 'Hi {{first_name}},\n\nFor the next 48 hours, we are opening an exclusive **20% founder discount** across our entire catalog of Google Sheets business operating systems.\n\nWhether you need complete financial runway modeling with Cash Flow OS, client pipeline tracking with Client CRM OS, or automated billing with Invoice OS, you can upgrade your workflow today at our lowest price ever.',
    targetSegment: 'all',
    targetProductKey: '',
    discountCode: 'VIP20',
    ctaLabel: 'Claim 20% Founder Discount →',
    ctaUrl: 'https://runwaysystems.cloud?discount=VIP20',
  })
  const [previewDevice, setPreviewDevice] = useState('desktop') // 'desktop' | 'mobile'

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({ email: '', name: '', source: 'manual' })
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [broadcastSending, setBroadcastSending] = useState(false)

  const loadAudience = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAdminAudience({ segment, search: debouncedSearch, product: productFilter, page: 1, limit: 100 })
      setAudienceData(data)
      const past = await getAdminMarketingCampaigns()
      setCampaigns(past || [])
    } catch (err) {
      notify?.(`Failed to load audience: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [segment, debouncedSearch, productFilter, notify])

  useEffect(() => {
    loadAudience()
  }, [loadAudience])

  const stats = audienceData.stats || { total: 0, leads: 0, customers: 0, waitlist: 0, unsubscribed: 0, totalLtvCents: 0 }

  const handleApplyTemplate = (tmpl) => {
    setCampaignForm((curr) => ({
      ...curr,
      title: tmpl.title,
      subject: tmpl.subject,
      eyebrow: tmpl.eyebrow,
      message: tmpl.message,
      ctaLabel: tmpl.ctaLabel,
      ctaUrl: tmpl.ctaUrl,
      discountCode: tmpl.discountCode,
    }))
    notify?.(`Loaded "${tmpl.label}" email template.`)
  }

  const handleSendTest = async () => {
    try {
      setTestSending(true)
      const res = await sendAdminMarketingTestEmail(campaignForm)
      notify?.(res.message || 'Test email dispatched to runwaysystems.cloud@gmail.com!')
    } catch (err) {
      notify?.(`Test email failed: ${err.message}`)
    } finally {
      setTestSending(false)
    }
  }

  const handleBroadcast = async () => {
    try {
      setBroadcastSending(true)
      const res = await broadcastAdminMarketingCampaign(campaignForm)
      setBroadcastModalOpen(false)
      notify?.(res.message || `Campaign successfully sent to ${res.sentCount} recipients via Brevo!`)
      loadAudience()
    } catch (err) {
      notify?.(`Broadcast failed: ${err.message}`)
    } finally {
      setBroadcastSending(false)
    }
  }

  const handleExportCsv = async () => {
    try {
      const csvText = await exportAdminAudienceCsv({ segment })
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `runway-audience-${segment}-${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      notify?.('Audience CSV exported successfully.')
    } catch (err) {
      notify?.(`Export failed: ${err.message}`)
    }
  }

  const handleAddContact = async (e) => {
    e.preventDefault()
    if (!addForm.email || !addForm.email.includes('@')) {
      notify?.('Please enter a valid email address')
      return
    }
    try {
      setBusyAction(true)
      await createAdminAudienceContact(addForm)
      setAddModalOpen(false)
      setAddForm({ email: '', name: '', source: 'manual' })
      notify?.('Contact added successfully to audience.')
      loadAudience()
    } catch (err) {
      notify?.(`Failed to add contact: ${err.message}`)
    } finally {
      setBusyAction(false)
    }
  }

  const handleToggleStatus = async (contact) => {
    const nextStatus = contact.status === 'subscribed' ? 'unsubscribed' : 'subscribed'
    try {
      await updateAdminAudienceContact(contact.id, { status: nextStatus })
      notify?.(`Contact status changed to ${nextStatus}.`)
      loadAudience()
    } catch (err) {
      notify?.(`Failed to update status: ${err.message}`)
    }
  }

  const handleDeleteContact = async (id, email) => {
    if (!window.confirm(`Are you sure you want to delete ${email} from your audience?`)) return
    try {
      await deleteAdminAudienceContact(id)
      notify?.(`Contact ${email} removed.`)
      loadAudience()
    } catch (err) {
      notify?.(`Failed to delete contact: ${err.message}`)
    }
  }

  const handleCopyEmail = (email, id) => {
    navigator.clipboard?.writeText(email)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 2000)
    notify?.(`Copied ${email} to clipboard.`)
  }

  // Calculate target recipient count for the current campaign target selection
  const estimatedRecipients = useMemo(() => {
    const contacts = audienceData.contacts || []
    if (campaignForm.targetSegment === 'leads') return stats.leads || 0
    if (campaignForm.targetSegment === 'customers') return stats.customers || 0
    if (campaignForm.targetSegment === 'waitlist') return stats.waitlist || 0
    return stats.total - (stats.unsubscribed || 0)
  }, [campaignForm.targetSegment, stats, audienceData.contacts])

  // Live preview rendered text
  const previewSubject = campaignForm.subject
    .replace(/\{\{\s*first_name\s*\}\}/gi, 'Alex')
    .replace(/\{\{\s*product_name\s*\}\}/gi, 'Cash Flow OS')
  const previewMessageHtml = formatHtmlPreview(
    campaignForm.message
      .replace(/\{\{\s*first_name\s*\}\}/gi, 'Alex')
      .replace(/\{\{\s*name\s*\}\}/gi, 'Alex Morgan')
      .replace(/\{\{\s*email\s*\}\}/gi, 'alex@company.com')
      .replace(/\{\{\s*product_name\s*\}\}/gi, 'Cash Flow OS')
  )

  return (
    <section className="admin-section-card marketing-hub-card" id="marketing">
      <header className="admin-section-head">
        <div>
          <span className="eyebrow">AUDIENCE & AUTOMATION</span>
          <h2>Email Marketing & Audience Hub</h2>
        </div>
        <div className="marketing-brevo-badge">
          <Mail size={14} />
          <span>Brevo SMTP Active (info@runwaysystems.cloud)</span>
        </div>
      </header>
      <p className="admin-section-hint">
        Every Google OAuth sign-in lead, verified Lemon Squeezy buyer, and waitlist subscriber is automatically captured and deduplicated here. Broadcast personalized campaigns via Brevo, offer discount codes, and export your audience anytime.
      </p>

      {/* Top Audience Metric Cards */}
      <div className="marketing-metrics-grid">
        <div className="marketing-metric-box">
          <div className="metric-header">
            <span>Total Audience</span>
            <Users size={16} className="text-gold" />
          </div>
          <strong>{(stats.total || 0).toLocaleString()}</strong>
          <small>All ingested contacts</small>
        </div>

        <div className="marketing-metric-box is-highlight">
          <div className="metric-header">
            <span>Signed-In Leads</span>
            <Sparkles size={16} className="text-lime" />
          </div>
          <strong>{(stats.leads || 0).toLocaleString()}</strong>
          <small>Logged in with Google (Not bought yet)</small>
        </div>

        <div className="marketing-metric-box">
          <div className="metric-header">
            <span>Verified Buyers</span>
            <ShoppingBag size={16} className="text-gold" />
          </div>
          <strong>{(stats.customers || 0).toLocaleString()}</strong>
          <small>Active paying customers</small>
        </div>

        <div className="marketing-metric-box">
          <div className="metric-header">
            <span>Waitlists Active</span>
            <UserPlus size={16} className="text-cyan" />
          </div>
          <strong>{(stats.waitlist || 0).toLocaleString()}</strong>
          <small>Pre-launch subscribers</small>
        </div>

        <div className="marketing-metric-box">
          <div className="metric-header">
            <span>Customer LTV</span>
            <CircleDollarSign size={16} className="text-gold" />
          </div>
          <strong>${((stats.totalLtvCents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
          <small>Total revenue from audience</small>
        </div>
      </div>

      {/* Campaign Studio Card */}
      <div className="marketing-composer-card">
        <div className="marketing-composer-head">
          <div>
            <span className="eyebrow text-gold">CAMPAIGN STUDIO</span>
            <h3>Broadcast Composer (Brevo Delivery)</h3>
            <p>Write high-converting emails with dynamic tags, custom discount codes, and live side-by-side previews.</p>
          </div>
          <div className="marketing-template-bar">
            <span className="template-label">Quick Templates:</span>
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                className="template-pill-btn"
                onClick={() => handleApplyTemplate(tmpl)}
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="marketing-composer-grid">
          {/* Left Form */}
          <div className="marketing-composer-form">
            <div className="form-group-row">
              <div className="form-group">
                <label>Target Audience Segment</label>
                <select
                  value={campaignForm.targetSegment}
                  onChange={(e) => setCampaignForm((c) => ({ ...c, targetSegment: e.target.value }))}
                >
                  <option value="all">All Subscribed Contacts ({stats.total - (stats.unsubscribed || 0)} recipients)</option>
                  <option value="leads">Signed-in Leads Only ({stats.leads || 0} non-buyers)</option>
                  <option value="customers">Verified Buyers Only ({stats.customers || 0} customers)</option>
                  <option value="waitlist">Product Waitlist Subscribers ({stats.waitlist || 0} prospects)</option>
                </select>
              </div>

              {campaignForm.targetSegment === 'waitlist' && (
                <div className="form-group">
                  <label>Filter by Product Waitlist</label>
                  <select
                    value={campaignForm.targetProductKey}
                    onChange={(e) => setCampaignForm((c) => ({ ...c, targetProductKey: e.target.value }))}
                  >
                    <option value="">All Product Waitlists</option>
                    {products.map((p) => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Internal Campaign Title</label>
              <input
                type="text"
                value={campaignForm.title}
                onChange={(e) => setCampaignForm((c) => ({ ...c, title: e.target.value }))}
                placeholder="e.g. VIP 48-Hour Weekend Promo"
              />
            </div>

            <div className="form-group">
              <div className="label-with-tags">
                <label>Subject Line</label>
                <div className="token-pills">
                  <span onClick={() => setCampaignForm((c) => ({ ...c, subject: `${c.subject} {{first_name}}` }))}>+ {'{{first_name}}'}</span>
                  <span onClick={() => setCampaignForm((c) => ({ ...c, subject: `${c.subject} {{product_name}}` }))}>+ {'{{product_name}}'}</span>
                </div>
              </div>
              <input
                type="text"
                value={campaignForm.subject}
                onChange={(e) => setCampaignForm((c) => ({ ...c, subject: e.target.value }))}
                placeholder="e.g. Exclusive 48-Hour Access: 20% off all systems"
              />
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>Eyebrow Header</label>
                <input
                  type="text"
                  value={campaignForm.eyebrow}
                  onChange={(e) => setCampaignForm((c) => ({ ...c, eyebrow: e.target.value }))}
                  placeholder="RUNWAY SYSTEMS · PRIVATE OFFER"
                />
              </div>

              <div className="form-group">
                <label>Lemon Squeezy Promo Code (Optional)</label>
                <div className="input-with-icon">
                  <Tag size={15} />
                  <input
                    type="text"
                    value={campaignForm.discountCode}
                    onChange={(e) => setCampaignForm((c) => ({ ...c, discountCode: e.target.value.toUpperCase() }))}
                    placeholder="e.g. VIP20 or LAUNCH10"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <div className="label-with-tags">
                <label>Message Content (Markdown supported)</label>
                <div className="token-pills">
                  <span onClick={() => setCampaignForm((c) => ({ ...c, message: `${c.message} {{first_name}}` }))}>+ {'{{first_name}}'}</span>
                </div>
              </div>
              <textarea
                rows={7}
                value={campaignForm.message}
                onChange={(e) => setCampaignForm((c) => ({ ...c, message: e.target.value }))}
                placeholder="Write your email body here. Use **bold text** for emphasis and double enter for new paragraphs."
              />
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>CTA Button Text</label>
                <input
                  type="text"
                  value={campaignForm.ctaLabel}
                  onChange={(e) => setCampaignForm((c) => ({ ...c, ctaLabel: e.target.value }))}
                  placeholder="Get Instant Access →"
                />
              </div>

              <div className="form-group">
                <label>CTA Button URL</label>
                <input
                  type="text"
                  value={campaignForm.ctaUrl}
                  onChange={(e) => setCampaignForm((c) => ({ ...c, ctaUrl: e.target.value }))}
                  placeholder="https://runwaysystems.cloud/products/cashflow-os"
                />
              </div>
            </div>

            {/* Campaign Actions */}
            <div className="marketing-actions-bar">
              <button
                type="button"
                className="button secondary"
                disabled={testSending || broadcastSending}
                onClick={handleSendTest}
              >
                <Mail size={15} />
                {testSending ? 'Sending Test...' : 'Send Test to Me'}
              </button>

              <button
                type="button"
                className="button primary"
                disabled={testSending || broadcastSending}
                onClick={() => setBroadcastModalOpen(true)}
              >
                <Send size={15} />
                Broadcast to {estimatedRecipients} Recipients
              </button>
            </div>
          </div>

          {/* Right Live Preview */}
          <div className="marketing-preview-container">
            <div className="preview-toolbar">
              <span className="preview-label">Live Email Preview</span>
              <div className="device-toggle">
                <button
                  type="button"
                  className={previewDevice === 'desktop' ? 'active' : ''}
                  onClick={() => setPreviewDevice('desktop')}
                >
                  <Monitor size={14} /> Desktop
                </button>
                <button
                  type="button"
                  className={previewDevice === 'mobile' ? 'active' : ''}
                  onClick={() => setPreviewDevice('mobile')}
                >
                  <Smartphone size={14} /> Mobile
                </button>
              </div>
            </div>

            <div className={`email-preview-frame is-${previewDevice}`}>
              <div className="email-preview-card">
                <div className="email-preview-eyebrow">{campaignForm.eyebrow || 'RUNWAY SYSTEMS · VIP ANNOUNCEMENT'}</div>
                <h4 className="email-preview-title">{previewSubject || 'Your Subject Line'}</h4>
                <div
                  className="email-preview-body"
                  dangerouslySetInnerHTML={{ __html: previewMessageHtml }}
                />

                {campaignForm.discountCode && (
                  <div className="email-preview-coupon">
                    <span className="coupon-sub">Exclusive Promotion Code</span>
                    <code className="coupon-code">{campaignForm.discountCode}</code>
                  </div>
                )}

                {campaignForm.ctaLabel && (
                  <div className="email-preview-cta">
                    <span className="email-cta-btn">{campaignForm.ctaLabel}</span>
                  </div>
                )}

                <div className="email-preview-footer">
                  <div>Runway Systems · High-Performance Google Sheets Operating Systems</div>
                  <div className="unsubscribe-line">
                    <span className="unsub-link">Unsubscribe</span> · <span>info@runwaysystems.cloud</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audience Segmentation & Contacts Table */}
      <div className="marketing-audience-section">
        <div className="audience-section-head">
          <div className="segment-filter-tabs">
            <button
              type="button"
              className={`filter-tab ${segment === 'all' ? 'active' : ''}`}
              onClick={() => setSegment('all')}
            >
              All Contacts ({stats.total || 0})
            </button>
            <button
              type="button"
              className={`filter-tab ${segment === 'leads' ? 'active' : ''}`}
              onClick={() => setSegment('leads')}
            >
              Signed-in Leads ({stats.leads || 0})
            </button>
            <button
              type="button"
              className={`filter-tab ${segment === 'customers' ? 'active' : ''}`}
              onClick={() => setSegment('customers')}
            >
              Verified Buyers ({stats.customers || 0})
            </button>
            <button
              type="button"
              className={`filter-tab ${segment === 'waitlist' ? 'active' : ''}`}
              onClick={() => setSegment('waitlist')}
            >
              Waitlists ({stats.waitlist || 0})
            </button>
            <button
              type="button"
              className={`filter-tab ${segment === 'unsubscribed' ? 'active' : ''}`}
              onClick={() => setSegment('unsubscribed')}
            >
              Unsubscribed ({stats.unsubscribed || 0})
            </button>
          </div>

          <div className="audience-controls">
            <div className="audience-search-box">
              <Search size={14} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email..."
              />
              {search && <button type="button" onClick={() => setSearch('')}><X size={12} /></button>}
            </div>

            <button
              type="button"
              className="button secondary button--small"
              onClick={handleExportCsv}
            >
              <Download size={13} /> Export CSV
            </button>

            <button
              type="button"
              className="button primary button--small"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus size={13} /> Add Contact
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="admin-table-wrap">
          <table className="admin-table audience-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Segment</th>
                <th>Systems / Waitlists</th>
                <th>Spend (USD)</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px' }}>
                    <RefreshCw className="spin" size={18} style={{ display: 'inline-block', marginRight: '8px' }} />
                    Loading audience list...
                  </td>
                </tr>
              ) : audienceData.contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No contacts found matching the selected filter.
                  </td>
                </tr>
              ) : (
                audienceData.contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <div className="contact-identity-cell">
                        {contact.avatarUrl ? (
                          <img src={contact.avatarUrl} alt="" className="contact-avatar-img" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="contact-avatar-fallback">
                            {(contact.name || contact.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <strong>{contact.name || 'Unnamed Founder'}</strong>
                          <small className="contact-email-line">{contact.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {contact.isCustomer ? (
                        <span className="audience-badge is-customer">
                          <ShoppingBag size={11} /> Buyer
                        </span>
                      ) : (
                        <span className="audience-badge is-lead">
                          <Sparkles size={11} /> Google Lead
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="product-pills-cell">
                        {(contact.productsOwned || []).map((key) => (
                          <span key={key} className="product-pill owned">
                            ✓ {key}
                          </span>
                        ))}
                        {(contact.waitlistsJoined || []).map((key) => (
                          <span key={key} className="product-pill waitlist">
                            ⏳ {key}
                          </span>
                        ))}
                        {(!contact.productsOwned?.length && !contact.waitlistsJoined?.length) && (
                          <span className="text-muted">None</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong>${((contact.totalSpendCents || 0) / 100).toFixed(2)}</strong>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                        {contact.ordersCount || 0} order{contact.ordersCount === 1 ? '' : 's'}
                      </small>
                    </td>
                    <td>
                      {contact.status === 'subscribed' ? (
                        <span className="status-pill active">Subscribed</span>
                      ) : (
                        <span className="status-pill muted">Unsubscribed</span>
                      )}
                    </td>
                    <td>
                      <small style={{ color: 'var(--text-muted)' }}>
                        {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '-'}
                      </small>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-row-actions">
                        <button
                          type="button"
                          className="action-icon-btn"
                          title="Copy email"
                          onClick={() => handleCopyEmail(contact.email, contact.id)}
                        >
                          {copiedId === contact.id ? <Check size={13} className="text-gold" /> : <Copy size={13} />}
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn"
                          title={contact.status === 'subscribed' ? 'Unsubscribe' : 'Resubscribe'}
                          onClick={() => handleToggleStatus(contact)}
                        >
                          <UserCheck size={13} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn text-danger"
                          title="Delete contact"
                          onClick={() => handleDeleteContact(contact.id, contact.email)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaign History Log */}
      {campaigns.length > 0 && (
        <div className="marketing-history-section">
          <div className="section-subtitle">
            <span className="eyebrow">BROADCAST LOGS</span>
            <h4>Past Marketing Broadcasts</h4>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Campaign / Subject</th>
                  <th>Target Segment</th>
                  <th>Recipients</th>
                  <th>Sent By</th>
                  <th>Dispatched At</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((camp) => (
                  <tr key={camp.id}>
                    <td>
                      <strong>{camp.title || camp.subject}</strong>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>{camp.subject}</small>
                    </td>
                    <td>
                      <span className="audience-badge">
                        {camp.targetSegment === 'leads' ? 'Signed-in Leads' : camp.targetSegment === 'customers' ? 'Buyers Only' : camp.targetSegment === 'waitlist' ? 'Waitlist' : 'All Subscribers'}
                      </span>
                    </td>
                    <td>
                      <strong>{camp.recipientCount} delivered</strong>
                    </td>
                    <td>
                      <small>{camp.sentBy}</small>
                    </td>
                    <td>
                      <small>{camp.sentAt ? new Date(camp.sentAt).toLocaleString() : '-'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {addModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setAddModalOpen(false)}>
          <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <header className="admin-modal-head">
              <h3>Add Manual Contact</h3>
              <button type="button" onClick={() => setAddModalOpen(false)}><X size={18} /></button>
            </header>
            <form onSubmit={handleAddContact} className="admin-modal-body">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="founder@venture.com"
                />
              </div>
              <div className="form-group">
                <label>Full Name (Optional)</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Alex Morgan"
                />
              </div>
              <div className="form-group">
                <label>Source</label>
                <select
                  value={addForm.source}
                  onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value }))}
                >
                  <option value="manual">Manual Entry</option>
                  <option value="google_signin">Google Sign-In</option>
                  <option value="checkout">Lemon Squeezy Checkout</option>
                  <option value="waitlist">Coming Soon Waitlist</option>
                </select>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="button secondary" onClick={() => setAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={busyAction}>
                  {busyAction ? 'Saving...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Confirmation Modal */}
      {broadcastModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => !broadcastSending && setBroadcastModalOpen(false)}>
          <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <header className="admin-modal-head">
              <h3>Confirm Email Broadcast</h3>
              <button type="button" onClick={() => !broadcastSending && setBroadcastModalOpen(false)}><X size={18} /></button>
            </header>
            <div className="admin-modal-body">
              <div className="broadcast-summary-callout">
                <AlertTriangle size={18} className="text-gold" />
                <div>
                  <strong>Ready to dispatch via Brevo?</strong>
                  <p>
                    This will send live emails to <strong>{estimatedRecipients} recipients</strong> in your{' '}
                    <code>{campaignForm.targetSegment}</code> segment from <strong>info@runwaysystems.cloud</strong>.
                  </p>
                </div>
              </div>

              <div className="broadcast-details-list">
                <div><span>Subject:</span> <strong>{previewSubject}</strong></div>
                <div><span>Promo Code:</span> <code>{campaignForm.discountCode || 'None'}</code></div>
                <div><span>CTA Link:</span> <small>{campaignForm.ctaUrl || 'Homepage'}</small></div>
                <div><span>Unsubscribe Protection:</span> <small>Active (Unsubscribed users will be automatically skipped)</small></div>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={broadcastSending}
                  onClick={() => setBroadcastModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={broadcastSending || estimatedRecipients === 0}
                  onClick={handleBroadcast}
                >
                  <Send size={15} />
                  {broadcastSending ? 'Broadcasting via Brevo...' : `Send to ${estimatedRecipients} Contacts`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
