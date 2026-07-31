# Butterfly Flock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the instanced butterfly flock — the second of the r3f stage's three systems — driven by whole-document scroll progress through a pure, tested motion module.

**Architecture:** A pure `flock.ts` maps scroll progress to `{ target, gather, settle }` against seven measured waypoints, one per timeline label. `Butterflies.tsx` mounts one `instancedMesh` whose vertex shader places all 1,200 instances from four uniforms, so per-frame CPU work is O(1) rather than 1,200 matrix writes. No GSAP MotionPath; no new dependencies.

**Tech Stack:** React 19 · react-three-fiber 9 · three 0.185 · Vitest (node environment) · TypeScript

**Spec:** `docs/superpowers/specs/2026-07-31-butterfly-flock-design.md`

## Global Constraints

- **Invariant 2 — GSAP lives only in `src/scroll/timeline.ts`.** No file created here may import `gsap` or `ScrollTrigger`. Importing non-GSAP helpers *from* `timeline.ts` is fine and already done by `SideRail`, `Dial` and `Track`.
- **Invariant 6 — Vitest is `environment: 'node'`, `include: ['src/**/*.test.ts']`. No DOM, no jsdom, no component tests.** Every test in this plan is a pure-function test. Consequently **`src/three/flock.ts` must never import `~/scroll/timeline`**, which imports GSAP at module scope — the test file imports `flock.ts` directly.
- **Invariant 4 — counts and offsets are never hardcoded in a view.** The known-good scene offsets (1800 / 5580 / 8460 / 11520) are a regression baseline, not constants to embed.
- **Invariant 1 — the frame channel never enters React state.** `Butterflies` reads `frame.progress` inside `useFrame` only, never in render.
- `THREE.Color` cannot parse `oklch`. Design tokens are converted to sRGB hex once and carry a comment naming the token they came from.
- Existing verification bar, all of which must still hold at the end: typecheck clean · **93 existing tests pass** · `npm run build` succeeds · console clean apart from the known three.js `Clock` deprecation.
- Commands: `npm run dev` (:5173) · `npm test` · `npm run typecheck` · `npm run build`

## File Structure

| File | Task | Responsibility |
| --- | --- | --- |
| `src/three/flock.ts` | 1, 2 | Pure motion rule + attractor table. No three.js, no React, no GSAP. |
| `src/three/flock.test.ts` | 1, 2 | Pure tests, node environment. |
| `src/three/Butterflies.tsx` | 3, 4 | One `instancedMesh`, shader, live waypoint read, frame loop. |
| `src/three/Stage.tsx` | 3 | Mount `Butterflies`; retire the SCAFFOLD paragraph. |
| `src/scroll/store.ts` | 4 | Delete the unused `frame.attractor` field. |

---

### Task 1: The pure motion rule

**Files:**
- Create: `src/three/flock.ts`
- Test: `src/three/flock.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Vec3 = [number, number, number]` · `type Waypoint = { at: number; target: Vec3 }` · `type FlockState = { target: Vec3; gather: number; settle: number }` · `flockAt(waypoints: Waypoint[], progress: number): FlockState`

- [ ] **Step 1: Write the failing test**

Create `src/three/flock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { flockAt, type Waypoint } from './flock'

/** Four waypoints is enough to exercise interior seams and the final leg. */
const WPS: Waypoint[] = [
  { at: 0, target: [-8, -4, -1] },
  { at: 0.2, target: [4, 1, 0] },
  { at: 0.5, target: [-7, 3, -2] },
  { at: 0.9, target: [0, -5, 0] },
]

describe('flockAt', () => {
  it('returns a waypoint own target at that waypoint at', () => {
    expect(flockAt(WPS, 0).target).toEqual([-8, -4, -1])
    expect(flockAt(WPS, 0.2).target).toEqual([4, 1, 0])
    expect(flockAt(WPS, 0.5).target).toEqual([-7, 3, -2])
    expect(flockAt(WPS, 0.9).target).toEqual([0, -5, 0])
  })

  it('gathers to 0 at every waypoint and peaks at 1 mid-gap', () => {
    for (const w of WPS) expect(flockAt(WPS, w.at).gather).toBeCloseTo(0, 6)
    expect(flockAt(WPS, 0.1).gather).toBeCloseTo(1, 6)
    expect(flockAt(WPS, 0.35).gather).toBeCloseTo(1, 6)
    expect(flockAt(WPS, 0.7).gather).toBeCloseTo(1, 6)
  })

  it('is continuous across the whole sweep, including at seams', () => {
    const STEP = 0.001
    let prev = flockAt(WPS, 0)
    for (let p = STEP; p <= 1; p += STEP) {
      const next = flockAt(WPS, p)
      for (let axis = 0; axis < 3; axis++) {
        expect(Math.abs(next.target[axis]! - prev.target[axis]!)).toBeLessThan(0.5)
      }
      expect(Math.abs(next.gather - prev.gather)).toBeLessThan(0.05)
      expect(Math.abs(next.settle - prev.settle)).toBeLessThan(0.05)
      prev = next
    }
  })

  it('clamps outside 0..1 rather than extrapolating', () => {
    expect(flockAt(WPS, -0.5).target).toEqual([-8, -4, -1])
    expect(flockAt(WPS, 1.5).target).toEqual([0, -5, 0])
    for (const p of [-0.5, 0, 0.42, 1, 1.5]) {
      const s = flockAt(WPS, p)
      expect(Number.isFinite(s.gather)).toBe(true)
      expect(Number.isFinite(s.settle)).toBe(true)
      expect(s.target.every(Number.isFinite)).toBe(true)
    }
  })

  it('settles only across the final leg', () => {
    expect(flockAt(WPS, 0.1).settle).toBe(0)
    expect(flockAt(WPS, 0.49).settle).toBe(0)
    expect(flockAt(WPS, 0.5).settle).toBe(0)
    expect(flockAt(WPS, 0.7).settle).toBeCloseTo(0.5, 6)
    expect(flockAt(WPS, 1).settle).toBe(1)
  })

  it('degrades safely on empty and single-waypoint lists', () => {
    // getLabelOffset returns undefined until the first refresh, so a short list
    // is a real mount-time state.
    expect(flockAt([], 0.5)).toEqual({ target: [0, 0, 0], gather: 0, settle: 0 })
    const one: Waypoint[] = [{ at: 0.3, target: [1, 2, 3] }]
    expect(flockAt(one, 0.9)).toEqual({ target: [1, 2, 3], gather: 0, settle: 0 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/three/flock.test.ts`
Expected: FAIL — cannot resolve `./flock`.

- [ ] **Step 3: Write the implementation**

Create `src/three/flock.ts`:

```ts
/**
 * Flock geometry — pure. No three.js, no React, and deliberately no import of
 * `~/scroll/timeline`: that module registers GSAP at import time and this file
 * has to stay loadable in Vitest's node environment (invariant 6). The live
 * read of label offsets therefore stops in `Butterflies.tsx`.
 *
 * README §175 specifies GSAP MotionPath here. It is not used — see
 * `docs/superpowers/specs/2026-07-31-butterfly-flock-design.md` §2.
 */

export type Vec3 = [number, number, number]

/** `at` is whole-document scroll progress, 0–1. `target` is canvas world space. */
export type Waypoint = { at: number; target: Vec3 }

export type FlockState = {
  target: Vec3
  /** 0 at a waypoint (thinned residue), 1 mid-gap (dense migrating cloud). */
  gather: number
  /** 0 until the final leg, 1 at the end. Damps drift and wing flap. */
  settle: number
}

const ORIGIN: Vec3 = [0, 0, 0]

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/**
 * Where the flock is heading, and how tightly, at a given scroll progress.
 *
 * `gather` is `sin(pi * t)` across each leg, which is what makes it exactly 0 at
 * both ends of every leg — so the seam between two legs is continuous by
 * construction rather than by a matching pair of hand-tuned endpoints.
 */
export const flockAt = (waypoints: Waypoint[], progress: number): FlockState => {
  if (waypoints.length === 0) return { target: ORIGIN, gather: 0, settle: 0 }

  const first = waypoints[0]!
  if (waypoints.length === 1) return { target: first.target, gather: 0, settle: 0 }

  const last = waypoints[waypoints.length - 1]!
  const p = clamp01(progress)

  if (p <= first.at) return { target: first.target, gather: 0, settle: 0 }
  // Past the last waypoint the flock has landed and holds — README §148.
  if (p >= last.at) return { target: last.target, gather: 0, settle: 1 }

  let i = 0
  while (i < waypoints.length - 2 && waypoints[i + 1]!.at <= p) i++

  const a = waypoints[i]!
  const b = waypoints[i + 1]!
  const span = b.at - a.at
  const t = span > 0 ? (p - a.at) / span : 0

  return {
    target: lerp3(a.target, b.target, t),
    gather: Math.sin(Math.PI * t),
    settle: i === waypoints.length - 2 ? t : 0,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/three/flock.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: 99 tests pass (93 existing + 6 new), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/three/flock.ts src/three/flock.test.ts
git commit -m "feat: pure flock motion rule mapping scroll progress to target, gather and settle"
```

---

### Task 2: Attractors and measured waypoints

**Files:**
- Modify: `src/three/flock.ts` (append)
- Test: `src/three/flock.test.ts` (append)

**Interfaces:**
- Consumes: `Vec3`, `Waypoint`, `clamp01` from Task 1.
- Produces: `ATTRACTORS: Record<Label, Vec3>` · `waypointsFrom(offsets: ReadonlyArray<number | undefined>, scrollable: number): Waypoint[]`

- [ ] **Step 1: Write the failing test**

First extend the existing imports at the **top** of `src/three/flock.test.ts` — the `./flock` import
gains two names, and `LABELS` is new:

```ts
import { ATTRACTORS, flockAt, waypointsFrom, type Waypoint } from './flock'
import { LABELS } from '~/scroll/scenes'
```

Then append the new block at the bottom:

```ts
describe('waypointsFrom', () => {
  const SEVEN = [0, 900, 1800, 5580, 8460, 11520, 14400]

  it('normalises every label offset against the scrollable height', () => {
    const wps = waypointsFrom(SEVEN, 15660)
    expect(wps).toHaveLength(7)
    expect(wps[0]!.at).toBe(0)
    expect(wps[3]!.at).toBeCloseTo(5580 / 15660, 6)
    expect(wps[6]!.at).toBeCloseTo(14400 / 15660, 6)
  })

  it('pairs each offset with its label attractor, in label order', () => {
    const wps = waypointsFrom(SEVEN, 15660)
    for (let i = 0; i < LABELS.length; i++) {
      expect(wps[i]!.target).toEqual(ATTRACTORS[LABELS[i]!])
    }
  })

  it('has one attractor per timeline label', () => {
    // README §184 says "one per scene", but the flock also has specified
    // behaviour at hero (§109) and contact (§148). Seven, not four.
    expect(Object.keys(ATTRACTORS).sort()).toEqual([...LABELS].sort())
  })

  it('returns nothing until every label has registered', () => {
    const partial = [0, 900, undefined, 5580, 8460, 11520, 14400]
    expect(waypointsFrom(partial, 15660)).toEqual([])
    expect(waypointsFrom([0, 900], 15660)).toEqual([])
    expect(waypointsFrom([], 15660)).toEqual([])
  })

  it('returns nothing when the document is not yet scrollable', () => {
    expect(waypointsFrom(SEVEN, 0)).toEqual([])
    expect(waypointsFrom(SEVEN, -1)).toEqual([])
  })

  it('clamps an offset that exceeds the scrollable height', () => {
    const wps = waypointsFrom(SEVEN, 10000)
    expect(wps[6]!.at).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/three/flock.test.ts`
Expected: FAIL — `ATTRACTORS` and `waypointsFrom` are not exported.

- [ ] **Step 3: Write the implementation**

Add this import to the top of `src/three/flock.ts` (`scenes.ts` imports only `~/data` and `./store`, so it is safe in a node test — unlike `timeline.ts`):

```ts
import { LABELS, type Label } from '~/scroll/scenes'
```

Append to `src/three/flock.ts`:

```ts
/**
 * One attractor per timeline label, in canvas world space. The camera sits at
 * z:10 / fov:45, so the visible frame is roughly 22 x 14 — the same box
 * `Pollen` scatters across.
 *
 * These live here rather than in `index.css` for the reason invariant 7 gives
 * for scene geometry: the motion rule computes with them, and CSS cannot.
 *
 * Sources: hero idles low-left, entering from the crop's edge (README §109);
 * about crosses the cream (§119); the gallery attractors sit outside the ring
 * (§131); contact is where the flock lands and stops (§148).
 */
export const ATTRACTORS: Record<Label, Vec3> = {
  hero: [-8, -4.2, -1],
  about: [4.5, 1.2, 0],
  g1: [-7, 3, -2],
  g2: [7, -2.4, -1],
  g3: [-6.2, -3, 0],
  g4: [6.4, 3.2, -2],
  contact: [0, -5, 0],
}

/**
 * Label offsets in document px -> waypoints in progress space.
 *
 * Offsets arrive in `LABELS` order and are recomputed on every
 * `ScrollTrigger.refresh()`, so nothing here is cached and the known-good
 * baseline offsets are never embedded (invariant 4).
 *
 * A partial set returns nothing rather than a shortened path: before the first
 * refresh some labels are unregistered, and interpolating across the gap would
 * fly the flock along a route that is wrong rather than merely absent.
 */
export const waypointsFrom = (
  offsets: ReadonlyArray<number | undefined>,
  scrollable: number,
): Waypoint[] => {
  if (scrollable <= 0 || offsets.length !== LABELS.length) return []

  const out: Waypoint[] = []
  for (let i = 0; i < LABELS.length; i++) {
    const offset = offsets[i]
    if (offset === undefined) return []
    out.push({ at: clamp01(offset / scrollable), target: ATTRACTORS[LABELS[i]!] })
  }
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/three/flock.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: 105 tests pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/three/flock.ts src/three/flock.test.ts
git commit -m "feat: seven measured flock attractors, one per timeline label"
```

---

### Task 3: The instanced mesh, mounted and static

Deliverable: a visible, still field of diamond-shaped marks. No scroll wiring yet — that is Task 4. Splitting here means a reviewer can reject the geometry without touching the motion, and vice versa.

**Files:**
- Create: `src/three/Butterflies.tsx`
- Modify: `src/three/Stage.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1–2 yet.
- Produces: `Butterflies` component, `type Props = { count: number }`. Its `ShaderMaterial` exposes uniforms `uTarget: THREE.Vector3`, `uGather: number`, `uSettle: number`, `uTime: number` for Task 4 to drive.

**`frozen` is deliberately not a prop yet.** It has no meaning until there is a frame loop to skip;
Task 4 adds both together. Accepting an unused prop here would be dead code that a reviewer would be
right to flag.

- [ ] **Step 1: Create the component**

Create `src/three/Butterflies.tsx`:

```tsx
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

type Props = {
  count: number
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

/** Tuning table from the spec §5. Expected to move during browser verification. */
const RADIUS_WIDE = 13
const RADIUS_TIGHT = 3.5
const ALPHA_THIN = 0.18
const ALPHA_DENSE = 0.85
const FLAP_FULL = 1.15
const FLAP_IDLE = 0.06

/**
 * Eight vertices: two quads sharing a hinge edge at x = 0. `aWing` is -1 on the
 * left pair and +1 on the right, so one `sin` drives both wings in opposite
 * directions.
 *
 * The camera is fixed (Stage.tsx), so nothing is billboarded: a folded pair
 * already reads as the rotated square README §227 requires, and the flap's
 * foreshortening supplies the motion.
 */
const wingGeometry = (): THREE.BufferGeometry => {
  const g = new THREE.BufferGeometry()
  const position = new Float32Array([
    0, -0.6, 0, 0, 0.6, 0, -1, 0.6, 0, -1, -0.6, 0, // left
    0, -0.6, 0, 0, 0.6, 0, 1, 0.6, 0, 1, -0.6, 0, //   right
  ])
  const aWing = new Float32Array([-1, -1, -1, -1, 1, 1, 1, 1])
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setAttribute('aWing', new THREE.BufferAttribute(aWing, 1))
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6])
  return g
}

/**
 * Per-instance variation. `cbrt` on the radius spreads instances evenly through
 * the volume instead of clumping them at the centre, and y is squashed to 0.62
 * because the visible frame is 22 wide by 14 tall.
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
export const Butterflies = ({ count }: Props) => {
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

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />
}
```

- [ ] **Step 2: Mount it**

In `src/three/Stage.tsx`, add the import beside the `Pollen` one:

```tsx
import { Butterflies } from './Butterflies'
```

Add the count constant beside `FULL_POLLEN`:

```tsx
const FULL_FLOCK = 1200
```

Replace the commented-out line 43 (`{/* <Butterflies count={compact ? 0 : 1200} frozen={reduced} /> */}`) with a conditional mount. A zero count would still allocate an `instancedMesh` and compile the shader program on exactly the devices with the least headroom:

```tsx
        <Pollen count={pollenCount} frozen={reduced} />
        {!compact && <Butterflies count={FULL_FLOCK} />}
        {/* <CentreSlot /> */}
```

`frozen` is not passed yet — Task 4 adds the prop and this argument together.

- [ ] **Step 3: Retire the SCAFFOLD paragraph**

In the `Stage` doc comment, replace this paragraph:

```
 * SCAFFOLD: only pollen exists so far. The flock (~1,200 instances, wing phase
 * in the vertex shader, one attractor per scene) is still to come. The centre
 * slot is DOM for now and cross-fades on snap — see sections/ring/CentreSlot.tsx,
 * which holds the seam the ripple/displacement shader replaces.
```

with:

```
 * SCAFFOLD: pollen and the flock exist; the centre slot does not. It is DOM for
 * now and cross-fades on snap — see sections/ring/CentreSlot.tsx, which holds
 * the seam the ripple/displacement shader replaces.
```

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both clean. `three` stays in its own lazy chunk; the flock adds shader strings only, no new dependency.

- [ ] **Step 5: Look at it**

Run: `npm run dev`, open `http://localhost:5173` **as the active tab**, and take a screenshot of the hero.

Expected: a wide, faint field of small marks across the frame — roughly 7–12px each at 1440px wide. They are still (no `uTime` yet) but each sits at a different fixed wing angle from its own `aPhase`, so they read as diamonds of varying width.

**Look at the screenshot, do not measure.** A collapsed or degenerate transform is invisible to `getComputedStyle` — that exact failure cost a cycle (handoff, defect 8). If the marks render as thin slivers or perfect rectangles rather than diamonds, the wing rotation is wrong.

Check the console: clean apart from the known three.js `Clock` deprecation. Any GLSL compile error surfaces here.

- [ ] **Step 6: Commit**

```bash
git add src/three/Butterflies.tsx src/three/Stage.tsx
git commit -m "feat: instanced butterfly geometry and shader, mounted on the stage"
```

---

### Task 4: Drive it from scroll

**Files:**
- Modify: `src/three/Butterflies.tsx`
- Modify: `src/three/Stage.tsx`
- Modify: `src/scroll/store.ts:67-81`

**Interfaces:**
- Consumes: `flockAt`, `waypointsFrom`, `type Waypoint` from `./flock`; `getLabelOffset` from `~/scroll/timeline`; `LABELS` from `~/scroll/scenes`; `frame` from `~/scroll/store`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Delete the dead store field**

In `src/scroll/store.ts`, remove the `attractor` field (lines 79–80):

```ts
  /** Which scene the flock is flying toward. */
  attractor: 0,
```

It was reserved for GSAP writing an attractor that r3f would read. The flock derives its own attractor from `progress` instead, so leaving the field would publish a permanently-zero value that reads as live state.

In the same file, update the channel doc comment (line 11) — `frame` no longer carries an attractor:

```ts
 *   `frame`  — continuous, every-frame. Rotation and scroll progress. Mutated
 *              in place by the GSAP scrub and read by r3f in useFrame. NEVER
 *              publishes — routing 60fps through React state is what makes
 *              scroll-driven canvas sites stutter.
```

- [ ] **Step 2: Add the live waypoint read**

In `src/three/Butterflies.tsx`, extend the imports:

```tsx
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { flockAt, waypointsFrom, type Waypoint } from './flock'
import { LABELS } from '~/scroll/scenes'
import { getLabelOffset } from '~/scroll/timeline'
import { frame } from '~/scroll/store'
```

Add above the component:

```tsx
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
```

- [ ] **Step 3: Add the `frozen` prop**

`frozen` becomes meaningful now that there is a frame loop to skip. Extend the props type:

```tsx
type Props = {
  count: number
  frozen: boolean
}
```

Change the signature to `export const Butterflies = ({ count, frozen }: Props) => {`, and in
`src/three/Stage.tsx` pass it through:

```tsx
        {!compact && <Butterflies count={FULL_FLOCK} frozen={reduced} />}
```

- [ ] **Step 4: Wire the frame loop**

Immediately after the `material` `useMemo` and before the `return`, add:

```tsx
  const waypoints = useRef<Waypoint[]>([])
  const measured = useRef(0)
  const invalidate = useThree((s) => s.invalidate)

  /** Writes the four driven uniforms for a given whole-document progress. */
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
    // them. Keying off scrollHeight avoids rebuilding seven waypoints 60 times
    // a second while still catching every refresh and resize.
    const height = document.documentElement.scrollHeight
    if (height !== measured.current) {
      measured.current = height
      waypoints.current = activeWaypoints()
    }

    ;(m.material as THREE.ShaderMaterial).uniforms.uTime!.value += delta
    place(frame.progress)
  })

  /**
   * Reduced motion: `Stage` sets `frameloop: 'demand'`, so `useFrame` never
   * runs and the flock becomes the static frieze README §197 asks for.
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
```

- [ ] **Step 5: Typecheck, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean, 105 tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/three/Butterflies.tsx src/three/Stage.tsx src/scroll/store.ts
git commit -m "feat: drive the flock from document scroll progress

Removes frame.attractor, which nothing ever wrote. It was reserved for
GSAP writing an attractor for r3f to read; the flock derives its own from
progress, so the field would only publish a permanent zero."
```

---

### Task 5: Browser verification and the tuning pass

The spec's §5 table is the one part expected to move. Everything else is a contract.

**Files:**
- Modify: `src/three/Butterflies.tsx` (tuning constants only, if needed)

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: nothing.

- [ ] **Step 1: Confirm the page is actually animating**

Run `npm run dev` and open `http://localhost:5173` **as the active tab**. Lenis runs off a GSAP ticker on `requestAnimationFrame`; in a background or occluded tab rAF is throttled and nothing moves, which looks exactly like a broken flock.

Before concluding anything about motion, confirm rAF is alive — count ticks over 500ms and expect 50+:

```js
let n = 0
const t = performance.now()
const tick = () => { n++; if (performance.now() - t < 500) requestAnimationFrame(tick) }
requestAnimationFrame(tick)
setTimeout(() => console.log('[flock] rAF ticks in 500ms:', n), 600)
```

- [ ] **Step 2: Screenshot mid-scene versus mid-gap**

Scroll with **real wheel input only** — never `window.scrollTo`, which fights Lenis for ownership of scroll position.

Capture two screenshots:
- **Mid-scene** (parked on g1, roughly y=1800): expect a thin residue — a handful of faint diamonds around the edges, most of the field dispersed past the frame. Nothing should crowd the ring.
- **Mid-gap** (roughly halfway between g1 and g2, around y=3700): expect a visibly denser, tighter, brighter cloud.

The contrast between the two is `gather` doing its job. If both look the same, the uniform is not reaching the shader.

- [ ] **Step 3: Screenshot the cream ground**

Scroll to g4 (merch, roughly y=11520) and screenshot.

This is the check that exists because measurement missed a rendering defect last cycle. Additive blending over cream adds toward white and disappears; the flock uses alpha blending specifically to survive here. **Confirm by eye that the marks read against the light ground.** If they wash out, `ALPHA_THIN` is the constant to raise — not the blend mode, which is a spec contract.

- [ ] **Step 4: Check the ending**

Scroll to contact. Expect wings damped to a near-idle flutter and drift stopped — README §148, "the flock lands here and stops."

- [ ] **Step 5: Check reduced motion and compact**

With `prefers-reduced-motion: reduce` emulated: the flock renders as a still frieze and does not animate. It will not follow scrolling — that is §197, not a defect.

At 920px wide: no flock at all, and no GLSL compile in the console. At 960px: the flock is present.

- [ ] **Step 6: Tune, if needed**

Adjust only `RADIUS_WIDE`, `RADIUS_TIGHT`, `ALPHA_THIN`, `ALPHA_DENSE` in `Butterflies.tsx`. Repeat steps 2–3 after any change.

If the tuned values differ from the spec's table, update §5 of `docs/superpowers/specs/2026-07-31-butterfly-flock-design.md` in the same commit so the spec does not go stale.

- [ ] **Step 7: Full verification**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean · 105 tests pass · build succeeds · console clean apart from the known three.js `Clock` deprecation.

Confirm the critical-path bundle has not grown: `three` must still be a lazy chunk, and the flock adds no dependency.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: tune the flock against a real browser on both grounds"
```

---

## Out of scope

- The ring's **collapse to a seed** between scenes. README §175 couples it to the flock; spec §1 explains why it is a separate cycle.
- The **centre-slot ripple shader** — the third r3f system. Its seam is already built in `CentreSlot.tsx`.
- `Pollen.tsx:59` hardcodes `#b8873f` for pollen, but `--color-ochre` (`oklch(0.68 0.11 62)`) actually converts to `#c9884c`. A pre-existing off-token colour, noted while converting the flock's tokens. **Do not fix it here** — it changes the look of a shipped system for reasons unrelated to this plan.
