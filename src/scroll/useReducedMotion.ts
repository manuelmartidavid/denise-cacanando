import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

const subscribe = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

const getSnapshot = () =>
  typeof window !== 'undefined' && window.matchMedia(QUERY).matches

/**
 * Reduced motion is a requirement, not a nicety. When true:
 * rings become snap-scroll lists, the flock freezes into a static frieze, and
 * pins release. Nothing structural is lost — every piece stays reachable.
 */
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, () => false)

const COMPACT = '(max-width: 899px)'

const subscribeCompact = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(COMPACT)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/**
 * Under 900px the ring unrolls into a horizontal snap list and the rail becomes
 * the bottom ticker. This is the same breakpoint the r3f stage uses to drop the
 * butterfly system and hold pollen at 25%.
 */
export const useCompactLayout = (): boolean =>
  useSyncExternalStore(
    subscribeCompact,
    () => typeof window !== 'undefined' && window.matchMedia(COMPACT).matches,
    () => false,
  )
