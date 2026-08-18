import { useEffect, useMemo, useState } from 'react'
import { Globe, Layers, Megaphone, Save, ShoppingBag, ScrollText } from 'lucide-react'
import { buildPoliciesViewModel } from '../data/policies'
import { buildProductViewModel } from '../data/catalog'
import { SITE_COPY_DEFAULTS } from '../lib/siteCopy'

const cx = (...classes) => classes.filter(Boolean).join(' ')

const ROWS_DEFAULT_PATHS = {
  tourItems: 'tour.items',
  featuresCards: 'features.cards',
  stepsItems: 'steps.items',
  benefitsItems: 'benefits.items',
  audiencesCards: 'audiences.cards',
  faqItems: 'faqs.items',
  pricingIncluded: 'pricing.included',
}

// ---------------------------------------------------------------------------
// Small helpers for flat <-> nested content editing.

function getAt(object, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object)
}

function setAt(object, path, value) {
  const keys = path.split('.')
  const clone = JSON.parse(JSON.stringify(object || {}))
  let cursor = clone
  for (const key of keys.slice(0, -1)) {
    cursor[key] = cursor[key] && typeof cursor[key] === 'object' && !Array.isArray(cursor[key]) ? cursor[key] : {}
    cursor = cursor[key]
  }
  cursor[keys[keys.length - 1]] = value
  return clone
}

const splitRows = (text) => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean)

const parsePairs = (text, count = 2) => splitRows(text).map((line) => line.split('::').map((part) => part.trim())).filter((parts) => parts.some(Boolean))

const serializePairs = (items, count = 2) => (items || []).map((item) => (Array.isArray(item) ? item : [item.title || item.role || '', item.copy || item.line || '']).slice(0, count).join(' :: ')).join('\n')

// Clarity metrics carry four parts and a numeric value, so they need their
// own serializer rather than the generic two-column pair helper.
const serializeMetrics = (items) => (items || [])
  .map((item) => [item.label || '', item.value ?? '', item.prefix || '', item.em || ''].join(' :: '))
  .join('\n')

// Hero floating cards carry an icon, a tone and a badge flag alongside their
// text. Only the text is editable, so the existing card at the same index is
// passed through to keep its icon and styling intact.
const serializeFloating = (items) => (items || [])
  .map((item) => [item.label || '', item.value || '', item.em || ''].join(' :: '))
  .join('\n')

function rowsValueFor(key, content, defaults) {
  const value = getAt(content, key)
  if (value === undefined || value === null) {
    const defaultItems = getAt(defaults, ROWS_DEFAULT_PATHS[key] || key)
    if (key === 'pricingIncluded') return (defaultItems || []).join('\n')
    if (key === 'tourItems') return (defaultItems || []).map((item) => [item.label || '', item.title || '', item.copy || ''].join(' :: ')).join('\n')
    if (key === 'audiencesCards') return (defaultItems || []).map((item) => [item.role || '', item.line || ''].join(' :: ')).join('\n')
    if (key === 'problem.clarity.metrics') return serializeMetrics(defaultItems)
    if (key === 'hero.visual.floating') return serializeFloating(defaultItems)
    return serializePairs(defaultItems, 2)
  }
  if (key === 'pricingIncluded') return (value || []).join('\n')
  if (key === 'problem.clarity.metrics') return serializeMetrics(value)
  if (key === 'hero.visual.floating') return serializeFloating(value)
  if (key === 'faqItems') return serializePairs(value, 2)
  if (key === 'tourItems') return value.map((item) => [item.label || '', item.title || '', item.copy || ''].join(' :: ')).join('\n')
  if (key === 'audiencesCards') return value.map((item) => [item.role || '', item.line || ''].join(' :: ')).join('\n')
  return serializePairs(value, 2)
}

function rowsParse(key, text, existing = []) {
  const lines = splitRows(text)
  // Floating cards: rewrite only the three text fields and carry the icon,
  // tone and badge over from the card that currently sits at this index, so
  // editing the wording never strips the artwork.
  if (key === 'hero.visual.floating') {
    const current = Array.isArray(existing) ? existing : []
    return lines.slice(0, 3).map((line, index) => {
      const [label, value, em] = line.split('::').map((part) => part.trim())
      const source = current[index] || {}
      const card = {
        ...source,
        label: label || '',
        value: value || '',
        em: em || '',
      }
      // A card shows either a badge tick or the small note, never both.
      if (source.badge && !em) card.badge = true
      else delete card.badge
      return card
    }).filter((card) => card.label || card.value)
  }
  if (key === 'faqItems') return lines.map((line) => line.split('::').map((part) => part.trim())).filter((parts) => parts.some(Boolean))
  if (key === 'tourItems') return lines.map((line) => {
    const [label, title, copy] = line.split('::').map((part) => part.trim())
    return { label: label || '', title: title || '', copy: copy || '' }
  }).filter((item) => item.title || item.copy)
  if (key === 'audiencesCards') return lines.map((line) => {
    const [role, lineText] = line.split('::').map((part) => part.trim())
    return { role: role || '', line: lineText || '' }
  }).filter((item) => item.role || item.line)
  // Proof stats and the scattered "before" notes render as plain pairs,
  // not {title, copy} objects.
  if (key === 'proof.stats' || key === 'problem.chaos.papers') {
    return lines
      .map((line) => line.split('::').map((part) => part.trim()))
      .map(([first, second]) => [first || '', second || ''])
      .filter((pair) => pair.some(Boolean))
  }
  // Clarity metrics feed AnimatedNumber, which calls toLocaleString on the
  // value, so it has to be a real number or the dashboard renders NaN.
  if (key === 'problem.clarity.metrics') {
    return lines.map((line) => {
      const [label, value, prefix, em] = line.split('::').map((part) => part.trim())
      const numeric = Number(String(value || '').replace(/[^0-9.-]/g, ''))
      return {
        label: label || '',
        value: Number.isFinite(numeric) ? numeric : 0,
        prefix: prefix || '',
        em: em || '',
      }
    }).filter((metric) => metric.label)
  }
  return lines.map((line) => {
    const [first, second] = line.split('::').map((part) => part.trim())
    return { title: first || '', copy: second || '' }
  }).filter((item) => item.title || item.copy)
}

// ---------------------------------------------------------------------------
// Schemas: every storefront text the owner can edit.

const PRODUCT_FIELDS = [
  ['meta.title', 'Page title (SEO)', 'text'],
  ['meta.description', 'Meta description', 'textarea'],
  ['hero.h1', 'Hero headline (line 1 / line 2)', 'list'],
  ['hero.lede', 'Hero lede', 'textarea'],
  ['hero.visual.floating', 'Hero floating cards (label :: value :: note per line, max 3)', 'rows'],
  ['hero.visual.cursorText', 'Hero cursor chip text', 'text'],
  ['ticker', 'Ticker items (one per line)', 'list'],
  ['proof.audience', 'Proof strip audience', 'text'],
  ['proof.stats', 'Proof stats (number :: label per line)', 'rows'],
  ['problem.heading', 'Problem heading (eyebrow / title)', 'list'],
  ['problem.intro', 'Problem section intro', 'textarea'],
  ['problem.chaos.label', 'Before label', 'text'],
  ['problem.chaos.h3', 'Before headline (line 1 / line 2)', 'list'],
  ['problem.chaos.papers', 'Before scattered notes (text :: mark per line)', 'rows'],
  ['problem.chaos.bullets', 'Before bullets (one per line)', 'list'],
  ['problem.clarity.label', 'After label', 'text'],
  ['problem.clarity.h3', 'After headline (line 1 / line 2)', 'list'],
  ['problem.clarity.head', 'After dashboard title', 'text'],
  ['problem.clarity.metrics', 'After metrics (label :: number :: prefix :: note per line)', 'rows'],
  ['problem.clarity.chartMax', 'After chart top value', 'text'],
  ['problem.clarity.chartBars', 'After chart bar heights (percent per line, 4-100)', 'list'],
  ['problem.clarity.bullets', 'After bullets (one per line)', 'list'],
  ['tour.eyebrow', 'Tour eyebrow', 'text'],
  ['tour.h2', 'Tour heading (line 1 / line 2)', 'list'],
  ['tour.intro', 'Tour intro', 'textarea'],
  ['tourItems', 'Tour steps (label :: title :: copy per line)', 'rows3'],
  ['features.eyebrow', 'Features eyebrow', 'text'],
  ['features.h2', 'Features heading (line 1 / line 2)', 'list'],
  ['features.intro', 'Features intro', 'textarea'],
  ['featuresCards', 'Feature cards (title :: copy per line)', 'rows'],
  ['features.privacy.h3', 'Privacy banner heading', 'text'],
  ['features.privacy.copy', 'Privacy banner copy', 'textarea'],
  ['steps.eyebrow', 'Steps eyebrow', 'text'],
  ['steps.h2', 'Steps heading (line 1 / line 2)', 'list'],
  ['steps.intro', 'Steps intro', 'textarea'],
  ['stepsItems', 'Steps (title :: copy per line)', 'rows'],
  ['steps.note.title', 'Sheets note title', 'text'],
  ['steps.note.body', 'Sheets note body', 'textarea'],
  ['benefits.heading', 'Benefits heading', 'text'],
  ['benefits.copy', 'Benefits copy', 'textarea'],
  ['benefitsItems', 'Benefit items (title :: copy per line)', 'rows'],
  ['audiences.eyebrow', 'Audiences eyebrow', 'text'],
  ['audiences.h2', 'Audiences heading (line 1 / line 2)', 'list'],
  ['audiences.intro', 'Audiences intro', 'textarea'],
  ['audiencesCards', 'Audience cards (role :: line per line)', 'rows'],
  ['audiences.note', 'Audiences closing note', 'textarea'],
  ['pricing.eyebrow', 'Pricing eyebrow', 'text'],
  ['pricing.h2', 'Pricing heading (line 1 / line 2)', 'list'],
  ['pricing.intro', 'Pricing intro', 'textarea'],
  ['pricing.reassurance', 'Reassurance items (one per line)', 'list'],
  ['pricing.priceSub', 'Price card subtitle', 'text'],
  ['pricing.license', 'License title', 'text'],
  ['pricing.licenseBody', 'License body', 'textarea'],
  ['pricingIncluded', 'Included features (one per line)', 'list'],
  ['faqs.eyebrow', 'FAQ eyebrow', 'text'],
  ['faqs.h2', 'FAQ heading (line 1 / line 2)', 'list'],
  ['faqItems', 'FAQs (question :: answer per line)', 'rows'],
  ['finalCta.eyebrow', 'Final CTA eyebrow', 'text'],
  ['finalCta.h2', 'Final CTA heading (line 1 / line 2)', 'list'],
  ['finalCta.copy', 'Final CTA copy', 'textarea'],
  ['finalCta.small', 'Final CTA reassurance items (one per line)', 'list'],
]

const SUITE_FIELDS = [
  ['hero.h1', 'Hero headline (line 1 / line 2)', 'list'],
  ['hero.lede', 'Hero lede', 'textarea'],
  ['ticker', 'Ticker items (one per line)', 'list'],
  ['whyHeading', 'Why heading (line 1 / line 2)', 'list'],
  ['whyIntro', 'Why intro', 'textarea'],
  ['whyItems', 'Why cards (title :: copy per line)', 'rows'],
  ['faqItems', 'Suite FAQs (question :: answer per line)', 'rows'],
  ['bundle.eyebrow', 'Bundle eyebrow', 'text'],
  ['bundle.title', 'Bundle title', 'text'],
  ['bundle.body', 'Bundle body', 'textarea'],
  ['finalCta.eyebrow', 'Final CTA eyebrow', 'text'],
  ['finalCta.h2', 'Final CTA heading (line 1 / line 2)', 'list'],
  ['finalCta.copy', 'Final CTA copy', 'textarea'],
  ['finalCta.button', 'Final CTA button label', 'text'],
  ['finalCta.small', 'Final CTA reassurance items (one per line)', 'list'],
  ['proof.audience', 'Proof strip audience', 'text'],
  ['proof.stats', 'Proof stats (number :: label per line)', 'rows'],
  ['consent.description', 'Cookie banner description', 'textarea'],
]

// ---------------------------------------------------------------------------
// Site copy schema: every storefront string outside the catalog, policies,
// and per-product content. Grouped by the surface it appears on.

const SITE_COPY_GROUPS = [
  {
    key: 'homeSeo',
    title: 'Homepage SEO',
    hint: 'Title and meta description for the suite homepage (search results and social cards).',
    fields: [
      ['title', 'Page title (SEO)', 'text'],
      ['description', 'Meta description', 'textarea'],
    ],
  },
  {
    key: 'footer',
    title: 'Footer',
    hint: 'Brand line, motto, the two support-column notes, and the bottom disclaimer.',
    fields: [
      ['tagline', 'Brand tagline', 'text'],
      ['motto', 'Brand motto', 'text'],
      ['supportNotes', 'Support column notes (one per line, two lines)', 'list'],
      ['disclaimer', 'Bottom disclaimer', 'text'],
    ],
  },
  {
    key: 'cart',
    title: 'Cart page',
    hint: 'Empty-cart heading and copy, plus the reassurance line under the checkout button.',
    fields: [
      ['emptyTitle', 'Empty cart heading', 'text'],
      ['emptyCopy', 'Empty cart copy', 'textarea'],
      ['assurance', 'Checkout reassurance line', 'text'],
    ],
  },
  {
    key: 'checkoutModal',
    title: 'Checkout error modal',
    hint: 'Shown when secure checkout cannot be started (the support email is appended after the body).',
    fields: [
      ['title', 'Modal heading', 'text'],
      ['body', 'Modal body', 'text'],
    ],
  },
  {
    key: 'success',
    title: 'Success page',
    hint: 'Headings and body for the verified and the verifying states.',
    fields: [
      ['verifiedTitle', 'Verified heading', 'text'],
      ['verifyingTitle', 'Verifying heading', 'text'],
      ['verifyingBody', 'Verifying body', 'textarea'],
    ],
  },
  {
    key: 'authModal',
    title: 'Sign-in modal',
    hint: 'Heading and intro shown when a visitor opens the Google sign-in dialog.',
    fields: [
      ['title', 'Modal heading', 'text'],
      ['intro', 'Modal intro', 'textarea'],
    ],
  },
  {
    key: 'notFound',
    title: '404 page',
    hint: 'Heading and copy for unknown routes.',
    fields: [
      ['title', '404 heading', 'text'],
      ['copy', '404 copy', 'textarea'],
    ],
  },
  {
    key: 'navbar',
    title: 'Navigation buttons',
    hint: 'Primary call-to-action labels on desktop and mobile navigation.',
    fields: [
      ['buyLabel', 'Product buy button', 'text'],
      ['browseLabel', 'Browse button', 'text'],
    ],
  },
]

function SiteCopyEditor({ settings, onSave, saving }) {
  const [draft, setDraft] = useState(null)
  const content = draft || settings.suiteContent?.siteCopy || {}

  const valueFor = (groupKey, path, type) => {
    const value = getAt(content, `${groupKey}.${path}`)
    if (value !== undefined && value !== null) return type === 'list' ? value.join('\n') : value
    const fallback = getAt(SITE_COPY_DEFAULTS, `${groupKey}.${path}`)
    return type === 'list' ? (fallback || []).join('\n') : (fallback ?? '')
  }

  const update = (groupKey, path, type, value) => {
    setDraft(setAt(content, `${groupKey}.${path}`, type === 'list' ? splitRows(value) : value))
  }

  const submit = () => {
    if (!draft) return
    // Prune empty slots so the storefront keeps built-in defaults for them.
    const pruned = JSON.parse(JSON.stringify(draft))
    const prune = (object) => {
      if (!object || typeof object !== 'object') return
      for (const [childKey, value] of Object.entries(object)) {
        if (Array.isArray(value)) {
          if (!value.length) delete object[childKey]
        } else if (typeof value === 'string') {
          if (!value.trim()) delete object[childKey]
        } else {
          prune(value)
        }
      }
    }
    prune(pruned)
    onSave(pruned)
    setDraft(null)
  }

  return (
    <div className="content-editor">
      <div className="content-editor__toolbar">
        <p className="content-editor__hint">Site-wide interface copy: footer, cart, checkout, success, sign-in, 404, homepage SEO, and navigation buttons.</p>
        <button className="button primary" type="button" onClick={submit} disabled={!draft || saving}>
          <Save size={15} /> {saving ? 'Saving...' : 'Save site copy'}
        </button>
      </div>
      {SITE_COPY_GROUPS.map((group) => (
        <fieldset className="admin-settings-group" key={group.key}>
          <legend>{group.title}</legend>
          <p className="admin-settings-group-copy">{group.hint}</p>
          <div className="admin-settings-group-grid">
            {group.fields.map(([path, label, type]) => (
              <Field key={`${group.key}.${path}`} label={label} type={type} value={valueFor(group.key, path, type)} onChange={(value) => update(group.key, path, type, value)} />
            ))}
          </div>
        </fieldset>
      ))}
      {draft && (
        <div className="admin-settings-footer">
          <p>You have unsaved changes.</p>
          <button className="button primary" type="button" onClick={submit} disabled={saving}><Save size={15} /> Save site copy</button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field rendering.

function Field({ label, type, value, onChange }) {
  if (type === 'textarea') {
    return (
      <label className="portal-field admin-wide-field">
        <span>{label}</span>
        <textarea rows="3" value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    )
  }
  if (type === 'list') {
    return (
      <label className="portal-field admin-wide-field">
        <span>{label}</span>
        <textarea rows="2" value={Array.isArray(value) ? value.join('\n') : ''} onChange={(event) => onChange(splitRows(event.target.value))} />
        <small>One item per line. Leave empty to keep the default.</small>
      </label>
    )
  }
  if (type === 'rows' || type === 'rows3') {
    return (
      <label className="portal-field admin-wide-field">
        <span>{label}</span>
        <textarea rows="4" value={value} onChange={(event) => onChange(event.target.value)} />
        <small>One item per line using :: as the separator. Leave empty to keep the default.</small>
      </label>
    )
  }
  return (
    <label className="portal-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

// ---------------------------------------------------------------------------
// Panels.

function ProductContentEditor({ products, defaults, onSave, savingKey }) {
  const [key, setKey] = useState(products[0]?.key || '')
  const product = products.find((item) => item.key === key) || null
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    setDraft(null)
  }, [key])

  if (!product) return <p className="table-empty">No products yet. Create one first.</p>

  const content = draft || product.content || {}
  const currentDefaults = defaults[product.key] || {}

  const valueFor = (path, type) => {
    if (type === 'rows' || type === 'rows3') return rowsValueFor(path, content, currentDefaults)
    const value = getAt(content, path)
    if (value !== undefined && value !== null) return value
    return getAt(currentDefaults, path) ?? ''
  }

  const update = (path, type, value) => {
    // Pass the current items so parsers that only edit text (floating cards)
    // can preserve fields the textarea does not expose, such as the icon.
    const existing = getAt(content, path) ?? getAt(currentDefaults, ROWS_DEFAULT_PATHS[path] || path)
    setDraft(setAt(content, path, type === 'rows' || type === 'rows3' ? rowsParse(path, value, existing) : value))
  }

  const submit = () => {
    if (!draft) return
    // Prune empty slots so the storefront keeps built-in defaults for them.
    const pruned = JSON.parse(JSON.stringify(draft))
    const prune = (object) => {
      if (!object || typeof object !== 'object') return
      for (const [childKey, value] of Object.entries(object)) {
        if (Array.isArray(value)) {
          if (!value.length) delete object[childKey]
          // Only recurse into plain objects. Pair arrays such as the chaos
          // paper chips (['Who still owes me?', '??']) and the proof stats
          // are positional: deleting an empty slot would turn ['A', ''] into
          // ['A', null] and the renderer destructures by position, so the
          // second value would come back undefined.
          else value.forEach((item) => item && typeof item === 'object' && !Array.isArray(item) && prune(item))
        } else if (typeof value === 'string') {
          if (!value.trim()) delete object[childKey]
        } else {
          prune(value)
        }
      }
    }
    prune(pruned)
    onSave(key, pruned)
    setDraft(null)
  }

  return (
    <div className="content-editor">
      <div className="content-editor__toolbar">
        <select value={key} onChange={(event) => setKey(event.target.value)} aria-label="Product to edit">
          {products.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select>
        <button className="button primary" type="button" onClick={submit} disabled={!draft || savingKey === `content:${key}`}>
          <Save size={15} /> {savingKey === `content:${key}` ? 'Saving...' : `Save ${product.name} content`}
        </button>
      </div>
      <div className="admin-settings-group-grid">
        {PRODUCT_FIELDS.map(([path, label, type]) => (
          <Field key={path} label={label} type={type} value={valueFor(path, type)} onChange={(value) => update(path, type, value)} />
        ))}
      </div>
      {draft && (
        <div className="admin-settings-footer">
          <p>You have unsaved changes.</p>
          <button className="button primary" type="button" onClick={submit} disabled={savingKey === `content:${key}`}><Save size={15} /> Save content</button>
        </div>
      )}
    </div>
  )
}

function SuiteContentEditor({ settings, onSave, saving }) {
  const [draft, setDraft] = useState(null)
  const content = draft || settings.suiteContent || {}

  const valueFor = (path, type) => {
    if (type === 'rows' || type === 'rows3') return rowsValueFor(path, content, {})
    const value = getAt(content, path)
    return value !== undefined && value !== null ? value : ''
  }

  const update = (path, type, value) => {
    const existing = getAt(content, path)
    setDraft(setAt(content, path, type === 'rows' || type === 'rows3' ? rowsParse(path, value, existing) : value))
  }

  const submit = () => {
    if (!draft) return
    const next = { ...content, ...draft }
    for (const key of Object.keys(next)) {
      const value = next[key]
      if ((Array.isArray(value) && !value.length) || (typeof value === 'string' && !value.trim())) delete next[key]
    }
    onSave(next)
    setDraft(null)
  }

  return (
    <div className="content-editor">
      <div className="content-editor__toolbar">
        <p>Homepage copy: hero, ticker, why cards, bundle banner, FAQs, and the final call to action.</p>
        <button className="button primary" type="button" onClick={submit} disabled={!draft || saving}><Save size={15} /> {saving ? 'Saving...' : 'Save suite content'}</button>
      </div>
      <div className="admin-settings-group-grid">
        {SUITE_FIELDS.map(([path, label, type]) => (
          <Field key={path} label={label} type={type} value={valueFor(path, type)} onChange={(value) => update(path, type, value)} />
        ))}
      </div>
    </div>
  )
}

function PoliciesEditor({ settings, onSave, saving }) {
  const defaults = useMemo(() => buildPoliciesViewModel({}), [])
  const [draft, setDraft] = useState(null)
  const content = draft || settings.policies || {}

  const sections = content.sections?.length ? content.sections : defaults.sections
  const intro = content.intro ?? defaults.intro

  const blocksToText = (blocks) => (blocks || []).map((block) => `${block.notice ? '! ' : block.h ? '# ' : ''}${block.h || ''}${block.h ? '\n' : ''}${block.p || ''}`).join('\n\n')

  const textToBlocks = (text) => String(text || '').split(/\n\n+/).map((raw) => {
    const lines = raw.split('\n').filter((line) => line.trim())
    let heading = ''
    let notice = false
    let rest = lines
    if (lines.length) {
      if (lines[0].startsWith('! ')) { notice = true; heading = lines[0].slice(2).trim(); rest = lines.slice(1) }
      else if (lines[0].startsWith('# ')) { heading = lines[0].slice(2).trim(); rest = lines.slice(1) }
    }
    return { h: heading, p: rest.join(' ').trim(), notice: notice || undefined }
  }).filter((block) => block.h || block.p)

  const submit = () => {
    if (!draft) return
    onSave(draft)
    setDraft(null)
  }

  return (
    <div className="content-editor">
      <div className="content-editor__toolbar">
        <p>Legal page copy. Prefix a block heading with # and a warning block with !. Separate blocks with a blank line.</p>
        <button className="button primary" type="button" onClick={submit} disabled={!draft || saving}><Save size={15} /> {saving ? 'Saving...' : 'Save policies'}</button>
      </div>
      <label className="portal-field admin-wide-field">
        <span>Policy intro</span>
        <textarea rows="2" value={intro} onChange={(event) => setDraft({ ...content, intro: event.target.value })} />
      </label>
      {sections.map((section, index) => (
        <label className="portal-field admin-wide-field" key={section.id}>
          <span>{section.title}</span>
          <textarea
            rows="8"
            value={blocksToText(draft?.sections?.[index]?.blocks ?? section.blocks)}
            onChange={(event) => {
              const nextSections = sections.map((item, itemIndex) => itemIndex === index
                ? { ...item, blocks: textToBlocks(event.target.value) }
                : item)
              setDraft({ ...content, sections: nextSections })
            }}
          />
        </label>
      ))}
    </div>
  )
}

function AnnouncementEditor({ settings, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    active: false,
    message: '',
    linkText: '',
    linkUrl: '',
    dismissible: true,
    ...(settings?.announcement || {}),
  }))
  const [dirty, setDirty] = useState(false)

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  const submit = () => {
    if (!dirty) return
    onSave(form)
    setDirty(false)
  }

  return (
    <div className="content-editor">
      <div className="content-editor__toolbar">
        <p>The announcement bar sits at the very top of every storefront page. Visitors can dismiss it until the message changes.</p>
        <button className="button primary" type="button" onClick={submit} disabled={!dirty || saving}><Save size={15} /> {saving ? 'Saving...' : 'Save announcement'}</button>
      </div>
      <label className="toggle-setting">
        <span><b>Announcement active</b><small>Show the bar across the storefront.</small></span>
        <input type="checkbox" checked={form.active} onChange={(event) => update('active', event.target.checked)} />
        <i aria-hidden="true" />
      </label>
      <div className="admin-settings-group-grid">
        <label className="portal-field admin-wide-field">
          <span>Message</span>
          <textarea rows="2" maxLength="200" value={form.message || ''} onChange={(event) => update('message', event.target.value)} placeholder="Launch week: the complete suite is 20% off until Sunday." />
        </label>
        <label className="portal-field">
          <span>Link text (optional)</span>
          <input maxLength="80" value={form.linkText || ''} onChange={(event) => update('linkText', event.target.value)} placeholder="Shop the sale" />
        </label>
        <label className="portal-field">
          <span>Link URL (optional)</span>
          <input type="url" maxLength="500" value={form.linkUrl || ''} onChange={(event) => update('linkUrl', event.target.value)} placeholder="https://your-domain.com/sale" />
          <small>Must be a full https:// URL when provided.</small>
        </label>
        <label className="toggle-setting">
          <span><b>Dismissible</b><small>Visitors can close the bar for this message.</small></span>
          <input type="checkbox" checked={form.dismissible} onChange={(event) => update('dismissible', event.target.checked)} />
          <i aria-hidden="true" />
        </label>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabbed panel.

export default function AdminContentPanel({ products, settings, onSaveProductContent, onSaveSuiteContent, onSavePolicies, onSaveAnnouncement, savingKey, notify }) {
  const [tab, setTab] = useState('suite')
  // Built-in view models feed the editor placeholders, so the owner sees the
  // current live copy while editing.
  const defaults = useMemo(() => {
    const map = {}
    for (const product of products) map[product.key] = buildProductViewModel(product.key, null)
    return map
  }, [products])

  const saveProduct = async (key, content) => {
    try {
      await onSaveProductContent(key, content)
      notify(`Content saved for ${products.find((item) => item.key === key)?.name || key}.`)
    } catch (error) {
      notify(error.message || 'Product content could not be saved.')
    }
  }

  const saveSuite = async (content) => {
    try {
      await onSaveSuiteContent(content)
      notify('Suite content saved.')
    } catch (error) {
      notify(error.message || 'Suite content could not be saved.')
    }
  }

  const savePolicies = async (policies) => {
    try {
      await onSavePolicies(policies)
      notify('Policies saved.')
    } catch (error) {
      notify(error.message || 'Policies could not be saved.')
    }
  }

  const saveAnnouncement = async (announcement) => {
    try {
      await onSaveAnnouncement(announcement)
      notify(announcement.active && announcement.message ? 'Announcement is live on the storefront.' : 'Announcement hidden.')
    } catch (error) {
      notify(error.message || 'Announcement could not be saved.')
    }
  }

  return (
    <section className="admin-section-card" id="content">
      <header className="admin-section-head">
        <div><span className="eyebrow">STORE CONTENT</span><h2>Content studio</h2></div>
        <ScrollText size={20} />
      </header>
      <div className="content-tabs" role="tablist" aria-label="Content sections">
        <button className={tab === 'suite' ? 'is-active' : ''} type="button" onClick={() => setTab('suite')}><Layers size={14} /> Suite homepage</button>
        <button className={tab === 'product' ? 'is-active' : ''} type="button" onClick={() => setTab('product')}><ShoppingBag size={14} /> Product pages</button>
        <button className={tab === 'policies' ? 'is-active' : ''} type="button" onClick={() => setTab('policies')}><ScrollText size={14} /> Legal policies</button>
        <button className={tab === 'announcement' ? 'is-active' : ''} type="button" onClick={() => setTab('announcement')}><Megaphone size={14} /> Announcement bar</button>
        <button className={tab === 'siteCopy' ? 'is-active' : ''} type="button" onClick={() => setTab('siteCopy')}><Globe size={14} /> Site copy</button>
      </div>
      <div className="content-panels">
        {tab === 'suite' && <SuiteContentEditor settings={settings} onSave={saveSuite} saving={savingKey === 'suite-content'} />}
        {tab === 'product' && <ProductContentEditor products={products} defaults={defaults} onSave={saveProduct} savingKey={savingKey} />}
        {tab === 'policies' && <PoliciesEditor settings={settings} onSave={savePolicies} saving={savingKey === 'policies'} />}
        {tab === 'announcement' && <AnnouncementEditor settings={settings} onSave={saveAnnouncement} saving={savingKey === 'announcement'} />}
        {tab === 'siteCopy' && <SiteCopyEditor settings={settings} onSave={(siteCopy) => saveSuite({ ...(settings.suiteContent || {}), siteCopy })} saving={savingKey === 'suite-content'} />}
      </div>
    </section>
  )
}
