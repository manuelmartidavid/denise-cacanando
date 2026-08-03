/**
* Petal motion (the "flutter") — pure. No three.js, no React: the same rule `flock.ts` follows,
 * for the same reason (invariant 6, and it has to stay loadable in Vitest's
 * node environment).
 *
 * Every function here is a **closed-form position**, not a simulation step. The
 * petal field is placed entirely in the vertex shader from `uTime` and
 * per-instance seeds, which is what deletes the old per-frame CPU loop and its
 * `needsUpdate` upload — but that only works if each displacement is an exact
 * antiderivative of the velocity it is meant to express. Get that wrong and the
 * petals still move smoothly; they just move *differently* from the motion the
 * spec describes, and nothing catches it by eye.
 *
 * So the displacements live here, and `petals.test.ts` differentiates them
 * numerically and checks them against the velocities they claim to integrate.
 *
 * `Petals.tsx` restates these formulas in GLSL. The constants below are
 * interpolated into that shader, so the numbers live in one place; the formulas
 * themselves necessarily appear twice.
 *
 * Named for the effect rather than the component, as `flock.ts` is. It cannot
 * be called `petals.ts` beside a `Petals.tsx`: the two differ only in casing,
 * and on Windows and default macOS filesystems they resolve to the same path.
 */

const TWO_PI = Math.PI * 2

// --- wind -------------------------------------------------------------------

/** Steady component of the breeze. */
export const WIND_BASE = 0.32
/** Slow swell either side of it, and how fast that swell breathes. */
export const WIND_SWING = 0.22
export const WIND_SWING_RATE = 0.21
/** Per-instance phase offset on the swell, so the field does not pulse as one. */
export const WIND_SEED_PHASE = 0.31

/** Gust strength, rate, and starting phase. */
export const GUST_GAIN = 0.85
export const GUST_RATE = 0.16
export const GUST_PHASE = 2.0
/** How much of a gust becomes lift rather than sideways push. */
export const GUST_LIFT = 0.3

/**
 * Gust envelope: `max(0, sin u)³`.
 *
 * Cubing a half-wave-rectified sine is what produces long quiet spells broken
 * by occasional soft pushes, rather than a breeze that swells evenly forever.
 * It is zero for a full half of every cycle and spends most of the other half
 * near zero too.
 */
export const gustAt = (t: number): number => {
  const s = Math.sin(GUST_RATE * t + GUST_PHASE)
  return s > 0 ? s * s * s : 0
}

/**
 * Antiderivative of `max(0, sin u)³` with respect to u.
 *
 * Over a positive half-cycle the antiderivative of sin³ is `-cos u + cos³u/3`,
 * which climbs by exactly 4/3 from end to end; over the negative half the
 * clamped integrand is zero and the total is flat. So the running value is 4/3
 * per completed cycle plus however far into the current one we are.
 */
const gustAntiderivative = (u: number): number => {
  const cycles = Math.floor(u / TWO_PI)
  const r = u - cycles * TWO_PI
  const c = Math.cos(r)
  const part = r < Math.PI ? -c + (c * c * c) / 3 + 2 / 3 : 4 / 3
  return cycles * (4 / 3) + part
}

/**
 * Running integral of `gustAt`, zeroed at t = 0.
 *
 * The spec allowed a slow sine as an approximation here and said only
 * smoothness mattered. This is exact, and smoother than the approximation would
 * have been: `max(0, sin u)³` vanishes to second order at both seams, so this
 * integral is C³ across them and no seam is visible in the drift.
 */
export const gustIntegral = (t: number): number =>
  (gustAntiderivative(GUST_RATE * t + GUST_PHASE) - gustAntiderivative(GUST_PHASE)) / GUST_RATE

/** Horizontal wind speed carrying a petal with the given seed. */
export const windAt = (t: number, seed: number, breeze = 1): number =>
  breeze *
  (WIND_BASE +
    WIND_SWING * Math.sin(WIND_SWING_RATE * t + seed * WIND_SEED_PHASE) +
    GUST_GAIN * gustAt(t))

/** Distance that wind has carried a petal since t = 0. */
export const windDisplacement = (t: number, seed: number, breeze = 1): number =>
  breeze *
  (WIND_BASE * t -
    (WIND_SWING / WIND_SWING_RATE) *
      (Math.cos(WIND_SWING_RATE * t + seed * WIND_SEED_PHASE) -
        Math.cos(seed * WIND_SEED_PHASE)) +
    GUST_GAIN * gustIntegral(t))

// --- sway and the fall coupled to it ----------------------------------------

/**
 * The fall speed is `fall * (0.35 + 0.65 * cos²ph)`, which the double-angle
 * identity turns into `fall * (FALL_MEAN + FALL_SWING * cos 2ph)` — a form that
 * integrates in closed form. These two are that rewrite, not new tuning.
 */
export const FALL_MEAN = 0.675
export const FALL_SWING = 0.325

/** Sway phase for an instance at time t. */
export const phaseAt = (t: number, swayFreq: number, seed: number): number =>
  t * swayFreq + seed

/** Horizontal speed contributed by the sway alone (wind excluded). */
export const swayAt = (t: number, swayFreq: number, seed: number, amp: number): number =>
  amp * swayFreq * Math.cos(phaseAt(t, swayFreq, seed))

/** Horizontal offset contributed by the sway alone, zeroed at t = 0. */
export const swayDisplacement = (
  t: number,
  swayFreq: number,
  seed: number,
  amp: number,
): number => amp * (Math.sin(phaseAt(t, swayFreq, seed)) - Math.sin(seed))

/**
 * Vertical speed: negative, and fastest when the petal is mid-swing.
 *
 * This coupling is the signature of the effect. `cos²ph` is 1 as the petal
 * passes through the centre of its slip and 0 at either extreme, so the petal
 * drops fastest mid-swing and very nearly hangs at the ends of it.
 */
export const fallAt = (t: number, swayFreq: number, seed: number, fall: number): number => {
  const cph = Math.cos(phaseAt(t, swayFreq, seed))
  return -fall * (0.35 + 0.65 * cph * cph)
}

/** Distance fallen since t = 0 (negative), the exact integral of `fallAt`. */
export const fallDisplacement = (
  t: number,
  swayFreq: number,
  seed: number,
  fall: number,
): number =>
  -fall *
  (FALL_MEAN * t +
    (FALL_SWING * (Math.sin(2 * phaseAt(t, swayFreq, seed)) - Math.sin(2 * seed))) /
      (2 * swayFreq))

// --- wrapping ---------------------------------------------------------------

/**
 * Fold a coordinate back into [-half, half].
 *
 * GLSL's `mod` always returns a non-negative result for a positive divisor;
 * JavaScript's `%` keeps the sign of the dividend, so a petal that has drifted
 * to a negative coordinate would come back out the wrong side with a naive
 * translation of the shader line. The extra `+ span) % span` is that
 * difference, and it is why this is tested rather than inlined twice.
 */
export const wrap = (v: number, half: number): number => {
  const span = half * 2
  return (((v + half) % span) + span) % span - half
}
