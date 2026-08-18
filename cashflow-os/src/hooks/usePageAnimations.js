import { useLayoutEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function usePageAnimations(ready) {
  useLayoutEffect(() => {
    if (!ready) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const isMobile = window.matchMedia('(max-width: 720px)').matches
    const touchOnly = window.matchMedia('(hover: none), (pointer: coarse)').matches
    ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load' })

    const magneticCleanups = []
    const refreshPage = () => ScrollTrigger.refresh()
    const refreshTimer = window.setTimeout(refreshPage, 320)
    window.addEventListener('load', refreshPage, { once: true })

    const context = gsap.context(() => {
      document.querySelectorAll('[data-count]').forEach((element, index) => {
        const target = Number(element.dataset.count)
        const decimals = Number(element.dataset.decimals || 0)
        const prefix = element.dataset.prefix || ''
        const suffix = element.dataset.suffix || ''
        const value = { current: 0 }
        gsap.to(value, {
          current: target,
          duration: 1.55,
          delay: .62 + index * .07,
          ease: 'power3.out',
          onUpdate: () => {
            element.textContent = `${prefix}${value.current.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
          },
        })
      })

      gsap.utils.toArray('.reveal:not(.feature-card):not(.audience-card)').forEach((element) => {
        gsap.fromTo(
          element,
          { y: isMobile ? 28 : 44, opacity: 0, scale: isMobile ? .992 : .985 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: isMobile ? .72 : .95,
            ease: 'power3.out',
            clearProps: 'opacity,transform',
            scrollTrigger: {
              trigger: element,
              start: isMobile ? 'top 94%' : 'top 88%',
              once: true,
              invalidateOnRefresh: true,
            },
          },
        )
      })

      gsap.utils.toArray('.chaos-stage, .clarity-dashboard, .tour-browser, .privacy-graphic, .outcome-card--main, .price-card-head, .price, .included-list, .final-icon').forEach((visual) => {
        gsap.fromTo(visual,
          { opacity: 0, clipPath: 'inset(7% 3% 9% 3% round 18px)', filter: isMobile ? 'none' : 'blur(5px)' },
          {
            opacity: 1,
            clipPath: 'inset(0% 0% 0% 0% round 0px)',
            filter: 'blur(0px)',
            duration: isMobile ? .78 : 1.08,
            ease: 'power3.out',
            clearProps: 'opacity,clipPath,filter',
            scrollTrigger: { trigger: visual, start: isMobile ? 'top 95%' : 'top 88%', once: true },
          },
        )
      })

      gsap.from('.paper', { y: 30, x: (index) => index % 2 ? 22 : -22, scale: .9, opacity: 0, duration: .78, stagger: .11, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.chaos-stage', start: 'top 88%', once: true } })
      gsap.from('.clarity-metrics > div', { y: 18, opacity: 0, duration: .65, stagger: .12, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.clarity-dashboard', start: 'top 86%', once: true } })
      gsap.from('.step-icon', { scale: .7, rotate: -9, opacity: 0, duration: .72, stagger: .13, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.steps', start: 'top 86%', once: true } })
      gsap.from('.price-card .included-list span', { x: -16, opacity: 0, duration: .48, stagger: .055, ease: 'power2.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.price-card', start: 'top 78%', once: true } })

      const gaugePath = document.querySelector('.confidence-gauge .gauge-progress')
      if (gaugePath) {
        const gaugeLength = gaugePath.getTotalLength()
        gsap.set(gaugePath, { strokeDasharray: gaugeLength, strokeDashoffset: gaugeLength })
        gsap.to(gaugePath, { strokeDashoffset: gaugeLength * .12, duration: 1.65, ease: 'power3.out', scrollTrigger: { trigger: gaugePath, start: 'top 88%', once: true } })
      }

      gsap.to('.scroll-progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .25 } })
      gsap.to('.steps-line i', { width: '100%', ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 75%', end: 'bottom 60%', scrub: 1 } })
      gsap.utils.toArray('.visual-feature__rail i').forEach((rail) => {
        gsap.fromTo(rail, { scaleY: 0 }, {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: { trigger: rail.closest('.visual-feature'), start: 'top 74%', end: 'bottom 46%', scrub: .8 },
        })
      })
      gsap.from('.visual-feature', {
        y: 48,
        opacity: 0,
        duration: .9,
        stagger: .14,
        ease: 'power3.out',
        clearProps: 'opacity,transform',
        scrollTrigger: { trigger: '.visual-showcase__list', start: isMobile ? 'top 93%' : 'top 84%', once: true, invalidateOnRefresh: true },
      })
      gsap.to('.hero-visual', { yPercent: isMobile ? 4 : 9, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: isMobile ? .45 : 1, invalidateOnRefresh: true } })
      gsap.to('.hero-runway', { yPercent: isMobile ? 12 : 25, opacity: .3, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: isMobile ? .45 : 1, invalidateOnRefresh: true } })
      gsap.to('.hero-orb--one', { rotate: 360, duration: 34, repeat: -1, ease: 'none' })
      gsap.to('.outcome-card--back-one', { y: -18, rotate: 1, ease: 'none', scrollTrigger: { trigger: '.outcome-stack', start: 'top bottom', end: 'bottom top', scrub: 1 } })
      gsap.to('.outcome-card--back-two', { y: 17, rotate: -1, ease: 'none', scrollTrigger: { trigger: '.outcome-stack', start: 'top bottom', end: 'bottom top', scrub: 1 } })
      gsap.to('.pricing-orb', { xPercent: 35, scale: 1.2, ease: 'none', scrollTrigger: { trigger: '.pricing-section', start: 'top bottom', end: 'bottom top', scrub: 1.2 } })
      gsap.from('.feature-card', { y: isMobile ? 32 : 55, rotateX: isMobile ? -3 : -8, opacity: 0, duration: isMobile ? .68 : .8, stagger: isMobile ? .065 : .08, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.feature-grid', start: isMobile ? 'top 93%' : 'top 82%', once: true, invalidateOnRefresh: true } })
      gsap.from('.audience-card', { x: isMobile ? 0 : (index) => index === 0 ? -35 : index === 2 ? 35 : 0, y: 28, opacity: 0, duration: isMobile ? .68 : .85, stagger: .1, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.audience-grid', start: isMobile ? 'top 93%' : 'top 82%', once: true, invalidateOnRefresh: true } })
      gsap.from('.product-card', { y: 34, opacity: 0, duration: .7, stagger: .07, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.products-grid', start: 'top 88%', once: true, invalidateOnRefresh: true } })

      gsap.utils.toArray('.dash-chart .line, .chaos-stage path').forEach((path) => {
        const length = path.getTotalLength()
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
        gsap.to(path, { strokeDashoffset: 0, duration: 1.7, ease: 'power2.out', scrollTrigger: { trigger: path, start: 'top 88%', once: true } })
      })

      // Magnetic buttons are a fine-pointer affordance. Bind pointer events
      // rather than mouse events and filter on pointerType, so a hybrid
      // laptop with a touchscreen still gets the effect from its trackpad
      // while a finger never drags the button out from under itself. The
      // pointerup/cancel resets matter because a stylus or a mouse leaving
      // the window can otherwise strand the button off-centre.
      if (!touchOnly) {
        document.querySelectorAll('.hero-actions .button, .final-cta .button').forEach((button) => {
          const move = (event) => {
            if (event.pointerType && event.pointerType !== 'mouse') return
            const rect = button.getBoundingClientRect()
            gsap.to(button, { x: (event.clientX - rect.left - rect.width / 2) * .1, y: (event.clientY - rect.top - rect.height / 2) * .14, duration: .35, ease: 'power2.out' })
          }
          const leave = () => gsap.to(button, { x: 0, y: 0, duration: .5, ease: 'power3.out' })
          button.addEventListener('pointermove', move, { passive: true })
          button.addEventListener('pointerleave', leave)
          button.addEventListener('pointercancel', leave)
          button.addEventListener('pointerup', leave)
          magneticCleanups.push(() => {
            button.removeEventListener('pointermove', move)
            button.removeEventListener('pointerleave', leave)
            button.removeEventListener('pointercancel', leave)
            button.removeEventListener('pointerup', leave)
          })
        })
      }

      ScrollTrigger.refresh()
    })

    return () => {
      window.clearTimeout(refreshTimer)
      window.removeEventListener('load', refreshPage)
      magneticCleanups.forEach((cleanup) => cleanup())
      context.revert()
    }
  }, [ready])
}
