import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
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

type Props = {
  count: number
  frozen: boolean
}

/**
 * Petal tints. Invariant 6 restricts this system to palette tokens but
 * explicitly allows petals "soft variations of ochre/cream tones", which is
 * what these are: the first is `--color-ochre-bright` exactly, the rest are
 * warm neighbours of it. They stay here rather than in `index.css` because CSS
 * never reads them and five canvas-only entries would be noise in the token
 * table. Promote them if the DOM ever needs the same five.
 */
const TINTS = ['#e8b181', '#dfa06c', '#e6c39a', '#d99a83', '#f0dcbd']

/** Base and tip of the painted petal gradient. */
const PETAL_BASE = '#cdbea8'
const PETAL_TIP = '#fdfaf5'

/** Petal dimensions in world units, long axis along x. */
const PETAL_LONG = 0.6
const PETAL_SHORT = 0.34

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
 * A soft teardrop with a base-to-tip luminance gradient, drawn once into a
 * 128px canvas rather than shipped as an asset — it is a gradient inside a
 * four-curve outline, and generating it costs less than the HTTP request.
 *
 * The blur is load-bearing. The PNG wing maps get their silhouette from
 * geometry, but a petal is a flat quad, so its shape has to come from alpha.
 * A hard-edged fill against `ALPHA_TEST` gives a stair-stepped rim on a shape
 * this small; blurring first makes the test bite gradually.
 */
const petalTexture = (): THREE.CanvasTexture => {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const gradient = ctx.createLinearGradient(10, 0, 120, 0)
  gradient.addColorStop(0, PETAL_BASE)
  gradient.addColorStop(1, PETAL_TIP)

  ctx.filter = 'blur(2.5px)'
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(10, 64)
  ctx.bezierCurveTo(28, 14, 88, 20, 120, 64)
  ctx.bezierCurveTo(88, 108, 28, 114, 10, 64)
  ctx.closePath()
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * A gently curled plane. The curl is baked into the vertices rather than
 * applied per frame: it never changes, and a flat quad catches the light of the
 * tilt as one hard facet, which reads as paper rather than petal.
 */
const petalGeometry = (): THREE.PlaneGeometry => {
  const geometry = new THREE.PlaneGeometry(PETAL_LONG, PETAL_SHORT, 5, 3)
  const position = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const across = (2 * y) / PETAL_SHORT
    position.setZ(i, 0.085 * Math.cos((Math.PI * x) / PETAL_LONG) + 0.045 * across * across)
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
    aSpin[i * 4 + 3] = near ? 0.4 + Math.random() * 0.6 : 0.1 + Math.random() * 0.6

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

    // Tilt is phase locked to the sway, so the petal banks into each slip
    // rather than tumbling independently of where it is going.
    float cph = cos(ph);
    float tilt = 0.25 + aSpin.x * cph;
    float tumble = aSpin.y + aSpin.z * uTime;

    float ct = cos(tilt);
    float st = sin(tilt);
    float cz = cos(tumble);
    float sz = sin(tumble);

    vec3 local = position * aSpin.w;
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
export const Petals = ({ count, frozen }: Props) => {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const viewport = useThree((s) => s.viewport)
  const invalidate = useThree((s) => s.invalidate)

  const wrapX = viewport.width / 2 + MARGIN_X
  const wrapY = viewport.height / 2 + MARGIN_Y

  const texture = useMemo(petalTexture, [])

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
          uBreeze: { value: 1 },
          uSlide: { value: 0 },
          uWrap: { value: new THREE.Vector2() },
          uMap: { value: texture },
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
    u.uSlide!.value = frame.progress * -SLIDE_X
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
