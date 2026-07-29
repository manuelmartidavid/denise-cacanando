import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from './useReducedMotion'

let lenis: Lenis | null = null

/** The live instance, for anything that needs to jump the page (rail, routes). */
export const getLenis = () => lenis

/**
 * Lenis drives smoothing, GSAP's ticker drives Lenis, and ScrollTrigger reads
 * from Lenis rather than from native scroll. Driving Lenis off requestAnimationFrame
 * separately from GSAP's ticker is the classic desync: pinned scenes then lag the
 * flock by a frame or two.
 *
 * Skipped entirely under reduced motion — smoothing is motion the user declined.
 */
export const useLenis = () => {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return

    const instance = new Lenis({ autoRaf: false })
    lenis = instance

    instance.on('scroll', ScrollTrigger.update)

    const tick = (time: number) => instance.raf(time * 1000) // GSAP is in seconds
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      instance.destroy()
      lenis = null
    }
  }, [reduced])
}
