import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getLenis } from './useLenis'
import { prefersReducedMotion } from './useReducedMotion'
import type { Label } from './scenes'
import { GALLERY_SCENES, LABELS, activeCount, type GalleryLabel, type GalleryScene } from './scenes'
import type { Rendered } from './presentation'
import { frame, setActiveIndex, setLabel } from './store'
import {
  indexAtProgress,
  orbitSeats,
  progressAtIndex,
  rotationAtProgress,
  snapProgress,
} from '~/lib/ring'
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
  if (lenis) {
    lenis.scrollTo(offset, { immediate })
    return
  }
  // No Lenis almost always means reduced motion — useLenis skips smoothing
  // entirely in that case — so smooth-scrolling here animated exactly the
  // journey the visitor asked not to be shown. Ask directly rather than infer
  // it from Lenis' absence, which is also briefly true before it initialises.
  const smooth = !immediate && !prefersReducedMotion()
  window.scrollTo({ top: offset, behavior: smooth ? 'smooth' : 'auto' })
}

/**
 * Pin lengths are computed from laid-out text. Before Instrument Serif and
 * Space Grotesk load, every heading is measured against a fallback and every
 * scene ends up the wrong height — the drift compounds across four pinned
 * scenes and the last one never reaches its final index.
 *
 * One refresh after fonts settle fixes it. Called once, from the app root.
 *
 * `then` runs immediately after that refresh. Creating a pinned trigger does
 * not itself lay out its pin spacer — only a refresh does — so this is the
 * first moment the document carries its full pinned height. Anything that
 * needs to address a scroll offset beyond the unpinned height, notably the
 * route-return restore, has to wait for it or the browser clamps the offset
 * against a document that is still seven viewports tall.
 */
export const refreshAfterFonts = (then?: () => void) => {
  if (typeof document === 'undefined') return
  void document.fonts.ready.then(() => {
    ScrollTrigger.refresh()
    then?.()
  })
}

/** Detail routes unmount the scroll page; the offsets they registered are stale. */
export const clearLabels = () => labelOffsets.clear()

/**
 * Fires after every global refresh, once each pin has contributed its spacing.
 *
 * The ground layer subscribes: it paints each section's ground across that
 * section's real document range, and those ranges only exist after the pin
 * spacers are laid out. Same reason the route-restore waits for
 * `refreshAfterFonts` rather than a bare rAF.
 *
 * Wrapped here so no component has to import ScrollTrigger (invariant 2).
 */
export const onTimelineRefresh = (cb: () => void): (() => void) => {
  ScrollTrigger.addEventListener('refresh', cb)
  return () => ScrollTrigger.removeEventListener('refresh', cb)
}

/** The trailing label in scroll order — see `offsetTopOf`. */
const LAST_LABEL = LABELS[LABELS.length - 1]

/**
 * What `scrollToLabel` should aim at: the section's own top in document space.
 *
 * For every label but the last this equals the trigger's start. The trailing
 * section's trigger deliberately starts a quarter-viewport early — its
 * offsetTop is exactly maxScroll, so `top top` can never fire — and jumping
 * to that start would leave it sitting 25% down the screen instead of
 * filling it.
 */
const offsetTopOf = (el: Element, self: { start: number }, label: Label): number =>
  label === LAST_LABEL ? el.getBoundingClientRect().top + window.scrollY : self.start

/**
 * Every non-pinned section registers its label the same way.
 *
 * `start` is a parameter because the last section cannot use the default. A
 * 100vh trailing section has `offsetTop === maxScroll`, so `top top` puts its
 * activation boundary on the final reachable pixel and it never fires — the
 * Contact diamond stayed dark with Contact filling the screen. Every other
 * label keeps `top top`, which is both reachable and the flip point the rail
 * is designed around.
 */
const createLabelTrigger = (el: Element, label: Label, start = 'top top') =>
  ScrollTrigger.create({
    trigger: el,
    start,
    end: 'bottom top',
    onRefresh: (self) => registerLabel(label, offsetTopOf(el, self, label)),
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

  // ORDER IS LOAD-BEARING: build top-to-bottom, exactly as the page reads.
  //
  // ScrollTrigger refreshes its triggers in creation order and lays each pin's
  // spacer out as it reaches it, so a trigger measures whatever the document
  // height happens to be at its turn. Measured directly: the four pinned scenes
  // grow the document 6300 -> 9180 -> 11160 -> 13320 -> 15660 as they refresh.
  // Anything created ahead of them therefore measures the 6300px unpinned
  // document, whose maxScroll is 5400 — and a later ScrollTrigger.refresh()
  // cannot rescue it, because refresh replays this same order.
  //
  // That one mistake used to produce two separate-looking bugs: `contact`
  // registered its offset as 5400 (its unpinned top) instead of 14760, sending
  // the side rail's Contact diamond into the middle of the Ovalese scene, and
  // the whole-document trigger below ended at 5400, so `frame.progress`
  // saturated at 1.0 from 37% of the page onward and the flock never travelled.
  for (const label of ['hero', 'about'] as const) {
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
      rendered === 'track'
        ? trackAt
        : // orbitSeats, not scene.seats: a filtered ring has fewer seats and a
          // correspondingly wider step, and the rotation has to advance by the
          // step the seats are actually placed at (see Dial's --step).
          (p, count) => rotationAtProgress(p, count, orbitSeats(scene.seats, count)),
    )
    sceneTriggers.set(scene.label, trigger)
    triggers.push(trigger)
  }

  // Last section on the page, so last to be built — see the note above.
  const contact = document.getElementById('contact')
  // 'top 25%' rather than 'top top': see createLabelTrigger. Contact lights
  // once it occupies roughly the lower three quarters of the viewport, which
  // is the closest reachable equivalent of "you are in this section" for a
  // section that can never scroll past the top. This belongs to whichever
  // label is LAST_LABEL (currently 'contact') — append a section after this
  // one and move the 'top 25%' start there too, or its trigger inherits the
  // same unreachable-boundary bug.
  if (contact) triggers.push(createLabelTrigger(contact, 'contact', 'top 25%'))

  // Whole-document progress, for the r3f stage. Built last and pinned there by
  // `refreshPriority: -1` (lower refreshes later), because this is the one
  // trigger that measures the *whole* document: it has to run after every pin
  // has contributed its spacing, or it ends at the unpinned 5400 and every
  // canvas system reading `frame.progress` stops moving a third of the way down.
  triggers.push(
    ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      refreshPriority: -1,
      onUpdate: (self) => {
        frame.progress = self.progress
      },
    }),
  )
}

export { ScrollTrigger, gsap }
