import { snapProgress } from '~/lib/ring'

/** A scene declares its pin length in vh; ScrollTrigger wants document px. */
export const pinLengthPx = (lengthVh: number, viewportHeight: number): number =>
  (lengthVh / 100) * viewportHeight

/** Document scroll position for a progress within a trigger's range. */
export const scrollAtProgress = (start: number, end: number, p: number): number =>
  start + p * (end - start)

/** Float drift below this is not worth a correction the user would feel. */
export const SNAP_EPSILON = 0.001

/**
 * Whether an idle scroll sits far enough off a stop to be worth correcting.
 * A category of one has nowhere to snap to.
 */
export const needsSnap = (p: number, count: number, epsilon = SNAP_EPSILON): boolean =>
  count >= 2 && Math.abs(p - snapProgress(p, count)) > epsilon
