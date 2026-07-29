import { useCompactLayout, useReducedMotion } from './useReducedMotion'
import { resolvePresentation, type Rendered } from './presentation'
import type { Presentation } from './scenes'

/** Thin hook wrapper — the decision itself is pure and tested in presentation.test.ts. */
export const usePresentation = (declared: Presentation): Rendered =>
  resolvePresentation(declared, useReducedMotion(), useCompactLayout())
