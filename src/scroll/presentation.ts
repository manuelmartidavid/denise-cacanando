import type { Presentation } from './scenes'

/** What actually renders, as opposed to what the scene declares. */
export type Rendered = 'dial' | 'list' | 'track'

/**
 * A `track` scene always resolves to `track` — the Murals x-translate track and
 * its fallback belong to a separate spec.
 *
 * A `dial` scene falls back to the pin-free list under reduced motion or below
 * 900px. Both routes reach every piece and carry the same links: nothing
 * structural is lost, which is the requirement, not a nicety.
 */
export const resolvePresentation = (
  declared: Presentation,
  reduced: boolean,
  compact: boolean,
): Rendered => {
  if (declared === 'track') return 'track'
  return reduced || compact ? 'list' : 'dial'
}
