import type { Presentation } from './scenes'

/** What actually renders, as opposed to what the scene declares. */
export type Rendered = 'dial' | 'list' | 'track'

/**
 * Both presentations fall back to the pin-free list under reduced motion or
 * below 900px. Every piece stays reachable through the same route either way,
 * which is the hard requirement — but for the track that fallback drops the
 * chapter bar (the scene's organising structure) and the "no full-width photo
 * exists" annotation that justifies the dossier format. Nothing is lost that
 * breaks navigation; the apparatus around it is thinner.
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
