import { useMemo, useState } from 'react'
import { CheckCircle2, Mail, Megaphone, Send, Users, UserRoundCheck, UserRoundPlus } from 'lucide-react'
import { createMarketingCampaign } from '../api/platformApi'

const audienceOptions = [
  { id: 'subscribers', title: 'Marketing subscribers', description: 'Everyone who actively asked for product updates.', icon: UserRoundCheck, countKey: 'subscribers' },
  { id: 'customers', title: 'Consented customers', description: 'Verified buyers who also opted in to marketing.', icon: Users, countKey: 'customers' },
  { id: 'waitlist', title: 'Consented waitlist', description: 'People waiting for a launch who also opted in to updates.', icon: UserRoundPlus, countKey: 'waitlist' },
]

const emptyCampaign = {
  audience: 'subscribers',
  productKey: '',
  subject: '',
  preheader: '',
  body: '',
  ctaLabel: '',
  ctaUrl: '',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function CampaignMetric({ icon: Icon, label, value, note }) {
  return (
    <article className="marketing-metric">
      <span><Icon size={18} /></span>
      <small>{label}</small>
      <strong>{Number(value || 0).toLocaleString()}</strong>
      <p>{note}</p>
    </article>
  )
}

export default function AdminMarketingPanel({ products = [], overview = {}, authOptions, onCampaignQueued, onError }) {
  const [form, setForm] = useState(emptyCampaign)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const counts = overview.counts || {}
  const selectedAudience = audienceOptions.find((item) => item.id === form.audience) || audienceOptions[0]
  const estimatedAudience = counts[selectedAudience.countKey] || 0
  const selectedProduct = products.find((product) => product.key === form.productKey)
  const ready = Boolean(form.subject.trim() && form.body.trim() && (!form.ctaLabel.trim() || form.ctaUrl.trim()))

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const productOptions = useMemo(() => products.filter((product) => product.active), [products])

  const send = async (event) => {
    event.preventDefault()
    if (!ready || sending) return
    const target = form.productKey ? ` for ${selectedProduct?.name || form.productKey}` : ''
    const approved = window.confirm(`Queue this campaign${target}? It will send only to contacts with active marketing consent. The current audience estimate is ${estimatedAudience}.`)
    if (!approved) return
    setSending(true)
    setNotice('')
    try {
      const campaign = await createMarketingCampaign({
        ...form,
        subject: form.subject.trim(),
        preheader: form.preheader.trim(),
        body: form.body.trim(),
        ctaLabel: form.ctaLabel.trim(),
        ctaUrl: form.ctaUrl.trim(),
      }, authOptions)
      setNotice(campaign.recipientCount ? `Queued for ${campaign.recipientCount} eligible contacts. Brevo delivery begins in the next queue cycle.` : 'Saved with no eligible consented contacts. No email was sent.')
      onCampaignQueued?.(campaign)
      setForm(emptyCampaign)
    } catch (error) {
      const message = error.message || 'The campaign could not be queued.'
      setNotice(message)
      onError?.(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="admin-section-card marketing-panel" id="marketing">
      <header className="admin-section-head">
        <div><span className="eyebrow">CONSENT-LED OUTREACH</span><h2>Email marketing</h2></div>
        <Megaphone size={20} />
      </header>
      <p className="admin-section-hint">Contacts are captured from sign-in, purchases, and launch requests. Campaigns are sent only to people with active marketing consent. Launch notices are separate: every person who requested a specific product launch remains eligible for that one requested notice.</p>

      <div className="marketing-metrics" aria-label="Contact audience counts">
        <CampaignMetric icon={Users} label="All contacts" value={counts.contacts} note="Signed in, purchased, or joined a launch list" />
        <CampaignMetric icon={UserRoundCheck} label="Marketing subscribers" value={counts.subscribers} note="Eligible for general product updates" />
        <CampaignMetric icon={Mail} label="Customers" value={counts.customers} note="Stored buyer contacts; consent still required" />
        <CampaignMetric icon={UserRoundPlus} label="Active waitlist" value={counts.waitlist} note="Waiting for a specific product launch" />
      </div>

      <div className="marketing-workspace">
        <form className="marketing-compose" onSubmit={send}>
          <div className="marketing-compose__head">
            <div><span className="eyebrow">NEW CAMPAIGN</span><h3>Write once. Queue safely.</h3></div>
            <span className="marketing-from"><Mail size={13} /> From info@runwaysystems.cloud</span>
          </div>
          <div className="marketing-audiences" aria-label="Campaign audience">
            {audienceOptions.map((option) => {
              const Icon = option.icon
              return (
                <label className={form.audience === option.id ? 'is-active' : ''} key={option.id}>
                  <input type="radio" name="audience" value={option.id} checked={form.audience === option.id} onChange={(event) => update('audience', event.target.value)} />
                  <Icon size={16} />
                  <span><b>{option.title}</b><small>{option.description}</small></span>
                  <em>{Number(counts[option.countKey] || 0).toLocaleString()}</em>
                </label>
              )
            })}
          </div>
          <div className="marketing-compose__grid">
            <label className="portal-field">
              <span>Subject line</span>
              <input required maxLength="150" value={form.subject} onChange={(event) => update('subject', event.target.value)} placeholder="A new Runway Systems product is here" />
            </label>
            <label className="portal-field">
              <span>Preheader <small>(optional)</small></span>
              <input maxLength="180" value={form.preheader} onChange={(event) => update('preheader', event.target.value)} placeholder="The short inbox preview next to your subject" />
            </label>
            <label className="portal-field marketing-wide-field">
              <span>Message</span>
              <textarea required rows="6" maxLength="4000" value={form.body} onChange={(event) => update('body', event.target.value)} placeholder={'Write a useful product update.\n\nUse short paragraphs and a clear next step.'} />
              <small>{form.body.length} / 4,000 characters</small>
            </label>
            <label className="portal-field">
              <span>Call-to-action label <small>(optional)</small></span>
              <input maxLength="80" value={form.ctaLabel} onChange={(event) => update('ctaLabel', event.target.value)} placeholder="Explore the update" />
            </label>
            <label className="portal-field">
              <span>Call-to-action URL <small>(optional)</small></span>
              <input type="url" maxLength="500" value={form.ctaUrl} onChange={(event) => update('ctaUrl', event.target.value)} placeholder="https://runwaysystems.cloud/products/..." />
            </label>
            {form.audience === 'waitlist' && (
              <label className="portal-field marketing-wide-field">
                <span>Narrow to one product <small>(optional)</small></span>
                <select value={form.productKey} onChange={(event) => update('productKey', event.target.value)}>
                  <option value="">All consented waitlist contacts</option>
                  {productOptions.map((product) => <option value={product.key} key={product.key}>{product.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="marketing-compose__footer">
            <p><CheckCircle2 size={14} /> {estimatedAudience.toLocaleString()} current {selectedAudience.title.toLowerCase()} before the final consent check. Every email includes a one-click unsubscribe link.</p>
            <button className="button primary" type="submit" disabled={!ready || sending}><Send size={15} /> {sending ? 'Queueing…' : 'Queue campaign'}</button>
          </div>
          {notice && <p className="marketing-compose__notice" role="status">{notice}</p>}
        </form>

        <aside className="marketing-side">
          <div className="marketing-side__heading"><span className="eyebrow">RECENT DELIVERY</span><h3>Campaign queue</h3></div>
          {(overview.campaigns || []).length ? <div className="marketing-campaign-list">
            {overview.campaigns.slice(0, 6).map((campaign) => (
              <article key={campaign.id}>
                <span className={`status-pill ${campaign.status === 'completed' ? 'status-approved' : campaign.status === 'queued' || campaign.status === 'sending' ? 'status-pending' : 'status-rejected'}`}>{campaign.kind === 'launch' ? 'launch' : campaign.status}</span>
                <b>{campaign.subject}</b>
                <small>{formatDate(campaign.createdAt)} · {campaign.sentCount || 0} / {campaign.recipientCount || 0} sent</small>
              </article>
            ))}
          </div> : <p className="marketing-empty">No campaigns yet. Your first queued email will appear here with its delivery progress.</p>}
          <div className="marketing-contact-snapshot">
            <span className="eyebrow">LATEST CONTACTS</span>
            {(overview.contacts || []).slice(0, 5).map((contact) => <div key={contact.id || contact.email}><span>{contact.email}</span><small>{contact.marketingConsent ? 'Marketing consent' : contact.lastSource || 'contact'}</small></div>)}
            {!(overview.contacts || []).length && <p>No contact activity yet.</p>}
          </div>
        </aside>
      </div>
    </section>
  )
}
