import { useEffect, useState } from 'react'

// Live draft channel for the owner's product preview.
//
// The product page normally renders saved, active products from
// /config/public. In preview mode it instead renders whatever the admin
// editor posts in, so the owner sees unsaved edits as they type. The editor
// embeds the page in an iframe and posts on every keystroke.
//
// Only same-origin messages are accepted: the preview must never be drivable
// by another site that happens to embed this page.
export const PREVIEW_FLAG = 'preview'
export const PREVIEW_MESSAGE = 'runway:preview-draft'
export const PREVIEW_READY = 'runway:preview-ready'

export function isPreviewRequest() {
  if (typeof window === 'undefined') return false
  // Only meaningful inside a frame; a top-level ?preview=1 is ignored so the
  // flag cannot be shared as a link that bypasses the storefront.
  if (window.parent === window) return false
  return new URLSearchParams(window.location.search).get(PREVIEW_FLAG) === '1'
}

export function usePreviewDraft(enabled) {
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    if (!enabled) return undefined

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return
      const data = event.data
      if (!data || data.type !== PREVIEW_MESSAGE) return
      setDraft(data.product || null)
    }

    window.addEventListener('message', onMessage)
    // Tell the editor the frame is listening, so a draft posted before this
    // page finished loading is not lost.
    try {
      window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin)
    } catch {
      // Cross-origin parent: preview simply stays empty.
    }
    return () => window.removeEventListener('message', onMessage)
  }, [enabled])

  return draft
}
