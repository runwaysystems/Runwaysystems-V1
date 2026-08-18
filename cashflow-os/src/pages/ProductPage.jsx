import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { catalogEntry, buildProductViewModel, defaultProducts } from '../data/catalog'
import { API_BASE_URL } from '../api/platformApi'
import { usePublicProducts } from '../hooks/usePublicProducts'
import { isPreviewRequest, usePreviewDraft } from '../hooks/usePreviewDraft'
import { productIsUnavailable, storefrontProducts } from '../lib/catalogAvailability'
import { useSecureCheckout } from '../hooks/useSecureCheckout'
import { usePageAnimations } from '../hooks/usePageAnimations'
import { useCart } from '../context/CartContext'
import { CheckoutModal, Footer, Navbar, SUPPORT_EMAIL } from '../components/StorefrontShell'
import Seo from '../components/Seo'
import { CheckoutConsentModal } from '../components/CheckoutConsent'
import TestimonialsSection from '../components/TestimonialsSection'
import NotFound from './NotFound'
import {
  AudienceProof,
  Benefits,
  FeatureGrid,
  FeatureTicker,
  FinalCTA,
  HowItWorks,
  ProblemSolution,
  ProductFAQ,
  ProductHero,
  ProductPricing,
  ProductProofStrip,
  ProductTour,
  VisualFeatureShowcase,
} from '../components/ProductSections'
import { ArrowLeft } from 'lucide-react'

// Uploaded product screenshots live in the Worker's media storage and arrive
// from the public config as relative /media/... paths.
const resolveMediaSrc = (src) => (src && src.startsWith('/media/') && API_BASE_URL ? `${API_BASE_URL}${src}` : src)

function resolveMediaUrls(viewModel) {
  if (viewModel.hero?.visual?.screen) {
    viewModel.hero.visual.screen.src = resolveMediaSrc(viewModel.hero.visual.screen.src)
  }
  for (const item of viewModel.tour?.items || []) {
    if (item.screen) item.screen.src = resolveMediaSrc(item.screen.src)
  }
  for (const feature of viewModel.featureVisuals || []) {
    feature.imagePath = resolveMediaSrc(feature.imagePath)
  }
  return viewModel
}

export default function ProductPage({ theme, onToggleTheme, palette, onPaletteChange }) {
  const { productKey } = useParams()
  const config = usePublicProducts()
  // Owner preview: the admin editor drives this page over postMessage so the
  // owner sees unsaved edits. The draft wins over the saved config.
  const previewMode = useMemo(() => isPreviewRequest(), [])
  const previewDraft = usePreviewDraft(previewMode)
  const saved = useMemo(() => (config?.products || []).find((product) => product.key === productKey) || null, [config, productKey])
  const live = previewMode && previewDraft ? previewDraft : saved
  const inCatalog = Boolean(catalogEntry(productKey))
  const product = useMemo(() => resolveMediaUrls(buildProductViewModel(productKey, live)), [productKey, live])
  const { startCheckout, checkoutError, clearCheckoutError } = useSecureCheckout()

  // Scroll position is handled globally by ScrollToTop (instant, before
  // paint) so product pages always open at the very top.

  usePageAnimations(inCatalog || live ? productKey : false)

  // SEO: full metadata plus Product, BreadcrumbList, and FAQPage structured
  // data, populated from the live product config so admin-created products
  // are just as crawlable as the built-in ones.
  const seoTitle = product?.meta?.title || `${product?.name || 'Product'} | Runway Systems`
  const seoDescription = product?.meta?.description || product?.hero?.lede || ''
  const priceNumber = (value) => {
    const parsed = Number.parseFloat(String(value || '').replace(/[^0-9.]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  const seoJsonLd = useMemo(() => {
    if (!product) return []
    const canonicalPath = `/products/${productKey}`
    const offer = product.offer || {}
    return [
      {
        id: 'jsonld-product',
        data: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: seoDescription,
          brand: { '@type': 'Brand', name: 'Runway Systems' },
          image: `${window.location.origin}${product.hero?.visual?.screen?.src || '/product-dashboard-uhd.webp'}`,
          offers: {
            '@type': 'Offer',
            url: `${window.location.origin}${canonicalPath}`,
            priceCurrency: 'USD',
            price: priceNumber(offer.displaySalePrice),
            availability: 'https://schema.org/InStock',
          },
        },
      },
      {
        id: 'jsonld-breadcrumb',
        data: {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Runway Systems', item: `${window.location.origin}/` },
            { '@type': 'ListItem', position: 2, name: product.name, item: `${window.location.origin}${canonicalPath}` },
          ],
        },
      },
      {
        id: 'jsonld-faq',
        data: {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: (product.faqs?.items || []).slice(0, 8).map(([question, answer]) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      },
    ]
  }, [product, productKey, seoDescription])

  // Hiding a product must hide its page too. Once the public config has
  // actually loaded, a key that is absent from it is either hidden or deleted,
  // so the page 404s instead of falling back to the built-in catalog copy,
  // which would keep a retired product fully readable (and indexable) at its
  // direct URL. If the config could not be loaded at all, nothing is treated
  // as hidden, so an outage never 404s the whole catalog.
  const hiddenFromStorefront = !previewMode && productIsUnavailable(config, productKey)

  // Every hook must run before any conditional return, otherwise React sees a
  // different hook count on the render that 404s and throws.
  const { toggle: toggleCart, has: cartHas } = useCart()
  const inCart = cartHas(product.key)
  // The three buy buttons on this page (nav, pricing, final CTA) all skip the
  // cart, so consent is taken in a confirm step here rather than inline beside
  // each button. Same agreement as the cart, one implementation.
  const [consentOpen, setConsentOpen] = useState(false)
  const onBuy = () => {
    // Inert in preview so the owner cannot start a real checkout while
    // reviewing copy.
    if (previewMode) return
    if (product.checkoutReady) setConsentOpen(true)
  }
  const confirmBuy = () => {
    setConsentOpen(false)
    startCheckout(product.key, '', 'product')
  }
  const onToggleCart = () => toggleCart(product.key)

  // A hidden or deleted product is indistinguishable from a bad URL to the
  // public, so both render the same 404.
  if (hiddenFromStorefront) {
    return <NotFound theme={theme} onToggleTheme={onToggleTheme} palette={palette} onPaletteChange={onPaletteChange} />
  }

  if (!inCatalog && !live) {
    return (
      <div className="product-not-found">
        <div className="shell">
          <p className="eyebrow">PRODUCT NOT FOUND</p>
          <h1>This product is not in the suite.</h1>
          <p>The link may be out of date, or the product may no longer be available.</p>
          <Link className="button primary" to="/"><ArrowLeft size={15} /> Back to the suite</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="product-page" data-product-accent={product.accent}>
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalPath={`/products/${productKey}`}
        ogType="product"
        ogImage={`${window.location.origin}${product.hero?.visual?.screen?.src || '/product-dashboard-uhd.webp'}`}
        jsonLd={seoJsonLd}
      />
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar product={product} onBuy={onBuy} theme={theme} onToggleTheme={onToggleTheme} palette={palette} onPaletteChange={onPaletteChange} offer={product.offer} />
      <main id="main">
        <ProductHero product={product} offer={product.offer} onToggleCart={onToggleCart} inCart={inCart} />
        <ProductProofStrip product={product} />
        <FeatureTicker labels={product.ticker} />
        <ProblemSolution product={product} />
        <ProductTour product={product} />
        {product.featureVisuals?.length ? <VisualFeatureShowcase product={product} /> : <FeatureGrid product={product} />}
        <HowItWorks product={product} />
        <Benefits product={product} />
        <AudienceProof product={product} />
        <TestimonialsSection productName={product.name} />
        <ProductPricing product={product} onBuy={onBuy} offer={product.offer} onToggleCart={onToggleCart} inCart={inCart} />
        <ProductFAQ product={product} supportEmail={config?.supportEmail || SUPPORT_EMAIL} />
        <FinalCTA product={product} onBuy={onBuy} offer={product.offer} />
      </main>
      <Footer products={storefrontProducts(config, defaultProducts())} supportEmail={config?.supportEmail || SUPPORT_EMAIL} />
      <CheckoutConsentModal
        open={consentOpen}
        productName={product.name}
        price={product.offer?.displaySalePrice}
        onCancel={() => setConsentOpen(false)}
        onConfirm={confirmBuy}
      />
      <CheckoutModal open={Boolean(checkoutError)} onClose={clearCheckoutError} message={checkoutError} supportEmail={config?.supportEmail || SUPPORT_EMAIL} />
    </div>
  )
}
