import type { MuralLocation, Piece } from '~/data'

/**
 * Pure geometry for the Murals x-translate track.
 *
 * No React, no DOM, no GSAP. The scroll timeline supplies a progress and this
 * turns it into ONE number — the fractional wall index — which the row writes
 * to a single CSS custom property. The plane bend is then pure CSS off that
 * same variable, so none of this runs per frame.
 */

/** Dossier box, from the design of record: 16 + 540 + 14 + 230 + 16. */
export const DOSSIER_W = 816
export const DOSSIER_H = 410
export const TRACK_GAP = 24

/** Centre-to-centre spacing. The row translates by exactly this per wall. */
export const TRACK_PITCH = DOSSIER_W + TRACK_GAP

/** Maximum plane bend at the frame edges, in degrees. */
export const MAX_BEND = 8

/** Fractional wall index at progress p. Wall 0 at p=0, wall n-1 at p=1. */
export const trackAt = (p: number, count: number): number => p * Math.max(0, count - 1)

/**
 * Plane bend for the wall at index i when the track sits at `at`.
 *
 * Shipped as a CSS clamp() on --at rather than called per frame — this is the
 * contract the CSS is transcribed from, and this test is what keeps the two
 * from drifting apart.
 */
export const bendDegrees = (i: number, at: number, max: number = MAX_BEND): number =>
  Math.max(-max, Math.min(max, (i - at) * max))

/** Symmetric centring gutter, so wall 1 and wall n both reach the centre. */
export const trackGutter = (width: number = DOSSIER_W): string => `calc(50% - ${width / 2}px)`

export const CHAPTER_LABELS: Record<MuralLocation, string> = {
  bgc: 'BGC',
  layaw: 'Layaw, Makati',
}

export type Chapter = {
  id: MuralLocation
  label: string
  count: number
  firstIndex: number
}

/**
 * The chapters a set of walls falls into, ordered by first appearance.
 *
 * Deliberately does not assume the data is grouped. `murals.ts` happens to list
 * BGC then Layaw, but a wall inserted out of order must join its own chapter
 * rather than opening a third one — a Map keyed by location gives that for
 * free, and preserves insertion order for the ordering guarantee.
 */
export const chaptersOf = (pieces: Piece[]): Chapter[] => {
  const byId = new Map<MuralLocation, Chapter>()
  pieces.forEach((piece, i) => {
    const id = piece.location
    if (!id) return
    const found = byId.get(id)
    if (found) found.count += 1
    else byId.set(id, { id, label: CHAPTER_LABELS[id], count: 1, firstIndex: i })
  })
  return [...byId.values()]
}
