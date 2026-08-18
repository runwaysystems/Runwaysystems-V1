import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Megaphone, X } from 'lucide-react'
import { getPublicConfigCache, setPublicConfigCache, subscribePublicConfig } from '../lib/publicConfigCache'
import { getPublicConfig } from '../api/platformApi'

const DISMISS_KEY = 'runway-announcement-dismissed'

// Dismissal is keyed to the announcement content, so a new announcement
// always reappears even if an older one was dismissed.
const announcementKey = (announcement) => [announcement?.message, announcement?.linkUrl].filter(Boolean).join('|')

export default function AnnouncementBar() {
  const barRef = useRef(null)
  const [announcement, setAnnouncement] = useState(() => getPublicConfigCache()?.announcement || null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) || ''
    } catch {
      return ''
    }
  })

  // Follow config updates (admin edits) and load the config once if no page
  // has fetched it yet, so the bar works on every route.
  useEffect(() => subscribePublicConfig((config) => setAnnouncement(config?.announcement || null)), [])
  useEffect(() => {
    if (getPublicConfigCache()) return undefined
    let active = true
    getPublicConfig()
      .then((config) => {
        if (!active) return
        setPublicConfigCache(config || { products: [] })
        setAnnouncement(config?.announcement || null)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const active = Boolean(announcement?.active && announcement?.message && dismissed !== announcementKey(announcement))

  // GSAP entrance: the bar unfolds into place once per appearance, and
  // settles instantly for visitors who prefer reduced motion.
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!active || !bar) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const tween = gsap.fromTo(bar, { y: -28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, ease: 'power3.out' })
    return () => {
      tween.kill()
    }
  }, [active])

  if (!active) return null

  const dismiss = () => {
    const key = announcementKey(announcement)
    try {
      window.localStorage.setItem(DISMISS_KEY, key)
    } catch {
      // Storage can be restricted; the bar simply stays visible this session.
    }
    setDismissed(key)
  }

  return (
    <aside className="announcement-bar" role="region" aria-label="Store announcement" ref={barRef}>
      <div className="shell announcement-bar__inner">
        <span className="announcement-bar__icon" aria-hidden="true"><Megaphone size={14} /></span>
        <p className="announcement-bar__message">
          {announcement.message}
          {announcement.linkUrl && announcement.linkText && (
            <a
              href={announcement.linkUrl}
              target={announcement.linkUrl.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
            >
              {announcement.linkText}
            </a>
          )}
        </p>
        {announcement.dismissible && (
          <button className="announcement-bar__close" type="button" aria-label="Dismiss announcement" onClick={dismiss}>
            <X size={14} />
          </button>
        )}
      </div>
    </aside>
  )
}
