import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Quote, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getApprovedTestimonials, subscribeToPlatformData } from '../api/platformApi'

const AUTO_ADVANCE_MS = 5500

function Rating({ value }) {
  return (
    <span className="review-rating" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={15} fill={index < value ? 'currentColor' : 'none'} aria-hidden="true" />
      ))}
    </span>
  )
}

export default function TestimonialsSection({ productName = 'Cash Flow OS' }) {
  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(true)
  const sectionRef = useRef(null)

  const loadTestimonials = useCallback(async () => {
    try {
      const approved = await getApprovedTestimonials()
      setTestimonials(approved)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTestimonials()
    return subscribeToPlatformData(loadTestimonials)
  }, [loadTestimonials])

  const count = testimonials.length
  const paused = hovered || !visible

  const goTo = (next) => setActive((((next % count) + count) % count))
  const next = () => count > 1 && goTo(active + 1)
  const prev = () => count > 1 && goTo(active - 1)

  // Horizontal swipe for touch and pen. Desktop keeps the arrows and the
  // keyboard; without this the carousel could only be driven by the small
  // arrow buttons on a phone, which is the one place a swipe is expected.
  const swipeRef = useRef(null)

  const onSwipeStart = (event) => {
    if (event.pointerType === 'mouse' || count < 2) return
    swipeRef.current = { x: event.clientX, y: event.clientY }
  }

  const onSwipeEnd = (event) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || count < 2) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    // Require a deliberate mostly-horizontal gesture so vertical page
    // scrolling is never hijacked.
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return
    if (deltaX < 0) next()
    else prev()
  }

  // Auto-advance one review at a time. Pauses on hover, keyboard focus,
  // when the section scrolls off-screen, and entirely under reduced motion.
  useEffect(() => {
    if (paused || count < 2) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => setActive((current) => (current + 1) % count), AUTO_ADVANCE_MS)
    return () => window.clearInterval(timer)
  }, [paused, count])

  // Keep the active slide valid as data loads or changes.
  useEffect(() => {
    if (count > 0 && active >= count) setActive(0)
  }, [count, active])

  useEffect(() => {
    if (!sectionRef.current || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        setVisible(true)
        observer.disconnect()
      } else {
        setVisible(false)
      }
    }, { threshold: 0.12 })
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="section reviews-section" id="reviews" ref={sectionRef}>
      <div className="shell">
        <div className="section-head review-heading">
          <div>
            <span className="eyebrow">CUSTOMER SIGNAL</span>
            <h2>Clearer decisions,<br />in their own words.</h2>
          </div>
          <div className="review-heading-aside">
            <Quote size={25} aria-hidden="true" />
            <p>Every testimonial is reviewed before it appears here. Honest feedback stays useful.</p>
          </div>
        </div>

        <div
          className="testimonial-carousel"
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true) }}
          onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHovered(false) }}
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
          onPointerCancel={() => { swipeRef.current = null; setHovered(false) }}
          onFocus={() => setHovered(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false)
          }}
        >
          {loading ? (
            <div className="testimonial-viewport"><div className="testimonial-track"><div className="testimonial-slide"><div className="testimonial-card is-skeleton" aria-hidden="true" /></div></div></div>
          ) : count ? (
            <>
              <div className="testimonial-viewport">
                <div className="testimonial-track" style={{ transform: `translateX(-${active * 100}%)` }}>
                  {testimonials.slice(0, 6).map((testimonial, index) => (
                    <div
                      className="testimonial-slide"
                      key={testimonial.id}
                      role="group"
                      aria-roledescription="slide"
                      aria-label={`${index + 1} of ${Math.min(count, 6)}`}
                      aria-hidden={index !== active}
                    >
                      <article className="testimonial-card">
                        <div className="testimonial-topline">
                          <Rating value={testimonial.rating} />
                          <span className="verified-mark">APPROVED</span>
                        </div>
                        <blockquote>“{testimonial.text}”</blockquote>
                        <footer>
                          <span className="review-avatar" aria-hidden="true">{testimonial.name.charAt(0)}</span>
                          <div>
                            <strong>{testimonial.name}</strong>
                            <small>{productName} customer</small>
                          </div>
                        </footer>
                      </article>
                    </div>
                  ))}
                </div>
              </div>

              {count > 1 && (
                <div className="carousel-controls">
                  <button className="carousel-arrow" type="button" onClick={prev} aria-label="Previous review">
                    <ArrowLeft size={16} />
                  </button>
                  <div className="carousel-dots">
                    {testimonials.slice(0, 6).map((testimonial, index) => (
                      <button
                        key={testimonial.id}
                        className={index === active ? 'is-active' : ''}
                        type="button"
                        onClick={() => goTo(index)}
                        aria-label={`Go to review ${index + 1}`}
                        aria-current={index === active}
                      />
                    ))}
                  </div>
                  <button className="carousel-arrow" type="button" onClick={next} aria-label="Next review">
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="reviews-empty">Approved customer stories will appear here.</div>
          )}
        </div>

        <div className="review-section-cta">
          <p>Already using {productName}?</p>
          <Link to="/feedback">Share your experience <ArrowUpRight size={15} /></Link>
        </div>
      </div>
    </section>
  )
}
