import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getLenis } from './useLenis'
import type { Label } from './scenes'
import { GALLERY_SCENES, activeCount, type GalleryLabel, type GalleryScene } from './scenes'
import type { Rendered } from './presentation'
import { frame, setActiveIndex, setLabel } from './store'
import { indexAtProgress, progressAtIndex, rotationAtProgress, snapProgress } from '~/lib/ring'
import { needsSnap, pinLengthPx, scrollAtProgress } from './timelineMath'
import { trackAt } from '~/lib/track'

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

/** Maps a scene's scroll progress to the one scalar its presentation writes. */
type PublishAt = (p: number, count: number) => number

/**
 * A pinned, scrubbed scene: the pin, the per-frame scalar, the discrete index
 * channel, and the idle snap. Every gallery presentation that pins uses this —
 * a dial and the Murals track differ only in `publish` and in which CSS custom
 * property the component writes.
 */
const createScrubScene = (el: Element, scene: GalleryScene, publish: PublishAt): ScrollTrigger => {
  const label = scene.label
  let idle: ReturnType<typeof setTimeout> | undefined

  return ScrollTrigger.create({
    trigger: el,
    start: 'top top',
    end: () => '+=' + pinLengthPx(scene.length, window.innerHeight),
    pin: true,
    invalidateOnRefresh: true,
    onRefresh: (self) => registerLabel(label, self.start),
    onEnter: () => setLabel(label),
    onEnterBack: () => setLabel(label),
    onUpdate: (self) => {
      const p = self.progress
      const count = activeCount(scene)

      frame.sceneProgress = p
      const value = publish(p, count)
      frame.scalar[label] = value
      frameListeners.get(label)?.(value)

      // Discrete channel: ~24 React updates across a 320vh pin, never 60/s.
      setActiveIndex(scene.category, indexAtProgress(p, count))

      // Snap settles on rest, never mid-gesture. Reading self.progress inside
      // the timeout rather than closing over `p` matters: by the time it fires
      // the user has moved on, and snapping to a stale progress fights them.
      if (idle) clearTimeout(idle)
      idle = setTimeout(() => {
        const at = self.progress
        const n = activeCount(scene)
        const lenis = getLenis()
        if (!self.isActive || !lenis || !needsSnap(at, n)) return
        const target = scrollAtProgress(self.start, self.end, snapProgress(at, n))
        lenis.scrollTo(target, { duration: SNAP_DURATION })
      }, SNAP_IDLE_MS)
      snapTimers.set(label, idle)
    },
  })
}

/** One scalar per frame: degrees for a dial, fractional wall index for a track. */
type Publish = (value: number) => void

const frameListeners = new Map<GalleryLabel, Publish>()
const sceneTriggers = new Map<GalleryLabel, ScrollTrigger>()
let triggers: ScrollTrigger[] = []

/** Long enough that a snap never fires mid-gesture, short enough to feel immediate. */
const SNAP_IDLE_MS = 120
const SNAP_DURATION = 0.35

/**
 * The pending idle timer per scene, so a route change cannot leave one firing
 * into a dead trigger. One entry per scene, replaced each frame — an array would
 * grow by one every onUpdate and never shrink.
 */
const snapTimers = new Map<GalleryLabel, ReturnType<typeof setTimeout>>()

/**
 * A presentation registers the single DOM write it owns, and GSAP never leaves
 * this module. Fires once immediately so a freshly mounted scene is not stuck
 * at 0.
 *
 * What the scalar MEANS is the presentation's business: the dial reads it as
 * degrees and writes --r, the track reads it as a fractional wall index and
 * writes --at. This channel only guarantees one number per frame.
 */
export const onSceneFrame = (label: GalleryLabel, cb: Publish): (() => void) => {
  frameListeners.set(label, cb)
  cb(frame.scalar[label])
  return () => {
    frameListeners.delete(label)
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
  for (const t of snapTimers.values()) clearTimeout(t)
  snapTimers.clear()
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
 * `resolved` says how each gallery scene is actually rendering: a dial and the
 * Murals track both pin and publish a per-frame scalar through
 * `createScrubScene`; a list does neither and owns its own scrolling.
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
    const rendered = resolved[scene.label]

    if (rendered === 'list') {
      // No pin: the list owns its own scrolling.
      triggers.push(createLabelTrigger(el, scene.label))
      continue
    }

    // A dial and the track differ only in the scalar they publish: degrees off
    // the ring's seat step, or the fractional wall index.
    const trigger = createScrubScene(
      el,
      scene,
      rendered === 'track' ? trackAt : (p, count) => rotationAtProgress(p, count, scene.seats),
    )
    sceneTriggers.set(scene.label, trigger)
    triggers.push(trigger)
  }
}

export { ScrollTrigger, gsap }
