import { useEffect, useRef } from 'react'
import { HERO_GROUND } from '~/sections/GroundLayer'
import { advance } from '~/scroll/loadProgress'
import { beginReveal, finishReveal, load, useLoadPhase } from '~/scroll/loading'
import { getLenis } from '~/scroll/useLenis'

/**
 * The opening beat — see docs/superpowers/specs/2026-08-07-hero-loader-design.md.
 *
 * A fixed layer over the whole page carrying its own copy of the name, set
 * in the EXACT hero classes: same face, same size, same line breaks, same
 * blend mode. That is not decoration, it is the whole trick — when the glide
 * lands (Task 7) the loader's copy and the real <h1> are the same pixels, so
 * the handover has nothing to give it away.
 *
 * Deliberately imports neither three.js nor drei. The flower is code-split
 * behind a lazy import and the loader exists to cover exactly that wait; an
 * eager drei import here would pull the wait into the loader itself.
 */

/** The name, one entry per line — the same split as the hero's h1 spans. */
const LINES = ['Denise', 'Cacanando']

/**
 * The glyph bounds of an element's text, not the element's own box.
 *
 * A `display: block` line span is full-width, so its rect says nothing about
 * where the letters are. A Range over its contents gives the inked bounds —
 * which means the hero h1's alignment (right at sm+, left below) and its
 * parallax `par` transform are absorbed by the measurement instead of having
 * to be reasoned about at all.
 */
const glyphRect = (el: Element): DOMRect => {
  const range = document.createRange()
  range.selectNodeContents(el)
  return range.getBoundingClientRect()
}

/**
 * The pen. A mask gradient rather than clip-path: the soft ramp between the
 * two stops IS the pen tip, and it is sized in `em` so it scales with the
 * type instead of being a fixed number of pixels at every breakpoint.
 *
 * Progress is split between the lines in proportion to their measured widths
 * so the pen crosses both at one constant speed, rather than spending half
 * the write on the shorter word.
 */
const paintWipe = (els: (HTMLElement | null)[], widths: number[], p: number) => {
  const total = widths.reduce((a, b) => a + b, 0)
  if (!total) return
  let before = 0
  els.forEach((el, i) => {
    if (!el) return
    const span = widths[i] / total
    // How far the pen has crossed THIS line, 0–1.
    const local = Math.min(1, Math.max(0, (p - before) / span))
    before += span
    if (local >= 1) {
      // Cleared rather than parked at 100%: a mask whose ramp ends exactly
      // at the edge still feathers the final glyph.
      el.style.maskImage = ''
      el.style.webkitMaskImage = ''
      return
    }
    const pct = local * 100
    const g = `linear-gradient(90deg, #000 calc(${pct}% - 0.35em), transparent calc(${pct}% + 0.15em))`
    el.style.maskImage = g
    el.style.webkitMaskImage = g
  })
}

export const Loader = () => {
  const phase = useLoadPhase()
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([])

  /** Line widths, measured once the real face is in. Empty = not ready. */
  const widths = useRef<number[]>([])

  /**
   * The scroll lock. The page behind this layer is fully live — mounted,
   * measured and pinned — so without this a visitor can wheel away from a
   * hero they have not been shown yet.
   *
   * Lenis owns wheel, touch and keyboard on the normal path, so stopping it
   * IS the lock. The preventDefault pair is for reduced motion, where
   * useLenis returns early and there is no instance to stop.
   */
  useEffect(() => {
    window.scrollTo(0, 0)
    getLenis()?.stop()
    const block = (e: Event) => e.preventDefault()
    window.addEventListener('wheel', block, { passive: false })
    window.addEventListener('touchmove', block, { passive: false })
    return () => {
      window.removeEventListener('wheel', block)
      window.removeEventListener('touchmove', block)
      getLenis()?.start()
    }
  }, [])

  /**
   * The write cannot start on a fallback face. Capped at 1.5s: a font that
   * never arrives must not hold the name hostage — the wipe simply starts
   * against whatever is rendering.
   *
   * `measure` is wired as both the fulfil AND reject handler: a rejected
   * `FontFaceSet.load()` (blocked request, CDN failure) deserves the exact
   * same "start against whatever is rendering" outcome as the 1.5s cap, not
   * an unhandled rejection in the console.
   */
  useEffect(() => {
    let cancelled = false
    const measure = () => {
      if (cancelled) return
      widths.current = lineRefs.current.map((el) => (el ? glyphRect(el).width : 0))
    }
    const ready = document.fonts
      ? document.fonts.load('1em "Pinyon Script"').then(measure, measure)
      : Promise.resolve().then(measure)
    const cap = window.setTimeout(measure, 1500)
    void ready
    return () => {
      cancelled = true
      window.clearTimeout(cap)
    }
  }, [])

  /**
   * The pen. A plain rAF rather than GSAP's ticker or React state: the value
   * changes every frame and lands on the DOM directly, which is the same
   * rule `frame` follows in scroll/store.ts.
   */
  useEffect(() => {
    if (phase !== 'loading') return
    let raf = 0
    let last = 0
    const start = performance.now()

    const tick = (now: number) => {
      const dt = last ? now - last : 16
      last = now
      load.written = advance(load.written, load.target, dt, now - start)
      if (widths.current.length) paintWipe(lineRefs.current, widths.current, load.written)
      if (load.written >= 1) {
        beginReveal()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  /**
   * Hand over. Task 7 replaces this with the FLIP glide; for now the swap is
   * immediate, which is enough to prove the phase machinery end to end.
   */
  useEffect(() => {
    if (phase !== 'revealing') return
    finishReveal()
  }, [phase])

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: HERO_GROUND }}
    >
      {/* The blend mode is copied from the h1 deliberately: the loader's
          backdrop and the hero's ground are the same gradient and the flower
          is still invisible at handover, so cream-through-difference resolves
          identically on both sides of the swap. */}
      <div className="font-hero text-hero-m text-cream sm:text-hero sm:mix-blend-difference text-center">
        {LINES.map((line, i) => (
          <span
            key={line}
            ref={(el) => {
              lineRefs.current[i] = el
            }}
            className="block"
            style={{ maskImage: 'linear-gradient(90deg, transparent 0%, transparent 100%)' }}
          >
            {line}
          </span>
        ))}
      </div>

      <p className="mt-8 font-mono text-meta tracking-caption uppercase text-cream/40">
        loading
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
      </p>
    </div>
  )
}
