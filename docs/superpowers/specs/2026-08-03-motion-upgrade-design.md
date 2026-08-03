# Task: Upgrade `Butterflies` and `Pollen` from confetti/dots to real butterflies and wind-blown petals

> ## Provenance and corrections
>
> Authored **2026-08-01** as an untracked `docs/motion-upgrade-prompt.md` and committed here on
> **2026-08-03** unchanged in substance. Five corrections were applied, all marked **[CORRECTED]**
> where they appear:
>
> 1. **The pollen colour was the off-token value.** The palette invariant named `#b8873f`, which is
>    the defect fixed in `c11100d` — `--color-ochre` converts to `#c9884c`. Following the original
>    faithfully would have reinstated it.
> 2. **The frame half-extents were computed from a wrong frustum width.** `6.55` came from the
>    `13.1` in `Butterflies.tsx`'s docstring, corrected to `13.255` in `41f3969`.
> 3. **Three of the values this asks to change are Denise's**, hand-set after seeing the canvas
>    working: `FULL_POLLEN`, `FULL_FLOCK`, `RADIUS_WIDE`. The reasoning for changing them is sound
>    and is kept — but as a case to put to her, not a value to edit.
> 4. **The prototype it rests on no longer exists.** `effects-visualizer.html` is nowhere in the
>    repo, so "validated in an interactive prototype" cannot be checked.
> 5. **It supersedes a standing decision** on the wing geometry. Flagged in §1.1 rather than left to
>    collide silently.
>
> Nothing else was touched. Per the handoff's own warning, **treat the prescribed code below as a
> draft, not as truth** — every cycle in this repo has found defects in its own spec.

## Context

This is the Denise portfolio site (React + @react-three/fiber + GSAP ScrollTrigger + Lenis). One fixed
full-viewport canvas (`src/three/Stage.tsx`, camera `z:10 / fov:45`) sits behind the DOM and hosts two
particle systems driven by whole-document scroll progress (`frame.progress` from `~/scroll/store`):

- `src/three/Butterflies.tsx` — an instanced flock placed entirely in the vertex shader from four
  uniforms (`uTarget`, `uGather`, `uSettle`, `uTime`). `src/three/flock.ts` (pure, node-testable)
  computes those from waypoints derived from timeline label offsets.
- `src/three/Pollen.tsx` — 500 `THREE.Points` falling straight down, additive-blended, CPU-updated
  every frame.

**[CORRECTED] `Pollen.tsx` changed in `c11100d`** and no longer scatters across a hardcoded box: it
reads the frustum from r3f's `viewport`, spreads each particle across the extent at its own `z`, and
owns a named `SLIDE_X` used both to size the right-edge allowance and to drive the leftward slide.
The rewrite in Part 2 replaces this system, but **must carry that lesson forward** — see §2.1.

**Problem:** the butterflies read as confetti (tiny translucent rhombi tumbling in place), and the
pollen reads as dots. We have prototyped better treatments in a standalone visualizer and want them
integrated. This document specifies both upgrades.

## Invariants — do not break these

1. **The four-uniform architecture stays.** The CPU writes `uTarget`/`uGather`/`uSettle`/`uTime` per
   frame; per-instance placement stays in the vertex shader. No per-instance CPU matrix writes.
2. **`flock.ts` stays pure** — no three.js, no React, no import of `~/scroll/timeline` (it registers
   GSAP at import time and `flock.ts` must stay loadable in Vitest's node environment). Its public
   API (`flockAt`, `waypointsFrom`, `ATTRACTORS`) keeps its shape; existing tests in `flock.test.ts`
   must keep passing (extend them for new pure helpers, don't weaken them).
3. **Reduced motion:** the `frozen` prop path must keep working — the `|| frozen` early-return guard
   in `useFrame` is what holds the frieze static (see the long comment in `Butterflies.tsx`; the
   frameloop mode does NOT stop `useFrame`). The frozen frieze should now show butterflies at varied
   fixed wing poses and petals at varied fixed tilts — not everything face-on.
4. **Disposal:** imperatively created geometries/materials/textures passed via `args` are not owned
   by r3f — keep (and extend) the manual `dispose()` effect. Every new texture must be disposed too.
5. **Compact layout** still drops the butterfly system entirely; petal count still scales down
   (currently 25%) — the caller (`Stage.tsx`) owns count decisions via props.
6. **Palette:** only palette tokens. Ochre `#e8b181` (`--color-ochre-bright`), sage `#63ab74`
   (`--color-sage`, flock only, `SAGE_SHARE = 1/6`, README §41), pollen ochre **`#c9884c`**
   (`--color-ochre`). Petal tints may use soft variations of ochre/cream tones — keep them warm and
   muted, nothing saturated.

   > **[CORRECTED]** The original named the pollen colour `#b8873f`. That was the hardcoded
   > off-token value fixed in `c11100d`; `--color-ochre` is `oklch(0.68 0.11 62)` = `#c9884c`.
   > `THREE.Color` cannot parse `oklch`, so every token used on the canvas is converted by hand and
   > the token named in a comment — handoff invariant 8. **Any new petal tint needs the same
   > treatment**, and a raw hex with no token behind it is not a palette token.

7. **Blending:** butterflies stay normal alpha blending (additive vanishes over cream grounds — see
   existing comment). Petals must SWITCH from additive to normal alpha blending for the same reason.
8. **ScrollTrigger control is preserved.** `flockAt(waypoints, frame.progress)` remains the sole
   driver of flock position/gather/settle. All changes below are local to each instance.
9. **[CORRECTED — NEW] `FULL_POLLEN`, `FULL_FLOCK` and `RADIUS_WIDE` are Denise's, not the
   implementer's.** She set 500 / 30 / 32 by hand after seeing the canvas working for the first time,
   and the handoff records them under "decisions already ruled on — do not re-open". This document
   proposes changing all three (§1.4, §2.3) and the reasoning is good — larger opaque butterflies
   genuinely do change the right count. **Put it to her with the new look on screen; do not land a
   number here as part of the implementation.** Treat radius and count as one decision.

---

## Part 1 — Butterflies (`Butterflies.tsx`, `flock.ts`)

### 1.1 Silhouette + body (biggest win)

> **[CORRECTED] This supersedes a standing decision.** The handoff records: "Wing geometry is two
> triangles apexed at `y = 0`, not two quads. Do not 'simplify' it back." That warning exists because
> both the original spec and plan prescribed quads, which are axis-aligned rectangles at every flap
> value and can never read as README §227's rotated square. Replacing the geometry wholesale with a
> real silhouette is a legitimate supersede, **but the same trap applies**: the only rotation is about
> `y`, which scales `x` by `cos(flap)` and never touches `y`. **Verify the new shape by looking at it
> on screen, not by measuring it** — that defect was reported as verified by measurements that could
> not have detected it.

Replace the 6-vertex rhombus with a recognizable butterfly:

- Each wing: a shape with a forewing lobe and hindwing lobe, hinged along the body axis (local y,
  hinge at x=0). Author it as a `THREE.Shape` → `ShapeGeometry` (≈10 curve segments), or as a small
  hand-authored triangle fan — either way keep it ONE geometry instanced for the whole flock, with
  the existing `aWing = ±1` trick so one flap value drives both wings in opposite directions in the
  vertex shader. Reference outline (local units, right wing, hinge at x=0):
  - start (0, 0.40) → bezier out to (1.12, 0.30) via (0.42, 0.74), (1.02, 0.66)  [forewing]
  - → (0.55, 0.02) via (1.18, 0.06), (0.78, −0.02)  [notch]
  - → (0.62, −0.62) via (0.92, −0.14), (0.94, −0.52)  [hindwing]
  - → close to (0, −0.30) via (0.30, −0.70), (0.04, −0.44)
- Add a thin dark body along the hinge (elongated capsule/ellipse shape, near-black warm brown
  `#4a3524`, length ≈ 0.7 wing-units). It can be extra vertices in the same instanced geometry
  (flag via an attribute so the shader skips flap rotation and the fragment shader colors it dark),
  or a second small `InstancedMesh` sharing the same instance attributes. Prefer whichever keeps a
  single draw call if practical; two draw calls total is acceptable.

### 1.2 Orientation: face the direction of travel

- Rotate each instance in the screen plane so the body axis aligns with its velocity.
- The per-instance drift is analytic (`sin`/`cos` of `uTime`), so its derivative is available in the
  shader for free. Combine: `v = flockVelocity + driftDerivative`, where `flockVelocity` is a new
  uniform `uFlockVel` (vec3) computed on the CPU as the delta of `uTarget` between frames divided by
  delta time (smoothed, e.g. exponential moving average, to survive scrub jitter). Rotate by
  `atan(v.y, v.x) − π/2` about z, applied around the instance centre.
- Add a small bank (roll about the body axis) proportional to the smoothed turn rate — clamp to
  ±0.6 rad. A cheap approximation from the second derivative of the drift is fine.
- Scrubbing backward should visibly turn the flock around — that is desired behavior.

### 1.3 Wingbeat: asymmetric flap–glide cycles

Replace the pure `sin` flap:

- **Asymmetric stroke:** `stroke = sin(p + 0.45·sin(p))` where `p = uTime·aFlapFreq + aPhase`
  (downstroke faster than upstroke).
- **Flap–glide duty cycle:** per instance, a cycle of period `aCycle` (random 2.2–3.6 s) with duty
  fraction `aDuty` (random 0.5–0.68). Within the flapping window, envelope `env` smoothsteps 0→1→0
  with ~12% edge ramps. Wing angle: `mix(GLIDE, 0.25 + 0.8·stroke, env)` with `GLIDE = 0.5` rad
  (shallow dihedral V while gliding).
- **Settle damping:** multiply `env` by `(1 − 0.9·uSettle)` — replaces the current
  `FLAP_FULL/FLAP_IDLE` mix. At rest (contact section / frozen frieze), add an occasional very slow
  open–close: a low-frequency per-instance term so perched butterflies aren't frozen solid (skip
  entirely when `frozen`).
- **Lift bob tied to the beat:** vertical offset `env·0.5·sin(p − 0.9)` (lift pulse per beat) plus
  `(1 − env)·(−0.22)` (sink while gliding), both scaled by `(1 − uSettle)` and by `aScale` so small
  distant butterflies bob less in world units.
- New per-instance attributes needed: `aFlapFreq` (7–10.5), `aCycle`, `aDuty` (reuse `aPhase`/`aSpeed`
  where sensible instead of adding redundant attributes).

### 1.4 Scale, count, opacity

- Raise `aScale` so butterflies read as creatures, not flecks. Target: 3 foreground instances at
  ~0.55–0.75 wing-units scale, the rest 0.28–0.48, with scale correlated to `aOffset.z` so nearer =
  larger (fake parallax). **[CORRECTED]** Frame half-extents at `z = 0` are **~6.63 × 4.14** at
  1440×900 — sanity-check on screen.

  > The original said `6.55 × 4.14`, taken from the `13.1` frustum width in `Butterflies.tsx`'s
  > docstring. That width was wrong: `2 · 10 · tan(22.5°)` is **8.28** tall and the width follows the
  > aspect — **13.255** at 1440×900, 14.7 at 16:9. Corrected in `41f3969`. **The width is
  > aspect-dependent, so a single half-extent number is a design-viewport check, not a constant** —
  > `Pollen.tsx` reads it live from `viewport` for exactly this reason.

- **[CORRECTED — was: "Consider lowering `FULL_FLOCK`"]** If the frame feels crowded at the new
  sizes, **prepare a recommendation for Denise on `FULL_FLOCK` and `RADIUS_WIDE` together** — see
  invariant 9. Both are hers. The existing `RADIUS_WIDE` docstring's on-screen figures were counted
  at 1,200 instances and are proportions, not absolutes; they **must** be re-measured at whatever
  count is current before they mean anything. Larger recognizable butterflies half-clipped at frame
  edges are newly noticeable, which is a real argument for re-tuning — make it with frames on screen.
- Opacity: near-opaque (~0.96). Keep `ALPHA_THIN/ALPHA_DENSE` structure if the gather-linked fade is
  still wanted, but raise both ends; translucency is a confetti cue.

### 1.5 Shading

- In the fragment shader, darken wing color by fold: factor `0.62 + 0.38·cos(wingAngle)` passed as a
  varying. Body stays flat dark brown.

---

## Part 2 — Pollen → Petals (`Pollen.tsx`)

Rewrite as an instanced petal system (rename to `Petals.tsx` and update imports/comments; keep the
`{ count, frozen }` prop contract).

### 2.1 Architecture

- `THREE.InstancedMesh` + `ShaderMaterial`, positions computed ANALYTICALLY in the vertex shader
  from `uTime` + per-instance seeds — this deletes the current per-frame CPU loop and
  `needsUpdate` upload entirely. Wrap via `mod()` in the shader with off-screen margins
  (x: ±(halfWidth + 2.2), y: ±(halfHeight + 1.4)) so respawns never pop on screen. Wrap BOTH axes
  (breeze migrates petals sideways).

  > **[CORRECTED] `halfWidth` / `halfHeight` must come from the camera, not from a constant.** This
  > is the defect `c11100d` fixed: the old system scattered across a hardcoded 22 × 14 box unrelated
  > to the frustum, leaving roughly a third of the field outside the frame at every width. Feed r3f's
  > `viewport` in as a uniform. Two details that fix carried, both still load-bearing here: the
  > frustum is a **pyramid**, so the extent grows with distance from the camera and a particle should
  > use the extent at its own `z`; and the field's leftward slide needs its allowance spent on the
  > **right** edge, or the right side empties out by the end of the document. The `SLIDE_X` constant
  > exists so the scatter and the slide cannot disagree — keep them one value.

- Geometry: a gently curled plane, long axis x, ≈0.6 × 0.34 units, 5×3 segments, with baked curl
  `z = 0.085·cos(πx/0.6) + 0.045·(2y/0.34)²`.
- Texture: a soft teardrop petal silhouette with a base→tip luminance gradient (base ~`#cdbea8`,
  tip near-white), generated once on a small canvas (128²) or shipped as a tiny asset; used as
  `map` with `alphaTest ≈ 0.05`. Tint per instance via an attribute from a short warm list
  (e.g. `#e8b181 #dfa06c #e6c39a #d99a83 #f0dcbd`) — **[CORRECTED]** subject to invariant 6: each of
  those needs a token behind it, or the list needs paring back to ones that have.
- Normal alpha blending, `depthWrite: false`, `DoubleSide`, opacity ≈ 0.94. NOT additive.
- Dispose geometry, material, texture on unmount (same pattern as `Butterflies`).

### 2.2 Motion (all analytic in the vertex shader)

Per instance, with `ph = uTime·aSwayFreq + aSeed` and `cph = cos(ph)`:

- **Wind:** `wind = uBreeze·(0.32 + 0.22·sin(uTime·0.21 + aSeed·0.31) + gust·0.85)` where
  `gust = max(0, sin(uTime·0.16 + 2.0))³` (long quiet spells, occasional soft pushes). `uBreeze`
  defaults to 1.
- **Sway + coupled fall** (the signature flutter): horizontal velocity
  `wind + aSwayAmp·aSwayFreq·cph`; vertical speed `−aFall·(0.35 + 0.65·cph²)` plus
  `gust·uBreeze·0.3` lift — petals drop fastest mid-swing and nearly hang at the extremes.
  Since position must be analytic (no state), integrate these in closed form:
  `x = x₀ + windIntegral(uTime) + aSwayAmp·sin(ph)` and
  `y = y₀ − aFall·(0.675·uTime + 0.325·sin(2ph)/(2·aSwayFreq)) + gustLiftIntegral` — the gust
  integral may be approximated by a slow sine; exactness doesn't matter, smoothness does.
- **Tilt phase-locked to the sway:** roll about long axis `= 0.25 + aTiltAmp·cph` (banks into each
  slip; `aTiltAmp` 0.5–0.9).
- **Slow tumble** about z: `aTumble₀ + aTumbleRate·uTime` (rate ±0.45).
- **Shading:** dim toward edge-on — multiply tint by `0.72 + 0.28·|cos(tilt)|` in the fragment.
- Per-instance ranges: `aSwayFreq` 0.8–1.6, `aSwayAmp` 0.35–0.8, `aFall` 0.28–0.55, scale 0.55–1.15
  with ~8 near-camera instances at 1.3–1.9 and z in (0.5, 2), the rest z in (−3, 0.5).

### 2.3 Count and scroll coupling

- **[CORRECTED — was: "Drop `FULL_POLLEN` from 500 to ~110–150"]** 500 petals at the new geometry is
  argued to be a blizzard, and ~110–150 is the prototype's figure. **`FULL_POLLEN` is Denise's** —
  see invariant 9. Build at 500, look at it, and take her a comparison. Note that 500 was itself a
  hand cut from 4,000 made after seeing the canvas work, so the number is considered, not a default.
  Keep the compact 25% rule and the halve-over-cream behavior if present.
- Keep the scroll coupling: the current `mesh.position.x = frame.progress · −SLIDE_X` sideways
  current is fine to keep as-is, or fold scroll progress into `uBreeze` so fast scrolling stirs the
  petals — either is acceptable; prefer whichever reads better on the real page.
- `frozen`: render one static frame with petals at their varied analytic poses (set `uTime` once from
  a fixed value and `invalidate()`), mirroring the Butterflies frieze pattern.

---

## Suggested implementation order

1. Butterfly silhouette + body (verify on screen before anything else).
2. Velocity orientation (`uFlockVel` + drift derivative) + bank.
3. Flap–glide cycles, asymmetric stroke, settle damping, lift bob.
4. Scale/opacity retune. **[CORRECTED]** Prepare — do not land — a `FULL_FLOCK` / `RADIUS_WIDE`
   recommendation for Denise, with frames shot at the two label offsets for the viewport in use.
5. Fold shading.
6. Petals rewrite (architecture, then motion, then tuning).
7. Frozen/reduced-motion pass for both systems.

Each step should leave the page working; commit per step.

## Acceptance criteria

- Butterflies read as butterflies at a glance: visible wing shape + body, facing their direction of
  travel, flap-then-glide rhythm with bobbing flight — no metronomic tumbling, no translucent flecks.
- Scrubbing the page back and forth moves the flock exactly as before (same waypoints/gather/settle
  timing from `flockAt`), with the flock visibly turning to face its travel direction.
- Petals visibly flutter: sideways slips with hang-at-the-extremes fall, banking locked to the slip,
  occasional gusts; they migrate gently with the breeze and never pop in/out at frame edges.
- No additive blending on petals; nothing disappears over cream grounds.
- `prefers-reduced-motion` shows a static, varied frieze for both systems (no drift, no time advance).
- `flock.ts` still imports clean in node; all existing Vitest suites pass; new pure math (e.g. wind
  integral helpers) is unit-tested.
- Per-frame CPU work does not regress: still O(1) uniform writes per system (plus the existing
  waypoint height check). No per-instance CPU loops remain in `Pollen`/`Petals`.
- Frame rate on a mid-range laptop at 1440×900 stays at 60fps with both systems active.
- **[CORRECTED — NEW]** Both systems fill the frame at **every** aspect ratio, not just 1440×900.
  The extent comes from `viewport`; no scatter box is hardcoded. Check at least one short viewport —
  a prior cycle shipped a regression visible only at short heights because every check used a single
  900px height.

## Tuning reference

> **[CORRECTED] The prototype is gone.** `effects-visualizer.html` is not in this repo and not in any
> commit. Every magic number below is therefore **unverifiable** — the same failure as the
> `RADIUS_WIDE` comparison frames, which "lived in a session scratchpad and are gone". Treat the
> numbers as a starting point with no evidence behind them. **If the prototype still exists on
> someone's machine, committing it is worth more than re-deriving these by hand.**

All magic numbers above were validated in an interactive prototype (`effects-visualizer.html`,
three.js, same camera as `Stage.tsx`). If a value feels off in situ, prefer re-tuning by eye on the
real page over trusting this document — but keep the *structure* (coupled sway/fall, phase-locked
tilt, flap–glide envelope, settle damping) intact; the structure is the effect.
