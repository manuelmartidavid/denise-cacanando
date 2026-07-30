import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

const subscribe = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/**
 * The same question outside React, for module-level code that cannot use a
 * hook — notably the rail's jump, which must not animate a scroll the visitor
 * has asked not to see.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia(QUERY).matches

const getSnapshot = () => prefersReducedMotion()

/**
 * Reduced motion is a requirement, not a nicety. When true:
 * rings become snap-scroll lists, the flock freezes into a static frieze, and
 * pins release. Nothing structural is lost — every piece stays reachable.
 */
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, () => false)

// 939, not 899: the dial needs about 940px of width for its 660px guide circle
// at left:62%, so engaging it at 900 left it clipped against the right edge in
// the 900–940 band. The list presentation owns that band instead.
const COMPACT = '(max-width: 939px)'

const subscribeCompact = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(COMPACT)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/**
 * Below 940px the ring unrolls into a horizontal snap list and the rail becomes
 * the bottom ticker. This is the same breakpoint the r3f stage uses to drop the
 * butterfly system and hold pollen at 25%.
 */
export const useCompactLayout = (): boolean =>
  useSyncExternalStore(
    subscribeCompact,
    () => typeof window !== 'undefined' && window.matchMedia(COMPACT).matches,
    () => false,
  )
