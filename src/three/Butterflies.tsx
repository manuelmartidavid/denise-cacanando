import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp01, flockAt, waypointsFrom, type Waypoint } from './flock'
import { LABELS } from '~/scroll/scenes'
import { getLabelOffset } from '~/scroll/timeline'
import { frame } from '~/scroll/store'
// Imported rather than referenced as a `/textures/...` string so Vite hashes
// them into the build and a renamed file fails the build instead of failing
// silently at runtime. They stay in the repo-root `textures/` folder beside the
// preview they were authored against; only these two are runtime assets.
//
// The `-256` suffix matters: these are downscales of the 1024px masters sitting
// next to them, which are kept as the source art and are NOT imported. A
// butterfly covers roughly 40px on a 1440px screen, so 256 is already several
// times the sampled resolution, and the masters cost 574KB against these 84KB.
// Re-export from the masters if the flock ever gets much larger on screen.
import wingRoseUrl from '../../textures/butterfly-wing-rose-256.png'
import wingBlueUrl from '../../textures/butterfly-wing-blue-256.png'

type Props = {
  count: number
  frozen: boolean
}

/**
 * `THREE.Color` cannot parse `oklch`, so the one token this system still reads
 * as a colour is converted once. Keep the token name — if `index.css` changes,
 * this must be recomputed by hand.
 *
 * The wings were ochre-bright and sage, then flat white and pink; they are now
 * textured from the two painted wing maps below, at Denise's direction. That is
 * a deliberate departure from the palette rather than a drift: rose and blue
 * are not accents of the ochre/cream system, and README §41's "sage, used
 * sparingly in flock only" no longer describes anything — the flock was sage's
 * only consumer, so `--color-sage` is now unreferenced.
 */
const BARK = '#4a3524' // --color-bark, authored as hex for this reason

/**
 * Share of the flock on the blue wing rather than the rose one. A hard `step`
 * on the per-instance `aTint`, so there is no blending between the two maps —
 * a butterfly is one or the other. Rose is the majority at Denise's direction;
 * at a 15-instance flock this is about 10 rose to 5 blue.
 */
const BLUE_SHARE = 1 / 3

/**
 * Tuning table from the spec §5. Observed with the canvas temporarily lifted
 * above the page content via a disclosed, uncommitted `z-index` change (defect
 * (a) occludes it otherwise) and with `frame.progress` driven directly (defect
 * (b) saturates it past scrollY 5400). Neither workaround is in this file.
 *
 * `RADIUS_WIDE` is the one value the spec got badly wrong, because it was
 * authored against the 22 x 14 scatter box `Pollen.tsx` used to hardcode rather
 * than against the camera. That box is gone — Pollen now reads the frustum from
 * r3f's `viewport` — but these figures predate the fix and are unaffected by it:
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
 * That warning has now come due. `FULL_FLOCK` is 15, not 1,200, and 32 kept
 * roughly *one* instance in frame at `gather: 0` — invisible, and the reason
 * the flock could not be judged on screen at all. Recognizable butterflies make
 * that worse rather than better: they are large enough that a near-empty frame
 * reads as a bug. PROVISIONAL at 10 so the silhouette can be seen; the residue
 * character this docstring describes is measured for real in the scale/count
 * pass, together with `FULL_FLOCK` and `aScale`.
 */
const RADIUS_WIDE = 10
const RADIUS_TIGHT = 3.5

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
const FLAP_FULL = 1.15
const FLAP_IDLE = 0.06

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
 * That frame was never the 22 x 14 box `Pollen.tsx` used to hardcode — that
 * number was Pollen's own constant, not a measurement, and it no longer exists.
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
  }

  return { aOffset, aPhase, aSpeed, aTint, aScale }
}

const VERTEX = /* glsl */ `
  uniform vec3 uTarget;
  uniform float uGather;
  uniform float uSettle;
  uniform float uTime;

  attribute vec3 aOffset;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aTint;
  attribute float aScale;
  attribute float aWing;
  attribute vec2 aUv;

  varying float vAlpha;
  varying float vBody;
  varying float vBlue;
  varying vec2 vUv;

  void main() {
    // One scalar drives both spread and opacity, so "thins to a residue" cannot
    // drift out of sync with "gathers".
    vec3 centre = uTarget + aOffset * mix(${RADIUS_WIDE.toFixed(1)}, ${RADIUS_TIGHT.toFixed(1)}, uGather);

    float drift = 1.0 - uSettle;
    centre.x += sin(uTime * aSpeed * 0.6 + aPhase) * 0.6 * drift;
    centre.y += cos(uTime * aSpeed * 0.45 + aPhase) * 0.4 * drift;

    float flap = sin(uTime * aSpeed + aPhase) * mix(${FLAP_FULL.toFixed(2)}, ${FLAP_IDLE.toFixed(2)}, uSettle);
    float c = cos(flap * aWing);
    float s = sin(flap * aWing);

    vec3 p = position * aScale;
    vec3 wing = vec3(p.x * c, p.y, -p.x * s);

    vUv = aUv;
    vAlpha = mix(${ALPHA_THIN.toFixed(2)}, ${ALPHA_DENSE.toFixed(2)}, uGather);
    // Resolved per instance here rather than per fragment: it is constant over
    // the whole butterfly, so the step belongs in the cheaper stage.
    vBlue = step(${(1 - BLUE_SHARE).toFixed(4)}, aTint);
    // 1 on the body triple (aWing = 0), 0 on either wing. Constant across each
    // triangle — no triangle mixes body and wing vertices — so nothing bleeds.
    vBody = 1.0 - abs(aWing);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(centre + wing, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform sampler2D uWingRose;
  uniform sampler2D uWingBlue;
  uniform vec3 uBark;

  varying float vAlpha;
  varying float vBody;
  varying float vBlue;
  varying vec2 vUv;

  void main() {
    // Both maps are sampled and one is thrown away by the mix, which keeps the
    // whole flock a single draw call — the alternative is splitting it into a
    // rose mesh and a blue mesh. Two texture fetches a fragment is the cheaper
    // half of that trade at this instance count.
    vec3 wing = mix(texture2D(uWingRose, vUv).rgb, texture2D(uWingBlue, vUv).rgb, vBlue);
    gl_FragColor = vec4(mix(wing, uBark, vBody), vAlpha);
    #include <colorspace_fragment>
  }
`

/**
 * The one live-reading line, mirroring `activePieces` in `scenes.ts`. It lives
 * here rather than in `flock.ts` because `getLabelOffset` comes from
 * `scroll/timeline`, which registers GSAP at import time — and `flock.ts` has
 * to stay loadable in a node test (invariant 6).
 *
 * Importing a non-GSAP helper from `timeline.ts` does not breach invariant 2;
 * `SideRail`, `Dial` and `Track` all do the same.
 */
const activeWaypoints = (): Waypoint[] =>
  waypointsFrom(
    LABELS.map((label) => getLabelOffset(label)),
    document.documentElement.scrollHeight - window.innerHeight,
  )

/**
 * The instanced butterfly flock — README §184.
 *
 * Every instance is placed in the vertex shader from four uniforms, so the CPU
 * writes four values per frame rather than one matrix per instance, whatever
 * the count. `instanceMatrix` is
 * never used, which is also why frustum culling is off: three would cull
 * against a bounding box the shader ignores.
 *
 * Alpha blending, not the additive blending `Pollen` uses. Additive over g4's
 * cream ground adds toward white and vanishes; butterflies are solid marks.
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
    return { rose: load(wingRoseUrl), blue: load(wingBlueUrl) }
  }, [gl, invalidate])

  const geometry = useMemo(() => {
    const g = butterflyGeometry()
    const a = instanceAttributes(count)
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(a.aOffset, 3))
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(a.aPhase, 1))
    g.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(a.aSpeed, 1))
    g.setAttribute('aTint', new THREE.InstancedBufferAttribute(a.aTint, 1))
    g.setAttribute('aScale', new THREE.InstancedBufferAttribute(a.aScale, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uTarget: { value: new THREE.Vector3() },
          uGather: { value: 0 },
          uSettle: { value: 0 },
          uTime: { value: 0 },
          uWingRose: { value: textures.rose },
          uWingBlue: { value: textures.blue },
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
      textures.rose.dispose()
      textures.blue.dispose()
    }
  }, [geometry, material, textures])

  const waypoints = useRef<Waypoint[]>([])
  const measured = useRef(0)

  /** Writes the three driven uniforms for a given whole-document progress. */
  const place = (progress: number) => {
    const m = mesh.current
    if (!m) return
    const u = (m.material as THREE.ShaderMaterial).uniforms
    const { target, gather, settle } = flockAt(waypoints.current, progress)
    ;(u.uTarget!.value as THREE.Vector3).set(target[0], target[1], target[2])
    u.uGather!.value = gather
    u.uSettle!.value = settle
  }

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m || frozen) return

    // Label offsets only move when the document height moves: pin lengths are
    // count-independent, so a merch chip re-blooming the ring does not shift
    // them. This read itself is not free — it forces layout on a DOM GSAP has
    // just dirtied — and it runs unconditionally, every frame, regardless of
    // the gate below. What the gate avoids is the cheap half: rebuilding seven
    // waypoints (seven Map lookups, seven allocations) 60 times a second when
    // the height hasn't actually changed.
    const height = document.documentElement.scrollHeight
    if (height !== measured.current) {
      const next = activeWaypoints()
      if (next.length) {
        measured.current = height
        waypoints.current = next
      }
    }

    ;(m.material as THREE.ShaderMaterial).uniforms.uTime!.value += delta
    place(frame.progress)
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
      waypoints.current = activeWaypoints()
      place(frame.progress)
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
