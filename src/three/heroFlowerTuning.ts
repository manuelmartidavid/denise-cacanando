/**
 * The hero dahlia's pose configuration — live values in a mutable object,
 * defaults alongside.
 *
 * Its own module, and deliberately free of three.js imports: the dev tuner
 * panel (`HeroFlowerTuner`, plain DOM rendered by Hero) writes these, and
 * routing that through `HeroFlower.tsx` would drag the whole three bundle
 * into the hero's chunk. `HeroFlower` reads the live object per frame, so a
 * slider drag lands on the very next rendered frame with no React state in
 * the loop — the same channel discipline as `frame` in scroll/store.
 *
 * In production nothing ever writes here (the tuner is dev-only), so the
 * live values ARE the defaults. When a tuning session settles on numbers,
 * copy them into `HERO_FLOWER_DEFAULTS` — that is the shipped pose.
 */
export type HeroFlowerTuning = {
  /** Root X tilt while closed — the bud's profile against the camera. */
  tiltBud: number
  /** Root X tilt at (and past) full bloom — how squarely it faces the screen. */
  tiltBloom: number
  /**
   * Roll around the screen axis. Negative carries the bud's tip to screen
   * RIGHT (north-east) under the camera's view down -Z, and it reads larger
   * than it measures: the model's own stem curvature starts the bud ~35° to
   * the north-west, so the roll pays that off before any of it shows.
   */
  leanZ: number
  /** World scale for a flower whose anchor box fills the canvas height. */
  scale: number
  /** Head offset from the anchor's centre, in the same anchor-relative units. */
  nudgeX: number
  nudgeY: number
  /**
   * Where full open bloom lands, as a fraction of the scrub. The tilt's
   * turn-to-camera finishes here, and the reduced-motion still freezes here.
   */
  bloomAt: number
  /**
   * The painterly pass (see three/painterly.ts). strokeScale is spatial
   * frequency of the brush pulls; strokeStrength how hard they modulate
   * colour; bandMix blends continuous vs 3-band diffuse (0 photographic,
   * 1 fully banded); chalk desaturates and lifts toward the page cream;
   * edgeFade is the dry-brush rim dissolve at grazing angles.
   */
  strokeScale: number
  strokeStrength: number
  bandMix: number
  chalk: number
  edgeFade: number
  /**
   * Dev-only: when set, replaces frame.heroProgress so a pose can be parked
   * mid-bloom while sliders move. The tuner owns it; never set in shipped
   * code.
   */
  progressOverride: number | null
}

/**
 * Marti's, chosen by eye in the tuner (2026-08-07). Equal tilts mean the
 * flower no longer turns while it opens — it holds one near-face-on angle
 * from bud to scatter — and the +2.1 nudge carries the head toward the
 * crop's right edge.
 */
export const HERO_FLOWER_DEFAULTS = {
  tiltBud: 0.3,
  tiltBloom: 0.3,
  leanZ: -0.54,
  scale: 2.65,
  nudgeX: 2.1,
  nudgeY: -0.4,
  bloomAt: 0.39,
  strokeScale: 1,
  strokeStrength: 0.35,
  bandMix: 0.5,
  chalk: 0.35,
  edgeFade: 0.55,
} as const

export const heroFlowerTuning: HeroFlowerTuning = {
  ...HERO_FLOWER_DEFAULTS,
  progressOverride: null,
}
