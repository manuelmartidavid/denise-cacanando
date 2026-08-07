import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { HERO_GROUND } from '~/sections/GroundLayer'
import { advance } from '~/scroll/loadProgress'
import { beginReveal, finishReveal, forceComplete, load, useLoadPhase } from '~/scroll/loading'
import { useReducedMotion } from '~/scroll/useReducedMotion'

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
 * One line, described in the two units the wipe has to reconcile: the ink's
 * width in pixels (which divides the TIME) and where that ink sits inside the
 * span's own box (which is what a mask percentage resolves against).
 */
type LineMetrics = {
  /** Inked width in px — how the write time is divided between the lines. */
  width: number
  /** Where the ink starts inside the box, as a fraction of the box width. */
  inset: number
  /** How much of the box the ink spans, as a fraction of the box width. */
  frac: number
}

const measureLine = (el: HTMLElement): LineMetrics => {
  const ink = glyphRect(el)
  const box = el.getBoundingClientRect()
  if (!box.width) return { width: ink.width, inset: 0, frac: 1 }
  return { width: ink.width, inset: (ink.left - box.left) / box.width, frac: ink.width / box.width }
}

/**
 * The pen. A mask gradient rather than clip-path: the soft ramp between the
 * two stops IS the pen tip, and it is sized in `em` so it scales with the
 * type instead of being a fixed number of pixels at every breakpoint.
 *
 * Progress is split between the lines in proportion to their INKED widths so
 * the pen crosses both at one constant speed, rather than spending half the
 * write on the shorter word.
 *
 * Reconciling that split with the mask is the whole subtlety. The spans are
 * blocks in a centred column, so both boxes are as wide as the LONGER line
 * and `text-center` floats the shorter one in the middle of its own — at
 * 1400px, "Denise" is 369px of ink starting 19.6% into a 606px box. Feeding
 * `local` straight in as a percentage therefore gave that line 37.8% of the
 * time to cross the same 606px "Cacanando" crossed in 62.2%, and spent ~39%
 * of it drawing empty margin: a hesitation before the D and again after the
 * e, which is exactly the artifact the width-proportional split exists to
 * prevent. `inset` and `frac` map the line-local fraction onto where the ink
 * actually is, so the constant speed is true on the screen and not only in
 * the arithmetic.
 */
const paintWipe = (els: (HTMLElement | null)[], lines: LineMetrics[], p: number) => {
  const total = lines.reduce((a, l) => a + l.width, 0)
  if (!total) return
  let before = 0
  els.forEach((el, i) => {
    const m = lines[i]
    const span = m ? m.width / total : 0
    // The accumulator advances ABOVE the guards below: a line that cannot be
    // drawn must cost itself its stroke, not shift every line after it.
    const start = before
    before += span
    if (!el || !m || span <= 0) return
    // How far the pen has crossed THIS line's ink, 0–1.
    const local = Math.min(1, Math.max(0, (p - start) / span))
    if (local >= 1) {
      // Cleared rather than parked at 100%: a mask whose ramp ends exactly
      // at the edge still feathers the final glyph.
      el.style.maskImage = ''
      el.style.webkitMaskImage = ''
      return
    }
    const pct = (m.inset + local * m.frac) * 100
    const g = `linear-gradient(90deg, #000 calc(${pct}% - 0.35em), transparent calc(${pct}% + 0.15em))`
    el.style.maskImage = g
    el.style.webkitMaskImage = g
  })
}

/** Keys that scroll the page directly, bypassing Lenis. */
const SCROLL_KEYS = new Set([
  ' ',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

export const Loader = () => {
  const phase = useLoadPhase()
  const reduced = useReducedMotion()
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([])
  const backdropRef = useRef<HTMLDivElement>(null)

  /** Per-line geometry, measured once the real face is in. Empty = not ready. */
  const metrics = useRef<LineMetrics[]>([])

  /**
   * The pointer and keyboard half of the scroll lock. The page behind this
   * layer is fully live — mounted, measured and pinned — so without a lock a
   * visitor can wheel away from a hero they have not been shown yet.
   *
   * Lenis is stopped by ScrollPage, not here: it owns the instance, and a
   * child's effect commits before its parent's, so this component could only
   * ever have seen a null one. See the comment there.
   *
   * The listeners below are not decoration, and what each one covers was read
   * off node_modules/lenis/dist/lenis.mjs rather than assumed:
   *
   *   - `keydown` is the ONLY keyboard lock that exists, on every path. Lenis
   *     has no keyboard handling whatsoever — grep it for `keydown` and there
   *     is nothing — so without this, Space, Page Up/Down, Home, End and the
   *     arrows scroll the page out from under a loader the visitor is still
   *     reading.
   *   - `wheel` and `touchmove` are the whole lock under reduced motion, where
   *     useLenis returns early and there is no instance to stop. On the Lenis
   *     path a stopped instance preventDefaults both of them itself, in
   *     onVirtualScroll's `isStopped` branch — but only while it is stopped.
   *     Left running it prevents wheel and NOT touch: `syncTouch` is off by
   *     default, so touchmove falls through to the "native" early return that
   *     hands the gesture back to the browser untouched.
   */
  useEffect(() => {
    window.scrollTo(0, 0)
    const block = (e: Event) => e.preventDefault()
    // Only the scrolling keys are blocked; Tab and Escape must keep working
    // or this traps the keyboard.
    const blockKeys = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key)) e.preventDefault()
    }
    window.addEventListener('wheel', block, { passive: false })
    window.addEventListener('touchmove', block, { passive: false })
    window.addEventListener('keydown', blockKeys, { passive: false })
    return () => {
      window.removeEventListener('wheel', block)
      window.removeEventListener('touchmove', block)
      window.removeEventListener('keydown', blockKeys)
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
      metrics.current = lineRefs.current.map((el) =>
        el ? measureLine(el) : { width: 0, inset: 0, frac: 1 },
      )
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
   * The hammer. A GLB that 404s or a network that dies mid-fetch would
   * otherwise leave the site behind a permanent black screen — the one
   * failure this feature must not be able to cause.
   */
  useEffect(() => {
    const t = window.setTimeout(forceComplete, 10_000)
    return () => window.clearTimeout(t)
  }, [])

  /**
   * The elapsed-since-mount clock for the wipe, in refs rather than the
   * effect's own local variables: `reduced` sits in that effect's dependency
   * array, and a visitor flipping prefers-reduced-motion mid-load — a real,
   * live event, since useReducedMotion subscribes to a matchMedia `change` —
   * tears the effect down and restarts it. A `let start` reseeded on that
   * restart would silently re-impose loadProgress's MIN_DURATION floor from
   * the flip instead of from mount. Refs survive the restart, so the clock
   * doesn't.
   */
  const startRef = useRef<number | null>(null)
  const lastRef = useRef(0)

  /**
   * The pen. A plain rAF rather than GSAP's ticker or React state: the value
   * changes every frame and lands on the DOM directly, which is the same
   * rule `frame` follows in scroll/store.ts.
   */
  useEffect(() => {
    if (phase !== 'loading') return
    if (startRef.current === null) startRef.current = performance.now()
    const start = startRef.current
    let raf = 0

    const tick = (now: number) => {
      // Capped: a backgrounded tab pauses rAF, so the first frame back can be
      // seconds wide. Uncapped, advance's chase constant saturates over that
      // dt and `written` lands straight on the goal — the name would appear
      // whole, with no write at all. 50ms degrades that to a hurried hand.
      const dt = Math.min(lastRef.current ? now - lastRef.current : 16, 50)
      lastRef.current = now
      load.written = advance(load.written, load.target, dt, now - start)
      if (!reduced && metrics.current.length) paintWipe(lineRefs.current, metrics.current, load.written)
      if (load.written >= 1) {
        beginReveal()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, reduced])

  /**
   * The handover. FLIP: measure where the loader's lines are, measure where
   * the hero's are, translate by the difference. Transform only — no
   * font-size and no layout animation, which is why the two renderings stay
   * the same shape the whole way across.
   *
   * The real h1 fades up underneath on a CSS delay (see index.css) rather
   * than being animated here: two systems writing one element's opacity is
   * how handovers get janky.
   */
  useEffect(() => {
    if (phase !== 'revealing') return

    const own = lineRefs.current.filter((el): el is HTMLSpanElement => Boolean(el))
    const targets = document.querySelectorAll<HTMLElement>('#hero [data-hero-line]')

    if (reduced) {
      // No travel and no cross-fade: the loader dissolves, the hero is
      // simply there. The 240ms matches the reduced-motion transition on
      // .hero-veil in index.css.
      const tl = gsap.timeline({ onComplete: finishReveal })
      tl.to([backdropRef.current, ...own], { opacity: 0, duration: 0.24, ease: 'none' })
      return () => {
        tl.kill()
      }
    }

    const tl = gsap.timeline({ onComplete: finishReveal })

    own.forEach((el, i) => {
      const target = targets[i]
      if (!target) return
      const from = glyphRect(el)
      const to = glyphRect(target)
      tl.to(el, {
        x: to.left - from.left,
        y: to.top - from.top,
        duration: 0.9,
        ease: 'power2.inOut',
      }, 0)
    })

    if (backdropRef.current) {
      // What this actually reveals is the side rail and the ticker: behind
      // the hero itself the gradient is identical, so there is nothing to see
      // it cross.
      tl.to(backdropRef.current, { opacity: 0, duration: 0.9, ease: 'power1.inOut' }, 0)
    }

    // The last breath — the loader's copy dissolves as the real h1, on its
    // matching 760ms CSS delay, comes up in the same place.
    tl.to(own, { opacity: 0, duration: 0.14, ease: 'none' }, 0.76)

    // A viewport change mid-glide invalidates every target measured above.
    // Snapping to the landed state is both simpler and less jarring than
    // watching the name travel to a position that no longer exists.
    const snap = () => tl.progress(1)
    window.addEventListener('resize', snap, { once: true })

    return () => {
      window.removeEventListener('resize', snap)
      tl.kill()
    }
  }, [phase, reduced])

  return (
    <div aria-hidden="true" className="fixed inset-0 z-50">
      <div ref={backdropRef} className="absolute inset-0" style={{ background: HERO_GROUND }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
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
              style={reduced ? undefined : { maskImage: 'linear-gradient(90deg, transparent 0%, transparent 100%)' }}
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
    </div>
  )
}
