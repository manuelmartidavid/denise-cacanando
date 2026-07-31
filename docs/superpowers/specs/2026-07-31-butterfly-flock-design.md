# Butterfly Flock — Design

**System:** the second of the r3f stage's three systems. Pollen exists; the centre-slot ripple does not.
**Design of record:** `README.md` §"r3f stage" (item 2), §227 on permitted marks, §41 on `sage`,
§109/119/131/148 for per-scene flock behaviour.
**Scope boundary:** the flock travels between per-scene attractors. The ring's *collapse to a seed* is
**not** in this cycle — see §1.

---

## 0. Starting state

`frame.attractor` is declared in `src/scroll/store.ts:80` and **nothing writes it**. `timeline.ts`
writes `frame.progress` (whole document, `timeline.ts:213`) and `frame.sceneProgress` (per scrub
scene, `timeline.ts:116`). The flock is genuinely unbuilt, not half-built.

`Stage.tsx:43` already holds the call site, commented out:
`{/* <Butterflies count={compact ? 0 : 1200} frozen={reduced} /> */}`.

This spec **removes `frame.attractor`** rather than filling it in. It was reserved for a design where
GSAP wrote an attractor and r3f read it; §2 chooses the opposite direction, so leaving the field
would leave a permanently-zero value that reads as live state.

## 1. Scope

In: instancing, per-instance wing phase in the vertex shader, one attractor per scene, and the
gather-then-thin travel between them driven by scroll progress.

Out: the ring's collapse-to-a-seed transition. README §175 couples the two — "between scenes the ring
collapses to a seed and the flock's MotionPath progress owns the gap." The flock's half of that gap
is intrinsic to "one attractor per scene" and is built here. The ring's half is a change to
`timeline.ts`'s scene structure, which is where the verified pin lengths, the scroll-restore
sequence and every known-good measurement live. Keeping this cycle purely additive is what lets it
be verified against the existing baseline rather than re-establishing one.

## 2. No MotionPath

README §175 names GSAP MotionPath as the driver. This spec does not use it.

Every other piece of geometry in this codebase is a pure module with a test file — `lib/ring.ts`,
`lib/track.ts`, `scroll/timelineMath.ts`, `lib/snapList.ts`. Invariant 6 makes the browser the only
other check on anything visual, and the browser has already failed to catch two serious defects
(handoff §"Defects", items 3 and 8). Putting the flock's motion rule in a pure function is what makes
it reviewable by something other than an eye.

Concretely, MotionPath would cost a plugin in the critical-path bundle, place the flock's shape where
no test can reach it, and add a second writer to the `frame` channel.

## 3. Modules

| File | Kind | Responsibility |
| --- | --- | --- |
| `src/three/flock.ts` | **pure** | Attractor geometry. No three.js, no React. |
| `src/three/flock.test.ts` | pure tests | `environment: 'node'`, per invariant 6. |
| `src/three/Butterflies.tsx` | r3f | One `instancedMesh`, custom shader, reads `frame` in `useFrame`. |
| `src/three/Stage.tsx` | edit | Mount `Butterflies`; drop the SCAFFOLD paragraph. |
| `src/scroll/store.ts` | edit | Remove `frame.attractor` (§0). |

### 3.1 The pure module

Mirrors the `piecesFor` / `activePieces` split in `scenes.ts` — a pure core plus one live-reading
line, so tests never touch module-global state:

```ts
// src/three/flock.ts — pure
type Vec3 = [number, number, number]
type Waypoint = { at: number; target: Vec3 }

/** The whole motion rule. */
flockAt(waypoints: Waypoint[], progress: number): {
  target: Vec3
  gather: number   // 0 at a waypoint, 1 mid-gap
  settle: number   // 0 until the final leg, 1 at the end
}

/** Label offsets in document px -> waypoints in progress space. */
waypointsFrom(offsets: ReadonlyArray<number | undefined>, scrollable: number): Waypoint[]

// src/three/Butterflies.tsx — the one live-reading line
activeWaypoints(): Waypoint[]
```

**`activeWaypoints` lives in the component, not in `flock.ts`.** It reads `getLabelOffset` from
`scroll/timeline`, which calls `gsap.registerPlugin(ScrollTrigger)` at module scope. `flock.ts` is
imported directly by a node-environment test, so it must not reach GSAP even transitively. The pure
half — `waypointsFrom`, which takes offsets as an argument — stays in `flock.ts` and is what the
tests exercise. This is the same split as `piecesFor` / `activePieces`, with the boundary drawn at a
file rather than at two functions in one file, because that is where the import constraint falls.

### 3.2 One waypoint per label, not per gallery scene

README §184 says "one attractor target per scene," but the flock has specified behaviour at
non-gallery labels too: it "idles low-left, entering from the crop's edge" at hero (§109), crosses
the cream as two diamonds at about (§119), and lands and stops at the end (§148). So there are
**seven** waypoints, one per entry in `LABELS` — `hero · about · g1 · g2 · g3 · g4 · contact` — and
the four gallery attractors are simply the four the ring scenes sit on.

Targets are authored in canvas world space as a constant table in `flock.ts`, alongside the seat
geometry rationale of invariant 7: the timeline computes with these values, so they do not belong in
`index.css`.

### 3.3 Waypoints are measured, never hardcoded

`at` is derived from `getLabelOffset(label)` divided by the scrollable document height, recomputed
per refresh. The known-good offsets (1800 / 5580 / 8460 / 11520) are a regression baseline, **not**
constants to embed: a merch chip re-blooms the ring and `refreshTimeline()` moves every offset after
it. Hardcoding them is the failure mode invariant 4 exists to prevent.

`Butterflies.tsx` importing `getLabelOffset` from `~/scroll/timeline` does not breach invariant 2,
which forbids components importing `gsap` or `ScrollTrigger`. `SideRail`, `Dial` and `Track` already
import non-GSAP helpers from that module.

### 3.4 Driver is `frame.progress`

Not `frame.sceneProgress`. `progress` is whole-document and written unconditionally.
`sceneProgress` is written only by scrub scenes, so it is stale under the list fallback and
meaningless in the gaps between scenes — which is exactly where the flock does its most visible work.

## 4. Per-frame cost

Four uniforms, not 1,200 matrices. Positions resolve in the vertex shader from `uTarget`, `uGather`,
`uSettle` and `uTime` against per-instance attributes (offset, phase, speed, colour mix).
`instanceMatrix` is never written at all — every instance is placed by the shader from the four
uniforms above, not from per-instance matrices.

1,200 instances × 6 vertices = 7,200 vertices. Draw cost is a non-issue; the per-frame JS is the
thing worth keeping at O(1), and this keeps it there.

## 5. Geometry and look

**Six vertices, hinged.** Two triangles sharing a hinge edge at `x = 0`, each apexed at `y = 0`, with
an `aWing` attribute of ∓1. The vertex shader rotates each wing about the body axis by
`sin(uTime * aSpeed + aPhase) * mix(FLAP_FULL, FLAP_IDLE, uSettle)`, opposite signs per side.

The apex placement is what makes the mark a diamond. An earlier revision used two quads with corners
`(±1, ±0.6)`; because the only rotation is about `y`, which scales `x` by `cos(flap)` and never
touches `y`, that silhouette is an axis-aligned **rectangle** at every flap value and can never read
as README §227's rotated square. Vertices at `(±1, 0)` and `(0, ±0.6)` give a true rhombus, and are
cheaper besides — 2 triangles per instance rather than 4.

**No billboarding.** The camera is fixed at `[0,0,10]` (`Stage.tsx:40`). A folded pair reads as the
rotated square README §227 requires — "the only glyph-like marks are CSS squares rotated 45°
(butterflies)" — and the flap's foreshortening supplies the motion.

**`gather` drives radius and opacity together.** At `gather: 0` instances disperse to a wide radius
that pushes most of them outside the ring and past the frame edge, at low opacity, leaving the few
peripheral diamonds the mockups draw (README §131, "four flock diamonds sit outside the ring"). At
`gather: 1` the radius tightens and opacity rises into a legible migrating cloud. One scalar with two
effects, so "thins to a residue" cannot drift out of sync with "gathers."

Values in the world units the camera at `z:10 / fov:45` establishes. **Not** the 22 × 14 box
`Pollen.tsx:23` spreads across — that is Pollen's own hardcoded constant, not a measurement of the
frustum. The frustum at the `z = 0` plane is about **8.3 tall and 13.1 wide** at 1440×900, so the
half-extents every radius below is judged against are roughly **6.55 × 4.14**.

| | `gather: 0` (residue) | `gather: 1` (migrating) |
| --- | --- | --- |
| Cloud radius | ~~13~~ → **32** | 3.5 |
| Instance opacity | ~~0.18~~ → **0.30** | 0.85 |

Observed with the canvas temporarily lifted above the page content via a disclosed, uncommitted
`z-index` change (defect (a) occludes the canvas otherwise) and with `frame.progress` driven directly
(defect (b) saturates it past scrollY 5400) — not plain, unaided browser verification (task 5).
Neither workaround is in the committed code; the screenshots taken during this pass were deleted, so
this prose is the surviving record.

The cloud radius moved the *opposite* way from what the 22 × 14 figure implied. At radius 13 the
frame is only twice the ball's half-width, so it samples the cloud's dense core: ~300-456 of the
1,200 instances stayed on screen at `gather: 0` and the "thin residue" reads as an all-over dusting
that crowds the ring rather than the handful of peripheral diamonds README §131 draws. 32 leaves
~110-145 on screen across the seven attractors — a minority of the flock, though not as sparse as the
mockups draw. Opacity rose with it: fewer marks can afford to be individually legible, and 0.30 is
also what makes the residue read on g4's cream ground rather than merely survive it.

That residue also does not read as *placed* at each attractor: at this radius the dispersal
ellipsoid's semi-axes are far larger than the visible frame's half-extents, so the frame sits wholly
inside it for all seven attractors and the on-screen count is near-uniform dust rather than a cluster
around the attractor. See `flock.ts`'s `ATTRACTORS` docstring — at this radius the attractors function
as travel endpoints for the mid-leg cloud, not as visible per-scene placements. Revisit once defect
(a) is fixed and the canvas is actually visible to a real visitor.

`RADIUS_TIGHT` and `ALPHA_DENSE` were confirmed unchanged — the mid-gap cloud is legible on both
grounds at 3.5 / 0.85.

These two rows are the one part of this spec expected to move during browser verification; §8 is how
they get judged. Everything else is a contract.

**`settle` is separate on purpose.** README §148: "the flock lands here and stops — wings idle, no
drift. That's the ending." `settle` ramps 0→1 across the **final leg — g4 to contact** — damping
drift to zero and flap from `FLAP_FULL` to `FLAP_IDLE`. Folding it into `gather` would conflate
*dispersed* with *landed*, which are opposite-looking states.

**Alpha blending, not additive — a deliberate break from `Pollen`.** `Pollen.tsx:62` is
`AdditiveBlending`, which over g4's cream ground adds toward white and vanishes. Butterflies are
solid marks, not glows: normal blending, `depthWrite: false`.

**Colour** is a per-instance mix, ochre-bright with roughly one in six sage. README §41 restricts
`sage` to the flock and says "sparingly."

## 6. Reduced motion and compact

**Reduced motion.** `Stage` sets `frameloop: 'demand'`, but that does not stop `useFrame` from
running — `Butterflies`' own mount effect calls `invalidate()`, which triggers exactly the render its
`useFrame` subscriber runs on. What actually keeps the flock a static frieze is the `|| frozen`
early-return guard at the top of that `useFrame` callback, matching `Pollen`'s
`if (!mesh || frozen) return`. `Butterflies` writes its uniforms once in a mount effect instead; the
guard is what stops the frame loop from then advancing `uTime` and unfreezing it.

State plainly, because it will read as a bug to anyone who does not know: the frieze reflects the
scroll position **at mount** and does not follow the visitor down the page. That is what README §197
asks for — "the flock freezes into a static frieze."

**Compact.** Mount conditionally, `{!compact && <Butterflies …/>}`, rather than passing `count={0}`
as the scaffold comment suggests. A zero count still allocates an `instancedMesh` and compiles the
shader program, on exactly the devices with the least headroom.

## 7. Tests

All pure, node environment, no jsdom — invariant 6.

1. `flockAt` returns a waypoint's own target at that waypoint's `at`.
2. `gather` is 0 at every waypoint and peaks at 1 mid-gap.
3. Continuous across the whole 0→1 sweep — no discontinuity at a waypoint seam.
4. Progress 0 and 1 clamp to the first/last target. No NaN, no extrapolation.
5. `settle` is 0 before the final leg and 1 at progress 1.
6. Empty and single-waypoint arrays degrade safely. `getLabelOffset` returns `undefined` until the
   first refresh, so a short waypoint list is a real mount-time state, not a hypothetical.

## 8. Browser verification

Following the handoff's two traps, both of which have already cost a cycle:

- **Drive the page as the active tab**, with real wheel input. Confirm rAF is alive (~50+ ticks per
  500ms) before concluding anything about motion. Never `window.scrollTo` — Lenis owns scroll
  position.
- **Look at screenshots.** Mid-gap versus mid-scene, to confirm the gather/thin contrast is visible
  and not merely computed. And one over g4's cream ground specifically: a washed-out flock on cream
  is precisely the class of defect measurement missed last cycle.

Plus: console clean apart from the known three.js `Clock` deprecation; `npm run build` succeeds and
the three chunk grows by shader strings only; typecheck clean; existing 93 tests still pass.

## 9. Dependencies

None added.
