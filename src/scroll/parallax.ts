/**
 * Per-section parallax — the "lift, gated by ground contrast".
 * Spec: docs/superpowers/specs/2026-08-06-parallax-section-transitions-design.md
 *
 * Pure, and deliberately DOM-free like `seed.ts`: the timeline owns
 * measurement and the per-frame write; this module owns every mapping the
 * write needs. Tune the feel here, not in the timeline.
 */
import type { Tone } from './scenes'

/**
 * How much of the gesture survives a same-ground boundary. The full lift only
 * fires where the ground flips — there is no visible world-change to rise off
 * otherwise. A look decision, tuned in a browser like SEED_PLATEAU.
 */
export const CALM = 0.35

export type EdgeIntensity = { enter: number; exit: number }

/**
 * One intensity pair per section, derived from the ground tones in page
 * order — `scene.ground` plus the fixed tones, via `toneFor`, never a
 * hand-maintained boundary list, so reordering sections keeps the rule true.
 * The first section's enter edge and the last section's exit edge are never
 * scrolled across; they get 1, which the clamps make unobservable.
 */
export const edgeIntensities = (tones: readonly Tone[]): EdgeIntensity[] =>
  tones.map((tone, i) => ({
    enter: i === 0 || tones[i - 1] !== tone ? 1 : CALM,
    exit: i === tones.length - 1 || tones[i + 1] !== tone ? 1 : CALM,
  }))

/**
 * Linear position of a section relative to its seat: −1 one full viewport
 * below, 0 anywhere in [top, holdEnd] (seated, or pinned), +1 one viewport
 * past release. `top` is the scroll at which the section seats; `holdEnd` is
 * where it starts to leave — equal to `top` for an unpinned section, the pin
 * release for a pinned one. Both are measured document px, handed in by the
 * timeline from the spans the section triggers register.
 */
export const rawParAt = (
  scroll: number,
  top: number,
  holdEnd: number,
  viewportH: number,
): number => {
  if (viewportH <= 0) return 0
  if (scroll < top) return Math.max(-1, (scroll - top) / viewportH)
  if (scroll > holdEnd) return Math.min(1, (scroll - holdEnd) / viewportH)
  return 0
}

/**
 * Sign-preserving quadratic: steep at the section's edges, zero slope at the
 * seat. This is what makes layers arrive and settle rather than glide — and
 * it lives in the scalar, not the consumer, so every opted-in element agrees.
 */
export const easePar = (raw: number): number => (raw < 0 ? -1 : 1) * raw * raw

export type ParGeometry = { top: number; holdEnd: number; enter: number; exit: number }

/** The value written as `--par`: eased, then scaled by the active edge. */
export const parAt = (scroll: number, geo: ParGeometry, viewportH: number): number => {
  const raw = rawParAt(scroll, geo.top, geo.holdEnd, viewportH)
  return easePar(raw) * (raw < 0 ? geo.enter : geo.exit)
}
