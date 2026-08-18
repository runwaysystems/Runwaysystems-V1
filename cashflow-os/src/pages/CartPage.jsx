import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ArrowLeft, ArrowRight, LockKeyhole, ShoppingBag, X } from 'lucide-react'
import { buildProductViewModel, defaultProducts } from '../data/catalog'
import { usePublicProducts } from '../hooks/usePublicProducts'
import { useSecureCheckout } from '../hooks/useSecureCheckout'
import { useCart } from '../context/CartContext'
import { CheckoutModal, Footer, Navbar, SUPPORT_EMAIL } from '../components/StorefrontShell'
import Seo from '../components/Seo'
import CheckoutConsent from '../components/CheckoutConsent'
import { sectionIcon } from '../components/ProductSections'
import { siteCopy } from '../lib/siteCopy'
import { productIsUnavailable, storefrontProducts } from '../lib/catalogAvailability'

const priceNumber = (value) => {
  const parsed = Number.parseFloat(String(value || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const money = (value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// GSAP count-up for the cart total: the number rolls from zero whenever the
// suite total changes, and renders instantly for reduced-motion visitors.
function TotalCounter({ value }) {
  const numberRef = useRef(null)

  useEffect(() => {
    const node = numberRef.current
    if (!node) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.textContent = money(value)
      return undefined
    }
    const counter = { current: 0 }
    node.textContent = money(0)
    const tween = gsap.to(counter, {
      current: value,
      duration: .9,
      ease: 'power3.out',
      onUpdate: () => { node.textContent = money(counter.current) },
    })
    return () => tween.kill()
  }, [value])

  return <strong ref={numberRef} aria-live="polite">{money(value)}</strong>
}

export default function CartPage({ theme, onToggleTheme, palette, onPaletteChange }) {
  const config = usePublicProducts()
  const copy = siteCopy(config).cart
  const { keys, remove, clear, count } = useCart()
  const { startCheckout, checkoutPending, checkoutError, clearCheckoutError } = useSecureCheckout()
  // Deliberately not persisted: consent is re-taken on every visit to the cart
  // rather than remembered from a previous session.
  const [consented, setConsented] = useState(false)
  const liveProducts = storefrontProducts(config, defaultProducts())

  // A product hidden (or deleted) after it was added to the cart must drop out
  // of the cart too, otherwise the shopper sees a line item priced from the
  // static catalog and checkout is refused by the Worker with a confusing
  // "not available" error at the very last step.
  const unavailableKeys = useMemo(
    () => keys.filter((key) => productIsUnavailable(config, key)),
    [config, keys],
  )

  const items = useMemo(() => keys
    .filter((key) => !unavailableKeys.includes(key))
    .map((key) => buildProductViewModel(key, liveProducts.find((product) => product.key === key) || null))
    .filter(Boolean), [keys, liveProducts, unavailableKeys])

  // Prune retired keys from the stored cart so the badge count and the
  // checkout payload agree with what is actually shown.
  useEffect(() => {
    if (!unavailableKeys.length) return
    for (const key of unavailableKeys) remove(key)
  }, [remove, unavailableKeys])

  const fullTotal = items.reduce((sum, item) => sum + priceNumber(item.offer?.displaySalePrice), 0)

  // If the cart happens to hold exactly the members of an active bundle, the
  // bundle price applies automatically. The Worker re-verifies the match and
  // recomputes the amount, so this is presentation only.
  const matchedBundle = useMemo(() => {
    const cartKeys = [...keys].sort().join(',')
    return (config?.bundles || []).find((bundle) => [...bundle.productKeys].sort().join(',') === cartKeys) || null
  }, [config, keys])

  // A bundle whose products are all in the cart but alongside extras cannot be
  // discounted, because the Worker requires an exact match. Surface the best
  // such near-miss so the shopper can choose to drop the extras, instead of
  // silently charging full price. Richest discount wins.
  const nearMissBundle = useMemo(() => {
    if (matchedBundle) return null
    const cartKeys = new Set(keys)
    return (config?.bundles || [])
      .filter((bundle) => bundle.productKeys.every((key) => cartKeys.has(key)) && bundle.productKeys.length < keys.length)
      .sort((a, b) => b.discountPercent - a.discountPercent)[0] || null
  }, [config, keys, matchedBundle])

  const total = matchedBundle
    ? fullTotal * (100 - matchedBundle.discountPercent) / 100
    : fullTotal

  // Explicit opt-in: drop the extras so the cart matches the bundle exactly.
  const keepOnlyBundle = (bundle) => {
    for (const key of keys) {
      if (!bundle.productKeys.includes(key)) remove(key)
    }
  }

  const checkout = () => {
    if (!consented || !items.length || checkoutPending) return
    startCheckout(items.map((item) => item.key), matchedBundle?.key || '')
  }

  // The whole cart becomes ONE Lemon Squeezy checkout: multi-product carts
  // are bundled into a single custom-priced suite bundle, so the buyer pays
  // exactly once and every product in the cart is delivered.


  // GSAP entrance: cart rows cascade in and the summary settles, skipped
  // entirely under reduced motion.
  useLayoutEffect(() => {
    if (!items.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const context = gsap.context(() => {
      gsap.from('.cart-item', { y: 22, autoAlpha: 0, duration: .55, stagger: .07, ease: 'power3.out', clearProps: 'opacity,transform' })
      gsap.from('.cart-summary', { y: 18, autoAlpha: 0, duration: .6, delay: .12, ease: 'power3.out', clearProps: 'opacity,transform' })
    })
    return () => context.revert()
  }, [items.length])

  return (
    <div className="cart-page">
      <Seo
        title="Your cart | Runway Systems"
        description="Review your Runway Systems products and check out once with a single secure payment."
        canonicalPath="/cart"
        noindex
      />
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar theme={theme} onToggleTheme={onToggleTheme} palette={palette} onPaletteChange={onPaletteChange} />
      <main id="main" className="shell cart-main">
        <Link className="hero-back-link" to="/"><ArrowLeft size={14} /> Continue browsing</Link>
        <div className="cart-heading">
          <div>
            <p className="eyebrow">YOUR CART</p>
            <h1>{count ? `${count} ${count === 1 ? 'product' : 'products'} ready for checkout` : copy.emptyTitle}</h1>
          </div>
          {count > 0 && <button className="button text" type="button" onClick={clear}>Clear cart</button>}
        </div>

        {count === 0 ? (
          <section className="cart-empty">
            <ShoppingBag size={34} />
            <p>{copy.emptyCopy}</p>
            <Link className="button primary" to="/">Browse the suite <ArrowRight size={15} /></Link>
          </section>
        ) : (
          <>
            <section className="cart-list" aria-label="Products in your cart">
              {items.map((item) => {
                const Icon = sectionIcon(item.icon)
                return (
                  <article className={`cart-item cart-item--${item.accent}`} key={item.key}>
                    <span className="cart-item__icon" aria-hidden="true"><Icon size={18} /></span>
                    <div className="cart-item__identity">
                      <Link to={`/products/${item.key}`}><h2>{item.name}</h2></Link>
                      <p>{item.taglineLive || item.hero?.lede || ''}</p>
                    </div>
                    <div className="cart-item__price">
                      {item.offer?.offerActive && <s>{item.offer.displayOriginalPrice}</s>}
                      <strong>{item.offer?.displaySalePrice}</strong>
                      <span>one-time</span>
                    </div>
                    <button className="cart-item__remove" type="button" aria-label={`Remove ${item.name} from cart`} onClick={() => remove(item.key)}>
                      <X size={16} />
                    </button>
                  </article>
                )
              })}
            </section>

            <section className="cart-summary">
              <div className="cart-summary__copy">
                <span>Total (USD, one-time)</span>
                <TotalCounter value={total} />
                {matchedBundle && (
                  <p className="cart-bundle-note">
                    <ShoppingBag size={13} /> {matchedBundle.name} applied — {matchedBundle.discountPercent}% off,
                    saving {money(fullTotal - total)}.
                  </p>
                )}
                {nearMissBundle && (
                  <div className="cart-bundle-offer">
                    <p>
                      <ShoppingBag size={13} /> Keep only the {nearMissBundle.name} products to save{' '}
                      {nearMissBundle.discountPercent}% on them.
                    </p>
                    <button type="button" className="button text button--small" onClick={() => keepOnlyBundle(nearMissBundle)}>
                      Apply {nearMissBundle.name}
                    </button>
                  </div>
                )}
                <p><LockKeyhole size={13} /> One secure checkout for everything in your cart. Multi-product carts are billed as a single suite bundle.</p>
                <p className="cart-tax-note">
                  Lemon Squeezy handles sales tax as the merchant of record.
                </p>
              </div>
              <CheckoutConsent checked={consented} onChange={setConsented} disabled={checkoutPending} />
              <button
                className="button button--lime button--xl button--full"
                type="button"
                onClick={checkout}
                disabled={checkoutPending || !consented}
                aria-describedby="checkout-consent"
              >
                {checkoutPending ? 'Opening secure checkout...' : <>Checkout securely <ArrowRight size={17} /></>}
              </button>
              <small>{copy.assurance}</small>
            </section>
          </>
        )}
      </main>
      <Footer products={liveProducts.map((product) => ({ key: product.key, name: product.name }))} supportEmail={config?.supportEmail || SUPPORT_EMAIL} />
      <CheckoutModal open={Boolean(checkoutError)} onClose={clearCheckoutError} message={checkoutError} supportEmail={config?.supportEmail || SUPPORT_EMAIL} />
    </div>
  )
}
