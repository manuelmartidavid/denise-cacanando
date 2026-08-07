# Hero Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On first arrival, open on the hero's own near-black ground with the name writing itself as the page and 3D dahlia load, then glide the name into its real hero position while the rest of the hero and the flower fade in.

**Architecture:** A fixed overlay (`Loader`) holds its own copy of the name in the exact hero typography. Load progress arrives through a new two-channel module (`scroll/loading.ts`) — a published phase for React, a mutated-in-place progress object for the per-frame wipe, mirroring the existing `state`/`frame` split in `scroll/store.ts`. When the flower reports its first frame, the loader measures the real `<h1>`'s glyph bounds and GSAP-translates its copy there (FLIP), then hands over and unmounts.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (CSS-first `@theme`), GSAP 3, Lenis, react-three-fiber + drei, Vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-07-hero-loader-design.md`. Read it before starting.
- **Vitest runs in the `node` environment and only collects `src/**/*.test.ts`** (see `vite.config.ts`). There is no DOM in tests. Unit tests therefore cover pure logic only (Tasks 1–2); everything DOM-shaped is verified in the browser (Task 9). Do **not** add jsdom or change `vite.config.ts`.
- **Import alias:** `~` → `src/`. Use `~/scroll/loading`, not relative paths, in files that already use the alias.
- **The two-channel rule** (from `src/scroll/store.ts`): anything that changes every frame is mutated in place and read imperatively — it must never be React state. Only the discrete phase publishes.
- **`@react-three/drei` and `@react-three/fiber` must never be imported by an eagerly-loaded module.** They are code-split behind the lazy `HeroFlower` import and that split is load-bearing. `Loader.tsx` imports neither.
- **Do not modify** `src/scroll/timeline.ts`, `src/scroll/store.ts`, or any gallery/section file other than `Hero.tsx` and `GroundLayer.tsx`.
- **Minimum loader duration is 1600ms**; safety timeout is **10000ms**; glide is **0.9s**; hero fade-in is **0.8s**.
- Commit after every task. Commit messages use the repo's existing style: lowercase `feat:` / `refactor:` / `docs:` prefix, then a short phrase.

---

### Task 1: The progress easing function

A pure function that turns the honest load fraction into the value the wipe draws: monotonic, frame-rate independent, and floored so the name always finishes writing.

**Files:**
- Create: `src/scroll/loadProgress.ts`
- Test: `src/scroll/loadProgress.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MIN_DURATION: number` (1600) and `advance(written: number, target: number, dt: number, elapsed: number): number`. All four arguments are numbers; `dt` and `elapsed` are milliseconds. Task 5's rAF loop calls it once per frame.

- [ ] **Step 1: Write the failing test**

Create `src/scroll/loadProgress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { advance, MIN_DURATION } from './loadProgress'

const AFTER = MIN_DURATION + 1

describe('advance', () => {
  it('moves toward the target without reaching past it', () => {
    const next = advance(0, 0.4, 16, AFTER)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThanOrEqual(0.4)
  })

  it('never goes backwards when the target drops', () => {
    expect(advance(0.6, 0.2, 16, AFTER)).toBe(0.6)
  })

  it('holds short of 1 until the minimum duration has passed', () => {
    let written = 0
    for (let i = 0; i < 200; i++) written = advance(written, 1, 16, 100)
    expect(written).toBeLessThan(1)
    expect(written).toBeGreaterThan(0.9)
  })

  it('reaches exactly 1 once the target is 1 and the floor has passed', () => {
    let written = 0
    for (let i = 0; i < 200; i++) written = advance(written, 1, 16, AFTER)
    expect(written).toBe(1)
  })

  it('is frame-rate independent', () => {
    const oneBigStep = advance(0, 1, 32, AFTER)
    const twoSmallSteps = advance(advance(0, 1, 16, AFTER), 1, 16, AFTER)
    expect(Math.abs(oneBigStep - twoSmallSteps)).toBeLessThan(0.01)
  })

  it('clamps a nonsense target into range', () => {
    expect(advance(0, 5, 16, AFTER)).toBeLessThanOrEqual(1)
    expect(advance(0, -5, 16, AFTER)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- loadProgress`
Expected: FAIL — cannot resolve `./loadProgress`.

- [ ] **Step 3: Write the implementation**

Create `src/scroll/loadProgress.ts`:

```ts
/**
 * The loader's pacing, kept pure so it can be tested without a DOM.
 *
 * Two jobs. First, `written` chases `target` on an exponential curve rather
 * than snapping to it, so a milestone landing all at once reads as a hand
 * speeding up instead of a jump-cut. Second, the floor: a warm cache reports
 * every milestone inside 100ms, and without MIN_DURATION the whole loader
 * would be a flash of black. The name must always finish writing.
 */

/** Below this many ms the loader has not earned its moment. */
export const MIN_DURATION = 1600

/** Chase rate, in units of e-foldings per second. Higher = the pen hurries. */
const CHASE = 3.2

/** How close to the target counts as arrived — an exponential never lands. */
const EPSILON = 0.002

/**
 * One frame of pen movement. `dt` and `elapsed` are milliseconds; `elapsed`
 * is measured from when the loader mounted, not from when writing began.
 */
export const advance = (written: number, target: number, dt: number, elapsed: number): number => {
  const goal = Math.min(1, Math.max(0, target))

  // Frame-rate independent: the same wall-clock time produces the same
  // movement whether it arrived as one 32ms frame or two 16ms ones.
  const k = 1 - Math.exp((-CHASE * dt) / 1000)

  let next = written + (goal - written) * k
  if (goal - next < EPSILON) next = goal

  // Monotonic. The target can drop — drei's progress store resets between
  // loads — and a pen that un-writes a letter is worse than one that stalls.
  next = Math.max(written, Math.min(next, goal))

  // The floor. 0.995 rather than something visibly short: the last half a
  // percent of the wipe is sub-pixel, so an early finish parks the pen on
  // the final glyph rather than leaving an obvious gap.
  return Math.min(next, elapsed >= MIN_DURATION ? 1 : 0.995)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- loadProgress`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/scroll/loadProgress.ts src/scroll/loadProgress.test.ts
git commit -m "feat: the loader's pen pacing, floored so the name always finishes"
```

---

### Task 2: The load channel

The module every other task talks to: milestone accounting, the mutated-in-place progress object, and the published phase.

**Files:**
- Create: `src/scroll/loading.ts`
- Test: `src/scroll/loading.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, all imported by later tasks:
  - `type LoadPhase = 'loading' | 'revealing' | 'done'`
  - `type Milestone = 'chunk' | 'model' | 'frame'`
  - `WEIGHTS: Record<Milestone, number>` — `{ chunk: 0.4, model: 0.4, frame: 0.2 }`
  - `load: { target: number; written: number }` — mutated in place, never published
  - `reportLoad(m: Milestone): void`
  - `reportModelFraction(f: number): void` — `f` is 0–1 within the model band
  - `forceComplete(): void` — the safety timeout's hammer
  - `getPhase(): LoadPhase`
  - `beginReveal(): void` / `finishReveal(): void`
  - `useLoadPhase(): LoadPhase`
  - `resetLoadingForTest(): void` — test-only

- [ ] **Step 1: Write the failing test**

Create `src/scroll/loading.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  beginReveal,
  finishReveal,
  forceComplete,
  getPhase,
  load,
  reportLoad,
  reportModelFraction,
  resetLoadingForTest,
  WEIGHTS,
} from './loading'

beforeEach(() => resetLoadingForTest())

describe('milestone accounting', () => {
  it('weighs the three milestones to exactly 1', () => {
    expect(WEIGHTS.chunk + WEIGHTS.model + WEIGHTS.frame).toBeCloseTo(1)
  })

  it('accumulates target as milestones land', () => {
    reportLoad('chunk')
    expect(load.target).toBeCloseTo(0.4)
    reportLoad('model')
    expect(load.target).toBeCloseTo(0.8)
    reportLoad('frame')
    expect(load.target).toBe(1)
  })

  it('is idempotent and order-independent', () => {
    reportLoad('frame')
    reportLoad('frame')
    expect(load.target).toBeCloseTo(0.2)
    reportLoad('chunk')
    reportLoad('model')
    expect(load.target).toBe(1)
  })

  it('fills the model band continuously', () => {
    reportLoad('chunk')
    reportModelFraction(0.5)
    expect(load.target).toBeCloseTo(0.6)
    reportLoad('model')
    expect(load.target).toBeCloseTo(0.8)
  })

  it('never lets the model fraction pull the target back down', () => {
    reportModelFraction(0.9)
    const high = load.target
    reportModelFraction(0.1)
    expect(load.target).toBe(high)
  })

  it('forceComplete finishes regardless of milestones', () => {
    forceComplete()
    expect(load.target).toBe(1)
  })
})

describe('phase', () => {
  it('starts at loading when the loader plays', () => {
    expect(getPhase()).toBe('loading')
  })

  it('advances one way only', () => {
    beginReveal()
    expect(getPhase()).toBe('revealing')
    beginReveal()
    expect(getPhase()).toBe('revealing')
    finishReveal()
    expect(getPhase()).toBe('done')
  })

  it('cannot be walked backwards', () => {
    finishReveal()
    beginReveal()
    expect(getPhase()).toBe('done')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- loading`
Expected: FAIL — cannot resolve `./loading`.

- [ ] **Step 3: Write the implementation**

Create `src/scroll/loading.ts`:

```ts
import { useSyncExternalStore } from 'react'

/**
 * The load channel — the same two-channel discipline as `scroll/store.ts`,
 * and for the same reason:
 *
 *   `phase`  — discrete, published to React. Three values, one way only.
 *   `load`   — continuous, mutated in place, NEVER published. The wipe reads
 *              it sixty times a second; routing that through React state
 *              would re-render the whole hero on every frame.
 */

export type LoadPhase = 'loading' | 'revealing' | 'done'

/** Written once the loader completes; absent means "play the loader". */
const FLAG = 'ovalese:loaded'

/**
 * What each milestone is worth. `model` is the only band filled
 * continuously — see reportModelFraction.
 */
export const WEIGHTS = { chunk: 0.4, model: 0.4, frame: 0.2 } as const
export type Milestone = keyof typeof WEIGHTS
const MILESTONES = Object.keys(WEIGHTS) as Milestone[]

/**
 * Decided once per page load and memoised, so the answer cannot change
 * underneath a render. sessionStorage throws in some privacy modes; a
 * portfolio must not white-screen over a loader, so failure means "skip".
 */
let decision: boolean | null = null

export const shouldPlayLoader = (): boolean => {
  if (decision !== null) return decision
  try {
    decision = typeof window !== 'undefined' && !window.sessionStorage.getItem(FLAG)
  } catch {
    decision = false
  }
  return decision
}

const markLoaderSeen = () => {
  try {
    window.sessionStorage.setItem(FLAG, '1')
  } catch {
    // Nothing to do — the loader simply plays again next navigation.
  }
}

/** Per-frame values. Mutated in place; read in rAF, never in render. */
export const load = {
  /** 0–1, the honest load fraction. */
  target: 0,
  /** 0–1, the eased value the wipe actually draws. */
  written: 0,
}

const landed = new Set<Milestone>()
let modelFraction = 0

const recompute = () => {
  let t = 0
  for (const m of MILESTONES) {
    if (landed.has(m)) t += WEIGHTS[m]
    else if (m === 'model') t += WEIGHTS.model * modelFraction
  }
  // Monotonic at the source as well as in the easing: drei's progress store
  // resets to 0 between loads, and the pen must not un-write.
  load.target = Math.max(load.target, Math.min(1, t))
}

export const reportLoad = (m: Milestone) => {
  if (landed.has(m)) return
  landed.add(m)
  recompute()
}

/** Fills the model band from the loading manager's own fraction (0–1). */
export const reportModelFraction = (f: number) => {
  if (!Number.isFinite(f)) return
  modelFraction = Math.min(1, Math.max(modelFraction, f))
  recompute()
}

/** The safety timeout's hammer: a failed fetch must never brick the site. */
export const forceComplete = () => {
  load.target = 1
}

let phase: LoadPhase | null = null
const listeners = new Set<() => void>()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export const getPhase = (): LoadPhase => {
  // Resolved lazily rather than at module scope so the sessionStorage read
  // happens on first use, not on import — which keeps this module safe to
  // import from a test with no `window`.
  if (phase === null) phase = shouldPlayLoader() ? 'loading' : 'done'
  return phase
}

const ORDER: LoadPhase[] = ['loading', 'revealing', 'done']

const setPhase = (next: LoadPhase) => {
  const current = getPhase()
  if (ORDER.indexOf(next) <= ORDER.indexOf(current)) return
  phase = next
  for (const fn of listeners) fn()
}

export const beginReveal = () => setPhase('revealing')

export const finishReveal = () => {
  setPhase('done')
  markLoaderSeen()
}

export const useLoadPhase = (): LoadPhase =>
  useSyncExternalStore(subscribe, getPhase, () => 'done' as LoadPhase)

/** Test-only. Nothing in the app may call this. */
export const resetLoadingForTest = () => {
  decision = true
  phase = null
  landed.clear()
  modelFraction = 0
  load.target = 0
  load.written = 0
}

// A dev handle for browser verification — the same spirit as the flower's
// `?tune` panel. Never reaches production.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__ovaleseLoad = {
    load,
    phase: getPhase,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- loading`
Expected: PASS, 9 tests.

Note: `resetLoadingForTest` sets `decision = true` so `getPhase()` starts at `'loading'` in tests without a `window`.

- [ ] **Step 5: Verify the whole suite and types still pass**

Run: `npm test && npm run typecheck`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/scroll/loading.ts src/scroll/loading.test.ts
git commit -m "feat: the load channel - milestones, phase, and a per-frame progress object"
```

---

### Task 3: Report the milestones

Wire the three milestones from where they actually happen, and share the hero ground constant so the loader's backdrop cannot drift from the section's.

**Files:**
- Modify: `src/sections/GroundLayer.tsx:29` (export the constant)
- Modify: `src/three/HeroFlower.tsx` (model fraction, model, frame)
- Modify: `src/sections/Hero.tsx:8-10` (chunk)

**Interfaces:**
- Consumes: `reportLoad`, `reportModelFraction` from `~/scroll/loading` (Task 2).
- Produces: `HERO_GROUND: string` exported from `~/sections/GroundLayer`, consumed by Task 5's `Loader`.

- [ ] **Step 1: Export the hero ground constant**

In `src/sections/GroundLayer.tsx`, change line 29 from `const HERO_GROUND` to:

```ts
/**
 * The one ground that is not a flat token. Hero, README §100.
 *
 * Exported because the loader paints its backdrop with it: the loader's
 * fade-out is invisible in the hero precisely because the two are the same
 * gradient, and a copy-pasted second definition would drift.
 */
export const HERO_GROUND = 'radial-gradient(ellipse at 10% 90%, #191411, #0d0c0a 58%)'
```

- [ ] **Step 2: Report the chunk milestone**

In `src/sections/Hero.tsx`, add the import at the top:

```ts
import { reportLoad } from '~/scroll/loading'
```

and replace the lazy declaration at lines 8–10 with:

```ts
const HeroFlower = lazy(() =>
  import('~/three/HeroFlower').then((m) => {
    // First of the loader's three milestones — three.js and drei have
    // landed, which is the biggest single wait on a cold cache.
    reportLoad('chunk')
    return { default: m.HeroFlower }
  }),
)
```

- [ ] **Step 3: Report the model fraction, the model, and the first frame**

In `src/three/HeroFlower.tsx`:

Add to the existing drei import on line 3 and add the loading import:

```ts
import { useGLTF, useProgress } from '@react-three/drei'
```

```ts
import { reportLoad, reportModelFraction } from '~/scroll/loading'
```

Inside `Bloom`, immediately after the `useGLTF` line (line 51), add:

```ts
  // The GLB and its buffers are in hand — this component only renders past
  // useGLTF's suspend. The continuous fill of this band happens in the
  // module-scope subscription at the bottom of the file.
  reportLoad('model')

  // The first frame the flower is actually part of. `useFrame` runs before
  // that frame's draw, so this leads the pixels by one frame — invisible,
  // and far simpler than reaching for a render callback.
  const painted = useRef(false)
```

Inside the existing `useFrame` callback (line 159), as the **first** statement — before the `if (frozen) return`, so a reduced-motion still still reports:

```ts
    if (!painted.current) {
      painted.current = true
      reportLoad('frame')
    }
```

At the bottom of the file, beside `useGLTF.preload(MODEL_URL)`:

```ts
/**
 * Fills the loader's model band continuously rather than in one jump at the
 * end. drei's progress store taps three's DefaultLoadingManager, which the
 * GLTFLoader reports through. Subscribed at module scope, inside this lazy
 * chunk on purpose: `Loader` must not import drei or the code-split that
 * keeps three.js out of the initial bundle would be undone.
 */
useProgress.subscribe((s) => reportModelFraction(s.progress / 100))
```

- [ ] **Step 4: Verify nothing broke**

Run: `npm run typecheck && npm test`
Expected: all green — no behaviour has changed yet; the loader does not exist, so the reports go into a store nobody reads.

- [ ] **Step 5: Verify the reports actually fire**

Run: `npm run dev`, open `http://localhost:5173/`, and in the browser console:

```js
__ovaleseLoad.load
```

Expected: `{ target: 1, written: 0 }` once the flower is visible. `written` stays 0 — nothing drives it until Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/sections/GroundLayer.tsx src/sections/Hero.tsx src/three/HeroFlower.tsx
git commit -m "feat: report the three load milestones and share the hero ground"
```

---

### Task 4: Make the hero revealable

Split the name into per-line spans the loader can measure against, and let the phase hold the hero's content invisible until the reveal.

**Files:**
- Modify: `src/sections/Hero.tsx`
- Modify: `src/styles/index.css` (append near the `.par` block, around line 267)

**Interfaces:**
- Consumes: `useLoadPhase` from `~/scroll/loading` (Task 2).
- Produces: a `#hero` section carrying `data-reveal="<phase>"`, and two `[data-hero-line]` spans inside the `<h1>` — the FLIP targets Task 7 measures.

- [ ] **Step 1: Add the reveal CSS**

Append to `src/styles/index.css`, after the `.par` rule (line 267):

```css
/* ---------------------------------------------------------------------------
   The loader's reveal — see components/Loader.tsx and scroll/loading.ts

   Driven by `data-reveal` on the hero section rather than by inline styles,
   for one reason: GSAP owns the loader's copy of the name during the glide,
   and having React write opacity onto the real h1 at the same moment is two
   animation systems fighting over one property. CSS with a delay lands the
   handover on time without either of them knowing about the other.

   When the loader is skipped the phase is 'done' from the first paint, no
   rule below matches, and the hero renders exactly as it always has. That
   is the point — these rules must be inert on every visit but the first.
   --------------------------------------------------------------------------- */
[data-reveal='loading'] .hero-veil,
[data-reveal='loading'] .hero-name-veil {
  opacity: 0;
}

[data-reveal='revealing'] .hero-veil {
  opacity: 1;
  transition: opacity 800ms ease var(--veil-delay, 0ms);
}

/* The name is the exception: it does not fade in from nothing, it takes over
   from the loader's identical copy in the last breath of the glide. */
[data-reveal='revealing'] .hero-name-veil {
  opacity: 1;
  transition: opacity 140ms ease 760ms;
}

@media (prefers-reduced-motion: reduce) {
  /* No choreography — the loader cross-fades out and the hero is simply
     there. Delays would read as the page hanging. */
  [data-reveal='revealing'] .hero-veil,
  [data-reveal='revealing'] .hero-name-veil {
    transition: opacity 240ms ease;
  }
}
```

- [ ] **Step 2: Split the name into measurable lines**

In `src/sections/Hero.tsx`, replace the `<h1>` (lines 127–134) with:

```tsx
      <h1
        className="font-hero text-hero-m text-cream sm:text-hero sm:mix-blend-difference par hero-name-veil"
        style={{ '--depth': -8 } as CSSProperties}
      >
        {/* Two block spans rather than a <br>: the loader glides its own copy
            of the name onto these, and FLIP needs a per-line box to measure.
            Renders identically — each span is a full-width block whose single
            line box inherits the h1's alignment and line-height. */}
        <span className="block" data-hero-line="0">
          Denise
        </span>
        <span className="block" data-hero-line="1">
          Cacanando
        </span>
      </h1>
```

- [ ] **Step 3: Publish the phase and veil the rest of the hero**

In `src/sections/Hero.tsx`, add the import:

```ts
import { useLoadPhase } from '~/scroll/loading'
```

Inside the component, above `const anchorRef`:

```ts
  // Discrete and low-frequency — the safe channel to render from. The wipe's
  // per-frame value never comes near React; see scroll/loading.ts.
  const phase = useLoadPhase()
```

Put the phase on the section (line 60):

```tsx
  <section id="hero" data-reveal={phase} className="relative h-screen w-full overflow-hidden">
```

Then add `hero-veil` to the class list of each element that fades in after the name, with its stagger delay as an inline custom property. Five elements:

1. The flower's canvas host (line 66) — `className="pointer-events-none absolute inset-0 par hero-veil"`, and extend its style to `{ '--depth': 8, '--veil-delay': '200ms' } as CSSProperties`.
2. The xl tagline (line 141) — append ` hero-veil` to the class list, style becomes `{ '--depth': -12, '--veil-delay': '620ms' } as CSSProperties`.
3. The xl fragment (line 148) — append ` hero-veil`, style `{ '--depth': -12, '--veil-delay': '700ms' } as CSSProperties`.
4. The below-xl tagline + fragment wrapper (line 162) — append ` hero-veil` to the class list and add `style={{ '--veil-delay': '620ms' } as CSSProperties}` (this div has no style prop today).
5. The xl meta block (line 181) — append ` hero-veil`, style `{ '--depth': -12, '--veil-delay': '780ms' } as CSSProperties`.

- [ ] **Step 4: Verify the hero is unchanged for a returning visitor**

Run: `npm run typecheck && npm test`, then `npm run dev`.

In the browser console, before loading the page, seed the flag so the loader path is skipped:

```js
sessionStorage.setItem('ovalese:loaded', '1')
```

Reload. Expected: the hero renders exactly as it does on `main` — name, tagline, fragment, meta and flower all present, nothing invisible. Confirm with:

```js
document.querySelector('#hero').dataset.reveal   // 'done'
document.querySelectorAll('#hero [data-hero-line]').length   // 2
```

- [ ] **Step 5: Verify the veil actually veils**

In the console:

```js
sessionStorage.removeItem('ovalese:loaded')
```

Reload. Expected: the hero is **empty** — near-black ground, no type, no flower. It stays that way, because nothing advances the phase until Task 5. This is the correct intermediate state.

Restore the flag afterwards so the dev server is usable: `sessionStorage.setItem('ovalese:loaded', '1')`.

- [ ] **Step 6: Commit**

```bash
git add src/sections/Hero.tsx src/styles/index.css
git commit -m "feat: per-line name spans and a phase-driven veil over the hero"
```

---

### Task 5: The loader layer

The overlay itself: the hero's ground, the finished name in hero typography, the animated `loading...`, the scroll lock, and a hard cut-over when loading completes. No wipe and no glide yet — those are Tasks 6 and 7.

**Files:**
- Create: `src/components/Loader.tsx`
- Modify: `src/routes/ScrollPage.tsx`
- Modify: `src/styles/index.css` (append)

**Interfaces:**
- Consumes: `HERO_GROUND` from `~/sections/GroundLayer` (Task 3); `load`, `useLoadPhase`, `beginReveal`, `finishReveal` from `~/scroll/loading` (Task 2) in `Loader`, plus `getPhase` and `useLoadPhase` in `ScrollPage`; `advance` from `~/scroll/loadProgress` (Task 1); `getLenis` from `~/scroll/useLenis`.
- Produces: `Loader` — a default-free named export, `export const Loader = () => …`, taking no props.

- [ ] **Step 1: Add the loading-dots CSS**

Append to `src/styles/index.css`, after the reveal block from Task 4:

```css
/* The loader's three dots. Separate spans rather than animating `content`:
   `content` on a pseudo-element is not interpolable and jumps between
   discrete strings, which reads as a stutter next to a hand-written name. */
.loading-dot {
  animation: ovalese-loading-dot 1.4s ease-in-out infinite;
}
.loading-dot:nth-child(2) {
  animation-delay: 0.18s;
}
.loading-dot:nth-child(3) {
  animation-delay: 0.36s;
}
@keyframes ovalese-loading-dot {
  0%,
  60%,
  100% {
    opacity: 0.25;
  }
  30% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-dot {
    animation: none;
    opacity: 0.6;
  }
}
```

- [ ] **Step 2: Write the loader**

Create `src/components/Loader.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { HERO_GROUND } from '~/sections/GroundLayer'
import { advance } from '~/scroll/loadProgress'
import { beginReveal, finishReveal, load, useLoadPhase } from '~/scroll/loading'
import { getLenis } from '~/scroll/useLenis'

/**
 * The opening beat — see docs/superpowers/specs/2026-08-07-hero-loader-design.md.
 *
 * A fixed layer over the whole page carrying its own copy of the name, set
 * in the EXACT hero classes: same face, same size, same line breaks, same
 * blend mode. That is not decoration, it is the whole trick — when the glide
 * lands (Task 7) the loader's copy and the real <h1> are the same pixels, so
 * the handover has nothing to give it away.
 *
 * Deliberately imports neither three.js nor drei. The flower is code-split
 * behind a lazy import and the loader exists to cover exactly that wait; an
 * eager drei import here would pull the wait into the loader itself.
 */

/** The name, one entry per line — the same split as the hero's h1 spans. */
const LINES = ['Denise', 'Cacanando']

export const Loader = () => {
  const phase = useLoadPhase()
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([])

  /**
   * The scroll lock. The page behind this layer is fully live — mounted,
   * measured and pinned — so without this a visitor can wheel away from a
   * hero they have not been shown yet.
   *
   * Lenis owns wheel, touch and keyboard on the normal path, so stopping it
   * IS the lock. The preventDefault pair is for reduced motion, where
   * useLenis returns early and there is no instance to stop.
   */
  useEffect(() => {
    window.scrollTo(0, 0)
    getLenis()?.stop()
    const block = (e: Event) => e.preventDefault()
    window.addEventListener('wheel', block, { passive: false })
    window.addEventListener('touchmove', block, { passive: false })
    return () => {
      window.removeEventListener('wheel', block)
      window.removeEventListener('touchmove', block)
      getLenis()?.start()
    }
  }, [])

  /**
   * The pen. A plain rAF rather than GSAP's ticker or React state: the value
   * changes every frame and lands on the DOM directly, which is the same
   * rule `frame` follows in scroll/store.ts.
   */
  useEffect(() => {
    if (phase !== 'loading') return
    let raf = 0
    let last = 0
    const start = performance.now()

    const tick = (now: number) => {
      const dt = last ? now - last : 16
      last = now
      load.written = advance(load.written, load.target, dt, now - start)
      if (load.written >= 1) {
        beginReveal()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  /**
   * Hand over. Task 7 replaces this with the FLIP glide; for now the swap is
   * immediate, which is enough to prove the phase machinery end to end.
   */
  useEffect(() => {
    if (phase !== 'revealing') return
    finishReveal()
  }, [phase])

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: HERO_GROUND }}
    >
      {/* The blend mode is copied from the h1 deliberately: the loader's
          backdrop and the hero's ground are the same gradient and the flower
          is still invisible at handover, so cream-through-difference resolves
          identically on both sides of the swap. */}
      <div className="font-hero text-hero-m text-cream sm:text-hero sm:mix-blend-difference text-center">
        {LINES.map((line, i) => (
          <span
            key={line}
            ref={(el) => {
              lineRefs.current[i] = el
            }}
            className="block"
          >
            {line}
          </span>
        ))}
      </div>

      <p className="mt-8 font-mono text-meta tracking-caption uppercase text-cream/40">
        loading
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Mount it, and stop the restore from fighting it**

In `src/routes/ScrollPage.tsx`, add the imports:

```ts
import { Loader } from '~/components/Loader'
import { getPhase, useLoadPhase } from '~/scroll/loading'
```

Inside the component, beside the other hooks (after `const compact = useCompactLayout()`):

```ts
  const phase = useLoadPhase()
```

In the restore effect, immediately after `const saved = sessionStorage.getItem(KEY)` (line 67), add:

```ts
    // The loader locks the page at the top and is about to write the name
    // across it; a restore would yank the document out from under it. Gated
    // on the live phase rather than on shouldPlayLoader(): this effect runs
    // again when the visitor comes back off a detail route, and by then the
    // phase is 'done' and the restore must happen normally.
    const loading = getPhase() !== 'done'
```

and change the `refreshAfterFonts` callback's guard (line 81) from:

```ts
      if (cancelled || restored.current) return
```

to:

```ts
      if (cancelled || restored.current) return
      if (loading) {
        restored.current = true
        window.scrollTo(0, 0)
        return
      }
```

Finally, render the loader as the last child of the fragment, after `<NearStage />`:

```tsx
      {phase !== 'done' && <Loader />}
```

- [ ] **Step 4: Verify the loader plays and hands over**

Run: `npm run typecheck && npm test`, then `npm run dev`.

In the console: `sessionStorage.removeItem('ovalese:loaded')`, then reload.

Expected:
- Black (warm near-black) screen, the name centred in Pinyon Script at full opacity, `loading` with three cycling dots beneath it.
- It holds for at least 1.6 seconds even on a warm cache.
- Then the loader vanishes and the full hero — name in position, tagline, fragment, meta, flower — fades in.
- Scrolling during the loader does nothing.

Then reload again *without* clearing the flag. Expected: no loader at all, hero immediately.

- [ ] **Step 5: Commit**

```bash
git add src/components/Loader.tsx src/routes/ScrollPage.tsx src/styles/index.css
git commit -m "feat: the loader layer - hero ground, the name, and a locked page"
```

---

### Task 6: The handwriting wipe

Reveal the name left to right as progress advances, with a soft pen edge, at one constant speed across both lines.

**Files:**
- Modify: `src/components/Loader.tsx`

**Interfaces:**
- Consumes: everything from Task 5.
- Produces: no new exports. Internal helpers `glyphRect(el)` and `paintWipe(els, widths, p)` that Task 7 also uses (`glyphRect`).

- [ ] **Step 1: Add the measurement and wipe helpers**

In `src/components/Loader.tsx`, above the component:

```tsx
/**
 * The glyph bounds of an element's text, not the element's own box.
 *
 * A `display: block` line span is full-width, so its rect says nothing about
 * where the letters are. A Range over its contents gives the inked bounds —
 * which means the hero h1's alignment (right at sm+, left below) and its
 * parallax `par` transform are absorbed by the measurement instead of having
 * to be reasoned about at all.
 */
const glyphRect = (el: Element): DOMRect => {
  const range = document.createRange()
  range.selectNodeContents(el)
  return range.getBoundingClientRect()
}

/**
 * The pen. A mask gradient rather than clip-path: the soft ramp between the
 * two stops IS the pen tip, and it is sized in `em` so it scales with the
 * type instead of being a fixed number of pixels at every breakpoint.
 *
 * Progress is split between the lines in proportion to their measured widths
 * so the pen crosses both at one constant speed, rather than spending half
 * the write on the shorter word.
 */
const paintWipe = (els: (HTMLElement | null)[], widths: number[], p: number) => {
  const total = widths.reduce((a, b) => a + b, 0)
  if (!total) return
  let before = 0
  els.forEach((el, i) => {
    if (!el) return
    const span = widths[i] / total
    // How far the pen has crossed THIS line, 0–1.
    const local = Math.min(1, Math.max(0, (p - before) / span))
    before += span
    if (local >= 1) {
      // Cleared rather than parked at 100%: a mask whose ramp ends exactly
      // at the edge still feathers the final glyph.
      el.style.maskImage = ''
      el.style.webkitMaskImage = ''
      return
    }
    const pct = local * 100
    const g = `linear-gradient(90deg, #000 calc(${pct}% - 0.35em), transparent calc(${pct}% + 0.15em))`
    el.style.maskImage = g
    el.style.webkitMaskImage = g
  })
}
```

`webkitMaskImage` is not in React's `CSSProperties` but is a real property on `CSSStyleDeclaration` in TypeScript's DOM lib, so assigning it on `el.style` type-checks. If `npm run typecheck` disagrees, use `el.style.setProperty('-webkit-mask-image', g)` instead.

- [ ] **Step 2: Gate the wipe on the font, and drive it from the rAF**

Pinyon Script must be loaded before the first stroke — wiping a fallback face and swapping mid-write would break the illusion outright. Add this state and effect to `Loader`, above the rAF effect:

```tsx
  /** Line widths, measured once the real face is in. Empty = not ready. */
  const widths = useRef<number[]>([])
```

```tsx
  /**
   * The write cannot start on a fallback face. Capped at 1.5s: a font that
   * never arrives must not hold the name hostage — the wipe simply starts
   * against whatever is rendering.
   */
  useEffect(() => {
    let cancelled = false
    const measure = () => {
      if (cancelled) return
      widths.current = lineRefs.current.map((el) => (el ? glyphRect(el).width : 0))
    }
    const ready = document.fonts
      ? document.fonts.load('1em "Pinyon Script"').then(measure)
      : Promise.resolve().then(measure)
    const cap = window.setTimeout(measure, 1500)
    void ready
    return () => {
      cancelled = true
      window.clearTimeout(cap)
    }
  }, [])
```

Then in the rAF `tick`, replace the body between `last = now` and the `if (load.written >= 1)` check so it paints:

```tsx
      load.written = advance(load.written, load.target, dt, now - start)
      if (widths.current.length) paintWipe(lineRefs.current, widths.current, load.written)
```

- [ ] **Step 3: Start the lines hidden**

An unmasked line is fully visible, so before the first paint the name would flash whole. Add to the line span's JSX in the render, as an inline style:

```tsx
            style={{ maskImage: 'linear-gradient(90deg, transparent 0%, transparent 100%)' }}
```

This is the "pen has not started" state, overwritten by the first `paintWipe` and cleared when a line completes.

- [ ] **Step 4: Verify the wipe**

Run: `npm run typecheck`, then `npm run dev`, clear the session flag, reload.

Expected:
- The name is not present at first, then appears left to right — `Denise` first, then `Cacanando` — with a soft leading edge, as if being written.
- The pen moves at a visibly even speed across both words (the second, longer word takes proportionally longer).
- Both words are complete and crisp — no feathered final letter — before the loader hands over.

To watch it slowly, throttle the network to "Slow 3G" in DevTools and reload with the flag cleared.

- [ ] **Step 5: Commit**

```bash
git add src/components/Loader.tsx
git commit -m "feat: the pen - a masked handwriting wipe paced across both lines"
```

---

### Task 7: The glide

Replace the hard cut-over with the FLIP handoff, and let the hero fade in around the landing name.

**Files:**
- Modify: `src/components/Loader.tsx`

**Interfaces:**
- Consumes: `glyphRect` (Task 6), the `[data-hero-line]` spans (Task 4), `gsap`.
- Produces: no new exports.

- [ ] **Step 1: Add the glide**

In `src/components/Loader.tsx`, add the import:

```ts
import { gsap } from 'gsap'
```

and add a ref for the backdrop, on the outer div:

```tsx
  const backdropRef = useRef<HTMLDivElement>(null)
```

Replace the placeholder hand-over effect from Task 5 with:

```tsx
  /**
   * The handover. FLIP: measure where the loader's lines are, measure where
   * the hero's are, translate by the difference. Transform only — no
   * font-size and no layout animation, which is why the two renderings stay
   * the same shape the whole way across.
   *
   * The real h1 fades up underneath on a CSS delay (see index.css) rather
   * than being animated here: two systems writing one element's opacity is
   * how handovers get janky.
   */
  useEffect(() => {
    if (phase !== 'revealing') return

    const own = lineRefs.current.filter((el): el is HTMLSpanElement => Boolean(el))
    const targets = document.querySelectorAll<HTMLElement>('#hero [data-hero-line]')

    const tl = gsap.timeline({ onComplete: finishReveal })

    own.forEach((el, i) => {
      const target = targets[i]
      if (!target) return
      const from = glyphRect(el)
      const to = glyphRect(target)
      tl.to(el, {
        x: to.left - from.left,
        y: to.top - from.top,
        duration: 0.9,
        ease: 'power2.inOut',
      }, 0)
    })

    if (backdropRef.current) {
      // What this actually reveals is the side rail and the ticker: behind
      // the hero itself the gradient is identical, so there is nothing to see
      // it cross.
      tl.to(backdropRef.current, { opacity: 0, duration: 0.9, ease: 'power1.inOut' }, 0)
    }

    // The last breath — the loader's copy dissolves as the real h1, on its
    // matching 760ms CSS delay, comes up in the same place.
    tl.to(own, { opacity: 0, duration: 0.14, ease: 'none' }, 0.76)

    // A viewport change mid-glide invalidates every target measured above.
    // Snapping to the landed state is both simpler and less jarring than
    // watching the name travel to a position that no longer exists.
    const snap = () => tl.progress(1)
    window.addEventListener('resize', snap, { once: true })

    return () => {
      window.removeEventListener('resize', snap)
      tl.kill()
    }
  }, [phase])
```

- [ ] **Step 2: Attach the backdrop ref**

The gradient must fade independently of the name, so it needs its own element. Restructure the returned JSX so the backdrop is a sibling of the content rather than its parent:

```tsx
  return (
    <div aria-hidden="true" className="fixed inset-0 z-50">
      <div ref={backdropRef} className="absolute inset-0" style={{ background: HERO_GROUND }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* …the name block and the loading line, unchanged… */}
      </div>
    </div>
  )
```

- [ ] **Step 3: Verify the glide**

Run: `npm run typecheck`, then `npm run dev`, clear the session flag, reload.

Expected:
- The name finishes writing, then travels — as one movement, no resize, no reflow — to its hero position: top-right at desktop widths, top-left below `sm`.
- It lands exactly on the real `<h1>`. Scrub the last frames by screenshotting repeatedly; there must be no jump at the swap.
- The tagline, fragment, meta line and flower fade in behind it in that order.
- The rail and ticker appear as the backdrop clears.

Check both compositions: a window at ≥1280px (right-aligned h1) and one at ~390px (left-aligned, `text-hero-m`).

- [ ] **Step 4: Commit**

```bash
git add src/components/Loader.tsx
git commit -m "feat: the glide - the name takes its place in the hero"
```

---

### Task 8: Reduced motion and the failure path

The visitor who declined motion gets the same information with none of the choreography; a dead network never leaves a black screen.

**Files:**
- Modify: `src/components/Loader.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` from `~/scroll/useReducedMotion`; `forceComplete` from `~/scroll/loading`.
- Produces: no new exports.

- [ ] **Step 1: Add the safety timeout**

In `src/components/Loader.tsx`, add `forceComplete` to the `~/scroll/loading` import, and add this effect above the rAF effect:

```tsx
  /**
   * The hammer. A GLB that 404s or a network that dies mid-fetch would
   * otherwise leave the site behind a permanent black screen — the one
   * failure this feature must not be able to cause.
   */
  useEffect(() => {
    const t = window.setTimeout(forceComplete, 10_000)
    return () => window.clearTimeout(t)
  }, [])
```

- [ ] **Step 2: Skip the choreography under reduced motion**

Add the import:

```ts
import { useReducedMotion } from '~/scroll/useReducedMotion'
```

and inside the component:

```tsx
  const reduced = useReducedMotion()
```

In the **wipe** rAF effect, guard the paint so the name simply stands there complete:

```tsx
      if (!reduced && widths.current.length) paintWipe(lineRefs.current, widths.current, load.written)
```

and add `reduced` to that effect's dependency array. Under reduced motion the lines must not start hidden either, so make the line span's inline mask conditional:

```tsx
            style={reduced ? undefined : { maskImage: 'linear-gradient(90deg, transparent 0%, transparent 100%)' }}
```

In the **glide** effect, take an early branch before building the timeline:

```tsx
    if (reduced) {
      // No travel and no cross-fade: the loader dissolves, the hero is
      // simply there. The 240ms matches the reduced-motion transition on
      // .hero-veil in index.css.
      const tl = gsap.timeline({ onComplete: finishReveal })
      tl.to([backdropRef.current, ...own], { opacity: 0, duration: 0.24, ease: 'none' })
      return () => {
        tl.kill()
      }
    }
```

placed immediately after `own` and `targets` are resolved, and add `reduced` to the effect's dependency array.

Note the minimum duration still applies under reduced motion — it is a pacing floor, not an animation, and the visitor still needs the flower to have loaded.

- [ ] **Step 3: Verify reduced motion**

Run: `npm run dev`. In DevTools open the command menu (Ctrl+Shift+P) and run "Emulate CSS prefers-reduced-motion: reduce". Clear the session flag and reload.

Expected: the complete name appears immediately with static dots, holds while loading, then the whole loader cross-fades out and the hero appears — no writing, no travel. Scroll is still locked while it is up.

- [ ] **Step 4: Verify the failure path**

With reduced motion off, block the model in DevTools: Network tab → right-click any request → "Block request URL" → add `*/3d/dahlia_bloom.glb`. Clear the session flag and reload.

Expected: the loader writes the name, waits, and after ~10 seconds hands over anyway. The hero appears complete except for the flower. The site is usable and scrollable.

Remove the block afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/components/Loader.tsx
git commit -m "feat: reduced-motion loader and a ten-second failsafe"
```

---

### Task 9: Full verification pass

Everything above was checked one slice at a time. This confirms the whole sequence, on both compositions, without breaking what was already there.

**Files:** none — verification only.

- [ ] **Step 1: Suite and types**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green; the build succeeds.

- [ ] **Step 2: Confirm the code-split survived**

Run: `npm run build` and inspect the output file list.

Expected: three.js/drei remain in a separate chunk from the entry chunk. If the entry chunk has grown by hundreds of kB, something in the loader path pulled drei eagerly — check `Loader.tsx`'s imports.

- [ ] **Step 3: The full sequence, desktop**

`npm run dev`, window ≥1280px, `sessionStorage.removeItem('ovalese:loaded')`, reload.

Screenshot at intervals through: black ground → name mid-write → name complete with dots → mid-glide → landed with hero fading in → settled hero. Confirm no jump at the swap and no flash of un-styled or duplicated name.

Note: the automation tab is rAF-throttled, so screenshots are what pump frames — take them in a steady sequence rather than expecting real-time playback.

- [ ] **Step 4: The full sequence, mobile**

Same, at ~390px wide. Confirm the name lands top-left on `text-hero-m`, and that the below-`xl` tagline/fragment block fades in above the ticker.

- [ ] **Step 5: Confirm nothing regressed**

With the flag set (no loader):
- Scroll the full page — hero pin, gallery rings, seed, contact all behave as before.
- Open a detail page and come back: the page restores to the scroll position it left from, and **no loader plays**.
- Hard-refresh mid-page: position is kept, no loader.

- [ ] **Step 6: Commit any fixes and close out**

If Steps 1–5 required changes, commit them:

```bash
git add -A
git commit -m "fix: <what the verification pass turned up>"
```

If nothing needed fixing, there is nothing to commit — say so rather than making an empty commit.
