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

export const Loader = () => {
  const phase = useLoadPhase()
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([])

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
