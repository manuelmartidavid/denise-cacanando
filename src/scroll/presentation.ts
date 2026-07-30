import type { Presentation } from './scenes'

/** What actually renders, as opposed to what the scene declares. */
export type Rendered = 'dial' | 'list' | 'track'

/**
 * Both presentations fall back to the pin-free list under reduced motion or
 * below 900px. Both routes reach every piece and carry the same links: nothing
 * structural is lost, which is the requirement, not a nicety.
 *
 * The list is category-generic, so the seven mural walls come through it as
 * cards linking to the same `/murals/<slug>` route the dossier links to.
 */
export const resolvePresentation = (
  declared: Presentation,
  reduced: boolean,
  compact: boolean,
): Rendered => {
  if (reduced || compact) return 'list'
  return declared === 'track' ? 'track' : 'dial'
}
