import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Route changes always open at the top of the page - instantly and before
// the browser paints, so there is no smooth-scroll animation from the old
// scroll position. Cross-page anchors (e.g. /terms#privacy) scroll straight
// to their section instead. Same-page hash links are untouched, so the
// in-page smooth scrolling still works.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  // null means "first mount", which counts as navigation (e.g. a direct
  // visit to /terms#privacy should jump to the section).
  const previousPath = useRef(null)

  useLayoutEffect(() => {
    const navigateAway = previousPath.current !== pathname
    previousPath.current = pathname

    if (!navigateAway && hash) return // in-page anchor: keep native smooth scroll

    if (hash) {
      // Cross-page anchor: jump to the section once it has mounted.
      requestAnimationFrame(() => {
        const target = document.getElementById(hash.slice(1))
        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' })
        else window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      })
      return
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash])

  return null
}
