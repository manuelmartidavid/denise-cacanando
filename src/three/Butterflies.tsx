import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp01, flockAt, type Span } from './flock'
import { activeSpans } from '~/scroll/timeline'
import { frame } from '~/scroll/store'
// Imported rather than referenced as a `/textures/...` string so Vite hashes
// them into the build and a renamed file fails the build instead of failing
// silently at runtime. They live under the repo-root `textures/` folder, beside
// the 1024px masters they were downscaled from.
//
// The `-256` suffix matters: these are downscales of the 1024px masters sitting
// next to them, which are kept as the source art and are NOT imported. A
// butterfly covers roughly 40px on a 1440px screen, so 256 is already several
// times the sampled resolution. Re-import the masters if the flock ever gets
// much larger on screen.
//
// Ember and bone replace the rose and blue maps these started as. The layout is
// identical -- veins converging at the left edge at mid height, banded corner
// with its dot row upper right, eyespots across the lower middle -- so the UV
// mapping in `mergeParts` carries over untouched. They arrived as RGBA, but
// every pixel was fully opaque -- the silhouette comes from the geometry, so
// that channel carried nothing and has been stripped. Keep them RGB: the alpha
// cost 44-69% of the file size to say "opaque" 260,000 times.
import wingEmberUrl from '../../textures/butterflies/butterfly-wing-ember-256.png'
import wingBoneUrl from '../../textures/butterflies/butterfly-wing-bone-256.png'

type Props = {
  count: number
  frozen: boolean
}

/**
 * `THREE.Color` cannot parse `oklch`, so the one token this system still reads
 * as a colour is converted once. Keep the token name — if `index.css` changes,
 * this must be recomputed by hand.
 *
 * The wings were ochre-bright and sage, then flat white and pink, then the rose
 * and blue maps; they are now textured from the ember and bone maps below, at
 * Denise's direction. README §41's "sage, used sparingly in flock only" has not
 * described anything since the first of those changes — the flock was sage's
 * only consumer, so `--color-sage` is unreferenced.
 */
const BARK = '#4a3524' // --color-bark, authored as hex for this reason

/**
 * Share of the flock on the bone wing rather than the ember one. A hard `step`
 * on the per-instance `aTint`, so there is no blending between the two maps —
 * a butterfly is one or the other. Ember is the majority at Denise's direction;
 * the ratio is the decision, so it survives a change of count. At the chosen
 * flock of 28 it falls roughly 17 ember to 11 bone — it read as 6 to 4 while
 * the count sat at a provisional 10, and that phrasing is what went stale, not
 * the share.
 */
const BONE_SHARE = 2 / 5

/**
 * Tuning table from the spec §5. Observed with the canvas temporarily lifted
 * above the page content via a disclosed, uncommitted `z-index` change (defect
 * (a) occludes it otherwise) and with `frame.progress` driven directly (defect
 * (b) saturates it past scrollY 5400). Neither workaround is in this file.
 *
 * `RADIUS_WIDE` is the one value the spec got badly wrong, because it was
 * authored against a 22 x 14 scatter box the old points field hardcoded rather
 * than against the camera. That box is long gone, and so is the file — `Petals`
 * reads the frustum from r3f's `viewport` — but these figures predate the fix
 * and are unaffected by it:
 * the flock's radii were always in real frustum units. The real frustum at z = 0
 * is only about 13.3 x 8.3 (see `instanceAttributes`), so
 * a radius of 13 leaves the frame sampling the dense core of the cloud: ~300-456
 * of the 1,200 instances stayed on screen at `gather: 0` and the "thin residue"
 * reads as an all-over dusting that crowds the ring. 32 leaves ~110-145 on
 * screen across the seven attractors — still a minority of the flock, and
 * enough thinner than R=13 to read as residue rather than dusting, though not
 * as sparse as the mockups draw. See `flock.ts`'s `ATTRACTORS` docstring for
 * why that residue does not read as biased toward any one attractor.
 *
 * EVERY on-screen figure above was counted at the then-current 1,200 instances
 * (`Stage.tsx`'s `FULL_FLOCK`). They are proportions of that count, not
 * absolutes: at a smaller flock the same radius leaves proportionally fewer
 * marks in frame. Re-measure before reusing them, and treat the radius and the
 * count as one decision — thinning the residue can be done from either end.
 *
 * That warning came due once already. `FULL_FLOCK` was cut to 10, not 1,200, and
 * 32 kept roughly *one* instance in frame at `gather: 0` — invisible, and the
 * reason the flock could not be judged on screen at all. Recognizable
 * butterflies make that worse rather than better: they are large enough that a
 * near-empty frame reads as a bug. It sat at a provisional 10 through phases
 * 1-3 and 5-7 purely so the silhouette could be seen.
 *
 * **16 is Denise's, chosen off a shot comparison, and is no longer
 * provisional.** Four candidates were rendered as a 2x2 — this radius against
 * `FULL_FLOCK`, at {10, 16} x {10, 28} — in the only three frames a dispersed
 * flock still exists in, and she picked 16 with 28 butterflies.
 *
 * **The scatter is unseeded `Math.random()`, so any single frame is one draw
 * from a distribution, not the look of a setting.** Expected instances in frame,
 * Monte Carlo over 20,000 trials against this placement and the frustum
 * half-extents (6.63 x 4.14 at z = 0, scaled by depth):
 *
 * ```
 *              hero          about         contact
 * r10 n10      2.20          4.83          3.10
 * r10 n28      6.63         14.26          9.32
 * r16 n10      2.11          2.47          2.17
 * r16 n28      6.51          7.74          6.83   <- chosen
 * ```
 *
 * **Count is the dominant lever; radius is a weaker one whose strength depends
 * on where the attractor sits.** At `hero` the radius barely registers (2.20 vs
 * 2.11) because that attractor is already outside the frame, so spreading it
 * further changes little. At `about` it nearly halves the count (4.83 -> 2.47)
 * because that attractor sits inside the frame, where a tight radius piles the
 * flock into view. Reach for the count to change density; reach for the radius
 * to even it out *between scenes*.
 *
 * **Spread is wide and visible**: at the chosen setting the foot ranges 4 at the
 * 10th percentile to 10 at the 90th. Two reloads legitimately look different.
 * Do not read a density change out of one screenshot — that error is recorded
 * as defect #28.
 */
const RADIUS_WIDE = 16

/**
 * The gathered radius at a seam. **Loosened from 3.5 to 5.5 on Denise's ruling**
 * about the seed collision — at 3.5 the flock piles into a cluster well inside
 * the frustum's 6.63 x 4.14 half-extents and swamps the 24px mark at the exact
 * midpoint, where both peak by construction. Spreading it thins the core the
 * seed sits in; the backing glow in `SeedLayer.tsx` is the other half of the
 * same ruling.
 *
 * **This is global and the seed is not.** `gather` runs at every boundary, but
 * the seed exists only at `g1 -> g2` — so a local problem is being solved with a
 * lever that changes how the flock reads at all six seams. That was accepted
 * deliberately rather than by oversight; the alternative is a per-seam radius,
 * which adds a second tuning surface for one frame of the page.
 *
 * **There is a ceiling on this, and it is the frustum.** Half-extents at z = 0
 * are 6.63 x 4.14, so a radius much past ~4.5 stops reading as a gathering at
 * all — the cluster is wider than the frame it is gathering inside, and the
 * "bunch" becomes an even scatter. Shot at the boundary (scrollY 5130, 1440x900,
 * `gather` = 0.999999) at three values. The files are in the repo root and are
 * **untracked**, following the mobile cycle's before-shots — so git will not
 * have them and they are gone once someone cleans the root:
 *
 * ```
 * seam-midpoint-r35.png   3.5   a real cluster, but a butterfly lands on the seed
 * seam-midpoint-r45.png   4.5   grouped, and the mark keeps clear air   <- here
 * seam-midpoint-r55.png   5.5   mark is clear; the gathering gesture is gone
 * ```
 *
 * **4.5 is provisional and Denise has not ruled on it.** She ruled the
 * *direction* — loosen it — not the amount; those three frames are for her to
 * pick from, the way the 2x2 settled `RADIUS_WIDE`. Each is one draw from an
 * unseeded scatter, so read the framing, not the density (defect #28).
 *
 * `FULL_FLOCK` remains the dominant lever on density and the radius the weaker
 * one — the same relationship `RADIUS_WIDE`'s table measures.
 */
const RADIUS_TIGHT = 4.5

/**
 * Instances held at the front of the z band at a size that reads as a creature
 * rather than a fleck. Everything else is scenery behind them.
 */
const FOREGROUND = 3

/**
 * Translucency was itself a confetti cue, so both ends are up from 0.3/0.85.
 * The gather-linked fade survives because it is what ties "thins to a residue"
 * to "gathers" — it just no longer fades to a ghost.
 */
const ALPHA_THIN = 0.82
const ALPHA_DENSE = 0.96

/**
 * How small a butterfly gets as presence goes to 0.
 *
 * Fading alone makes a recognizable butterfly dissolve in place, which reads as
 * a crossfade artefact rather than as departure; shrinking as it fades reads as
 * flying away. Deliberately not 0 — the alpha reaches nothing first, and a
 * degenerate triangle is not worth the branch it would take to avoid.
 */
const SCALE_ABSENT = 0.55

/**
 * Floor under `presence` in the reduced-motion frieze.
 *
 * The gating is a motion decision: it exists so nothing flies over a centred
 * piece while the visitor scrolls past it. A frieze does not move, so it has
 * nothing to gate — and a reduced-motion visitor parked in a gallery scene,
 * where presence is 0 by design, would otherwise be shown an empty canvas.
 * Reduced motion must lose the motion, not the composition.
 */
const FRIEZE_FLOOR = 0.35
/**
 * Wing angle held while gliding: a shallow dihedral V rather than flat, which
 * is what a gliding butterfly actually holds and what keeps the silhouette
 * readable between beats.
 *
 * This and the flap-glide envelope replace the old `FLAP_FULL`/`FLAP_IDLE`
 * pair, which mixed between two amplitudes of one continuous `sin` — the
 * metronome the spec set out to remove.
 */
const GLIDE = 0.5

/** Spread of the held dihedral across the flock, so gliders are not identical. */
const GLIDE_SPREAD = 0.18

/**
 * Darkest the wing goes when folded fully edge-on, as a fraction of its flat
 * colour. The shading factor is this plus its own complement times the fold
 * cosine, so the two sum to 1 by construction and a face-on wing is left
 * exactly unshaded rather than almost-unshaded.
 *
 * The full range is only reached at a 90-degree fold. The beat tops out around
 * 1.05 rad, so in practice wings darken by about 19%, not 38%.
 */
const FOLD_FLOOR = 0.62

/**
 * Steering weights. A butterfly's heading is the direction of the sum of three
 * things: where the flock as a whole is travelling (`uFlockVel`, which is zero
 * unless the page is being scrolled), the instance's own drift velocity, and a
 * fixed per-instance resting heading.
 *
 * The balance between the last two is the one that matters visually. The drift
 * oscillates at roughly `aSpeed * 0.6` rad/s — about 4 rad/s — so steering
 * straight into it makes butterflies spin on the spot. Keeping the resting
 * heading at unit weight and the drift well below it turns that spin into a
 * gentle weave of about +/-20 degrees around a stable heading, which is what a
 * butterfly actually does. Raise `DRIFT_STEER` for a drunker flock.
 *
 * Neither term can outvote a real migration: mid-leg `uFlockVel` runs to
 * several units per second and simply dominates the sum.
 */
const DRIFT_STEER = 0.12
const REST_STEER = 1.0

/**
 * Bank angle per rad/s of turn, and the spec's hard limit on the result.
 *
 * The gain has to be this small because the drift's angular velocity is much
 * larger than it looks: measured over the `aSpeed` range of 5-9, the steering
 * vector turns at a mean of 2.5-8.1 rad/s and peaks above 20. A gain of 0.3
 * pins the bank to the clamp essentially always, which reads as a snap between
 * two fixed extremes rather than a roll. At 0.03 the mean bank is 4-14 degrees
 * and only the fastest instances reach the limit, which is what a clamp is for.
 */
const BANK_GAIN = 0.03
const BANK_MAX = 0.6

/**
 * Time constant of the exponential moving average on the flock's velocity.
 * `uTarget` is driven by a scrubbed ScrollTrigger, which delivers it in
 * jitters rather than smoothly, and an unsmoothed frame-to-frame delta makes
 * the whole flock twitch. 0.12s is long enough to absorb that and short enough
 * that reversing the scroll turns the flock within a few frames.
 */
const VEL_TAU = 0.12

/** Per-frame scratch, so the velocity maths allocates nothing. */
const SCRATCH = new THREE.Vector3()

/**
 * One wing, outlined as the right one — the left is this mirrored in x. Four
 * cubic beziers: out along the forewing to the tip, back in to the notch, out
 * again across the hindwing, then home to the hinge. Hinged on the body axis at
 * x = 0, so `aWing = ±1` still lets one flap value drive both wings in opposite
 * directions in the vertex shader.
 *
 * Coordinates are the prototype's (`effects-visualizer.html`), in wing-units;
 * `aScale` sizes them per instance. The camera is fixed (Stage.tsx), so nothing
 * is billboarded — the flap's foreshortening supplies the motion, as it did for
 * the rhombus this replaces.
 */
const wingShape = (): THREE.Shape => {
  const s = new THREE.Shape()
  s.moveTo(0, 0.4)
  s.bezierCurveTo(0.42, 0.74, 1.02, 0.66, 1.12, 0.3) //    forewing lobe
  s.bezierCurveTo(1.18, 0.06, 0.78, -0.02, 0.55, 0.02) //  notch between lobes
  s.bezierCurveTo(0.92, -0.14, 0.94, -0.52, 0.62, -0.62) // hindwing lobe
  s.bezierCurveTo(0.3, -0.7, 0.04, -0.44, 0, -0.3) //       back to the hinge
  s.closePath()
  return s
}

/**
 * The body: an ellipse along the hinge.
 *
 * The spec asked for ~0.7 wing-units long, which sat the body entirely inside
 * the wing span. The texture preview Denise supplied draws it differently — the
 * body runs nearly the full height of the wings and is noticeably narrower —
 * and the preview is the newer artifact and the one that says what these should
 * look like, so these proportions follow it: 1.12 long against the wings' 1.25,
 * and half as wide relative to span.
 */
const bodyShape = (): THREE.Shape => {
  const s = new THREE.Shape()
  s.absellipse(0, 0, 0.045, 0.56, 0, Math.PI * 2, false, 0)
  return s
}

type Part = { source: THREE.ShapeGeometry; wing: number; mirror: boolean }

/**
 * Flattens the three parts into one indexed geometry so the whole flock is
 * still a single instanced draw call. `aWing` carries the part identity: ±1 for
 * the two wings, and **0 for the body**, which is what keeps the body out of
 * the flap for free — the shader's `cos(flap * aWing)` is 1 and its
 * `sin(flap * aWing)` is 0 there, so the body never rotates and needs no branch
 * and no second attribute. The fragment shader recovers it as `1 - abs(aWing)`.
 *
 * UVs are each source shape's own bounding box normalised to 0–1, which is what
 * lands the wing maps correctly: their veins converge at the left edge, mid
 * height, exactly where the wing's hinge is, and their dark banded corner falls
 * on the forewing tip. Crucially the UV is taken from the source position
 * **before** the mirror, so both wings address the map identically and the left
 * one comes out as the mirror image of the right — which is what a butterfly
 * is, and what the preview draws.
 */
const mergeParts = (parts: Part[]): THREE.BufferGeometry => {
  let vertices = 0
  let indices = 0
  for (const part of parts) {
    vertices += part.source.attributes.position!.count
    indices += part.source.index!.count
  }

  const position = new Float32Array(vertices * 3)
  const aWing = new Float32Array(vertices)
  const aUv = new Float32Array(vertices * 2)
  const index = new Uint16Array(indices)

  let v = 0
  let i = 0
  for (const part of parts) {
    const src = part.source.attributes.position!.array
    const srcIndex = part.source.index!.array
    const count = part.source.attributes.position!.count
    const sign = part.mirror ? -1 : 1

    part.source.computeBoundingBox()
    const box = part.source.boundingBox!
    const spanX = box.max.x - box.min.x || 1
    const spanY = box.max.y - box.min.y || 1

    for (let k = 0; k < count; k++) {
      const x = src[k * 3]!
      const y = src[k * 3 + 1]!
      position[(v + k) * 3] = x * sign
      position[(v + k) * 3 + 1] = y
      position[(v + k) * 3 + 2] = 0
      aWing[v + k] = part.wing
      aUv[(v + k) * 2] = (x - box.min.x) / spanX
      aUv[(v + k) * 2 + 1] = (y - box.min.y) / spanY
    }

    for (let k = 0; k < srcIndex.length; k++) {
      // Mirroring in x reverses each triangle's winding. DoubleSide makes that
      // moot, but re-reverse it so the buffer stays consistently wound.
      const o = k % 3
      index[i + k] = v + srcIndex[part.mirror ? k - o + (2 - o) : k]!
    }

    v += count
    i += srcIndex.length
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setAttribute('aWing', new THREE.BufferAttribute(aWing, 1))
  g.setAttribute('aUv', new THREE.BufferAttribute(aUv, 2))
  g.setIndex(new THREE.BufferAttribute(index, 1))
  return g
}

const butterflyGeometry = (): THREE.BufferGeometry => {
  const wing = new THREE.ShapeGeometry(wingShape(), 10)
  const body = new THREE.ShapeGeometry(bodyShape(), 10)
  const merged = mergeParts([
    { source: wing, wing: 1, mirror: false },
    { source: wing, wing: -1, mirror: true },
    { source: body, wing: 0, mirror: false },
  ])
  // Intermediates: never uploaded, but disposed for hygiene (invariant 4).
  wing.dispose()
  body.dispose()
  return merged
}

/**
 * Per-instance variation. `cbrt` on the radius spreads instances evenly through
 * the volume instead of clumping them at the centre, and y is squashed to 0.62
 * so the cloud matches the frame's proportions.
 *
 * That frame was never the 22 x 14 box the old points field hardcoded — that
 * number was its own constant, not a measurement, and neither survives.
 * With the camera at z:10 / fov:45 (`Stage.tsx`) the frustum at the z = 0 plane
 * is 2 * 10 * tan(22.5 deg) = 8.28 tall, and as wide as the aspect makes it:
 * 13.3 at 1440x900, 14.7 at 16:9. Half-extents at the design viewport are then
 * roughly 6.63 x 4.14. Every radius below is in those units; 8.28 / 13.3 = 0.62
 * is where the squash comes from.
 *
 * Earlier revisions of this comment said 13.1 and derived 0.63. The height was
 * always right; the width was slightly under. 0.62 is unchanged and correct.
 */
const instanceAttributes = (count: number) => {
  const aOffset = new Float32Array(count * 3)
  const aPhase = new Float32Array(count)
  const aSpeed = new Float32Array(count)
  const aTint = new Float32Array(count)
  const aScale = new Float32Array(count)
  const aBeat = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const z = Math.random() * 2 - 1
    const ring = Math.sqrt(1 - z * z)
    const r = Math.cbrt(Math.random())

    aOffset[i * 3] = Math.cos(theta) * ring * r
    aOffset[i * 3 + 1] = Math.sin(theta) * ring * r * 0.62
    // The first few instances are pulled to the front of the z band to be the
    // foreground readers; the rest keep their even-through-the-volume z.
    aOffset[i * 3 + 2] = i < FOREGROUND ? 0.16 + Math.random() * 0.09 : z * r * 0.25

    aPhase[i] = Math.random() * Math.PI * 2
    aSpeed[i] = 5 + Math.random() * 4
    aTint[i] = Math.random()

    // Scale tracks z so nearer reads larger, on top of the perspective divide
    // that already does some of this — the exaggeration is the point (fake
    // parallax). `aOffset.z` spans ±0.25 before the shader's radius multiply.
    const near = clamp01((aOffset[i * 3 + 2]! / 0.25 + 1) / 2)
    aScale[i] = i < FOREGROUND ? 0.275 + Math.random() * 0.1 : 0.14 + near * 0.1

    // The wingbeat, packed rather than carried as three separate attributes:
    // one buffer and one attribute slot instead of three, for values that are
    // never read apart. x = beat frequency, y = flap-glide cycle length in
    // seconds, z = the fraction of that cycle spent flapping.
    aBeat[i * 3] = 7 + Math.random() * 3.5
    aBeat[i * 3 + 1] = 2.2 + Math.random() * 1.4
    aBeat[i * 3 + 2] = 0.5 + Math.random() * 0.18
  }

  return { aOffset, aPhase, aSpeed, aTint, aScale, aBeat }
}

const VERTEX = /* glsl */ `
  uniform vec3 uTarget;
  uniform vec3 uFlockVel;
  uniform float uGather;
  uniform float uSettle;
  uniform float uPresence;
  uniform float uTime;
  uniform float uRestBreath;

  attribute vec3 aOffset;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aTint;
  attribute float aScale;
  attribute float aWing;
  attribute vec2 aUv;
  attribute vec3 aBeat;

  varying float vAlpha;
  varying float vBody;
  varying float vBone;
  varying float vFold;
  varying vec2 vUv;

  void main() {
    // One scalar drives both spread and opacity, so "thins to a residue" cannot
    // drift out of sync with "gathers".
    vec3 centre = uTarget + aOffset * mix(${RADIUS_WIDE.toFixed(1)}, ${RADIUS_TIGHT.toFixed(1)}, uGather);

    float drift = 1.0 - uSettle;
    float d1 = uTime * aSpeed * 0.6 + aPhase;
    float d2 = uTime * aSpeed * 0.45 + aPhase;
    centre.x += sin(d1) * 0.6 * drift;
    centre.y += cos(d2) * 0.4 * drift;

    // The drift is pure sin/cos of uTime, so its first and second derivatives
    // are free right here - no second uniform, no CPU-side history. Constants
    // are the chain rule on the two lines above: 0.6*0.6, 0.45*0.4, then the
    // same again times the inner frequency.
    vec2 driftVel = vec2(cos(d1) * aSpeed * 0.36, -sin(d2) * aSpeed * 0.18) * drift;
    vec2 driftAcc = vec2(-sin(d1) * 0.216, -cos(d2) * 0.081) * aSpeed * aSpeed * drift;

    // A per-instance resting heading, always present at unit length. This is
    // what makes the steering total safe to normalise: at the contact section
    // uSettle is 1, which zeroes the drift, and the target has stopped moving
    // so uFlockVel has decayed to zero too. Without this term the sum would be
    // exactly zero, atan(0,0) is undefined, and the whole flock would snap to
    // one arbitrary shared heading - including in the reduced-motion frieze,
    // where uFlockVel is never written at all. Reusing aPhase rather than
    // adding an attribute: its correlation with the drift phase is invisible.
    vec2 rest = vec2(cos(aPhase), sin(aPhase));
    vec2 v = uFlockVel.xy + driftVel * ${DRIFT_STEER.toFixed(2)} + rest * ${REST_STEER.toFixed(2)};

    float speed = length(v);
    vec2 dir = speed > 1e-4 ? v / speed : rest;
    float heading = atan(dir.y, dir.x) - 1.5707963;

    // Angular velocity of the steering vector, v x a / |v|^2, from the drift
    // alone - the spec's sanctioned cheap approximation. Banking into the weave
    // rather than out of it is the whole point, so the sign matters.
    float turn = (v.x * driftAcc.y - v.y * driftAcc.x) / (dot(v, v) + 0.001);
    float bank = clamp(turn * ${BANK_GAIN.toFixed(2)}, -${BANK_MAX.toFixed(2)}, ${BANK_MAX.toFixed(2)});

    // Flap-glide. Each instance runs a cycle aBeat.y seconds long and beats for
    // the first aBeat.z of it, gliding the rest. Past the flapping window w
    // exceeds 1, where the closing smoothstep is already saturated, so the
    // envelope shuts itself off without a branch or a step().
    float cycle = mod(uTime + aPhase, aBeat.y) / aBeat.y;
    float w = cycle / aBeat.z;
    float env = smoothstep(0.0, 0.12, w) * (1.0 - smoothstep(0.88, 1.0, w));
    // Settling damps the beat toward a held glide. This replaces the old
    // FLAP_FULL/FLAP_IDLE amplitude mix.
    env *= 1.0 - 0.9 * uSettle;

    // The sin-of-sin warps the phase so the downstroke is quicker than the
    // recovery. A pure sin is symmetric, and symmetric is what reads as a
    // metronome.
    float p = uTime * aBeat.x + aPhase;
    float stroke = sin(p + 0.45 * sin(p));

    // The held dihedral varies slightly per instance. Without this every
    // gliding butterfly sits at exactly GLIDE, and since roughly 40% of the
    // flock is between beats at any moment, that is a lot of identical wings -
    // most visible in the frozen frieze, where the gliders were the only poses
    // that repeated. Keyed off the cycle length rather than aTint, which would
    // correlate the dihedral with the ember/bone split and make bone
    // butterflies visibly flatter than ember ones.
    float glide = ${GLIDE.toFixed(2)} + ((aBeat.y - 2.2) / 1.4 - 0.5) * ${GLIDE_SPREAD.toFixed(2)};
    float flap = mix(glide, 0.25 + 0.8 * stroke, env);

    // A perched butterfly is not frozen solid: it opens and closes now and
    // then. Cubing a half-wave rectified slow sine gives long stillness broken
    // by an occasional unhurried opening. uRestBreath is zeroed when the frieze
    // is frozen, so reduced motion gets no time-varying term at all.
    float breath = max(0.0, sin(uTime * 0.4 + aPhase * 2.0));
    flap += uSettle * uRestBreath * 0.45 * breath * breath * breath;

    // Lift pulse on each beat plus a sink while gliding, scaled by aScale so a
    // small distant butterfly bobs less in world units than a near one.
    // Deliberately NOT folded into the steering derivative above: at 7-10.5
    // rad/s it would pitch the whole flock on every wingbeat.
    centre.y += (env * 0.5 * sin(p - 0.9) - (1.0 - env) * 0.22) * (1.0 - uSettle) * aScale;

    float c = cos(flap * aWing);
    float s = sin(flap * aWing);

    // Three rotations, innermost first, all about the instance centre because
    // the centre is only added at the very end.
    //   flap    - each wing about the hinge (local y), opposite signs via aWing
    //   bank    - the whole insect about that same body axis, both wings alike
    //   heading - the whole insect in the screen plane so +y faces travel
    // Named local, not p: p is the beat phase above, and GLSL rejects the
    // redefinition rather than shadowing it.
    // Shrinking as it fades is what reads as flying away rather than dissolving
    // - see SCALE_ABSENT. The bob above stays on the unscaled aScale: it is a
    // world-space displacement of the whole instance, not part of its body.
    vec3 local = position * aScale * mix(${SCALE_ABSENT.toFixed(2)}, 1.0, uPresence);
    vec3 wing = vec3(local.x * c, local.y, -local.x * s);

    float cb = cos(bank);
    float sb = sin(bank);
    wing = vec3(wing.x * cb + wing.z * sb, wing.y, wing.z * cb - wing.x * sb);

    float ch = cos(heading);
    float sh = sin(heading);
    wing = vec3(wing.x * ch - wing.y * sh, wing.x * sh + wing.y * ch, wing.z);

    vUv = aUv;
    vAlpha = uPresence * mix(${ALPHA_THIN.toFixed(2)}, ${ALPHA_DENSE.toFixed(2)}, uGather);
    // Resolved per instance here rather than per fragment: it is constant over
    // the whole butterfly, so the step belongs in the cheaper stage.
    vBone = step(${(1 - BONE_SHARE).toFixed(4)}, aTint);
    // 1 on the body triple (aWing = 0), 0 on either wing. Constant across each
    // triangle - no triangle mixes body and wing vertices - so nothing bleeds.
    vBody = 1.0 - abs(aWing);

    // Shade by fold. c is the flap cosine already computed above, so this costs
    // nothing extra. It needs no exemption for the body: the body carries
    // aWing = 0, which makes c exactly 1 and leaves this exactly 1 too, so the
    // dark brown stays flat without a branch.
    vFold = ${FOLD_FLOOR.toFixed(2)} + ${(1 - FOLD_FLOOR).toFixed(2)} * c;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(centre + wing, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform sampler2D uWingEmber;
  uniform sampler2D uWingBone;
  uniform vec3 uBark;

  varying float vAlpha;
  varying float vBody;
  varying float vBone;
  varying float vFold;
  varying vec2 vUv;

  void main() {
    // Both maps are sampled and one is thrown away by the mix, which keeps the
    // whole flock a single draw call - the alternative is splitting it into a
    // ember mesh and a bone mesh. Two texture fetches a fragment is the cheaper
    // half of that trade at this instance count.
    vec3 wing = mix(texture2D(uWingEmber, vUv).rgb, texture2D(uWingBone, vUv).rgb, vBone);
    // vFold is exactly 1 on the body, so this shades the wings and leaves the
    // flat brown alone without singling it out.
    gl_FragColor = vec4(mix(wing, uBark, vBody) * vFold, vAlpha);
    #include <colorspace_fragment>
  }
`

/**
 * The instanced butterfly flock — README §184.
 *
 * Every instance is placed in the vertex shader from six uniforms, so the CPU
 * writes six values per frame rather than one matrix per instance, whatever
 * the count. (Four until the flock learned to face where it is going;
 * `uFlockVel` is the fifth and `uPresence` the sixth, both written the same O(1)
 * way.) `instanceMatrix` is never used, which is also why frustum culling is
 * off: three would cull against a bounding box the shader ignores.
 *
 * Alpha blending, never additive: additive over g4's cream ground adds toward
 * white and vanishes, and butterflies are solid marks. `Petals` now follows the
 * same rule — this comment used to cite it as the counter-example, which it
 * stopped being when the points field was rewritten.
 */
export const Butterflies = ({ count, frozen }: Props) => {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)

  /**
   * The two painted wing maps. `SRGBColorSpace` is not optional: without it the
   * renderer treats the bytes as linear, the mid-tones come back washed out,
   * and the `<colorspace_fragment>` include at the end of the fragment shader
   * then encodes them a second time.
   *
   * The `invalidate` on load is what makes the reduced-motion frieze work.
   * `Stage` runs `frameloop: 'demand'` there, so the one frame the frieze
   * renders is very likely drawn before these have finished decoding — without
   * a re-render on arrival the static frieze would keep the untextured frame
   * forever.
   */
  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader()
    const anisotropy = gl.capabilities.getMaxAnisotropy()
    const load = (url: string) => {
      const texture = loader.load(url, () => invalidate())
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = anisotropy
      return texture
    }
    return { ember: load(wingEmberUrl), bone: load(wingBoneUrl) }
  }, [gl, invalidate])

  const geometry = useMemo(() => {
    const g = butterflyGeometry()
    const a = instanceAttributes(count)
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(a.aOffset, 3))
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(a.aPhase, 1))
    g.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(a.aSpeed, 1))
    g.setAttribute('aTint', new THREE.InstancedBufferAttribute(a.aTint, 1))
    g.setAttribute('aScale', new THREE.InstancedBufferAttribute(a.aScale, 1))
    g.setAttribute('aBeat', new THREE.InstancedBufferAttribute(a.aBeat, 3))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uTarget: { value: new THREE.Vector3() },
          uFlockVel: { value: new THREE.Vector3() },
          uGather: { value: 0 },
          uSettle: { value: 0 },
          uPresence: { value: 0 },
          uTime: { value: 0 },
          uRestBreath: { value: 1 },
          uWingEmber: { value: textures.ember },
          uWingBone: { value: textures.bone },
          uBark: { value: new THREE.Color(BARK) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [textures],
  )

  // `geometry`, `material` and the two wing textures are built imperatively and
  // passed via `args`/uniforms, so r3f does not own or dispose them — only the
  // attached `instancedMesh` and its `instanceMatrix` get that treatment
  // automatically. Without this, every crossing of the compact breakpoint
  // (which mounts/unmounts `Butterflies`) leaks a `BufferGeometry`, a compiled
  // shader program and two textures.
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
      textures.ember.dispose()
      textures.bone.dispose()
    }
  }, [geometry, material, textures])

  // The resting open-close is the one term that still moves when everything
  // else has settled, so reduced motion has to switch it off explicitly rather
  // than relying on `uTime` standing still.
  useEffect(() => {
    material.uniforms.uRestBreath!.value = frozen ? 0 : 1
  }, [material, frozen])

  const spans = useRef<Span[]>([])
  const measured = useRef(0)
  const prevTarget = useRef(new THREE.Vector3())
  const flockVel = useRef(new THREE.Vector3())
  const primed = useRef(false)

  /**
   * Writes the four driven uniforms for a given whole-document progress, and
   * gates the draw.
   *
   * `floor` is the reduced-motion escape hatch: the frieze must not lose
   * anything structural, so a visitor parked in a gallery scene — where
   * `presence` is 0 by design — still gets a static frieze rather than an empty
   * canvas. Zero on the live path, where absence is the whole point.
   *
   * Skipping the draw outright below `0.01` is worth a branch here: with
   * `HOLD.g1..g4` at 0 that is the entire gallery, which is most of the
   * document.
   */
  const place = (progress: number, floor = 0) => {
    const m = mesh.current
    if (!m) return
    const u = (m.material as THREE.ShaderMaterial).uniforms
    const { target, gather, settle, presence } = flockAt(spans.current, progress)
    const shown = Math.max(presence, floor)
    ;(u.uTarget!.value as THREE.Vector3).set(target[0], target[1], target[2])
    u.uGather!.value = gather
    u.uSettle!.value = settle
    u.uPresence!.value = shown
    m.visible = shown > 0.01
  }

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m || frozen) return

    // Label offsets only move when the document height moves: pin lengths are
    // count-independent, so a merch chip re-blooming the ring does not shift
    // them. This read itself is not free — it forces layout on a DOM GSAP has
    // just dirtied — and it runs unconditionally, every frame, regardless of
    // the gate below. What the gate avoids is the cheap half: rebuilding seven
    // spans (seven Map lookups, seven allocations) 60 times a second when
    // the height hasn't actually changed.
    const height = document.documentElement.scrollHeight
    if (height !== measured.current) {
      const next = activeSpans()
      if (next.length) {
        measured.current = height
        spans.current = next
      }
    }

    const u = (m.material as THREE.ShaderMaterial).uniforms
    u.uTime!.value += delta
    place(frame.progress)

    /**
     * The flock's own velocity, as the frame-to-frame delta of the target it is
     * flying toward. Still O(1) work per frame and no allocation — `SCRATCH` is
     * module-level — so the uniform-driven architecture is intact; this is one
     * more scalar written the same way, not a per-instance CPU loop.
     *
     * The first frame is skipped rather than measured: `prevTarget` starts at
     * the origin while the real target is metres away, and dividing that by a
     * frame time would fling the whole flock's heading on mount.
     *
     * Scrubbing backward yields a negative delta and turns the flock around,
     * which the spec asks for explicitly.
     */
    const target = u.uTarget!.value as THREE.Vector3
    if (primed.current && delta > 1e-4) {
      SCRATCH.subVectors(target, prevTarget.current).divideScalar(delta)
      // Frame-rate independent EMA: a fixed per-frame coefficient would smooth
      // differently at 60fps and 144fps.
      flockVel.current.lerp(SCRATCH, 1 - Math.exp(-delta / VEL_TAU))
    } else {
      primed.current = true
    }
    prevTarget.current.copy(target)
    ;(u.uFlockVel!.value as THREE.Vector3).copy(flockVel.current)
  })

  /**
   * Reduced motion: `Stage` sets `frameloop: 'demand'`, but that does not stop
   * `useFrame` from running — `invalidate()` below triggers exactly the render
   * this effect's own callback subscribes to. What actually holds the flock
   * still is the `|| frozen` early-return guard at the top of `useFrame`
   * above: it makes the frieze static, not the frameloop mode. Do not delete
   * that guard on the assumption `useFrame` is dormant here — `uTime` would
   * resume advancing and the "static frieze" would silently drift.
   *
   * Placed twice: once at mount, and once after fonts settle, because
   * `refreshAfterFonts` is what first gives the document its real height and
   * every label its real offset. The frieze reflects the scroll position at
   * that moment and does not follow the visitor down the page — that is the
   * spec, not a bug.
   */
  useEffect(() => {
    if (!frozen) return
    let cancelled = false

    const settleFrieze = () => {
      if (cancelled) return
      spans.current = activeSpans()
      // The frieze keeps a floor under presence — see `place`.
      place(frame.progress, FRIEZE_FLOOR)
      invalidate()
    }

    settleFrieze()
    void document.fonts.ready.then(() => requestAnimationFrame(settleFrieze))

    return () => {
      cancelled = true
    }
  }, [frozen, invalidate])

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />
}
