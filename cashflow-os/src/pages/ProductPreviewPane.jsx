import { useCallback, useEffect, useRef, useState } from 'react'
import { Monitor, RefreshCw, Smartphone, Tablet } from 'lucide-react'
import { PREVIEW_MESSAGE, PREVIEW_READY } from '../hooks/usePreviewDraft'

// Live preview of the real product page, driven by the unsaved draft.
//
// An iframe rather than rendering the sections inline, because the product
// page is responsive and CSS media queries resolve against the viewport, not
// an element's width. A scaled <div> would show desktop layout shrunk and the
// mobile breakpoints would never fire, which is exactly what the owner needs
// to check. The frame gets its own viewport, so 390px really is mobile.
const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: 1280, icon: Monitor },
  { id: 'tablet', label: 'Tablet', width: 834, icon: Tablet },
  { id: 'mobile', label: 'Mobile', width: 390, icon: Smartphone },
]

// Map the editor's draft onto the shape /config/public would return, so the
// product page builds its view model exactly as it does in production.
export function draftToLiveProduct(draft) {
  if (!draft) return null
  return {
    key: draft.key || 'preview',
    name: draft.name || 'Untitled product',
    tagline: draft.tagline || '',
    category: draft.category || '',
    icon: draft.icon || 'spreadsheet',
    accent: draft.accent || 'lime',
    originalPrice: draft.originalPrice || '',
    salePrice: draft.salePrice || '',
    offerLabel: draft.offerLabel || '',
    offerActive: Boolean(draft.offerActive),
    active: true,
    featured: Boolean(draft.featured),
    sortOrder: Number(draft.sortOrder) || 0,
    includes: String(draft.includesText || '').split('\n').map((line) => line.trim()).filter(Boolean),
    heroImage: draft.heroImage || '',
    featureImages: Array.isArray(draft.featureImages) ? draft.featureImages : [],
    features: Array.isArray(draft.features) ? draft.features : [],
    content: draft.content || {},
    checkoutReady: Boolean(draft.lemonVariantId),
  }
}

export default function ProductPreviewPane({ draft }) {
  const frameRef = useRef(null)
  const stageRef = useRef(null)
  const readyRef = useRef(false)
  const [scale, setScale] = useState(1)
  const [device, setDevice] = useState('desktop')
  const [nonce, setNonce] = useState(0)

  const previewKey = draft?.key || 'preview'
  const src = `/products/${encodeURIComponent(previewKey || 'preview')}?preview=1`

  const post = useCallback(() => {
    const frame = frameRef.current
    if (!frame?.contentWindow || !readyRef.current) return
    frame.contentWindow.postMessage(
      { type: PREVIEW_MESSAGE, product: draftToLiveProduct(draft) },
      window.location.origin,
    )
  }, [draft])

  // The frame announces itself once mounted, which avoids a race where the
  // first draft is posted before the page is listening.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== PREVIEW_READY) return
      readyRef.current = true
      post()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [post])

  // Push every keystroke. Cheap: it is a structured clone, not a reload.
  useEffect(() => { post() }, [post])

  const reload = () => {
    readyRef.current = false
    setNonce((value) => value + 1)
  }

  const active = DEVICES.find((item) => item.id === device) || DEVICES[0]

  // Scale the frame to fit the pane rather than using a fixed factor: a fixed
  // scale that suits 1280px desktop would render the 390px mobile view
  // uselessly small. Never scale above 1, so mobile shows at real size.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const fit = () => {
      const room = stage.clientWidth - 24
      setScale(Math.min(1, room / active.width))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [active.width])

  return (
    <section className="admin-preview">
      <header className="admin-preview__bar">
        <div className="admin-preview__devices" role="group" aria-label="Preview width">
          {DEVICES.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={item.id === device ? 'is-active' : undefined}
                aria-pressed={item.id === device}
                onClick={() => setDevice(item.id)}
              >
                <Icon size={13} /> {item.label}
              </button>
            )
          })}
        </div>
        <span className="admin-preview__width">{active.width}px</span>
        <button type="button" className="button text button--small" onClick={reload}>
          <RefreshCw size={13} /> Reload
        </button>
      </header>
      <div className="admin-preview__stage" ref={stageRef}>
        <iframe
          key={`${previewKey}-${nonce}`}
          ref={frameRef}
          className="admin-preview__frame"
          style={{ width: `${active.width}px`, transform: `scale(${scale})`, height: `${Math.round(620 / scale)}px` }}
          src={src}
          title="Product page preview"
          onLoad={post}
        />
      </div>
      <p className="admin-preview__note">
        Live preview of the real product page, including unsaved edits. Buy buttons are inactive here.
        Uploaded images appear after the upload finishes.
      </p>
    </section>
  )
}
