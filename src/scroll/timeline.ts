import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getLenis } from './useLenis'
import { prefersReducedMotion } from './useReducedMotion'
import type { Label } from './scenes'
import { GALLERY_SCENES, LABELS, activeCount, toneFor, type GalleryLabel, type GalleryScene } from './scenes'
import { edgeIntensities, parAt, type ParGeometry } from './parallax'
import type { Rendered } from './presentation'
import { frame, setActiveIndex, setLabel } from './store'
import {
  indexAtProgress,
  orbitSeats,
  progressAtIndex,
  rotationAtProgress,
  snapProgress,
} from '~/lib/ring'
import { fractionalIndexAt, needsSnap, pinLengthPx, scrollAtProgress } from './timelineMath'
import { seamAt, spansFrom, type Span } from '~/three/flock'
import { SEED_SEAM_INDEX, seamPinnedAt, seedPresence } from './seed'

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

/**
 * How much scroll each section actually occupies, as a document px range.
 *
 * A parallel registry rather than a widening of `labelOffsets`, because that map
 * has four consumers — `SideRail`, `Dial`, `Butterflies` and the route-restore
 * — and every one of them wants the single number it already gets. Only the
 * flock needs the range.
 *
 * The distinction the flock needs is exactly the one a single offset destroys:
 * `registerLabel` stores a pinned scene's `self.start`, the moment the pin
 * BEGINS, and a gallery scene then holds that offset still for
 * `pinLengthPx(scene.length, innerHeight)` of scroll — 320vh for g1. Treating
 * that as an instant put the flock's densest cloud in the middle of the pin,
 * over the piece the visitor came to look at.
 *
 * Recomputed on every refresh alongside the offsets, so nothing here is cached.
 */
const labelSpans = new Map<Label, { start: number; end: number }>()

export const registerLabelSpan = (label: Label, start: number, end: number) => {
  labelSpans.set(label, { start, end })
}

export const getLabelSpan = (label: Label): { start: number; end: number } | undefined =>
  labelSpans.get(label)

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
 * Pin lengths are computed from laid-out text. Before Fraunces, Pinyon Script
 * and Space Grotesk load, every heading is measured against a fallback and every
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

/**
 * Detail routes unmount the scroll page; the offsets they registered are stale.
 * Both registries, or a detail route leaves the flock flying a stale route.
 */
export const clearLabels = () => {
  labelOffsets.clear()
  labelSpans.clear()
}

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
    onRefresh: (self) => {
      registerLabel(label, offsetTopOf(el, self, label))
      // The trigger's own range, not `offsetTopOf`'s: an unpinned section is one
      // viewport of scroll and that is the whole truth about how long it is on
      // screen. `offsetTopOf` exists to give `scrollToLabel` somewhere sensible
      // to land, which is a different question.
      registerLabelSpan(label, self.start, self.end)
    },
    onEnter: () => setLabel(label),
    onEnterBack: () => setLabel(label),
  })

/** Maps a scene's scroll progress to the one scalar its presentation writes. */
type PublishAt = (p: number, count: number) => number

/**
 * A pinned, scrubbed scene: the pin, the per-frame scalar, the discrete index
 * channel, and the idle snap. Every gallery presentation that pins uses this —
 * a dial and the field differ only in `publish` and in which CSS custom
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
    onRefresh: (self) => {
      registerLabel(label, self.start)
      // `self.end` is `self.start + pinLengthPx(scene.length, innerHeight)` —
      // the entire pin. This is the range the flock has to stay out of.
      registerLabelSpan(label, self.start, self.end)
    },
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

/** One scalar per frame: degrees for a dial, fractional piece index for a field. */
type Publish = (value: number) => void

const frameListeners = new Map<GalleryLabel, Publish>()
const sceneTriggers = new Map<GalleryLabel, ScrollTrigger>()
let triggers: ScrollTrigger[] = []

/**
 * Label spans, normalised into progress-space `Span`s — the shared geometry
 * the seam scalar and the flock's per-frame placement both read.
 *
 * The exact expression `Butterflies.tsx` used to compute independently:
 * exporting it here, which already owns `getLabelSpan`, is what stops the two
 * modules drifting apart on the g1|g2 boundary — see the design doc's naming
 * tension note on "two modules independently computing the same geometry"
 * being this repo's most repeated defect. Callers keep their own caching:
 * this function itself always recomputes, since `spansFrom` allocates seven
 * objects and it is the caller who knows whether the document height has
 * actually moved since the last call.
 */
export const activeSpans = (): Span[] =>
  spansFrom(
    LABELS.map((label) => getLabelSpan(label)),
    document.documentElement.scrollHeight - window.innerHeight,
  )

/**
 * Spans for the seam scalar, rebuilt on refresh rather than per frame:
 * `spansFrom` allocates seven objects, and label offsets only move when the
 * document height does.
 */
let seamSpans: Span[] = []

/**
 * Per-section geometry for the `--par` writes, rebuilt on refresh exactly
 * like `seamSpans` — the offsets and spans it reads only move when the
 * document height does. Empty under reduced motion: with nothing written,
 * every layer's CSS fallback `var(--par, 0)` renders today's layout.
 */
type ParEntry = { el: HTMLElement; geo: ParGeometry; last: string }
let parEntries: ParEntry[] = []
let parViewportH = 0

const measureParEntries = (): ParEntry[] => {
  parViewportH = window.innerHeight
  const intensities = edgeIntensities(LABELS.map(toneFor))
  const entries: ParEntry[] = []
  LABELS.forEach((label, i) => {
    const el = document.getElementById(label)
    const top = getLabelOffset(label)
    const span = getLabelSpan(label)
    if (!el || top === undefined || !span) return
    // A pinned scene holds its seat until the pin releases at span.end; an
    // unpinned section starts leaving the moment it is seated. sceneTriggers
    // only ever holds pinned gallery labels, so membership IS pinned-ness.
    const pinned = sceneTriggers.has(label as GalleryLabel)
    entries.push({ el, geo: { top, holdEnd: pinned ? span.end : top, ...intensities[i]! }, last: '' })
  })
  return entries
}

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
 * degrees and writes --r, the field reads it as a fractional piece index and
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
  seamSpans = []
  parEntries = []
  // Removed, not defaulted — same rule as --seam above: the property must be
  // genuinely absent until the next refresh measures again.
  for (const label of LABELS) {
    document.getElementById(label)?.style.removeProperty('--par')
  }
  // Removed, not defaulted — same reasoning as the onUpdate comment below: no
  // single fallback value leaves both the outgoing and incoming ring open, so
  // the properties must be genuinely ABSENT until the next refresh remeasures
  // them. A detail-route round-trip that left a stale --seam / --seed behind
  // would otherwise reappear as a collapsed or half-open ring for one frame
  // before anything has been measured again.
  document.documentElement.style.removeProperty('--seam')
  document.documentElement.style.removeProperty('--seed')
  document.documentElement.style.removeProperty('--seam-pin')
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
 * field both pin and publish a per-frame scalar through `createScrubScene`; a
 * list does neither and owns its own scrolling.
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

    // The pinned presentations differ only in the scalar they publish: the
    // field pans on a fractional piece index, a dial rotates by degrees.
    const trigger = createScrubScene(
      el,
      scene,
      rendered === 'field'
        ? fractionalIndexAt
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
      // Runs last by the same `refreshPriority`, which is exactly what the
      // spans need: every pin has already registered its own by now.
      onRefresh: () => {
        seamSpans = activeSpans()
        parEntries = prefersReducedMotion() ? [] : measureParEntries()
      },
      onUpdate: (self) => {
        frame.progress = self.progress
        // The mobile ticker's progress line. A CSS custom property is how a
        // per-frame value legally reaches the DOM here: it keeps the scrub out
        // of React state (invariant 1) and keeps GSAP inside this module
        // (invariant 2) — the ticker only ever reads --progress.
        const root = document.documentElement.style
        root.setProperty('--progress', String(self.progress))

        // The collapse-to-seed transition, on the same channel and for the
        // same reason. Skipped rather than defaulted while spans are
        // unmeasured: g1 (outgoing) reads --seam open at -1 and g2 (incoming)
        // reads it open at +1, so there is no single fallback value that
        // leaves both rings open — writing one would collapse g1 to a point
        // before anything is measured. Leaving the property unset instead lets
        // each ring's own CSS fallback (`var(--seam, -1)` / `var(--seam, 1)`,
        // added in a later task) apply only while it is genuinely absent. Do
        // not "fix" this by adding a default here.
        if (seamSpans.length) {
          const seam = seamAt(seamSpans, self.progress, SEED_SEAM_INDEX)
          root.setProperty('--seam', String(seam))
          root.setProperty('--seed', String(seedPresence(seam)))
          // The rings collapse against a second scalar, renormalised so its zero
          // spans the unpinned gap instead of falling on the boundary. A ring is
          // positioned against its own section and the seed against the
          // viewport, so the two only coincide while GSAP has that section
          // pinned — see `seamPinnedAt`. Same band edges, same absent-until-
          // measured rule; only the interior differs.
          root.setProperty('--seam-pin', String(seamPinnedAt(seamSpans, self.progress, SEED_SEAM_INDEX)))
        }

        // The lift. Same channel as --seam and for the same reasons, but
        // written per SECTION element so each subtree scopes its own scalar.
        // toFixed(3) is ~0.06px of translate at these depths — below
        // perception — and the string compare keeps redundant style writes
        // off the hot path: only sections inside their ramps change value.
        const scroll = self.scroll()
        for (const entry of parEntries) {
          const v = parAt(scroll, entry.geo, parViewportH).toFixed(3)
          if (v !== entry.last) {
            entry.last = v
            entry.el.style.setProperty('--par', v)
          }
        }
      },
    }),
  )
}

export { ScrollTrigger, gsap }
