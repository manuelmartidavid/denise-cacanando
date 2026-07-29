import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getLenis } from './useLenis'
import type { Label } from './scenes'

gsap.registerPlugin(ScrollTrigger)

/**
 * Scroll offsets for the seven timeline labels, in document px.
 * Each section registers itself here as its ScrollTrigger is created; the rail
 * and the route-restore logic read from it. Recomputed on every refresh, so
 * nothing here survives a resize — always read, never cache.
 */
const labelOffsets = new Map<Label, number>()

export const registerLabel = (label: Label, offset: number) => {
  labelOffsets.set(label, offset)
}

export const getLabelOffset = (label: Label): number | undefined => labelOffsets.get(label)

/** Rail diamonds jump to timeline labels. */
export const scrollToLabel = (label: Label, immediate = false) => {
  const offset = labelOffsets.get(label)
  if (offset === undefined) return

  const lenis = getLenis()
  if (lenis) lenis.scrollTo(offset, { immediate })
  else window.scrollTo({ top: offset, behavior: immediate ? 'auto' : 'smooth' })
}

/**
 * Pin lengths are computed from laid-out text. Before Instrument Serif and
 * Space Grotesk load, every heading is measured against a fallback and every
 * scene ends up the wrong height — the drift compounds across four pinned
 * scenes and the last one never reaches its final index.
 *
 * One refresh after fonts settle fixes it. Called once, from the app root.
 */
export const refreshAfterFonts = () => {
  if (typeof document === 'undefined') return
  void document.fonts.ready.then(() => ScrollTrigger.refresh())
}

/** Detail routes unmount the scroll page; the offsets they registered are stale. */
export const clearLabels = () => labelOffsets.clear()

export { ScrollTrigger, gsap }
