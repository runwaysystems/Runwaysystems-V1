import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Fingerprint, Layers, LockKeyhole, Plus, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react'
import { buildProductViewModel, buildSuiteViewModel, CATALOG_ORDER, defaultProducts, SUITE_NAME } from '../data/catalog'
import { dedupeProducts } from '../api/platformApi'
import { catalogIsAuthoritative, storefrontProducts } from '../lib/catalogAvailability'
import { usePublicProducts } from '../hooks/usePublicProducts'
import { usePageAnimations } from '../hooks/usePageAnimations'
import { siteCopy } from '../lib/siteCopy'
import { introSeenInSession } from '../lib/introState'
import { useCart } from '../context/CartContext'
import { BrandIntro, Footer, Navbar, SUPPORT_EMAIL } from '../components/StorefrontShell'
import Seo from '../components/Seo'
import Hero3DBackground from '../components/Hero3DBackground'
import TestimonialsSection from '../components/TestimonialsSection'
import { FeatureTicker, HeroVisual, MAX_FLOATING_CARDS, ProductProofStrip, sectionIcon } from '../components/ProductSections'

const cx = (...classes) => classes.filter(Boolean).join(' ')

const priceNumber = (value) => {
  const parsed = Number.parseFloat(String(value || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const money = (value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// The suite hero mirrors the live catalog. Every product name, price, tab and
// floating card is derived from the products actually on sale, so adding,
// removing, renaming or repricing a product updates the hero automatically
// instead of leaving hardcoded copy that quietly goes stale.
const FLOATING_TONES = ['', 'peach', 'blue']

// Spelled-out counts read better in a headline than a digit. Falls back to the
// number itself for larger catalogs.
const COUNT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const countWord = (count) => COUNT_WORDS[count] || String(count)

function buildSuiteVisual(products) {
  const named = (products || []).filter((product) => product && product.name)
  const priced = named.filter((product) => priceNumber(product.offer?.displaySalePrice) > 0)
  // Tallest bar is the most expensive product, so the chart keeps its shape
  // for any catalog size rather than assuming four fixed heights.
  const maxPrice = priced.reduce((top, product) => Math.max(top, priceNumber(product.offer?.displaySalePrice)), 0)

  return {
    windowTitle: `${SUITE_NAME} / Suite`,
    logo: 'R',
    logoDot: 'S',
    tabs: named.map((product) => product.name),
    ribbon: [
      { label: named.length === 1 ? 'Product' : 'Products', value: String(named.length), delta: 'One-time' },
      { label: 'Data lives', value: 'Your Drive', delta: '100%' },
      { label: 'Monthly fees', value: '$0', delta: 'Forever' },
    ],
    mock: {
      variant: 'dashboard',
      metrics: named.slice(0, 4).map((product) => ({
        label: product.name,
        value: product.offer?.displaySalePrice || '—',
      })),
      bars: named.slice(0, 8).map((product) => {
        const price = priceNumber(product.offer?.displaySalePrice)
        return {
          label: product.category || product.name,
          height: maxPrice > 0 ? Math.max(22, Math.round((price / maxPrice) * 92)) : 50,
          value: product.offer?.displaySalePrice || '—',
        }
      }),
    },
    // Capped at the number of scatter slots defined in the CSS.
    floating: named.slice(0, MAX_FLOATING_CARDS).map((product, index) => ({
      icon: product.icon || 'spreadsheet',
      tone: FLOATING_TONES[index % FLOATING_TONES.length],
      label: product.name,
      value: product.offer?.displaySalePrice || '—',
      em: product.category || 'Google Sheets',
    })),
    cursorText: 'Updates automatically',
  }
}

function SuiteHero({ suiteVm, visual }) {
  const [line1, line2] = suiteVm.hero.h1
  return (
    <section className="hero dark-section">
      <Hero3DBackground />
      <div className="hero-orb hero-orb--one" />
      <div className="hero-orb hero-orb--two" />
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-runway" aria-hidden="true"><i /><i /><i /><span /></div>
      <div className="hero-particles" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--particle': index }} />)}</div>
      <div className="shell hero-layout">
        <div className="hero-copy">
          <div className="pill hero-pill"><Sparkles size={14} /> {SUITE_NAME} <i /> Product suite</div>
          <h1>{line1}<br /><span>{line2}</span></h1>
          <p className="hero-lede">{suiteVm.hero.lede}</p>
          <div className="hero-actions">
            <a href="#products" className="button button--lime button--large">Browse the suite <ArrowRight size={18} /></a>
            <a href="#why" className="text-link">Why Runway <ArrowRight size={15} /></a>
          </div>
          <div className="hero-trust">
            <span><Check size={14} /> One-time payments</span>
            <span><Check size={14} /> Google Sheets native</span>
            <span><Check size={14} /> Lifetime updates</span>
          </div>
        </div>
        <HeroVisual visual={visual} name={`${SUITE_NAME} suite`} />
      </div>
      <div className="hero-bottom-fade" />
    </section>
  )
}

function ProductCard({ viewModel, inCart, onToggleCart }) {
  const cardRef = useRef(null)
  const quickX = useRef(null)
  const quickY = useRef(null)
  const Icon = sectionIcon(viewModel.icon)
  const offer = viewModel.offer

  // GSAP tilt via quickTo: one reusable tween per axis instead of spawning
  // a new tween on every pointermove, so hover stays silky on long catalogs.
  const canTilt = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!canTilt()) return undefined
    quickX.current = gsap.quickTo(cardRef.current, 'rotationY', { duration: .45, ease: 'power3.out' })
    quickY.current = gsap.quickTo(cardRef.current, 'rotationX', { duration: .45, ease: 'power3.out' })
    gsap.set(cardRef.current, { transformPerspective: 900 })
    return () => {
      quickX.current = null
      quickY.current = null
    }
  }, [])

  const enterCard = (event) => {
    if (!canTilt()) return
    cardRef.current.classList.add('is-tilting')
    gsap.to(cardRef.current, { y: -5, duration: .45, ease: 'power3.out' })
    moveCard(event)
  }

  const moveCard = (event) => {
    if (!quickX.current || !quickY.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - .5
    const y = (event.clientY - rect.top) / rect.height - .5
    quickX.current(x * 6)
    quickY.current(-y * 5)
  }

  const resetCard = () => {
    if (!quickX.current || !quickY.current) return
    quickX.current(0)
    quickY.current(0)
    gsap.to(cardRef.current, {
      y: 0,
      duration: .65,
      ease: 'power3.out',
      onComplete: () => cardRef.current.classList.remove('is-tilting'),
    })
  }

  return (
    <Link
      className={`product-card product-card--${viewModel.accent} reveal`}
      to={`/products/${viewModel.key}`}
      ref={cardRef}
      onPointerEnter={enterCard}
      onPointerMove={moveCard}
      onPointerLeave={resetCard}
      onPointerCancel={resetCard}
    >
      <button
        className={cx('product-card__add', inCart && 'is-added')}
        type="button"
        aria-label={inCart ? `Remove ${viewModel.name} from cart` : `Add ${viewModel.name} to cart`}
        aria-pressed={inCart}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onToggleCart(viewModel.key)
        }}
      >
        {inCart ? <><Check size={13} /> In cart</> : <><Plus size={13} /> Add</>}
      </button>
      <span className="product-card__icon"><Icon /></span>
      <span className="product-card__category">{viewModel.category}</span>
      <h3>{viewModel.name}</h3>
      <p>{viewModel.taglineLive || viewModel.hero?.lede || ''}</p>
      <div className="product-card__price">
        {offer.offerActive && <s>{offer.displayOriginalPrice}</s>}
        <strong>{offer.displaySalePrice}</strong>
        <span>one-time</span>
      </div>
      <span className="product-card__cta">View product <ArrowUpRight size={15} /></span>
    </Link>
  )
}

function SuiteFAQ({ suiteVm, supportEmail }) {
  const [open, setOpen] = useState(0)
  return (
    <section className="section section--cream" id="faq">
      <div className="shell faq-layout">
        <div className="faq-heading reveal"><p className="eyebrow">Questions, answered</p><h2>Everything you need to know.</h2><p>Still have a question? Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p></div>
        <div className="faq-list reveal">
          {suiteVm.faqs.map(([question, answer], index) => <div className={cx('faq-item', open === index && 'is-open')} key={question}><button onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}><span>{question}</span><ChevronDown /></button><div className="faq-answer" aria-hidden={open !== index}><div><p>{answer}</p></div></div></div>)}
        </div>
      </div>
    </section>
  )
}

export default function CatalogHome({ theme, onToggleTheme, palette, onPaletteChange }) {
  const config = usePublicProducts()
  const { add, toggle, has, clear } = useCart()
  const [introDone, setIntroDone] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches || introSeenInSession())
  const finishIntro = useCallback(() => setIntroDone(true), [])

  usePageAnimations(introDone)

  const liveProducts = useMemo(() => dedupeProducts(config?.products || []), [config])
  const suiteVm = useMemo(() => buildSuiteViewModel(config?.suiteContent || {}), [config])
  const supportEmail = config?.supportEmail || SUPPORT_EMAIL
  // Once the config has loaded, its product list is the whole catalog: a
  // built-in product the owner has hidden is absent from it on purpose. The
  // grid previously topped every missing CATALOG_ORDER key back up from the
  // static catalog, which put hidden products straight back on the homepage.
  // The static catalog is now only a fallback for when the config could not
  // be fetched at all.
  const catalogAuthoritative = catalogIsAuthoritative(config)
  const viewModels = useMemo(() => {
    if (catalogAuthoritative) {
      return dedupeProducts(liveProducts.map((product) => buildProductViewModel(product.key, product)))
    }
    const liveKeys = new Set(liveProducts.map((product) => product.key))
    const ordered = liveProducts.length ? liveProducts : defaultProducts()
    const models = ordered.map((product) => buildProductViewModel(product.key, product))
    for (const key of CATALOG_ORDER) {
      if (!liveKeys.has(key) && !models.some((model) => model.key === key)) {
        models.push(buildProductViewModel(key, null))
      }
    }
    // Built view models can still collide by display name (two different keys
    // both named "Cash Flow OS"), which would render two identical cards.
    return dedupeProducts(models)
  }, [catalogAuthoritative, liveProducts])

  const footerProducts = dedupeProducts(storefrontProducts(config, defaultProducts())).map((product) => ({ key: product.key, name: product.name }))

  // Rebuilt whenever the catalog changes, so the hero visual always shows the
  // products that are actually on sale.
  const suiteVisual = useMemo(() => buildSuiteVisual(viewModels), [viewModels])

  // The two strips directly under the hero also name the catalog, so they are
  // derived too. An owner edit in the content studio still wins: only the
  // untouched defaults get replaced with live product data.
  const suiteTicker = useMemo(() => {
    if (config?.suiteContent?.ticker?.length) return suiteVm.ticker
    const names = viewModels.map((product) => String(product.name || '').toUpperCase()).filter(Boolean)
    return names.length ? [...names, 'GOOGLE SHEETS NATIVE', 'LIFETIME UPDATES'] : suiteVm.ticker
  }, [config, suiteVm.ticker, viewModels])

  const suiteProof = useMemo(() => {
    if (config?.suiteContent?.proof) return suiteVm.proof
    const count = viewModels.length
    if (!count) return suiteVm.proof
    return {
      ...suiteVm.proof,
      stats: [
        [String(count), count === 1 ? 'connected product' : 'connected products'],
        ...suiteVm.proof.stats.slice(1),
      ],
    }
  }, [config, suiteVm.proof, viewModels])

  const bundleTotal = viewModels.reduce((sum, product) => sum + priceNumber(product.offer?.displaySalePrice), 0)
  const cartHas = (key) => has(key)
  const toggleCart = (key) => toggle(key)
  const addCompleteSuite = () => {
    for (const product of viewModels) add(product.key)
  }

  const bundles = useMemo(() => config?.bundles || [], [config])

  // Adding a bundle replaces the cart with exactly its members, because the
  // Worker only honours the discount when the cart matches the bundle.
  // Add the bundle's products to whatever is already in the cart rather than
  // replacing it, so a shopper never silently loses an unrelated item. The
  // Worker only discounts a cart that matches a bundle exactly, so the cart
  // page tells them what to remove when extras are present.
  const addBundle = (bundle) => {
    for (const product of bundle.products) add(product.key)
  }

  return (
    <>
      <Seo
        title={siteCopy(config).homeSeo.title}
        description={siteCopy(config).homeSeo.description}
        canonicalPath="/"
        ogImage={`${window.location.origin}/product-dashboard-uhd.webp`}
        jsonLd={[
          {
            id: 'jsonld-organization',
            data: {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Runway Systems',
              url: `${window.location.origin}/`,
              logo: `${window.location.origin}/runway-systems-mark.svg`,
            },
          },
          {
            id: 'jsonld-website',
            data: {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Runway Systems',
              url: `${window.location.origin}/`,
            },
          },
        ]}
      />
      {!introDone && <BrandIntro onComplete={finishIntro} />}
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar theme={theme} onToggleTheme={onToggleTheme} palette={palette} onPaletteChange={onPaletteChange} />
      <main id="main" className={!introDone ? 'intro-active' : undefined}>
        <SuiteHero suiteVm={suiteVm} visual={suiteVisual} />
        <ProductProofStrip product={{ proof: suiteProof }} />
        <FeatureTicker labels={suiteTicker} />

        <section className="section section--white" id="products">
          <div className="shell">
            <div className="section-heading section-heading--split reveal">
              <div><p className="eyebrow">The suite</p><h2>{countWord(viewModels.length)} calm {viewModels.length === 1 ? 'system' : 'systems'}.<br />One place to run things.</h2></div>
              <p>Every product is a complete Google Sheets workspace. Buy one or build the set. Each arrives with a private copy and lifetime updates.</p>
            </div>
            {/* Hiding every product is a valid state (a store between launches),
                so the suite banner and its $0.00 total are suppressed rather
                than advertising an empty bundle. */}
            {viewModels.length > 1 && (
              <div className="suite-bundle-banner reveal">
                <div className="suite-bundle-banner__copy">
                  <p className="eyebrow">{suiteVm.bundle.eyebrow}</p>
                  <b>{suiteVm.bundle.title}</b>
                  <span>{suiteVm.bundle.body}</span>
                </div>
                <div className="suite-bundle-banner__price">
                  <strong>{money(bundleTotal)}</strong>
                  <span>one-time</span>
                </div>
                <button className="button button--lime button--large" type="button" onClick={addCompleteSuite}>
                  Add complete suite <ShoppingBag size={16} />
                </button>
              </div>
            )}
            {bundles.length > 0 && (
              <div className="bundle-grid">
                {bundles.map((bundle) => (
                  <article className="bundle-card reveal" key={bundle.key}>
                    <div className="bundle-card__head">
                      <span className="bundle-card__badge">SAVE {bundle.discountPercent}%</span>
                      <b>{bundle.name}</b>
                      {bundle.tagline && <span className="bundle-card__tagline">{bundle.tagline}</span>}
                    </div>
                    <ul className="bundle-card__products">
                      {bundle.products.map((product) => (
                        <li key={product.key}><Check size={13} /> {product.name}</li>
                      ))}
                    </ul>
                    <div className="bundle-card__foot">
                      <div className="bundle-card__price">
                        <s>{bundle.fullPrice}</s>
                        <strong>{bundle.bundlePrice}</strong>
                        <span>you save {bundle.saving}</span>
                      </div>
                      <button className="button button--lime" type="button" onClick={() => addBundle(bundle)}>
                        Add bundle <ShoppingBag size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {viewModels.length > 0 ? (
              <div className="products-grid">
                {viewModels.map((product) => (
                  <ProductCard
                    viewModel={product}
                    key={product.key}
                    inCart={cartHas(product.key)}
                    onToggleCart={toggleCart}
                  />
                ))}
              </div>
            ) : (
              <p className="catalog-empty reveal">
                No products are on sale right now. Check back soon.
              </p>
            )}
          </div>
        </section>

        <section className="section section--mint" id="why">
          <div className="shell">
            <div className="section-heading section-heading--center reveal">
              <p className="eyebrow">Why Runway Systems</p>
              <h2>{suiteVm.whyHeading[0]}<br />{suiteVm.whyHeading[1]}</h2>
              <p>{suiteVm.whyIntro}</p>
            </div>
            <div className="audience-grid">
              {suiteVm.why.map((item) => {
                const Icon = sectionIcon(item.icon)
                return <article className="audience-card reveal" key={item.title}><div className="quote-mark">“</div><p>{item.copy}</p><div className="audience-role"><span><Icon /></span><div><b>{item.title}</b><small>Built for independent business.</small></div></div></article>
              })}
            </div>
            <div className="privacy-banner reveal">
              <div className="privacy-graphic" aria-hidden="true"><span><Fingerprint /></span><i /><i /></div>
              <div><p className="eyebrow">Private by design</p><h3>Your data stays yours.</h3><p>Every product lives inside your private Google Drive. Your revenue, clients, projects, and invoices are never sent to us or anyone else.</p></div>
              <div className="privacy-points"><span><ShieldCheck size={17} /> No external database</span><span><LockKeyhole size={17} /> You control sharing</span><span><Fingerprint size={17} /> You own your copy</span></div>
            </div>
          </div>
        </section>

        <TestimonialsSection productName="Runway Systems" />

        <SuiteFAQ suiteVm={suiteVm} supportEmail={supportEmail} />

        <section className="final-cta dark-section">
          <div className="final-grid" aria-hidden="true" />
          <div className="final-glow" aria-hidden="true" />
          <div className="shell final-inner reveal">
            <span className="final-icon"><Layers /></span>
            <p className="eyebrow">{suiteVm.finalCta.eyebrow}</p>
            <h2>{suiteVm.finalCta.h2[0]}<br /><span>{suiteVm.finalCta.h2[1]}</span></h2>
            <p>{suiteVm.finalCta.copy}</p>
            <a className="button button--lime button--xl" href="#products">{suiteVm.finalCta.button} <ArrowRight /></a>
            <small>{suiteVm.finalCta.small.map((item) => <span key={item}><Check /> {item} </span>)}</small>
          </div>
        </section>
      </main>
      <Footer products={footerProducts} supportEmail={supportEmail} />
    </>
  )
}
