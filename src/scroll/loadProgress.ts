/**
 * The loader's pacing, kept pure so it can be tested without a DOM.
 *
 * Two jobs. First, `written` chases `target` on an exponential curve rather
 * than snapping to it, so a milestone landing all at once reads as a hand
 * speeding up instead of a jump-cut. Second, the floor: a warm cache reports
 * every milestone inside 100ms, and without MIN_DURATION the whole loader
 * would be a flash of black. The name must always finish writing.
 */

/** Below this many ms the loader has not earned its moment. */
export const MIN_DURATION = 1600

/** Chase rate, in units of e-foldings per second. Higher = the pen hurries. */
const CHASE = 3.2

/** How close to the target counts as arrived — an exponential never lands. */
const EPSILON = 0.002

/**
 * One frame of pen movement. `dt` and `elapsed` are milliseconds; `elapsed`
 * is measured from when the loader mounted, not from when writing began.
 */
export const advance = (written: number, target: number, dt: number, elapsed: number): number => {
  const goal = Math.min(1, Math.max(0, target))

  // Frame-rate independent: the same wall-clock time produces the same
  // movement whether it arrived as one 32ms frame or two 16ms ones.
  const k = 1 - Math.exp((-CHASE * dt) / 1000)

  let next = written + (goal - written) * k
  if (Math.abs(goal - next) < EPSILON) next = goal

  // Monotonic. The target can drop — drei's progress store resets between
  // loads — and a pen that un-writes a letter is worse than one that stalls.
  next = Math.max(written, Math.min(next, goal))

  // The floor. 0.995 rather than something visibly short: the last half a
  // percent of the wipe is sub-pixel, so an early finish parks the pen on
  // the final glyph rather than leaving an obvious gap.
  return Math.min(next, elapsed >= MIN_DURATION ? 1 : 0.995)
}
