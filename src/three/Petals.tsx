import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AVOID_MAX, getAvoidRects } from './avoid'
import * as THREE from 'three'
import { frame } from '~/scroll/store'
import {
  FALL_MEAN,
  FALL_SWING,
  GUST_GAIN,
  GUST_LIFT,
  GUST_PHASE,
  GUST_RATE,
  WIND_BASE,
  WIND_SEED_PHASE,
  WIND_SWING,
  WIND_SWING_RATE,
} from './flutter'
// Replaces the teardrop this system used to draw into a canvas at runtime. A
// painted map is worth the request: the generated one was a gradient in an
// outline, with none of the vein structure or the softness at the rim.
import petalUrl from '../../textures/petals/petal-ember-bone-256.png'

type Props = {
  count: number
  frozen: boolean
  /**
   * The foreground layer: bigger, fewer, faster, and NOT deflected.
   *
   * Deflection is a back-layer behaviour. These petals are drawn in front of the
   * paintings, and a petal that visibly passes over a canvas while also easing
   * around its edge reads as broken depth rather than as physics.
   */
  near?: boolean
}

/**
 * Petal tints. Invariant 6 restricts this system to palette tokens but
 * explicitly allows petals "soft variations of ochre/cream tones", which is
 * what these are: the first is `--color-ochre-bright` exactly, the rest are
 * warm neighbours of it. They stay here rather than in `index.css` because CSS
 * never reads them and five canvas-only entries would be noise in the token
 * table. Promote them if the DOM ever needs the same five.
 */
const TINTS = ['#f4c6b0', '#f1aa92', '#f3d9bf', '#e29381', '#f4ead9']

/**
 * The quad is **square**, because the map is square and the painted petal
 * carries its own proportions inside it. Mapping a square map onto the 0.6 x
 * 0.34 quad this system used to use would stretch a petal painted at 1.45:1 out
 * to roughly 2.55:1 — recognisably thinner than the artwork.
 *
 * So `PETAL_SIZE` sizes the quad, not the petal. Measured off the map's alpha
 * channel, the silhouette fills 95.3% of its width and 65.6% of its height, so
 * what actually appears on screen is about 0.57 x 0.39 world units. The rest of
 * the quad is transparent and discarded by `ALPHA_TEST`.
 */
const PETAL_SIZE = 0.6
const PETAL_COVER_X = 0.953
const PETAL_COVER_Y = 0.656

/**
 * Off-screen margins on the wrap box. These are not slack: the field spans z
 * from -3 to 2 and the frustum widens with distance, so at the far plane the
 * visible half-extents are about 1.3x those at z = 0. The margins are sized to
 * cover exactly that, which is what stops a petal popping into view at the
 * moment it wraps.
 *
 * They carry no allowance for petal size beyond that, so they hold only while
 * the scales below stay modest. Push a scale far past ~1.9 and a petal can
 * begin wrapping with a corner still on screen, which reads as a blink.
 */
const MARGIN_X = 2.2
const MARGIN_Y = 1.4

/** How far the field slides left across the document. */
const SLIDE_X = 3

/** Foreground petals travel this much further across the document. */
const NEAR_SLIDE = 1.9

/**
 * And are drawn this much larger, which is the whole of what makes them near.
 *
 * 2.1 put single petals across a third of a painting — at that size the texture
 * shows its own blur and the petal reads as a smudge on the lens rather than as
 * something passing in front of the work. 1.45 is close enough to be foreground
 * and small enough to stay a petal.
 */
const NEAR_SCALE = 1.45

const OPACITY = 0.94
const ALPHA_TEST = 0.05

/** Instances pulled in front of the camera plane to read as foreground. */
const NEAR = 8

/**
 * The `uTime` the reduced-motion frieze freezes at. Any non-zero value would
 * do; what matters is that it is not 0, where every petal still sits at its
 * seeded start with no sway, no tilt and no tumble applied, and the field would
 * read as a grid of identical face-on petals.
 */
const FRIEZE_TIME = 12.3

/**
 * A gently curled plane. The curl is baked into the vertices rather than
 * applied per frame: it never changes, and a flat quad catches the light of the
 * tilt as one hard facet, which reads as paper rather than petal.
 *
 * Both curl terms are normalised to the painted silhouette rather than to the
 * quad. The quad is square and the petal fills only two thirds of its height,
 * so measuring the cross-curl across the full quad would leave the petal's own
 * edge at 43% of the intended cup, and the curl would all but disappear.
 */
const petalGeometry = (): THREE.PlaneGeometry => {
  const geometry = new THREE.PlaneGeometry(PETAL_SIZE, PETAL_SIZE, 5, 5)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const halfLong = (PETAL_SIZE * PETAL_COVER_X) / 2
  const halfShort = (PETAL_SIZE * PETAL_COVER_Y) / 2

  for (let i = 0; i < position.count; i++) {
    const along = position.getX(i) / halfLong
    const across = position.getY(i) / halfShort
    position.setZ(i, 0.085 * Math.cos((Math.PI * along) / 2) + 0.045 * across * across)
  }
  position.needsUpdate = true
  return geometry
}

/**
 * Per-instance seeds. Packed into four attributes rather than nine, since none
 * of these are ever read apart:
 *
 *   aOrigin  x0, y0, z
 *   aWave    sway frequency, sway amplitude, fall rate, seed
 *   aSpin    tilt amplitude, tumble start, tumble rate, scale
 *   aTint    rgb
 */
const instanceAttributes = (count: number, wrapX: number, wrapY: number) => {
  const aOrigin = new Float32Array(count * 3)
  const aWave = new Float32Array(count * 4)
  const aSpin = new Float32Array(count * 4)
  const aTint = new Float32Array(count * 3)
  const colour = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const near = i < NEAR

    // Scattered across the wrap box, not the visible frame: the box is what the
    // shader folds into, so seeding outside it would just wrap on frame one.
    aOrigin[i * 3] = (Math.random() * 2 - 1) * wrapX
    aOrigin[i * 3 + 1] = (Math.random() * 2 - 1) * wrapY
    aOrigin[i * 3 + 2] = near ? 0.5 + Math.random() * 1.5 : -3 + Math.random() * 3.5

    aWave[i * 4] = 0.8 + Math.random() * 0.8
    aWave[i * 4 + 1] = 0.35 + Math.random() * 0.45
    aWave[i * 4 + 2] = 0.28 + Math.random() * 0.27
    aWave[i * 4 + 3] = Math.random() * Math.PI * 2

    aSpin[i * 4] = 0.5 + Math.random() * 0.4
    aSpin[i * 4 + 1] = Math.random() * Math.PI * 2
    aSpin[i * 4 + 2] = (Math.random() * 2 - 1) * 0.45
    // Scale. The far band's floor is 0.2, NOT the 0.1 it shipped with, and the
    // arithmetic is the reason rather than the taste:
    //
    //   long axis = PETAL_SIZE * PETAL_COVER_X * scale = 0.572 * scale
    //
    // so 0.1 drew a petal 0.057 world units across, against the 0.035 of the
    // dots this whole system was written to replace — 1.6x, close enough that
    // the haziest petals had quietly become dots again. That is the specific
    // failure the rewrite existed to fix, and nobody chose it; it fell out of
    // the numbers. At 0.2 the smallest petal is 0.114 units, about 3.3x a dot,
    // and still comfortably the smallest thing in the field.
    //
    // The ceiling is untouched at 0.7, so this narrows the far band's range
    // rather than shifting it — the depth separation from the near band (0.4-1.0,
    // and held at the front of the z range) is unchanged.
    aSpin[i * 4 + 3] = near ? 0.4 + Math.random() * 0.6 : 0.2 + Math.random() * 0.5

    colour.set(TINTS[Math.floor(Math.random() * TINTS.length)]!)
    aTint[i * 3] = colour.r
    aTint[i * 3 + 1] = colour.g
    aTint[i * 3 + 2] = colour.b
  }

  return { aOrigin, aWave, aSpin, aTint }
}

/**
 * Positions are closed-form in `uTime`, so there is no state to advance and the
 * CPU writes two uniforms a frame whatever the count. The formulas mirror
 * `flutter.ts`, which is where they are unit-tested; the constants are
 * interpolated from there so the numbers exist once.
 */
const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  // The artworks the field publishes, in petal-space world units:
  // (centre x, centre y, half width, half height). See three/avoid.ts.
  uniform vec4 uAvoid[${AVOID_MAX}];
  uniform int uAvoidCount;
  uniform float uAvoidPush;
  uniform float uAvoidSoft;
  uniform float uBreeze;
  uniform float uSlide;
  uniform vec2 uWrap;

  attribute vec3 aOrigin;
  attribute vec4 aWave;
  attribute vec4 aSpin;
  attribute vec3 aTint;

  varying vec3 vTint;
  varying float vShade;
  varying vec2 vUv;

  // Antiderivative of max(0, sin u)^3. A positive half-cycle climbs by exactly
  // 4/3; the negative half is flat because the clamped integrand is zero there.
  float gustAnti(float u) {
    float cycles = floor(u / 6.28318531);
    float r = u - cycles * 6.28318531;
    float c = cos(r);
    float part = r < 3.14159265 ? (-c + c * c * c / 3.0 + 0.66666667) : 1.33333333;
    return cycles * 1.33333333 + part;
  }

  float gustIntegral(float t) {
    return (gustAnti(${GUST_RATE.toFixed(2)} * t + ${GUST_PHASE.toFixed(1)})
          - gustAnti(${GUST_PHASE.toFixed(1)})) / ${GUST_RATE.toFixed(2)};
  }

  void main() {
    float freq = aWave.x;
    float seed = aWave.w;
    float ph = uTime * freq + seed;
    float gust = gustIntegral(uTime);

    // Wind carries the field sideways; the sway is the petal's own slip either
    // side of that. uSlide is added BEFORE the wrap on purpose: fold first and
    // translate after and the far edge empties out as the document scrolls,
    // which is the failure the old field's SLIDE_X allowance was paying for.
    float x = aOrigin.x
      + uBreeze * (${WIND_BASE.toFixed(2)} * uTime
        - ${(WIND_SWING / WIND_SWING_RATE).toFixed(6)}
          * (cos(${WIND_SWING_RATE.toFixed(2)} * uTime + seed * ${WIND_SEED_PHASE.toFixed(2)})
           - cos(seed * ${WIND_SEED_PHASE.toFixed(2)}))
        + ${GUST_GAIN.toFixed(2)} * gust)
      + aWave.y * (sin(ph) - sin(seed))
      + uSlide;

    // Fall speed is fall * (0.35 + 0.65 cos^2 ph), rewritten by the double
    // angle identity into a form that integrates in closed form. The petal
    // drops fastest mid-slip and nearly hangs at either extreme.
    float y = aOrigin.y
      - aWave.z * (${FALL_MEAN.toFixed(3)} * uTime
        + ${FALL_SWING.toFixed(3)} * (sin(2.0 * ph) - sin(2.0 * seed)) / (2.0 * freq))
      + uBreeze * ${GUST_LIFT.toFixed(2)} * gust;

    x = mod(x + uWrap.x, 2.0 * uWrap.x) - uWrap.x;
    y = mod(y + uWrap.y, 2.0 * uWrap.y) - uWrap.y;

    // Flow around the paintings.
    //
    // AFTER the wrap, deliberately: the rectangles are measured in screen space
    // and a petal's screen position is only settled once it has folded. A push
    // can carry a petal a little outside the wrap box, which is harmless — the
    // box already carries MARGIN_X/Y of slack for exactly this kind of overshoot.
    //
    // No 'break' in the loop and no dynamic bound: GLSL ES 1.00 requires a
    // constant iteration count, so the tail is masked out with 'step' instead.
    // Eight iterations of this is nothing next to the texture fetch.
    vec2 pos = vec2(x, y);
    for (int i = 0; i < ${AVOID_MAX}; i++) {
      vec4 rect = uAvoid[i];
      // 'inUse', not 'active': 'active' is a reserved word in GLSL ES, and
      // with it the whole material silently failed to compile — which took the
      // petals off the page entirely rather than just skipping the deflection.
      float inUse = step(float(i) + 0.5, float(uAvoidCount));
      vec2 d = pos - rect.xy;
      // Signed distance to the rectangle: negative inside, positive outside.
      vec2 q = abs(d) - rect.zw;
      float outside = max(q.x, q.y);
      float push = (1.0 - smoothstep(-uAvoidSoft, uAvoidSoft, outside)) * inUse;
      pos += (d / max(length(d), 0.0001)) * push * uAvoidPush;
    }
    x = pos.x;
    y = pos.y;

    // Tilt is phase locked to the sway, so the petal banks into each slip
    // rather than tumbling independently of where it is going.
    float cph = cos(ph);
    float tilt = 0.25 + aSpin.x * cph;
    float tumble = aSpin.y + aSpin.z * uTime;

    float ct = cos(tilt);
    float st = sin(tilt);
    float cz = cos(tumble);
    float sz = sin(tumble);

    vec3 local = position * aSpin.w * uScale;
    local = vec3(local.x, local.y * ct - local.z * st, local.y * st + local.z * ct);
    local = vec3(local.x * cz - local.y * sz, local.x * sz + local.y * cz, local.z);

    vUv = uv;
    vTint = aTint;
    // Dim toward edge-on, where a real petal shows almost no face.
    vShade = 0.72 + 0.28 * abs(ct);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(vec3(x, y, aOrigin.z) + local, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;

  varying vec3 vTint;
  varying float vShade;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(uMap, vUv);
    // Normal alpha blending, never additive: additive over the cream grounds
    // adds toward white and the petal vanishes. Same reason Butterflies gives.
    if (texel.a < ${ALPHA_TEST.toFixed(2)}) discard;
    gl_FragColor = vec4(texel.rgb * vTint * vShade, texel.a * ${OPACITY.toFixed(2)});
    #include <colorspace_fragment>
  }
`

/**
 * Wind-blown petals — the system that used to be `Pollen`.
 *
 * Every position is computed analytically in the vertex shader from `uTime` and
 * per-instance seeds, which removes the per-frame CPU loop and the
 * `needsUpdate` upload the points field needed. The CPU now writes `uTime` and
 * `uSlide` per frame and nothing else, whatever the count.
 *
 * Density drops to 25% on compact layouts; the count arrives as a prop so the
 * caller owns that decision.
 */
export const Petals = ({ count, frozen, near = false }: Props) => {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const viewport = useThree((s) => s.viewport)
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)

  const wrapX = viewport.width / 2 + MARGIN_X
  const wrapY = viewport.height / 2 + MARGIN_Y

  /**
   * `SRGBColorSpace` for the same reason the wing maps need it: without it the
   * bytes are treated as linear, the mid-tones wash out, and the
   * `<colorspace_fragment>` include encodes them a second time.
   *
   * The `invalidate` on load is what keeps the reduced-motion frieze correct.
   * This texture used to be drawn synchronously into a canvas and was ready
   * before the first render; a PNG is not, and under `frameloop: 'demand'` the
   * single frieze frame would otherwise be drawn untextured and never redrawn.
   */
  const texture = useMemo(() => {
    const loaded = new THREE.TextureLoader().load(petalUrl, () => invalidate())
    loaded.colorSpace = THREE.SRGBColorSpace
    loaded.anisotropy = gl.capabilities.getMaxAnisotropy()
    return loaded
  }, [gl, invalidate])

  /**
   * A resize re-scatters the field, as a count change already did. Deliberate:
   * it is the only way the wrap box can follow a new aspect, and a reshuffle of
   * petals behind the page costs less than carrying normalised coordinates
   * through the analytic drift.
   */
  const geometry = useMemo(() => {
    const g = petalGeometry()
    const a = instanceAttributes(count, wrapX, wrapY)
    g.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(a.aOrigin, 3))
    g.setAttribute('aWave', new THREE.InstancedBufferAttribute(a.aWave, 4))
    g.setAttribute('aSpin', new THREE.InstancedBufferAttribute(a.aSpin, 4))
    g.setAttribute('aTint', new THREE.InstancedBufferAttribute(a.aTint, 3))
    return g
  }, [count, wrapX, wrapY])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 1 },
          uBreeze: { value: 1 },
          uSlide: { value: 0 },
          uWrap: { value: new THREE.Vector2() },
          uMap: { value: texture },
          // One Vector4 per slot, allocated once and mutated in place — a fresh
          // array every frame would churn far more than the drift ever does.
          uAvoid: { value: Array.from({ length: AVOID_MAX }, () => new THREE.Vector4()) },
          uAvoidCount: { value: 0 },
          /**
           * How hard a petal is pushed out, and how wide the falloff is, both in
           * world units.
           *
           * These were 0.55 and 0.85, which cleared the visible field. At a 45°
           * fov from z=10 the frame is only about 13 x 8 world units, a painting
           * is roughly 1.8 of those across, and six of them each pushing 0.55
           * over a 0.85 band adds to a repulsion covering most of the screen:
           * every petal ended up stacked along the edges. A quarter of that
           * reads as what it should — petals easing around a painting's edge
           * rather than being swept off it.
           */
          uAvoidPush: { value: 0.22 },
          uAvoidSoft: { value: 0.45 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [texture],
  )

  // The wrap box follows the viewport without rebuilding the material.
  useEffect(() => {
    ;(material.uniforms.uWrap!.value as THREE.Vector2).set(wrapX, wrapY)
  }, [material, wrapX, wrapY])

  // Set here rather than in the uniform defaults: the material is memoised on
  // [texture] alone, so a default would not follow a change of layer.
  useEffect(() => {
    material.uniforms.uScale!.value = near ? NEAR_SCALE : 1
  }, [material, near])

  // Built imperatively and passed via `args`/uniforms, so r3f owns none of it
  // (invariant 4). Every crossing of the compact breakpoint remounts this.
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
      texture.dispose()
    }
  }, [geometry, material, texture])

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m || frozen) return
    const u = (m.material as THREE.ShaderMaterial).uniforms
    u.uTime!.value += delta
    // Scroll nudges the whole field sideways - petals carried by the same
    // current the flock rides.
    // The near layer rides the same current, harder — parallax by speed.
    u.uSlide!.value = frame.progress * -SLIDE_X * (near ? NEAR_SLIDE : 1)

    // Artwork rectangles, NDC → the petals' own world units. The field
    // publishes NDC because that is the one space the DOM and the canvas agree
    // on without either knowing the other's scale; half the viewport in world
    // units is what turns it back into something the drift can be measured
    // against. Same basis as `uWrap`, which is why they stay in register
    // through a resize.
    if (near) {
      u.uAvoidCount!.value = 0
      return
    }

    const rects = getAvoidRects()
    const slots = u.uAvoid!.value as THREE.Vector4[]
    const halfW = viewport.width / 2
    const halfH = viewport.height / 2
    const n = Math.min(rects.length, AVOID_MAX)
    for (let i = 0; i < n; i++) {
      const [cx, cy, hw, hh] = rects[i]!
      slots[i]!.set(cx * halfW, cy * halfH, hw * halfW, hh * halfH)
    }
    u.uAvoidCount!.value = n
  })

  /**
   * Reduced motion, mirroring the frieze in `Butterflies`. `frameloop: 'demand'`
   * does not stop `useFrame`, so what holds this still is the `|| frozen`
   * early return above; this effect only sets the single frame that gets drawn.
   */
  useEffect(() => {
    if (!frozen) return
    const m = mesh.current
    if (!m) return
    const u = (m.material as THREE.ShaderMaterial).uniforms
    u.uTime!.value = FRIEZE_TIME
    u.uSlide!.value = frame.progress * -SLIDE_X
    invalidate()
  }, [frozen, invalidate])

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />
}
