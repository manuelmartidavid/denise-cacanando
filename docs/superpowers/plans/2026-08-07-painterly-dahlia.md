# Painterly Dahlia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the hero's 3D dahlia a faded oil-sketch look — soft brush strokes, chalky colour, dry-brush rims — via an `onBeforeCompile` patch on its single petal material, tunable from the existing dev tuner.

**Architecture:** A new `src/three/painterly.ts` holds a pure shader-string patcher (unit-testable), the shared uniform set, an `applyPainterly(material)` installer, and a `syncPainterlyUniforms(tune)` per-frame bridge. Five knobs join `heroFlowerTuning` (three-free module) and the tuner's slider rows; `HeroFlower.tsx` applies the patch in its existing `scene.traverse` and syncs uniforms in `useFrame`.

**Tech Stack:** three ^0.185 (`ShaderLib` chunk anchors), @react-three/fiber, vitest, TypeScript.

## Global Constraints

- `src/three/heroFlowerTuning.ts` must stay free of three.js imports (spec: tuner panel must not drag the three bundle into the hero chunk). `painterly.ts` may import the tuning *type*, never the reverse.
- Edge fade is a **colour** fade toward cream — never `transparent = true` or alpha writes (spec: 22 double-sided zero-thickness meshes = blend-sorting minefield).
- Missing shader anchors must `console.error` naming the anchor and leave the material unpatched (spec: "a plain flower beats a black one").
- Site cream is `#f2ece1` (`src/styles/index.css:13`); construct it as `new THREE.Color('#f2ece1')` so color management converts it to the linear working space.
- The GLB's material carries `KHR_materials_specular`, so GLTFLoader instantiates `MeshPhysicalMaterial` — both it and `MeshStandardMaterial` compile from the `meshphysical` shader, so the anchors below apply either way.

---

### Task 1: `painterly.ts` — pure shader patcher, uniforms, sync

**Files:**
- Create: `src/three/painterly.ts`
- Test: `src/three/painterly.test.ts`

**Interfaces:**
- Consumes: `THREE.ShaderLib`, `THREE.Color`, `THREE.Material`.
- Produces:
  - `patchPainterlyShader(vertexShader: string, fragmentShader: string): { vertexShader: string; fragmentShader: string } | null`
  - `painterlyUniforms: { uStrokeScale: { value: number }, uStrokeStrength: { value: number }, uBandMix: { value: number }, uChalk: { value: number }, uEdgeFade: { value: number }, uCream: { value: THREE.Color } }`
  - `applyPainterly(material: THREE.Material): void`
  - `syncPainterlyUniforms(t: { strokeScale: number; strokeStrength: number; bandMix: number; chalk: number; edgeFade: number }): void`

- [ ] **Step 1: Write the failing tests**

```ts
// src/three/painterly.test.ts
import { describe, expect, it, vi } from 'vitest'
import { ShaderLib } from 'three'
import { painterlyUniforms, patchPainterlyShader, syncPainterlyUniforms } from './painterly'

// The real templates onBeforeCompile receives — #include directives unresolved.
const vert = ShaderLib.physical.vertexShader
const frag = ShaderLib.physical.fragmentShader

describe('patchPainterlyShader', () => {
  it('patches both stages of the stock physical shader', () => {
    const out = patchPainterlyShader(vert, frag)
    expect(out).not.toBeNull()
    expect(out!.vertexShader).toContain('vPainterlyPos = position;')
    expect(out!.vertexShader).toContain('varying vec3 vPainterlyPos;')
    expect(out!.fragmentShader).toContain('painterlyStrokeField')
    expect(out!.fragmentShader).toContain('uEdgeFade')
  })

  it('keeps the stroke grain before lighting and the banding after it', () => {
    const out = patchPainterlyShader(vert, frag)!
    const f = out.fragmentShader
    expect(f.indexOf('diffuseColor.rgb *= 1.0 + stroke')).toBeLessThan(
      f.indexOf('#include <lights_fragment_begin>'),
    )
    expect(f.indexOf('float litLum')).toBeLessThan(f.indexOf('#include <opaque_fragment>'))
    expect(f.indexOf('float litLum')).toBeGreaterThan(f.indexOf('#include <lights_fragment_begin>'))
  })

  it('returns null and reports the anchor when one is missing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = patchPainterlyShader(vert, frag.replace('#include <color_fragment>', ''))
    expect(out).toBeNull()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('#include <color_fragment>'))
    error.mockRestore()
  })
})

describe('syncPainterlyUniforms', () => {
  it('copies tuning values into the uniform set', () => {
    syncPainterlyUniforms({
      strokeScale: 1.5,
      strokeStrength: 0.4,
      bandMix: 0.6,
      chalk: 0.2,
      edgeFade: 0.7,
    })
    expect(painterlyUniforms.uStrokeScale.value).toBe(1.5)
    expect(painterlyUniforms.uStrokeStrength.value).toBe(0.4)
    expect(painterlyUniforms.uBandMix.value).toBe(0.6)
    expect(painterlyUniforms.uChalk.value).toBe(0.2)
    expect(painterlyUniforms.uEdgeFade.value).toBe(0.7)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/three/painterly.test.ts`
Expected: FAIL — cannot resolve `./painterly`.

- [ ] **Step 3: Implement `painterly.ts`**

```ts
// src/three/painterly.ts
import * as THREE from 'three'

/**
 * The hero dahlia's faded-oil-sketch treatment, layered INTO the GLB's own
 * material via onBeforeCompile rather than replacing it — the standard
 * pipeline keeps doing lights, vertex colours and tone mapping, and three
 * fragments are injected around it:
 *
 *  1. stroke grain  — after <color_fragment>: fBm noise sampled from the
 *     petal-local position in a radial frame (long along the petal, fine
 *     across it), modulating albedo lightness plus a warm/cool drift, with
 *     a chalky desaturate-and-lift toward the page cream.
 *  2. light banding — before <opaque_fragment>: the lit colour's luminance
 *     softly quantized into 3 bands, blended by uBandMix.
 *  3. dry-brush rim — same injection: fresnel-driven lift toward cream,
 *     broken by the stroke noise so the fade is ragged, not a smooth glow.
 *
 * Colour-only on purpose: no alpha is touched, because the 22 double-sided
 * zero-thickness petal meshes would make blended transparency a sorting
 * minefield (see the design doc).
 *
 * The stroke field reads the raw `position` attribute, so paint sticks to
 * each petal through the baked bloom/scatter animation instead of swimming.
 */

export type PainterlyTuning = {
  strokeScale: number
  strokeStrength: number
  bandMix: number
  chalk: number
  edgeFade: number
}

/**
 * Shared across every patched material and written by syncPainterlyUniforms
 * each frame — the same live-channel discipline as heroFlowerTuning itself.
 * uCream is the page background (--color-cream); constructed as a CSS colour
 * so color management lands it in the linear working space.
 */
export const painterlyUniforms = {
  uStrokeScale: { value: 1 },
  uStrokeStrength: { value: 0.35 },
  uBandMix: { value: 0.5 },
  uChalk: { value: 0.35 },
  uEdgeFade: { value: 0.55 },
  uCream: { value: new THREE.Color('#f2ece1') },
}

export const syncPainterlyUniforms = (t: PainterlyTuning): void => {
  painterlyUniforms.uStrokeScale.value = t.strokeScale
  painterlyUniforms.uStrokeStrength.value = t.strokeStrength
  painterlyUniforms.uBandMix.value = t.bandMix
  painterlyUniforms.uChalk.value = t.chalk
  painterlyUniforms.uEdgeFade.value = t.edgeFade
}

const VERTEX_DECL = /* glsl */ `
varying vec3 vPainterlyPos;
`

const VERTEX_ASSIGN = /* glsl */ `
vPainterlyPos = position;
`

const FRAGMENT_DECL = /* glsl */ `
varying vec3 vPainterlyPos;
uniform float uStrokeScale;
uniform float uStrokeStrength;
uniform float uBandMix;
uniform float uChalk;
uniform float uEdgeFade;
uniform vec3 uCream;

float painterlyHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}

float painterlyNoise( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( mix( painterlyHash( i ), painterlyHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ),
         mix( painterlyHash( i + vec3( 0.0, 1.0, 0.0 ) ), painterlyHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
    mix( mix( painterlyHash( i + vec3( 0.0, 0.0, 1.0 ) ), painterlyHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ),
         mix( painterlyHash( i + vec3( 0.0, 1.0, 1.0 ) ), painterlyHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ),
    f.z );
}

// Two-octave fBm in a radial frame around the flower's +Y axis: the noise
// domain moves fast around the axis (fine ACROSS a stroke) and slowly with
// radius + height (long ALONG the petal). The unit-circle mapping keeps it
// seamless in angle; below 1e-4 radius the frame degenerates, so the heart
// of the flower just reads one stroke — invisible at that size.
float painterlyStrokeField( vec3 p, float scale ) {
  float r = length( p.xz );
  vec2 dir = r > 1e-4 ? p.xz / r : vec2( 1.0, 0.0 );
  vec3 q = vec3( dir * 9.0 * scale, ( r + 0.55 * p.y ) * 0.9 * scale );
  return painterlyNoise( q ) * 0.65 + painterlyNoise( q * 2.7 + 11.3 ) * 0.35;
}
`

const FRAGMENT_GRAIN = /* glsl */ `
float stroke = painterlyStrokeField( vPainterlyPos, uStrokeScale ) - 0.5;
float strokeDrift = painterlyStrokeField( vPainterlyPos + 37.0, uStrokeScale * 1.8 ) - 0.5;
diffuseColor.rgb *= 1.0 + stroke * uStrokeStrength;
diffuseColor.rgb += vec3( strokeDrift, 0.0, -strokeDrift ) * uStrokeStrength * 0.18;
float painterlyLum = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
diffuseColor.rgb = mix( diffuseColor.rgb, vec3( painterlyLum ), uChalk * 0.55 );
diffuseColor.rgb = mix( diffuseColor.rgb, uCream, uChalk * 0.3 );
`

const FRAGMENT_FINISH = /* glsl */ `
float litLum = dot( outgoingLight, vec3( 0.2126, 0.7152, 0.0722 ) );
float bandsX = litLum * 3.0;
float banded = ( floor( bandsX ) + smoothstep( 0.25, 0.75, fract( bandsX ) ) ) / 3.0;
float targetLum = mix( litLum, banded, uBandMix );
outgoingLight *= ( targetLum + 1e-3 ) / ( litLum + 1e-3 );
float fres = pow( 1.0 - abs( dot( normalize( vViewPosition ), normal ) ), 2.2 );
float brushBreak = 0.55 + 0.9 * painterlyStrokeField( vPainterlyPos * 1.7 + 5.0, uStrokeScale );
outgoingLight = mix( outgoingLight, uCream, clamp( fres * brushBreak * uEdgeFade, 0.0, 1.0 ) );
`

type Patched = { vertexShader: string; fragmentShader: string }

/**
 * Pure string patch against the UNRESOLVED shader templates (onBeforeCompile
 * runs before #include expansion, so the directives below are literal
 * anchors). Any missing anchor — a three upgrade renaming a chunk — logs
 * which one and returns null, leaving the plain flower rendering.
 */
export const patchPainterlyShader = (
  vertexShader: string,
  fragmentShader: string,
): Patched | null => {
  const edits: Array<{ stage: 'vertex' | 'fragment'; anchor: string; inject: string }> = [
    { stage: 'vertex', anchor: '#include <common>', inject: VERTEX_DECL },
    { stage: 'vertex', anchor: '#include <begin_vertex>', inject: VERTEX_ASSIGN },
    { stage: 'fragment', anchor: '#include <common>', inject: FRAGMENT_DECL },
    { stage: 'fragment', anchor: '#include <color_fragment>', inject: FRAGMENT_GRAIN },
  ]
  let vertex = vertexShader
  let fragment = fragmentShader
  for (const { stage, anchor, inject } of edits) {
    const source = stage === 'vertex' ? vertex : fragment
    if (!source.includes(anchor)) {
      console.error(`[painterly] missing shader anchor ${anchor} — flower renders unpatched`)
      return null
    }
    const patched = source.replace(anchor, `${anchor}\n${inject}`)
    if (stage === 'vertex') vertex = patched
    else fragment = patched
  }
  // The finish layer injects BEFORE its anchor — banding and rim fade need
  // outgoingLight complete, and opaque_fragment is where it gets written out.
  const out = '#include <opaque_fragment>'
  if (!fragment.includes(out)) {
    console.error(`[painterly] missing shader anchor ${out} — flower renders unpatched`)
    return null
  }
  fragment = fragment.replace(out, `${FRAGMENT_FINISH}\n${out}`)
  return { vertexShader: vertex, fragmentShader: fragment }
}

/**
 * Installs the patch on a GLB material. Guarded by userData so the traverse
 * in HeroFlower — which sees the one shared petal material 22 times — only
 * wires it once.
 */
export const applyPainterly = (material: THREE.Material): void => {
  if (material.userData.painterly) return
  material.userData.painterly = true
  material.onBeforeCompile = (shader) => {
    const patched = patchPainterlyShader(shader.vertexShader, shader.fragmentShader)
    if (!patched) return
    Object.assign(shader.uniforms, painterlyUniforms)
    shader.vertexShader = patched.vertexShader
    shader.fragmentShader = patched.fragmentShader
  }
  material.needsUpdate = true
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/three/painterly.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/three/painterly.ts src/three/painterly.test.ts
git commit -m "feat: painterly shader patch - stroke grain, light bands, dry-brush rim"
```

---

### Task 2: Tuning knobs — `heroFlowerTuning.ts` + tuner rows

**Files:**
- Modify: `src/three/heroFlowerTuning.ts` (add 5 fields to type + defaults)
- Modify: `src/three/HeroFlowerTuner.tsx:18-26` (add 5 slider rows)

**Interfaces:**
- Consumes: nothing new — extends the existing `HeroFlowerTuning` type and `HERO_FLOWER_DEFAULTS`.
- Produces: `heroFlowerTuning.strokeScale / .strokeStrength / .bandMix / .chalk / .edgeFade` (all `number`), which Task 3 passes to `syncPainterlyUniforms`. Defaults: `strokeScale: 1`, `strokeStrength: 0.35`, `bandMix: 0.5`, `chalk: 0.35`, `edgeFade: 0.55` — matching `painterlyUniforms` initial values.

- [ ] **Step 1: Add the fields to the tuning type and defaults**

In `src/three/heroFlowerTuning.ts`, extend the type after `bloomAt` (before `progressOverride`):

```ts
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
```

And extend `HERO_FLOWER_DEFAULTS`:

```ts
  strokeScale: 1,
  strokeStrength: 0.35,
  bandMix: 0.5,
  chalk: 0.35,
  edgeFade: 0.55,
```

- [ ] **Step 2: Add tuner rows**

In `src/three/HeroFlowerTuner.tsx`, append to `ROWS`:

```ts
  { key: 'strokeScale', label: 'paint · stroke scale', min: 0.2, max: 4, step: 0.05 },
  { key: 'strokeStrength', label: 'paint · stroke strength', min: 0, max: 1, step: 0.01 },
  { key: 'bandMix', label: 'paint · band mix', min: 0, max: 1, step: 0.01 },
  { key: 'chalk', label: 'paint · chalk', min: 0, max: 1, step: 0.01 },
  { key: 'edgeFade', label: 'paint · edge fade', min: 0, max: 1, step: 0.01 },
```

(`NumericKey` derives from `HERO_FLOWER_DEFAULTS`, and the copy button maps over `ROWS`, so both pick the new knobs up with no further change.)

- [ ] **Step 3: Verify**

Run: `npm run typecheck` — expected: clean.
Run: `npx vitest run` — expected: all suites still pass.

- [ ] **Step 4: Commit**

```bash
git add src/three/heroFlowerTuning.ts src/three/HeroFlowerTuner.tsx
git commit -m "feat: five painterly knobs join the dahlia tuner"
```

---

### Task 3: Wire the patch into `HeroFlower.tsx`

**Files:**
- Modify: `src/three/HeroFlower.tsx`

**Interfaces:**
- Consumes: `applyPainterly(material)`, `syncPainterlyUniforms(tune)` from `./painterly` (Task 1); the five tuning fields (Task 2).
- Produces: the shipped behaviour — no new exports.

- [ ] **Step 1: Apply the patch in the traverse effect**

Add the import:

```ts
import { applyPainterly, syncPainterlyUniforms } from './painterly'
```

In the `scene.traverse` effect (`HeroFlower.tsx:75-91`), extend the material loop — the same place `DoubleSide` is forced, for the same reason: it survives a re-export:

```ts
      for (const material of materials) {
        material.side = THREE.DoubleSide
        // The faded-oil-sketch pass rides the GLB's own material — see
        // three/painterly.ts for what gets injected and why colour-only.
        applyPainterly(material)
      }
```

- [ ] **Step 2: Sync uniforms every rendered frame**

In `useFrame` (after `const p = progressAt()`):

```ts
    syncPainterlyUniforms(tune)
```

And in the reduced-motion effect (before `invalidate()`):

```ts
    syncPainterlyUniforms(tune)
```

The reduced-motion call matters: under `frameloop: 'demand'` the frozen early-return skips `useFrame`'s sync, and the still would otherwise render whatever the uniforms last held.

- [ ] **Step 3: Verify it renders**

Run: `npm run typecheck` — expected: clean.
Run: `npm run dev`, open the hero — expected: flower renders with visible stroke grain and softened shading, no console errors, scrub still blooms and scatters.

- [ ] **Step 4: Commit**

```bash
git add src/three/HeroFlower.tsx
git commit -m "feat: the dahlia wears the painterly pass"
```

---

### Task 4: Visual tune + verification

**Files:**
- Modify: `src/three/heroFlowerTuning.ts` (bake eye-tuned defaults, if the initial values need adjusting)

**Interfaces:**
- Consumes: everything above; the dev tuner's park-scrub slider.
- Produces: final `HERO_FLOWER_DEFAULTS` paint values.

- [ ] **Step 1: Screenshot the scrub**

With `npm run dev` running, drive the browser (note: the automation tab is rAF-throttled — screenshots pump frames; scrollTo + screenshot scrubs the animation):

- Hero at scroll 0 (bud), ~mid-bloom, full bloom (`bloomAt` ≈ 0.39 of the pin), and scatter.
- Check: strokes read as radial brush pulls glued to petals (not screen-space shimmer), shading looks stepped-but-soft, rims lift toward cream, palette still reads as the dahlia's embers.

- [ ] **Step 2: Check the reduced-motion still and mobile crop**

- Emulate `prefers-reduced-motion: reduce` — the frozen bloom must carry the same paint.
- Narrow viewport to the mobile crop — effect scale should still look right (strokes are model-space, so they scale with the flower automatically).

- [ ] **Step 3: Tune by eye if needed, bake defaults**

If the shipped look needs adjusting, use the tuner's paint sliders (park the scrub at `bloomAt` for the open face), copy values, paste into `HERO_FLOWER_DEFAULTS`.

- [ ] **Step 4: Full test suite + typecheck**

Run: `npx vitest run` and `npm run typecheck` — expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/three/heroFlowerTuning.ts
git commit -m "feat: baked painterly defaults - the dahlia settles into its oil sketch"
```

---

## Self-Review Notes

- **Spec coverage:** stroke grain / banding / rim fade → Task 1 GLSL; tuner knobs → Task 2; traverse application + per-frame sync + reduced-motion sync → Task 3; verification matrix (scrub, reduced motion, mobile) → Task 4. Error handling (loud anchor failure) → Task 1 `patchPainterlyShader` + test.
- **Anchor validity:** injection anchors (`#include <common>`, `<begin_vertex>`, `<color_fragment>`, `<opaque_fragment>`) all exist in three r185's `meshphysical` templates, which both `MeshStandardMaterial` and the `KHR_materials_specular`-induced `MeshPhysicalMaterial` compile from. `normal` and `vViewPosition` are in scope at the `<opaque_fragment>` injection point.
- **Type consistency:** `PainterlyTuning` structurally matches the five fields added to `HeroFlowerTuning`, so `syncPainterlyUniforms(tune)` type-checks without importing the tuning module.
