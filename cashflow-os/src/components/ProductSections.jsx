import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  CalendarRange,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Folder,
  Gauge,
  Grid2X2,
  HeartHandshake,
  Infinity as InfinityIcon,
  Layers,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Mail,
  MousePointer2,
  PieChart,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react'
import ProductMockVisual from './ProductMockVisual'

const cx = (...classes) => classes.filter(Boolean).join(' ')

export const SECTION_ICONS = {
  spreadsheet: FileSpreadsheet,
  check: Check,
  layoutDashboard: LayoutDashboard,
  receipt: ReceiptText,
  barChart3: BarChart3,
  trendingUp: TrendingUp,
  fileSpreadsheet: FileSpreadsheet,
  gauge: Gauge,
  pieChart: PieChart,
  shieldCheck: ShieldCheck,
  clock3: Clock3,
  users: Users,
  fileCheck2: FileCheck2,
  refreshCw: RefreshCw,
  banknote: Banknote,
  walletCards: WalletCards,
  sparkles: Sparkles,
  zap: Zap,
  circleDollarSign: CircleDollarSign,
  layers: Layers,
  heartHandshake: HeartHandshake,
  fileText: FileText,
  target: Target,
  calendarRange: CalendarRange,
  listChecks: ListChecks,
  send: Send,
  badgeCheck: BadgeCheck,
  folder: Folder,
}

export function sectionIcon(key) {
  return SECTION_ICONS[key] || Folder
}

// The "before" squiggle is deliberately identical on every product page: it is
// the brand's chaos motif, not per-product data. Its length feeds
// getTotalLength() in usePageAnimations, so a single shared path also
// guarantees the draw-on ("snake") animation runs at exactly the same speed
// everywhere. Do not make this per-product.
const CHAOS_PATH = 'M4 82 C45 20 80 100 120 52 S190 89 225 38 S280 82 316 17'

// Six scatter slots for the chaos chips, matching the CSS.
export const PAPER_POSITIONS = ['one', 'two', 'three', 'four', 'five', 'six']

const DEFAULT_MINI_BARS = [44, 68, 52, 82, 63, 92, 74, 100]

// The clarity chart shape is per-product content: a finance system trends up,
// but a CRM or project tool may want a different story. Heights are clamped
// to 4-100% so an out-of-range edit cannot collapse or overflow the chart.
function MiniBars({ bars }) {
  const heights = (Array.isArray(bars) && bars.length ? bars : DEFAULT_MINI_BARS)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.min(100, Math.max(4, Math.round(value))))
    .slice(0, 12)
  const safe = heights.length ? heights : DEFAULT_MINI_BARS
  return (
    <div className="mini-bars" aria-hidden="true">
      {safe.map((height, index) => <i key={index} style={{ '--h': `${height}%`, '--d': `${index * 60}ms` }} />)}
    </div>
  )
}

export function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, className = '' }) {
  const numberRef = useRef(null)

  useEffect(() => {
    const node = numberRef.current
    if (!node) return undefined
    const format = (current) => `${prefix}${current.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.textContent = format(value)
      return undefined
    }
    const counter = { current: 0 }
    node.textContent = format(0)
    const tween = gsap.to(counter, {
      current: value,
      duration: 1.55,
      ease: 'power3.out',
      scrollTrigger: { trigger: node, start: 'top 94%', once: true },
      onUpdate: () => { node.textContent = format(counter.current) },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [value, prefix, suffix, decimals])

  return <b ref={numberRef} className={className}>{prefix}{Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</b>
}

export function ProductScreenshot({ src, alt, variant = 'charts', eager = false, aspectRatio, animated = false, onRatio }) {
  const [loaded, setLoaded] = useState(false)
  const overlay = (
    <span className="product-shot__effects" aria-hidden="true">
      {variant === 'invoices' && <><i className="row-sweep row-sweep--one" /><i className="row-sweep row-sweep--two" /><i className="row-sweep row-sweep--three" /></>}
      {variant === 'dashboard' && <><i className="metric-pulse metric-pulse--one" /><i className="metric-pulse metric-pulse--two" /><i className="metric-pulse metric-pulse--three" /></>}
      {(variant === 'charts' || variant === 'forecast') && <><i className="chart-playhead" /><i className="chart-glint chart-glint--one" /><i className="chart-glint chart-glint--two" /></>}
      {variant === 'categories' && <><i className="category-pulse category-pulse--one" /><i className="category-pulse category-pulse--two" /></>}
      {variant === 'risk' && <><i className="risk-pulse risk-pulse--one" /><i className="risk-pulse risk-pulse--two" /></>}
      <i className="product-shot__telemetry-line" />
      <i className="product-shot__live"><b /> Live model</i>
      <i className="product-shot__scan" />
    </span>
  )

  return (
    <figure
      className={cx('product-shot', `product-shot--${variant}`, animated && 'product-shot--animated', animated && 'product-shot--cover')}
      style={aspectRatio ? { '--shot-ratio': aspectRatio } : undefined}
    >
      <img
        className={cx(loaded && 'is-loaded')}
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        onLoad={(event) => {
          setLoaded(true)
          // Report the intrinsic ratio so a ratio-sized container can frame an
          // upload we have no authored dimensions for.
          const { naturalWidth: w, naturalHeight: h } = event.currentTarget
          if (onRatio && w > 0 && h > 0) onRatio(`${w} / ${h}`)
        }}
      />
      {overlay}
    </figure>
  )
}

// Six scatter slots exist in the CSS. Anything beyond that would reuse a
// position and stack cards on top of each other, so callers cap at six.
export const FLOATING_POSITIONS = [
  'floating-card--profit',
  'floating-card--invoice',
  'floating-card--runway',
  'floating-card--four',
  'floating-card--five',
  'floating-card--six',
]
export const MAX_FLOATING_CARDS = FLOATING_POSITIONS.length

export function FloatingCardVisual({ card, index = 0 }) {
  const Icon = sectionIcon(card.icon)
  return (
    <div className={cx('floating-card', FLOATING_POSITIONS[index % FLOATING_POSITIONS.length])}>
      <span className={cx('float-icon', card.tone && `float-icon--${card.tone}`)}><Icon size={17} /></span>
      <div><small>{card.label}</small><strong>{card.value}</strong></div>
      {card.badge ? <BadgeCheck size={19} /> : <em>{card.em}</em>}
    </div>
  )
}

export function HeroVisual({ visual, name }) {
  const visualRef = useRef(null)
  const cardRef = useRef(null)
  const cursorRef = useRef(null)
  const interactingRef = useRef(false)
  const touchResetRef = useRef(null)
  const [measuredRatio, setMeasuredRatio] = useState('')
  // Authored ratio wins; otherwise use whatever the image reports once loaded.
  const shotRatio = visual.screen?.aspectRatio || measuredRatio

  useEffect(() => () => window.clearTimeout(touchResetRef.current), [])

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const floatingCards = () => visualRef.current ? [...visualRef.current.querySelectorAll('.floating-card')] : []

  const bringCardsForward = () => {
    if (reducedMotion() || interactingRef.current) return
    interactingRef.current = true
    visualRef.current?.classList.add('is-interacting')
    const poses = [
      { x: 15, y: -19, rotationY: -9, rotationX: 3, rotationZ: 1.2 },
      { x: -17, y: 13, rotationY: 10, rotationX: -3, rotationZ: -1.4 },
      { x: 21, y: 1, rotationY: -8, rotationX: 2, rotationZ: .8 },
    ]
    floatingCards().forEach((card, index) => {
      gsap.killTweensOf(card)
      gsap.to(card, {
        ...poses[index],
        zIndex: 12 + index,
        scale: 1.075,
        boxShadow: '0 34px 75px rgba(0,0,0,.36)',
        duration: .62,
        delay: index * .055,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    })
    gsap.to(cardRef.current, { scale: .975, duration: .62, ease: 'power3.out', overwrite: 'auto' })
  }

  const returnCards = (event) => {
    if (event?.pointerType === 'touch') return
    window.clearTimeout(touchResetRef.current)
    if (reducedMotion()) return
    interactingRef.current = false
    visualRef.current?.classList.remove('is-interacting')
    floatingCards().forEach((card, index) => {
      const flipDirection = index === 1 ? 1 : -1
      gsap.to(card, {
        keyframes: [
          { rotationY: flipDirection * 18, rotationX: -7, scale: .985, duration: .2, ease: 'power2.in' },
          { x: 0, y: 0, rotationY: 0, rotationX: 0, rotationZ: 0, scale: 1, boxShadow: '0 20px 50px rgba(0,0,0,.28)', duration: .56, ease: 'power3.out' },
        ],
        delay: index * .045,
        overwrite: 'auto',
        onComplete: () => gsap.set(card, { zIndex: 5 }),
      })
    })
    gsap.to(cardRef.current, { rotateY: -4, rotateX: 3, y: 0, scale: 1, duration: .82, ease: 'power3.inOut', overwrite: 'auto' })
    gsap.to(cursorRef.current, { opacity: 0, scale: .82, duration: .28, ease: 'power2.out', overwrite: 'auto' })
  }

  const onMove = (event) => {
    if (reducedMotion() || event.pointerType === 'touch') return
    bringCardsForward()
    const cardBounds = cardRef.current.getBoundingClientRect()
    const visualBounds = visualRef.current.getBoundingClientRect()
    const x = (event.clientX - cardBounds.left) / cardBounds.width - 0.5
    const y = (event.clientY - cardBounds.top) / cardBounds.height - 0.5
    gsap.to(cardRef.current, { rotateY: x * 7, rotateX: -y * 5.5, scale: .975, duration: .42, ease: 'power3.out', overwrite: 'auto' })
    gsap.to(cursorRef.current, {
      x: event.clientX - visualBounds.left + 16,
      y: event.clientY - visualBounds.top + 15,
      opacity: 1,
      scale: 1,
      rotation: -3,
      duration: .24,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  const onPress = (event) => {
    if (reducedMotion()) return
    bringCardsForward()
    if (event.pointerType === 'touch') {
      window.clearTimeout(touchResetRef.current)
      touchResetRef.current = window.setTimeout(returnCards, 1750)
    }
  }

  const onKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    bringCardsForward()
  }

  return (
    <div
      className="hero-visual"
      ref={visualRef}
      role="group"
      aria-label={`Interactive ${name} preview. Hover, tap, or focus to bring the live KPI cards forward.`}
      tabIndex="0"
      onPointerEnter={bringCardsForward}
      onPointerMove={onMove}
      onPointerDown={onPress}
      onPointerLeave={returnCards}
      onPointerCancel={returnCards}
      onFocus={bringCardsForward}
      onBlur={returnCards}
      onKeyDown={onKeyDown}
    >
      <div className="dashboard-3d" ref={cardRef}>
        <div className="mock-window-top">
          <div className="window-dots"><i /><i /><i /></div>
          <span className="window-title"><FileSpreadsheet size={13} /> {visual.windowTitle}</span>
          <span className="live-pill"><i /> LIVE</span>
        </div>
        <div className="mock-toolbar">
          <span className="mock-logo">{visual.logo}<span>•</span>{visual.logoDot}</span>
          <div className="mock-tabs">{visual.tabs.map((tab, index) => index === 0 ? <b key={tab}>{tab}</b> : <span key={tab}>{tab}</span>)}</div>
          <span className="mock-avatar">JD</span>
        </div>
        <div className="metric-ribbon">
          {visual.ribbon.map((metric) => (
            <div key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.delta}</em></div>
          ))}
        </div>
        {/* The box is sized by ratio. Prefer an authored aspectRatio, else
            measure the image once it loads, so owner uploads of any shape are
            framed without cropping or letterboxing. */}
        <div className="screen-shot" style={shotRatio ? { '--shot-ratio': shotRatio } : undefined}>
          {visual.screen
            ? <ProductScreenshot eager src={visual.screen.src} variant="dashboard" alt={visual.screen.alt} animated={Boolean(visual.screen.uploaded)} onRatio={setMeasuredRatio} />
            : <ProductMockVisual variant={visual.mock?.variant} data={visual.mock || {}} title={visual.windowTitle} />}
        </div>
      </div>
      {visual.floating.map((card, index) => <FloatingCardVisual card={card} index={index} key={card.label} />)}
      <div className="cursor-chip" ref={cursorRef} aria-hidden="true"><MousePointer2 size={12} /> {visual.cursorText}</div>
    </div>
  )
}

export function ProductHero({ product, offer, onToggleCart, inCart }) {
  const visual = product.hero.visual

  return (
    <section className="hero dark-section">
      <div className="hero-orb hero-orb--one" />
      <div className="hero-orb hero-orb--two" />
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-runway" aria-hidden="true"><i /><i /><i /><span /></div>
      <div className="hero-particles" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--particle': index }} />)}</div>
      <div className="shell hero-layout">
        <div className="hero-copy">
          <Link to="/" className="hero-back-link"><ArrowLeft size={14} /> All products</Link>
          <div className="pill hero-pill"><Sparkles size={14} /> {product.name} <i /> A Runway Systems product</div>
          <h1>{product.hero.h1[0]}<br /><span>{product.hero.h1[1]}</span></h1>
          <p className="hero-lede">{product.hero.lede}</p>
          <div className="hero-actions">
            <a href="#pricing" className="button button--lime button--large">Get {product.name} for {offer.displaySalePrice} <ArrowRight size={18} /></a>
            {onToggleCart && (
              <button className={cx('button button--outline button--large', inCart && 'is-added')} type="button" onClick={onToggleCart} aria-pressed={inCart}>
                {inCart ? <><Check size={15} /> In cart</> : <><ShoppingBag size={15} /> Add to cart</>}
              </button>
            )}
            <a href="#preview" className="text-link">See what’s inside <ArrowRight size={15} /></a>
          </div>
          <div className="hero-trust">
            <span><Check size={14} /> One-time payment</span>
            <span><Check size={14} /> Instant access</span>
            <span><Check size={14} /> Lifetime updates</span>
          </div>
        </div>

        <HeroVisual visual={visual} name={product.name} />
      </div>
      <div className="hero-bottom-fade" />
    </section>
  )
}

export function ProductProofStrip({ product, className = '' }) {
  const { audience, stats } = product.proof
  return (
    <section className={cx('proof-strip', className)} aria-label="Product highlights">
      <div className="shell proof-grid">
        <p>Built for <b>{audience}</b></p>
        {stats.map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}
      </div>
    </section>
  )
}

export function FeatureTicker({ labels, className = '' }) {
  return (
    <div className={cx('feature-ticker-strip', className)} aria-hidden="true">
      <div className="header-marquee">
        <div className="header-marquee__track">
          {[0, 1].map((group) => (
            <span className="header-marquee__group" key={group}>
              {labels.map((label) => <span className="header-marquee__item" key={`${group}-${label}`}><b>{label}</b><i /></span>)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ProblemSolution({ product }) {
  const { problem } = product
  return (
    <section className="section section--cream overflow-hidden">
      <div className="shell">
        <div className="section-heading section-heading--split reveal">
          <div><p className="eyebrow">{problem.heading[0]}</p><h2>{problem.heading[1]}</h2></div>
          <p>{problem.intro}</p>
        </div>
        <div className="before-after reveal">
          <article className="chaos-card">
            <div className="card-label"><X size={14} /> {problem.chaos.label}</div>
            <h3>{problem.chaos.h3[0]}<br />{problem.chaos.h3[1]}</h3>
            <div className="chaos-stage" aria-hidden="true">
              {problem.chaos.papers.slice(0, PAPER_POSITIONS.length).map(([text, mark], index) => (
                <span className={`paper paper--${PAPER_POSITIONS[index]}`} key={`${text}-${index}`}>{text} <b>{mark}</b></span>
              ))}
              <svg viewBox="0 0 320 110"><path d={CHAOS_PATH} /></svg>
            </div>
            <ul>{problem.chaos.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
          </article>
          <div className="transformation-arrow"><ArrowRight /></div>
          <article className="clarity-card">
            <div className="card-label"><Check size={14} /> {problem.clarity.label}</div>
            <h3>{problem.clarity.h3[0]}<br />{problem.clarity.h3[1]}</h3>
            <div className="clarity-dashboard">
              <div className="clarity-head"><span>{problem.clarity.head}</span><small>THIS YEAR <ChevronDown size={11} /></small></div>
              <div className="clarity-metrics">
                {problem.clarity.metrics.map((metric) => (
                  <div key={metric.label}><small>{metric.label}</small><AnimatedNumber value={metric.value} prefix={metric.prefix} suffix={metric.suffix} decimals={metric.decimals} /><em>{metric.em}</em></div>
                ))}
              </div>
              <div className="clarity-chart"><span>{problem.clarity.chartMax}</span><MiniBars bars={problem.clarity.chartBars} /></div>
            </div>
            <ul>{problem.clarity.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
          </article>
        </div>
      </div>
    </section>
  )
}

function TourVisual({ item, product }) {
  const Icon = sectionIcon(item.icon)
  if (item.screen) {
    return (
      <div className="feature-ui feature-ui--real">
        <div className="ui-title real-ui-title">
          <div><Icon size={18} /><span><small>{item.screen.label}</small><b>{item.screen.name}</b></span></div>
          <span className="forecast-status"><i /> Live data</span>
        </div>
        <ProductScreenshot src={item.screen.src} alt={item.screen.alt} variant={item.screen.variant} aspectRatio={item.screen.aspectRatio} animated={Boolean(item.screen.uploaded)} />
        <div className="real-screen-metrics">
          {item.screen.metrics.map((metric) => (
            <span key={metric.label}>
              <small>{metric.label}</small>
              {typeof metric.value === 'number'
                ? <AnimatedNumber value={metric.value} prefix={metric.prefix} suffix={metric.suffix} decimals={metric.decimals} className={metric.tone || ''} />
                : <b className={metric.tone || ''}>{metric.text}</b>}
            </span>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="feature-ui feature-ui--real feature-ui--mock">
      <div className="ui-title real-ui-title">
        <div><Icon size={18} /><span><small>{product.name.toUpperCase()}</small><b>{item.label}</b></span></div>
        <span className="forecast-status"><i /> Live data</span>
      </div>
      <ProductMockVisual variant={item.mock.variant} data={item.mock} title={`${product.name} / ${item.label}`} />
    </div>
  )
}

export function ProductTour({ product }) {
  const [hoverPaused, setHoverPaused] = useState(false)
  const [active, setActive] = useState(0)
  const [offscreen, setOffscreen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const navRef = useRef(null)
  const sectionRef = useRef(null)
  const paused = hoverPaused || offscreen || hidden
  const items = product.tour.items
  const feature = items[active]

  // Auto-advance pauses whenever the tour leaves the viewport or the tab is
  // hidden, so the rotation never runs unseen and never jumps on return.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting), { threshold: 0.08 })
    observer.observe(section)
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % items.length), 5200)
    return () => window.clearTimeout(timer)
  }, [paused, active, items.length])

  useEffect(() => {
    const nav = navRef.current
    const selected = nav?.children[active]
    if (!nav || !selected) return
    const leftEdge = selected.offsetLeft
    const rightEdge = leftEdge + selected.offsetWidth
    if (leftEdge < nav.scrollLeft || rightEdge > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: Math.max(0, leftEdge - 12), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [active])

  const handleTabKey = (event, index) => {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return
    event.preventDefault()
    setActive(next)
    window.requestAnimationFrame(() => navRef.current?.children[next]?.focus())
  }

  return (
    <section className="section section--dark" id="preview" ref={sectionRef}>
      <div className="shell">
        <div className="section-heading section-heading--center section-heading--light reveal">
          <p className="eyebrow">{product.tour.eyebrow}</p>
          <h2>{product.tour.h2[0]}<br />{product.tour.h2[1]}</h2>
          <p>{product.tour.intro}</p>
        </div>
        {/* Pause on hover, but only for real pointers. A tap fires an
            emulated pointerenter that is frequently never followed by a
            pointerleave, which used to freeze the auto-advance permanently on
            phones and tablets. */}
        <div
          className={cx('tour reveal', paused && 'is-paused')}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHoverPaused(true) }}
          onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHoverPaused(false) }}
          onPointerCancel={() => setHoverPaused(false)}
        >
          <div className="tour-nav" role="tablist" aria-label="Product features" ref={navRef}>
            {items.map((item, index) => {
              const Icon = sectionIcon(item.icon)
              return <button key={item.id} id={`tour-tab-${item.id}`} role="tab" tabIndex={active === index ? 0 : -1} aria-selected={active === index} aria-controls="tour-panel" className={cx(active === index && 'is-active')} onClick={() => setActive(index)} onKeyDown={(event) => handleTabKey(event, index)}><span>{item.number}</span><Icon size={17} /><b>{item.label}</b>{active === index && <i className="tour-tab-progress" key={`${item.id}-${active}-${paused}`} />}</button>
            })}
          </div>
          <div className="tour-stage" id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${feature.id}`}>
            <div className="tour-copy" key={`${feature.id}-copy`}>
              <span className="tour-number">{feature.number} / {String(items.length).padStart(2, '0')}</span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
              <a href="#pricing">Get the complete system <ArrowRight size={15} /></a>
            </div>
            <div className="tour-browser" key={`${feature.id}-visual`}>
              <div className="browser-bar"><div className="window-dots"><i /><i /><i /></div><span>{product.name} / Google Sheets</span><div className="browser-actions"><Grid2X2 size={13} /><span className="share-button">Share</span></div></div>
              <TourVisual item={feature} product={product} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function FeatureGrid({ product }) {
  const moveSpotlight = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
    event.currentTarget.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
  }
  const { features } = product
  return (
    <section className="section section--white" id="features">
      <div className="shell">
        <div className="section-heading section-heading--split reveal">
          <div><p className="eyebrow">{features.eyebrow}</p><h2>{features.h2[0]}<br />{features.h2[1]}</h2></div>
          <p>{features.intro}</p>
        </div>
        <div className="feature-grid">
          {features.cards.map((item, index) => {
            const Icon = sectionIcon(item.icon)
            return <article className={`feature-card feature-card--${item.tone} reveal`} key={item.title} style={{ '--delay': `${index * 45}ms` }} onPointerMove={moveSpotlight}><span className="feature-card-glow" aria-hidden="true" /><span className="feature-icon"><Icon /></span><span className="feature-index">0{index + 1}</span><h3>{item.title}</h3><p>{item.copy}</p><div className="feature-arrow"><ArrowUpRight /></div></article>
          })}
        </div>
        <div className="privacy-banner reveal">
          <div className="privacy-graphic" aria-hidden="true"><span><Fingerprint /></span><i /><i /></div>
          <div><p className="eyebrow">Private by design</p><h3>{features.privacy.h3}</h3><p>{features.privacy.copy}</p></div>
          <div className="privacy-points">
            <span><ShieldCheck size={17} /> {features.privacy.points[0]}</span>
            <span><LockKeyhole size={17} /> {features.privacy.points[1]}</span>
            <span><Fingerprint size={17} /> {features.privacy.points[2]}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HowItWorks({ product }) {
  const { steps } = product
  return (
    <section className="section section--mint" id="how-it-works">
      <div className="shell">
        <div className="section-heading section-heading--center reveal">
          <p className="eyebrow">{steps.eyebrow}</p>
          <h2>{steps.h2[0]}<br />{steps.h2[1]}</h2>
          <p>{steps.intro}</p>
        </div>
        <div className="steps">
          <div className="steps-line" aria-hidden="true"><i /></div>
          {steps.items.map((step, index) => {
            const Icon = sectionIcon(step.icon)
            return <article className="step reveal" key={step.number}><span className="step-number">{step.number}</span><div className="step-icon"><Icon /></div><h3>{step.title}</h3><p>{step.copy}</p>{index < steps.items.length - 1 && <ArrowRight className="step-arrow" />}</article>
          })}
        </div>
        <div className="sheets-note reveal"><FileSpreadsheet /><div><b>{steps.note.title}</b><span>{steps.note.body}</span></div><BadgeCheck /></div>
      </div>
    </section>
  )
}

export function Benefits({ product }) {
  const { benefits } = product
  return (
    <section className="section section--cream">
      <div className="shell benefits-layout">
        <div className="benefits-copy reveal">
          <p className="eyebrow">The payoff</p>
          <h2>{benefits.heading}</h2>
          <p>{benefits.copy}</p>
          <div className="benefit-list">
            {benefits.items.map((item) => {
              const Icon = sectionIcon(item.icon)
              return (
                <div key={item.title}><span><Icon /></span><p><b>{item.title}</b>{item.copy}</p></div>
              )
            })}
          </div>
        </div>
        <div className="outcome-stack reveal">
          <div className="outcome-card outcome-card--main">
            <div className="outcome-top"><span>{benefits.outcome.label}</span><span className="live-pill"><i /> LIVE</span></div>
            <div className="confidence-gauge"><svg viewBox="0 0 220 120"><path d="M20 106a90 90 0 0 1 180 0" /><path className="gauge-progress" d="M20 106a90 90 0 0 1 180 0" /></svg><div><AnimatedNumber value={benefits.outcome.gaugeValue} /><span>{benefits.outcome.gaugeLabel}</span></div></div>
            <div className="outcome-stats">
              {benefits.outcome.stats.map((stat) => <span key={stat.label}><small>{stat.label}</small><AnimatedNumber value={stat.value} prefix={stat.prefix} suffix={stat.suffix} decimals={stat.decimals} /></span>)}
            </div>
          </div>
          <div className="outcome-card outcome-card--back-one"><span>{benefits.outcome.backOne.label}</span><AnimatedNumber value={benefits.outcome.backOne.value} prefix={benefits.outcome.backOne.prefix} suffix={benefits.outcome.backOne.suffix} decimals={benefits.outcome.backOne.decimals} /></div>
          <div className="outcome-card outcome-card--back-two"><span>{benefits.outcome.backTwo.label}</span><AnimatedNumber value={benefits.outcome.backTwo.value} prefix={benefits.outcome.backTwo.prefix} suffix={benefits.outcome.backTwo.suffix} decimals={benefits.outcome.backTwo.decimals} /></div>
        </div>
      </div>
    </section>
  )
}

export function AudienceProof({ product }) {
  const { audiences } = product
  return (
    <section className="section section--white" id="audiences">
      <div className="shell">
        <div className="section-heading section-heading--center reveal">
          <p className="eyebrow">{audiences.eyebrow}</p>
          <h2>{audiences.h2[0]}</h2>
          <p>{audiences.intro}</p>
        </div>
        <div className="audience-grid">
          {audiences.cards.map((card) => {
            const Icon = sectionIcon(card.icon)
            return <article className="audience-card reveal" key={card.role}><div className="quote-mark">“</div><p>{card.line}</p><div className="audience-role"><span><Icon /></span><div><b>Built for {card.role}</b><small>Clear inputs. Useful answers.</small></div></div></article>
          })}
        </div>
        <p className="proof-note reveal"><BadgeCheck size={16} /> {audiences.note}</p>
      </div>
    </section>
  )
}

export function ProductPricing({ product, onBuy, offer, onToggleCart, inCart }) {
  const cardRef = useRef(null)
  const ProductIcon = sectionIcon(product.icon)
  const { pricing } = product
  const tiltCard = (event) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - .5
    const y = (event.clientY - rect.top) / rect.height - .5
    cardRef.current.style.setProperty('--shine-x', `${(x + .5) * 100}%`)
    cardRef.current.style.setProperty('--shine-y', `${(y + .5) * 100}%`)
    gsap.to(cardRef.current, { rotateY: x * 7, rotateX: -y * 6, transformPerspective: 1100, duration: .55, ease: 'power3.out' })
  }
  const resetCard = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.to(cardRef.current, { rotateY: 0, rotateX: 0, duration: .65, ease: 'power3.out' })
  }
  return (
    <section className="section pricing-section" id="pricing">
      <div className="pricing-orb" aria-hidden="true" />
      <div className="shell pricing-layout">
        <div className="pricing-copy reveal">
          <p className="eyebrow">{pricing.eyebrow}</p>
          <h2>{pricing.h2[0]}</h2>
          <p>{pricing.intro}</p>
          <div className="price-reassurance">
            <span><ShieldCheck /> {pricing.reassurance[0]}</span>
            <span><Zap /> {pricing.reassurance[1]}</span>
            <span><InfinityIcon /> {pricing.reassurance[2]}</span>
          </div>
        </div>
        <article className="price-card reveal" ref={cardRef} onPointerMove={tiltCard} onPointerLeave={resetCard} onPointerCancel={resetCard}>
          {offer.offerActive && <div className="offer-ribbon">{offer.offerLabel}</div>}
          <div className="price-card-head">
            <div><span className="product-icon"><ProductIcon /></span><p>{product.name}</p></div>
            <span className="one-time">ONE-TIME</span>
          </div>
          <div className="price">{offer.offerActive && <s>{offer.displayOriginalPrice}</s>}<strong>{offer.displaySalePrice}</strong><span>USD<br />once</span></div>
          <p className="price-sub">{pricing.priceSub}</p>
          <div className="included-list">{pricing.included.map((item) => <span key={item}><Check /> {item}</span>)}</div>
          <button className="button button--lime button--xl button--full" onClick={onBuy} disabled={!product.checkoutReady}>
            {product.checkoutReady ? <>Get instant access <ArrowRight /></> : 'Coming soon'}
          </button>
          {onToggleCart && (
            <button className={cx('button button--outline button--full', inCart && 'is-added')} type="button" onClick={onToggleCart} aria-pressed={inCart}>
              {inCart ? <><Check size={15} /> In cart</> : <><ShoppingBag size={15} /> Add to cart</>}
            </button>
          )}
          <p className="secure-note">
            <LockKeyhole /> Secure checkout powered by Lemon Squeezy · Tax handled as the merchant of record
          </p>
          <div className="price-footer"><span><b>{pricing.license}</b>{pricing.licenseBody}</span></div>
        </article>
      </div>
    </section>
  )
}

export function ProductFAQ({ product, supportEmail }) {
  const [open, setOpen] = useState(0)
  const items = product.faqs?.items || []
  return (
    <section className="section section--cream" id="faq">
      <div className="shell faq-layout">
        <div className="faq-heading reveal"><p className="eyebrow">{product.faqs?.eyebrow || 'Questions, answered'}</p><h2>{product.faqs?.h2?.[0] || 'Everything you need to know.'}</h2><p>Still have a question? Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p></div>
        <div className="faq-list reveal">
          {items.map(([question, answer], index) => <div className={cx('faq-item', open === index && 'is-open')} key={question}><button onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}><span>{question}</span><ChevronDown /></button><div className="faq-answer" aria-hidden={open !== index}><div><p>{answer}</p></div></div></div>)}
        </div>
      </div>
    </section>
  )
}

export function FinalCTA({ product, onBuy, offer }) {
  const { finalCta } = product
  return (
    <section className="final-cta dark-section">
      <div className="final-grid" aria-hidden="true" />
      <div className="final-glow" aria-hidden="true" />
      <div className="shell final-inner reveal">
        <span className="final-icon"><TrendingUp /></span>
        <p className="eyebrow">{finalCta.eyebrow}</p>
        <h2>{finalCta.h2[0]}<br /><span>{finalCta.h2[1]}</span></h2>
        <p>{finalCta.copy}</p>
        <button className="button button--lime button--xl" onClick={onBuy} disabled={!product.checkoutReady}>
          {product.checkoutReady ? <>Get {product.name} for {offer.displaySalePrice} <ArrowRight /></> : 'Coming soon'}
        </button>
        <small>{finalCta.small.map((item) => <span key={item}><Check /> {item} </span>)}</small>
      </div>
    </section>
  )
}

function VisualNumber({ value }) {
  const numberRef = useRef(null)

  useEffect(() => {
    const node = numberRef.current
    if (!node) return undefined
    const pad = (current) => String(current).padStart(2, '0')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.textContent = pad(value)
      node.classList.add('is-counted')
      return undefined
    }
    const counter = { current: 0 }
    node.textContent = pad(0)
    const tween = gsap.to(counter, {
      current: value,
      duration: 1.35,
      ease: 'power3.out',
      scrollTrigger: { trigger: node, start: 'top 90%', once: true },
      onUpdate: () => {
        node.textContent = pad(Math.round(counter.current))
        if (counter.current > 0.1) node.classList.add('is-counted')
      },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [value])

  return <b ref={numberRef} className="visual-feature__number" aria-hidden="true">{String(value).padStart(2, '0')}</b>
}

export function VisualFeatureShowcase({ product }) {
  const features = product.featureVisuals || []
  const heading = product.features || {}
  return (
    <section className="section section--white visual-showcase" id="features">
      <div className="shell">
        <div className="section-heading section-heading--split reveal">
          <div>
            <p className="eyebrow">{heading.eyebrow || 'A closer look'}</p>
            <h2>{(heading.h2 && heading.h2[0]) || 'Every detail,'}<br />{(heading.h2 && heading.h2[1]) || 'clearly in view.'}</h2>
          </div>
          <p>{heading.intro || `Inside ${product.name}, one uploaded view at a time.`}</p>
        </div>
        <div className="visual-showcase__list">
          {features.map((feature, index) => (
            <article className={cx('visual-feature', index % 2 === 1 && 'is-flipped')} key={feature.id || feature.imagePath}>
              <div className="visual-feature__content">
                <div className="visual-feature__rail" aria-hidden="true"><i /></div>
                <VisualNumber value={index + 1} />
                <h3>{feature.heading || `${product.name} view ${index + 1}`}</h3>
                <p>{feature.subheading}</p>
              </div>
              <div className="visual-feature__media-wrap">
                <ProductScreenshot
                  src={feature.imagePath}
                  alt={feature.heading || `${product.name} feature screenshot ${index + 1}`}
                  variant="charts"
                  aspectRatio="16 / 10"
                  animated
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export { MiniBars }
