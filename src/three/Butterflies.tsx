import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { flockAt, waypointsFrom, type Waypoint } from './flock'
import { LABELS } from '~/scroll/scenes'
import { getLabelOffset } from '~/scroll/timeline'
import { frame } from '~/scroll/store'

type Props = {
  count: number
  frozen: boolean
}

/**
 * `THREE.Color` cannot parse `oklch`, so the two tokens this system uses are
 * converted once. Keep the token name — if `index.css` changes, these must be
 * recomputed by hand.
 */
const OCHRE_BRIGHT = '#e8b181' // --color-ochre-bright, oklch(0.8 0.09 62)
const SAGE = '#63ab74' //         --color-sage,         oklch(0.68 0.11 150)

/** README §41 restricts sage to the flock and says "sparingly". */
const SAGE_SHARE = 1 / 6

/**
 * Tuning table from the spec §5. Observed with the canvas temporarily lifted
 * above the page content via a disclosed, uncommitted `z-index` change (defect
 * (a) occludes it otherwise) and with `frame.progress` driven directly (defect
 * (b) saturates it past scrollY 5400). Neither workaround is in this file.
 *
 * `RADIUS_WIDE` is the one value the spec got badly wrong, because it was
 * authored against `Pollen`'s 22 x 14 scatter box rather than the camera. The
 * real frustum at z = 0 is only about 13.1 x 8.3 (see `instanceAttributes`), so
 * a radius of 13 leaves the frame sampling the dense core of the cloud: ~300-456
 * of the 1,200 instances stayed on screen at `gather: 0` and the "thin residue"
 * reads as an all-over dusting that crowds the ring. 32 leaves ~110-145 on
 * screen across the seven attractors — still a minority of the flock, and
 * enough thinner than R=13 to read as residue rather than dusting, though not
 * as sparse as the mockups draw. See `flock.ts`'s `ATTRACTORS` docstring for
 * why that residue does not read as biased toward any one attractor.
 */
const RADIUS_WIDE = 32
const RADIUS_TIGHT = 3.5
const ALPHA_THIN = 0.3
const ALPHA_DENSE = 0.85
const FLAP_FULL = 1.15
const FLAP_IDLE = 0.06

/**
 * Six vertices: two triangles sharing a hinge edge at x = 0, each apexed at
 * y = 0 so the pair reads as a rhombus. `aWing` is -1 on the left triple and
 * +1 on the right, so one `sin` drives both wings in opposite directions.
 *
 * The apex placement is load-bearing, not a saving. The only rotation is about
 * y, which scales x by cos(flap) and never touches y — so a quad with corners
 * (±1, ±0.6) stays an axis-aligned rectangle at every flap value and can never
 * read as the rotated square README §227 requires.
 *
 * The camera is fixed (Stage.tsx), so nothing is billboarded: the flap's
 * foreshortening supplies the motion.
 */
const wingGeometry = (): THREE.BufferGeometry => {
  const g = new THREE.BufferGeometry()
  const position = new Float32Array([
    0, -0.6, 0, 0, 0.6, 0, -1, 0, 0, // left
    0, -0.6, 0, 0, 0.6, 0, 1, 0, 0, //  right
  ])
  const aWing = new Float32Array([-1, -1, -1, 1, 1, 1])
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setAttribute('aWing', new THREE.BufferAttribute(aWing, 1))
  // Both faces wind to +z; DoubleSide makes it moot, but keep them consistent.
  g.setIndex([0, 1, 2, 3, 5, 4])
  return g
}

/**
 * Per-instance variation. `cbrt` on the radius spreads instances evenly through
 * the volume instead of clumping them at the centre, and y is squashed to 0.62
 * so the cloud matches the frame's proportions.
 *
 * That frame is NOT the 22 x 14 box `Pollen.tsx` scatters across — that number
 * is Pollen's own hardcoded constant, not a measurement. With the camera at
 * z:10 / fov:45 (`Stage.tsx`) the frustum at the z = 0 plane is about 8.3 tall
 * and 13.1 wide at 1440x900, so half-extents are roughly 6.55 x 4.14. Every
 * radius below is in those units; 8.3 / 13.1 = 0.63 is where 0.62 comes from.
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
    aOffset[i * 3 + 2] = z * r * 0.25

    aPhase[i] = Math.random() * Math.PI * 2
    aSpeed[i] = 5 + Math.random() * 4
    aTint[i] = Math.random()
    aScale[i] = 0.05 + Math.random() * 0.045
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

  varying float vTint;
  varying float vAlpha;

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

    vTint = aTint;
    vAlpha = mix(${ALPHA_THIN.toFixed(2)}, ${ALPHA_DENSE.toFixed(2)}, uGather);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(centre + wing, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec3 uOchre;
  uniform vec3 uSage;

  varying float vTint;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(mix(uOchre, uSage, step(${(1 - SAGE_SHARE).toFixed(4)}, vTint)), vAlpha);
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
 * writes four values per frame rather than 1,200 matrices. `instanceMatrix` is
 * never used, which is also why frustum culling is off: three would cull
 * against a bounding box the shader ignores.
 *
 * Alpha blending, not the additive blending `Pollen` uses. Additive over g4's
 * cream ground adds toward white and vanishes; butterflies are solid marks.
 */
export const Butterflies = ({ count, frozen }: Props) => {
  const mesh = useRef<THREE.InstancedMesh>(null)

  const geometry = useMemo(() => {
    const g = wingGeometry()
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
          uOchre: { value: new THREE.Color(OCHRE_BRIGHT) },
          uSage: { value: new THREE.Color(SAGE) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )

  // `geometry` and `material` are built imperatively and passed via `args`, so
  // r3f does not own or dispose them — only the attached `instancedMesh` and
  // its `instanceMatrix` get that treatment automatically. Without this, every
  // crossing of the compact breakpoint (which mounts/unmounts `Butterflies`)
  // leaks a `BufferGeometry` and a compiled shader program.
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  const waypoints = useRef<Waypoint[]>([])
  const measured = useRef(0)
  const invalidate = useThree((s) => s.invalidate)

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
