import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getLenis } from './useLenis'
import type { Label } from './scenes'
import { GALLERY_SCENES, activeCount, type GalleryLabel } from './scenes'
import type { Rendered } from './presentation'
import { frame, setActiveIndex, setLabel } from './store'
import { indexAtProgress, progressAtIndex, rotationAtProgress } from '~/lib/ring'
import { pinLengthPx, scrollAtProgress } from './timelineMath'

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

/** Every non-pinned section registers its label the same way. */
const createLabelTrigger = (el: Element, label: Label) =>
  ScrollTrigger.create({
    trigger: el,
    start: 'top top',
    end: 'bottom top',
    onRefresh: (self) => registerLabel(label, self.start),
    onEnter: () => setLabel(label),
    onEnterBack: () => setLabel(label),
  })

type Rotate = (rotation: number) => void

const rotationListeners = new Map<GalleryLabel, Rotate>()
const sceneTriggers = new Map<GalleryLabel, ScrollTrigger>()
let triggers: ScrollTrigger[] = []

/**
 * A Dial registers the single DOM write it owns, and GSAP never leaves this
 * module. Fires once immediately so a freshly mounted ring is not stuck at 0°.
 */
export const onSceneRotation = (label: GalleryLabel, cb: Rotate): (() => void) => {
  rotationListeners.set(label, cb)
  cb(frame.rotation[label])
  return () => {
    rotationListeners.delete(label)
  }
}

/** Clicking a thumb rotates it to centre by scrolling to that piece's stop. */
export const scrollToPiece = (label: GalleryLabel, index: number, count: number): void => {
  const trigger = sceneTriggers.get(label)
  const lenis = getLenis()
  if (!trigger || !lenis) return
  const target = scrollAtProgress(trigger.start, trigger.end, progressAtIndex(index, count))
  lenis.scrollTo(target, { duration: 0.6 })
}

/** Selecting a merch chip changes the piece count; layout must be remeasured. */
export const refreshTimeline = (): void => ScrollTrigger.refresh()

export const killTimeline = (): void => {
  for (const t of triggers) t.kill()
  triggers = []
  sceneTriggers.clear()
  clearLabels()
}

/**
 * Builds every ScrollTrigger on the page.
 *
 * One trigger per section, not one gsap.timeline() — a single timeline cannot
 * pin four sections independently, so the "master timeline" of the design spec
 * is this module rather than a GSAP object. It still owns all seven labels, the
 * proportional pins, and the one post-fonts refresh.
 *
 * `resolved` says how each gallery scene is actually rendering: a dial pins and
 * scrubs, a list does neither and owns its own scrolling.
 */
export const buildTimeline = (resolved: Record<GalleryLabel, Rendered>): void => {
  killTimeline()

  // Whole-document progress, for the r3f stage.
  triggers.push(
    ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        frame.progress = self.progress
      },
    }),
  )

  for (const label of ['hero', 'about', 'contact'] as const) {
    const el = document.getElementById(label)
    if (!el) continue
    triggers.push(createLabelTrigger(el, label))
  }

  for (const scene of GALLERY_SCENES) {
    const el = document.getElementById(scene.label)
    if (!el) continue
    const label = scene.label

    if (resolved[label] !== 'dial') {
      // No pin, no scrub: the list and the track scaffold own their own scrolling.
      triggers.push(createLabelTrigger(el, label))
      continue
    }

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: () => '+=' + pinLengthPx(scene.length, window.innerHeight),
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
      onRefresh: (self) => registerLabel(label, self.start),
      onEnter: () => setLabel(label),
      onEnterBack: () => setLabel(label),
      onUpdate: (self) => {
        const p = self.progress
        const count = activeCount(scene)

        frame.sceneProgress = p
        const rotation = rotationAtProgress(p, count, scene.seats)
        frame.rotation[label] = rotation
        rotationListeners.get(label)?.(rotation)

        // Discrete channel: ~24 React updates across a 320vh pin, never 60/s.
        setActiveIndex(scene.category, indexAtProgress(p, count))
      },
    })

    sceneTriggers.set(label, trigger)
    triggers.push(trigger)
  }
}

export { ScrollTrigger, gsap }
