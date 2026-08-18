import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowLeft,
  ArrowUpRight,
  LockKeyhole,
  Mail,
  Menu,
  Moon,
  ShoppingBag,
  Sun,
  X,
} from 'lucide-react'
import { AccountButton } from './AuthUI'
import { Logo, RunwayMark } from './Brand'
import { SUITE_NAME } from '../data/catalog'
import { markIntroSeenInSession } from '../lib/introState'
import { useCart } from '../context/CartContext'
import { openConsentPreferences } from './ConsentBanner'
import { getPublicConfigCache } from '../lib/publicConfigCache'
import { useSiteCopy } from '../lib/siteCopy'

// Env fallback only; the owner can override the support email from the admin
// panel and it flows through the public config.
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'hello@yourdomain.com'

export function getSupportEmail() {
  return getPublicConfigCache()?.supportEmail || SUPPORT_EMAIL
}

const cx = (...classes) => classes.filter(Boolean).join(' ')
export const readStorage = (key) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
export const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Persistence is optional when storage is restricted.
  }
}

export function ThemeToggle({ theme, onToggle, className = '' }) {
  const dark = theme === 'dark'
  return (
    <button
      className={cx('theme-toggle', className)}
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
      aria-pressed={dark}
      title={`Switch to ${dark ? 'light' : 'dark'} theme`}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <Sun className="theme-toggle__sun" />
        <Moon className="theme-toggle__moon" />
        <i />
      </span>
    </button>
  )
}

export function PaletteSwitch({ palette, onChange }) {
  const glacier = palette === 'glacier'
  const nextPalette = glacier ? 'brass' : 'glacier'

  return (
    <div className="palette-switch">
      <span className="palette-switch__label" aria-hidden="true">PALETTE</span>
      <button
        className={cx('palette-toggle', glacier && 'is-glacier')}
        type="button"
        role="switch"
        aria-checked={glacier}
        aria-label={`Switch to ${nextPalette} color palette`}
        title={`Switch to ${nextPalette} color palette`}
        onClick={() => onChange(nextPalette)}
      >
        <span className="palette-toggle__label palette-toggle__label--brass"><i />Brass</span>
        <span className="palette-toggle__track" aria-hidden="true"><i /></span>
        <span className="palette-toggle__label palette-toggle__label--glacier"><i />Glacier</span>
      </button>
    </div>
  )
}

export function BrandIntro({ onComplete }) {
  const introRef = useRef(null)
  const timelineRef = useRef(null)
  const dashTweenRef = useRef(null)
  const finishedRef = useRef(false)
  const previousFocusRef = useRef(null)
  const previousOverflowRef = useRef('')
  const repeatVisitorRef = useRef(Boolean(readStorage('runway-intro-seen')))
  const [skipVisible, setSkipVisible] = useState(false)

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    timelineRef.current?.kill()
    dashTweenRef.current?.kill()
    writeStorage('runway-intro-seen', 'true')
    markIntroSeenInSession()
    document.body.style.overflow = previousOverflowRef.current
    const previousFocus = previousFocusRef.current
    onComplete()
    window.requestAnimationFrame(() => {
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true })
    })
  }, [onComplete])

  useEffect(() => {
    const skipTimer = window.setTimeout(() => setSkipVisible(true), repeatVisitorRef.current ? 400 : 850)
    return () => window.clearTimeout(skipTimer)
  }, [])

  // Fail-safe: whatever happens in this environment, the intro must never
  // keep the storefront covered. Force-finish if the animation stalls.
  useEffect(() => {
    const safetyTimer = window.setTimeout(finish, 14000)
    return () => window.clearTimeout(safetyTimer)
  }, [finish])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return undefined
    }

    const root = introRef.current
    previousFocusRef.current = document.activeElement
    previousOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    root?.focus({ preventScroll: true })

    const heroVisual = document.querySelector('.hero-visual')
    const heroCopyItems = document.querySelectorAll('.hero-copy > *')
    const heroSignals = document.querySelectorAll('.floating-card')

    // Responsive type rhythm. The wordmark is wider than a phone screen at
    // desktop tracking, so compact viewports use tighter tracking targets and
    // the CSS stacks the two words vertically. Sampled once on mount: the
    // intro only runs for a few seconds, and a plain context guarantees the
    // timeline is always built regardless of viewport size.
    const compact = window.innerWidth <= 720 || window.innerHeight <= 460
    const tiny = window.innerWidth <= 420
    const stacked = compact
    const spacingStart = tiny ? '.22em' : compact ? '.3em' : '.46em'
    const spacingSettle = tiny ? '.05em' : compact ? '.08em' : '.19em'
    const spacingFinal = compact ? '-.02em' : '-.03em'

    let context
    try {
      context = gsap.context(() => {
      gsap.set('.intro-runway-scene, .intro-road, .intro-edge-light, .intro-centerline-stream, .intro-vanishing-glow', { opacity: 0 })
      gsap.set('.intro-brand-wordmark', { opacity: 0, scale: .86, letterSpacing: spacingStart })
      gsap.set('.intro-logo-forge', { opacity: 0, scale: .54, rotation: -4 })
      gsap.set('.intro-logo-forge .runway-mark__sheet--r', { opacity: 0, x: -44, rotationY: -42, transformOrigin: '100% 50%' })
      gsap.set('.intro-logo-forge .runway-mark__sheet--s', { opacity: 0, x: 44, rotationY: 42, transformOrigin: '0% 50%' })
      gsap.set('.intro-logo-forge .runway-mark__seam', { opacity: 0, strokeDasharray: 1, strokeDashoffset: 1 })
      gsap.set('.intro-logo-forge .runway-mark__spark', { opacity: 0, scale: .2, rotation: 0, transformOrigin: '50% 50%' })
      gsap.set('.intro-fold-guides, .intro-forge-meta', { opacity: 0, scale: .72 })
      gsap.set('.intro-split-panel', { opacity: 0 })
      gsap.set(heroCopyItems, { opacity: 0, y: 30 })
      gsap.set(heroVisual, { opacity: 0, y: 58, x: 0, scale: .925, rotationZ: 0, transformOrigin: '50% 60%' })
      gsap.set(heroSignals, { opacity: 0, y: 18, scale: .9 })

      dashTweenRef.current = gsap.to('.intro-centerline-stream', {
        backgroundPositionY: '240px',
        duration: .95,
        ease: 'none',
        repeat: -1,
        paused: true,
      })
      gsap.to('.intro-centerline-stream', { filter: 'brightness(1.28)', duration: .68, ease: 'power2.inOut', repeat: -1, yoyo: true })

      const timeline = gsap.timeline({ defaults: { ease: 'power3.inOut' }, onComplete: finish })
      timelineRef.current = timeline
      timeline
        .fromTo('.intro-runway-scene', { opacity: 0 }, { opacity: 1, duration: .65, ease: 'power2.out' }, .05)
        .fromTo('.intro-road', { opacity: 0, rotateX: 54, filter: 'blur(2px)' }, { opacity: .92, rotateX: 61, filter: 'blur(0px)', duration: .9 }, .1)
        .fromTo('.intro-vanishing-glow', { opacity: 0, scale: .68 }, { opacity: .78, scale: 1, duration: .85 }, .12)
        .fromTo('.intro-edge-light', { opacity: 0, scaleY: .74 }, { opacity: .8, scaleY: 1, duration: .82, stagger: .08 }, .16)
        .fromTo('.intro-centerline-stream', { opacity: 0 }, { opacity: .84, duration: .55, ease: 'power2.out' }, .24)
        .call(() => dashTweenRef.current?.play(), null, .24)
        .call(() => dashTweenRef.current?.timeScale(4.8), null, 1.28)
        .to('.intro-runway-world', { scale: 2.4, yPercent: 10, duration: 1.3, transformOrigin: '50% 7%', ease: 'power2.inOut', force3D: true }, 1.25)
        .to('.intro-road', { rotateX: 69, duration: 1.12, ease: 'power2.inOut' }, 1.28)
        // The lights are clipped to the road's own edges now, so translating
        // them would slide the lit band off the road. The camera push reads as
        // the edges flaring instead.
        .to('.intro-edge-light', { opacity: .95, filter: 'drop-shadow(0 0 10px color-mix(in srgb, var(--intro-accent) 92%, #fff)) drop-shadow(0 0 26px color-mix(in srgb, var(--intro-accent) 55%, transparent))', duration: 1.1, ease: 'power2.inOut' }, 1.3)
        .to('.intro-vanishing-glow', { scale: 1.75, opacity: 1, duration: 1.1, ease: 'power2.inOut' }, 1.3)
        // The push settles fully before the crossfade begins, so the camera
        // never visibly collides with the fade. The runway dims only slightly
        // and the side lights and centerline stay lit all the way through the
        // brand wordmark and the logo convergence on every screen size.
        .to('.intro-runway-world', { opacity: .75, filter: 'blur(1px)', duration: .55, ease: 'power2.out' }, 2.62)
        .to('.intro-edge-light', { opacity: 1, duration: .6, ease: 'power1.inOut' }, 2.58)
        .to('.intro-centerline-stream', { opacity: .9, duration: .6, ease: 'power1.inOut' }, 2.58)
        .to('.intro-vanishing-glow', { opacity: .18, duration: .5 }, 2.66)
        .fromTo('.intro-brand-wordmark', { opacity: 0, scale: .86, letterSpacing: spacingStart }, { opacity: 1, scale: 1, letterSpacing: spacingSettle, duration: .78, ease: 'power3.out' }, 2.5)
        .to('.intro-word', {
          // Converge on the wordmark's own centre, not the raw viewport
          // centre: when the words are stacked on small screens they must
          // collapse onto the same point the logo occupies.
          x: (_, word) => {
            const bounds = word.getBoundingClientRect()
            const anchor = word.closest('.intro-brand-wordmark')?.getBoundingClientRect()
            const centre = anchor ? anchor.left + anchor.width / 2 : window.innerWidth / 2
            return centre - (bounds.left + bounds.width / 2)
          },
          y: (_, word) => {
            if (!stacked) return 0
            const bounds = word.getBoundingClientRect()
            const anchor = word.closest('.intro-brand-wordmark')?.getBoundingClientRect()
            if (!anchor) return 0
            return (anchor.top + anchor.height / 2) - (bounds.top + bounds.height / 2)
          },
          scaleX: .045,
          opacity: 0,
          filter: 'blur(8px)',
          duration: .72,
          stagger: .035,
          ease: 'power3.inOut',
        }, 3.42)
        .to('.intro-brand-wordmark', { letterSpacing: spacingFinal, duration: .72, ease: 'power3.inOut' }, 3.42)
        .to('.intro-logo-forge', { opacity: 1, scale: 1, rotation: 0, duration: .72, ease: 'power3.out' }, 3.46)
        .to('.intro-logo-forge .runway-mark__sheet--r', { opacity: 1, x: 0, rotationY: 0, duration: .66, ease: 'power3.out' }, 3.48)
        .to('.intro-logo-forge .runway-mark__sheet--s', { opacity: .72, x: 0, rotationY: 0, duration: .72, ease: 'power3.out' }, 3.56)
        .to('.intro-logo-forge .runway-mark__seam', { opacity: .55, strokeDashoffset: 0, duration: .5, ease: 'power2.inOut' }, 3.78)
        .to('.intro-fold-guides', { opacity: .7, scale: 1, duration: .5, ease: 'power3.out' }, 3.7)
        .to('.intro-forge-meta', { opacity: 1, scale: 1, duration: .42, stagger: .06, ease: 'power2.out' }, 3.92)
        .fromTo('.intro-logo-forge .runway-mark__spark', { opacity: 0, scale: .2, rotation: 0 }, { opacity: 1, scale: 1.65, rotation: 45, duration: .24, repeat: 1, yoyo: true, ease: 'power2.inOut' }, 3.98)
        .to('.intro-logo-forge', { scale: 1.075, duration: .32, ease: 'power2.inOut' }, 4.13)
        // The lights stay lit through the logo forge, then the whole runway
        // scene releases only as the split gates slide open onto the hero.
        .to('.intro-runway-scene', { opacity: 0, duration: .5, ease: 'power2.inOut' }, 4.48)
        // Hold the completed folded ledger before both sheets become the opening gates.
        .to('.intro-split-panel', { opacity: 1, duration: .22, ease: 'power1.out' }, 4.53)
        .set(root, { backgroundColor: 'transparent' }, 4.6)
        .to('.intro-split-panel--left', { xPercent: -101, duration: 1.02, ease: 'power3.inOut' }, 4.67)
        .to('.intro-split-panel--right', { xPercent: 101, duration: 1.02, ease: 'power3.inOut' }, 4.67)
        .to('.intro-logo-forge .runway-mark__sheet--r', { x: () => -window.innerWidth * .58, rotationY: -52, opacity: .14, duration: .96, ease: 'power3.inOut' }, 4.65)
        .to('.intro-logo-forge .runway-mark__sheet--s', { x: () => window.innerWidth * .58, rotationY: 52, opacity: .14, duration: .96, ease: 'power3.inOut' }, 4.65)
        .to('.intro-logo-forge .runway-mark__seam', { scaleY: 0, opacity: 0, duration: .54, ease: 'power3.in' }, 4.63)
        .to('.intro-fold-guides, .intro-forge-meta', { opacity: 0, scale: 1.15, duration: .38, ease: 'power2.in' }, 4.61)
        .to(heroCopyItems, { opacity: 1, y: 0, duration: .82, stagger: .07, ease: 'power3.out' }, 4.63)
        .to(heroVisual, { opacity: 1, y: 0, x: 0, scale: 1, rotationZ: 0, duration: .62, ease: 'expo.out' }, 4.61)
        .to(heroSignals, { opacity: 1, y: 0, scale: 1, duration: .62, stagger: .09, ease: 'power3.out' }, 4.97)
        .to(root, { opacity: 0, duration: .28, ease: 'power2.out' }, 5.43)
        .to(heroVisual, {
          keyframes: [
            { y: -24, duration: .2, ease: 'power2.out' },
            { y: 8, duration: .16, ease: 'power2.in' },
            { y: -9, duration: .16, ease: 'power2.out' },
            { y: 0, duration: .25, ease: 'power2.inOut' },
          ],
        }, 5.23)
    }, root)
    } catch (error) {
      console.error('Brand intro failed to start', error)
      finish()
    }

    return () => {
      document.body.style.overflow = previousOverflowRef.current
      dashTweenRef.current?.kill()
      timelineRef.current = null
      context?.revert()
    }
  }, [finish])

  const keepFocusInIntro = (event) => {
    if (event.key === 'Escape') finish()
    if (event.key === 'Tab') {
      event.preventDefault()
      if (skipVisible) event.currentTarget.querySelector('.intro-skip')?.focus()
      else event.currentTarget.focus({ preventScroll: true })
    }
  }

  return (
    <div className="brand-intro" ref={introRef} role="dialog" aria-modal="true" aria-label="Runway Systems introduction" tabIndex="-1" onKeyDown={keepFocusInIntro}>
      <div className="intro-runway-scene" aria-hidden="true">
        <div className="intro-vanishing-glow" />
        <div className="intro-runway-world">
          <div className="intro-road">
            <i className="intro-edge-light intro-edge-light--left" />
            <i className="intro-edge-light intro-edge-light--right" />
            <i className="intro-centerline-stream" />
          </div>
        </div>
      </div>
      <div className="intro-split-panels" aria-hidden="true">
        <i className="intro-split-panel intro-split-panel--left" />
        <i className="intro-split-panel intro-split-panel--right" />
      </div>
      {/* The wordmark is centred by a full-bleed grid parent, never by a
          percentage transform. Its width changes as letter-spacing animates,
          and a translate(-50%) offset would be frozen at the old width by
          GSAP, drifting the words off-centre and away from the logo. */}
      <div className="intro-wordmark-anchor">
        <div className="intro-brand-wordmark" aria-label="Runway Systems">
          <span className="intro-word intro-word--runway">RUNWAY</span>
          <span className="intro-word intro-word--systems">SYSTEMS</span>
        </div>
      </div>
      <div className="intro-forge-anchor" aria-hidden="true">
        <div className="intro-logo-forge">
          <i className="intro-fold-guides"><b /><b /><b /></i>
          <RunwayMark className="intro-runway-mark" />
          <span className="intro-forge-meta intro-forge-meta--top">LEDGER / FOLD · 04</span>
          <span className="intro-forge-meta intro-forge-meta--bottom">RUNWAY SYSTEMS · PRODUCT SUITE</span>
        </div>
      </div>
      <button className={cx('intro-skip', skipVisible && 'is-visible')} type="button" tabIndex={skipVisible ? 0 : -1} aria-hidden={!skipVisible} onClick={finish}>Skip intro <span aria-hidden="true">↗</span></button>
    </div>
  )
}

export function CheckoutModal({ open, onClose, message, supportEmail = null }) {
  const copy = useSiteCopy().checkoutModal
  const email = supportEmail || getSupportEmail()
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close checkout message"><X size={18} /></button>
        <span className="modal-icon"><LockKeyhole size={21} /></span>
        <p className="eyebrow">SECURE CHECKOUT</p>
        <h2 id="checkout-title">{copy.title}</h2>
        <p>{message || 'The secure payment service is temporarily unavailable. Please try again.'}</p>
        <p className="modal-support">{copy.body} <a href={`mailto:${email}`}>{email}</a>.</p>
        <button className="button button--dark button--full" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

export function Navbar({ product = null, onBuy, theme, onToggleTheme, palette, onPaletteChange, offer = null }) {
  const copy = useSiteCopy().navbar
  const [open, setOpen] = useState(false)
  const headerRef = useRef(null)
  const location = useLocation()
  const onHome = location.pathname === '/'
  const { count } = useCart()

  // GSAP ScrollTrigger: the floating navbar gains elevation as the page
  // scrolls, giving every route a tangible scroll state.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const trigger = ScrollTrigger.create({
      start: 24,
      end: 80,
      onUpdate: (self) => {
        headerRef.current?.classList.toggle('is-scrolled', self.scroll() > 24)
      },
    })
    return () => trigger.kill()
  }, [])

  const links = product
    ? [['Preview', '#preview'], ['Features', '#features'], ['How it works', '#how-it-works'], ['Reviews', '#reviews'], ['FAQ', '#faq']]
    : [['Products', '#products'], ['Why Runway', '#why'], ['Reviews', '#reviews'], ['FAQ', '#faq']]
  const hrefFor = (hash) => (product || onHome ? hash : `/${hash}`)

  return (
    <header className="nav-wrap" ref={headerRef}>
      <div className="header-utility">
        <PaletteSwitch palette={palette} onChange={onPaletteChange} />
        <div className="header-utility__spacer" aria-hidden="true" />
        <div className="header-theme-control">
          <span aria-hidden="true">{theme === 'dark' ? 'DARK' : 'LIGHT'}</span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      <div className="scroll-progress" aria-hidden="true" />
      <nav className="navbar shell" aria-label="Primary navigation">
        <Logo />
        <div className="nav-links" aria-label="Page sections">
          {!onHome && <Link className="nav-home-link" to="/"><ArrowLeft size={13} /> {product ? 'All products' : 'Runway Systems'}</Link>}
          {links.map(([label, href]) => <a key={label} href={hrefFor(href)}>{label}</a>)}
        </div>
        <div className="nav-actions">
          <Link className={cx('nav-cart', count > 0 && 'has-items')} to="/cart" aria-label={`Cart with ${count} ${count === 1 ? 'product' : 'products'}`}>
            <ShoppingBag size={16} />
            {count > 0 && <b>{count}</b>}
          </Link>
          <AccountButton />
          {product ? (
            <>
              <a className="nav-price" href="#pricing">{offer?.offerActive && <s>{offer.displayOriginalPrice}</s>} {offer?.displaySalePrice}</a>
              <button className="button button--nav" onClick={onBuy}>{copy.buyLabel} <ArrowUpRight size={15} /></button>
            </>
          ) : (
            <a className="button button--nav" href="#products">{copy.browseLabel} <ArrowUpRight size={15} /></a>
          )}
          <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" aria-label="Toggle menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>
      <div id="mobile-menu" className={cx('mobile-menu', open && 'is-open')}>
        {!onHome && <Link className="mobile-home-link" to="/" onClick={() => setOpen(false)}><ArrowLeft size={13} /> {product ? 'All products' : 'Runway Systems'}</Link>}
        <Link className="mobile-cart-link" to="/cart" onClick={() => setOpen(false)}><ShoppingBag size={14} /> Cart {count > 0 && `(${count})`}</Link>
        {links.map(([label, href]) => (
          <a key={label} href={hrefFor(href)} onClick={() => setOpen(false)}>{label}</a>
        ))}
        {product && <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>}
        <div className="mobile-account"><AccountButton /></div>
        {product
          ? <button className="button button--dark button--full" onClick={() => { setOpen(false); onBuy() }}>Get {product.name} for {offer?.displaySalePrice}</button>
          : <a className="button button--dark button--full" href={hrefFor('#products')} onClick={() => setOpen(false)}>{copy.browseLabel}</a>}
      </div>
    </header>
  )
}

export function Footer({ products = [], supportEmail = null }) {
  const copy = useSiteCopy().footer
  const email = supportEmail || getSupportEmail()
  const footerRef = useRef(null)

  // GSAP typography reveal: the wordmark rises out of its masks with a
  // tracking settle while the 3D backdrop drifts on scroll. Skipped entirely
  // under reduced motion, where the final state renders statically.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const context = gsap.context(() => {
      gsap.fromTo(
        '.footer-3d-backdrop',
        { yPercent: 7 },
        {
          yPercent: -7,
          ease: 'none',
          scrollTrigger: { trigger: footerRef.current, start: 'top bottom', end: 'bottom top', scrub: 1 },
        },
      )
      gsap.fromTo(
        '.footer-reveal__line',
        { yPercent: 115, letterSpacing: '.32em' },
        {
          yPercent: 0,
          letterSpacing: '.015em',
          duration: 1.35,
          stagger: .16,
          ease: 'power4.out',
          scrollTrigger: { trigger: '.footer-reveal', start: 'top 82%', once: true },
        },
      )
      gsap.fromTo(
        '.footer-reveal__mark, .footer-reveal__eyebrow',
        { autoAlpha: 0, y: 26 },
        {
          autoAlpha: 1,
          y: 0,
          duration: .9,
          stagger: .12,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.footer-reveal', start: 'top 88%', once: true },
        },
      )
    }, footerRef)
    return () => context.revert()
  }, [])

  return (
    <footer className="footer" ref={footerRef}>
      <div className="footer-3d-backdrop" aria-hidden="true">
        <div className="footer-3d-horizon" />
        <div className="footer-3d-aura" />
        <div className="footer-vignette" />
        <div className="footer-particles">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--particle': index }} />)}</div>
      </div>

      <div className="shell footer-reveal" aria-hidden="true">
        <RunwayMark className="footer-reveal__mark" />
        <p className="footer-reveal__eyebrow">RUNWAY SYSTEMS · PRODUCT SUITE</p>
        <p className="footer-reveal__title">
          <span className="footer-reveal__mask"><span className="footer-reveal__line">RUNWAY</span></span>
          <span className="footer-reveal__mask"><span className="footer-reveal__line footer-reveal__line--gold">SYSTEMS</span></span>
        </p>
      </div>

      <div className="shell footer-main">
        <div className="footer-brand"><Logo light /><p>{copy.tagline}</p><span>{copy.motto}</span></div>
        <div className="footer-links">
          <div><b>Suite</b>{products.map((product) => <Link key={product.key} to={`/products/${product.key}`}>{product.name}</Link>)}</div>
          <div><b>Legal</b><Link to="/terms#terms">Terms of use</Link><Link to="/terms#privacy">Privacy</Link><Link to="/terms#refunds">Refund policy</Link><button className="footer-link-button" type="button" onClick={openConsentPreferences}>Cookie preferences</button></div>
          <div><b>Support</b><a href={`mailto:${email}`}><Mail size={14} /> {email}</a>{(copy.supportNotes || []).map((note) => <span key={note}>{note}</span>)}</div>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© {new Date().getFullYear()} {SUITE_NAME}. All rights reserved.</span><span>{copy.disclaimer}</span></div>
    </footer>
  )
}
