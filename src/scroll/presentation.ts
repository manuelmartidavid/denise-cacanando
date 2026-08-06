import type { Presentation } from './scenes'

/** What actually renders, as opposed to what the scene declares. */
export type Rendered = 'dial' | 'list' | 'field'

/**
 * Both presentations fall back to the pin-free list under reduced motion or
 * below 900px. Every piece stays reachable through the same route either way,
 * which is the hard requirement.
 *
 * The list is category-generic, so the seven mural walls come through it as
 * cards linking to the same `/murals/<slug>` route the dial's centre slot
 * links to.
 */
export const resolvePresentation = (
  declared: Presentation,
  reduced: boolean,
  compact: boolean,
): Rendered => {
  if (reduced || compact) return 'list'
  if (declared === 'field') return 'field'
  return 'dial'
}
