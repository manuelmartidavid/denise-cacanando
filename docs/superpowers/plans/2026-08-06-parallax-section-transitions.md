# Parallax Section Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scroll-driven "lift" parallax on every section transition, gated by ground contrast — one `--par` CSS variable per section, consumed by one CSS rule.

**Architecture:** A pure module (`src/scroll/parallax.ts`) maps scroll position to an eased −1…+1 scalar per section, scaled by a boundary intensity derived from ground tones. The existing whole-document ScrollTrigger (the one that already writes `--seam`) writes `--par` onto each section element per frame, reading the label offsets/spans the section triggers register on refresh. Elements opt in with `className="par"` plus an inline `--depth`.

**Tech Stack:** GSAP ScrollTrigger (already present), Lenis (untouched), Tailwind v4 CSS, vitest. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-06-parallax-section-transitions-design.md` — read it before starting.

## Global Constraints

- No new dependencies. `@react-spring/parallax` is explicitly rejected; no GSAP Observer.
- Invariant 1: per-frame values reach the DOM as CSS custom properties, never React state.
- Invariant 2: GSAP never leaves `src/scroll/timeline.ts` — components only gain a class and a `--depth`.
- Boundary intensities are **derived** from ground declarations (`scene.ground` + the fixed hero/about/contact tones). Never a hand-maintained boundary list.
- Teardown leaves `--par` **absent, not defaulted** — mirror how `killTimeline` removes `--seam`.
- Reduced motion: no `--par` machinery is built when `prefersReducedMotion()` holds; the CSS fallback `var(--par, 0)` must render today's layout exactly.
- Depth values: crop/imagery **+8**, headings/content planes **−8**, captions/meta/counters **−12** (vh percent). Everything unlisted keeps depth 0.
- The seed system (`--seam`, `--seed`, `--seam-pin`, SeedLayer) and the scene centrepieces (field, dials, track) are not touched by any task.
- Commit messages: lowercase `feat:` / `docs:` style, matching `git log`.
- Verify commands: `npm test` (vitest run), `npm run typecheck`.

---

### Task 1: Ground tones become declared, shared knowledge (`toneFor`)

The intensity rule needs each section's tone. Gallery scenes already declare `ground`; hero/about/contact tones are currently buried in `GroundLayer`'s `groundFor`. Move the tone knowledge into `scenes.ts` (where the gallery declarations live) and make `GroundLayer` consume it, so parallax and grounds can never disagree.

**Files:**
- Modify: `src/scroll/scenes.ts` (add `Tone`, `toneFor` — near `sceneByLabel`)
- Modify: `src/sections/GroundLayer.tsx:40-45` (refactor `groundFor` to read `toneFor`)
- Test: `src/scroll/scenes.test.ts` (append)

**Interfaces:**
- Consumes: existing `sceneByLabel(label)`, `Label` type, `scene.ground: 'dark' | 'cream'`.
- Produces: `export type Tone = 'dark' | 'cream'` and `export const toneFor = (label: Label): Tone` — Task 2's tests and Task 3's timeline integration import both from `~/scroll/scenes`.

- [ ] **Step 1: Write the failing test** — append to `src/scroll/scenes.test.ts` (match the file's existing import style):

```ts
describe('toneFor', () => {
  it('reads gallery tones from the scene declarations', () => {
    expect(toneFor('g1')).toBe('cream')
    expect(toneFor('g2')).toBe('dark')
    expect(toneFor('g3')).toBe('dark')
    expect(toneFor('g4')).toBe('cream')
  })

  it('declares the three fixed sections', () => {
    expect(toneFor('hero')).toBe('dark')
    expect(toneFor('about')).toBe('cream')
    expect(toneFor('contact')).toBe('dark')
  })
})
```

Add `toneFor` to the test file's import from `./scenes`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/scroll/scenes.test.ts`
Expected: FAIL — `toneFor` is not exported.

- [ ] **Step 3: Implement** — in `src/scroll/scenes.ts`, after `sceneByLabel`:

```ts
export type Tone = 'dark' | 'cream'

/**
 * Ground tone per label. Gallery scenes declare theirs (`scene.ground`); the
 * three fixed sections are declared here. This is the single source both
 * `GroundLayer` and the parallax boundary intensities read — the two must
 * never disagree about what colour a boundary joins.
 */
export const toneFor = (label: Label): Tone => {
  const scene = sceneByLabel(label)
  if (scene) return scene.ground
  return label === 'about' ? 'cream' : 'dark'
}
```

- [ ] **Step 4: Refactor `GroundLayer`** — in `src/sections/GroundLayer.tsx`, replace the body of `groundFor` (keep `HERO_GROUND`, `CREAM`, `INK` as they are):

```ts
import { LABELS, toneFor, type Label } from '~/scroll/scenes'

const groundFor = (label: Label): string => {
  if (label === 'hero') return HERO_GROUND
  return toneFor(label) === 'cream' ? CREAM : INK
}
```

(The `sceneByLabel` import becomes unused there — remove it.)

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- src/scroll/scenes.test.ts` then `npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/scroll/scenes.ts src/scroll/scenes.test.ts src/sections/GroundLayer.tsx
git commit -m "feat: ground tones are declared once and shared (toneFor)"
```

---

### Task 2: The pure parallax module

All mapping logic, no DOM. Sibling to `seed.ts` / `timelineMath.ts`.

**Files:**
- Create: `src/scroll/parallax.ts`
- Test: `src/scroll/parallax.test.ts`

**Interfaces:**
- Consumes: `Tone` from `~/scroll/scenes` (Task 1).
- Produces (Task 3 imports all of these from `./parallax`):
  - `CALM: number` (0.35)
  - `type EdgeIntensity = { enter: number; exit: number }`
  - `edgeIntensities(tones: readonly Tone[]): EdgeIntensity[]`
  - `rawParAt(scroll: number, top: number, holdEnd: number, viewportH: number): number`
  - `easePar(raw: number): number`
  - `type ParGeometry = { top: number; holdEnd: number; enter: number; exit: number }`
  - `parAt(scroll: number, geo: ParGeometry, viewportH: number): number`

- [ ] **Step 1: Write the failing tests** — create `src/scroll/parallax.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CALM, easePar, edgeIntensities, parAt, rawParAt } from './parallax'
import { LABELS, toneFor } from './scenes'

describe('edgeIntensities', () => {
  it('gives the full gesture across a tone flip and CALM across a match', () => {
    const [hero, about, g1, g2, g3, g4, contact] = edgeIntensities([
      'dark', 'cream', 'cream', 'dark', 'dark', 'cream', 'dark',
    ])
    expect(hero).toEqual({ enter: 1, exit: 1 }) // enter edge never seen; exit flips to cream
    expect(about).toEqual({ enter: 1, exit: CALM }) // in loud from hero, out quiet into g1
    expect(g1).toEqual({ enter: CALM, exit: 1 })
    expect(g2).toEqual({ enter: 1, exit: CALM })
    expect(g3).toEqual({ enter: CALM, exit: 1 })
    expect(g4).toEqual({ enter: 1, exit: 1 })
    expect(contact).toEqual({ enter: 1, exit: 1 }) // exit edge never seen
  })

  it('derives from the live declarations without a hand-kept list', () => {
    // The spine above is today's; this guards the derivation against reorders.
    expect(edgeIntensities(LABELS.map(toneFor))).toHaveLength(LABELS.length)
  })
})

describe('rawParAt', () => {
  const H = 800

  it('ramps -1 to 0 across one viewport of entry', () => {
    expect(rawParAt(1200, 2000, 2000, H)).toBe(-1)
    expect(rawParAt(1600, 2000, 2000, H)).toBe(-0.5)
    expect(rawParAt(2000, 2000, 2000, H)).toBe(0)
  })

  it('clamps below the entry ramp', () => {
    expect(rawParAt(0, 2000, 2000, H)).toBe(-1)
  })

  it('holds 0 across a pinned run', () => {
    expect(rawParAt(2500, 2000, 4000, H)).toBe(0)
    expect(rawParAt(4000, 2000, 4000, H)).toBe(0)
  })

  it('ramps 0 to 1 across one viewport of exit, then clamps', () => {
    expect(rawParAt(4400, 2000, 4000, H)).toBe(0.5)
    expect(rawParAt(4800, 2000, 4000, H)).toBe(1)
    expect(rawParAt(9000, 2000, 4000, H)).toBe(1)
  })

  it('degenerates cleanly when holdEnd equals top (unpinned section)', () => {
    expect(rawParAt(1999, 2000, 2000, H)).toBeCloseTo(-1 / 800)
    expect(rawParAt(2001, 2000, 2000, H)).toBeCloseTo(1 / 800)
  })

  it('guards a zero viewport', () => {
    expect(rawParAt(500, 2000, 2000, 0)).toBe(0)
  })
})

describe('easePar', () => {
  it('preserves sign and endpoints', () => {
    expect(easePar(-1)).toBe(-1)
    expect(easePar(0)).toBe(0)
    expect(easePar(1)).toBe(1)
    expect(easePar(-0.5)).toBe(-0.25)
    expect(easePar(0.5)).toBe(0.25)
  })

  it('has near-zero slope at the seat', () => {
    // quadratic: the step from 0 to 0.01 moves the output by 0.0001, not 0.01
    expect(Math.abs(easePar(0.01))).toBeLessThan(0.001)
  })
})

describe('parAt', () => {
  const H = 800
  const geo = { top: 2000, holdEnd: 4000, enter: 1, exit: CALM }

  it('scales the entering ramp by the enter edge and the exit by the exit edge', () => {
    expect(parAt(1600, geo, H)).toBe(-0.25) // eased -0.5² × enter 1
    expect(parAt(4400, geo, H)).toBeCloseTo(0.25 * CALM)
  })

  it('is continuous across both joins', () => {
    // sweep the whole life in 10px steps; no step may jump more than the
    // steepest slope of the eased ramp (2/H per px × intensity, ~0.025 here)
    let prev = parAt(1100, geo, H)
    for (let s = 1110; s <= 4900; s += 10) {
      const v = parAt(s, geo, H)
      expect(Math.abs(v - prev)).toBeLessThan(0.03)
      prev = v
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/scroll/parallax.test.ts`
Expected: FAIL — module `./parallax` does not exist.

- [ ] **Step 3: Implement** — create `src/scroll/parallax.ts`:

```ts
/**
 * Per-section parallax — the "lift, gated by ground contrast".
 * Spec: docs/superpowers/specs/2026-08-06-parallax-section-transitions-design.md
 *
 * Pure, and deliberately DOM-free like `seed.ts`: the timeline owns
 * measurement and the per-frame write; this module owns every mapping the
 * write needs. Tune the feel here, not in the timeline.
 */
import type { Tone } from './scenes'

/**
 * How much of the gesture survives a same-ground boundary. The full lift only
 * fires where the ground flips — there is no visible world-change to rise off
 * otherwise. A look decision, tuned in a browser like SEED_PLATEAU.
 */
export const CALM = 0.35

export type EdgeIntensity = { enter: number; exit: number }

/**
 * One intensity pair per section, derived from the ground tones in page
 * order — `scene.ground` plus the fixed tones, via `toneFor`, never a
 * hand-maintained boundary list, so reordering sections keeps the rule true.
 * The first section's enter edge and the last section's exit edge are never
 * scrolled across; they get 1, which the clamps make unobservable.
 */
export const edgeIntensities = (tones: readonly Tone[]): EdgeIntensity[] =>
  tones.map((tone, i) => ({
    enter: i === 0 || tones[i - 1] !== tone ? 1 : CALM,
    exit: i === tones.length - 1 || tones[i + 1] !== tone ? 1 : CALM,
  }))

/**
 * Linear position of a section relative to its seat: −1 one full viewport
 * below, 0 anywhere in [top, holdEnd] (seated, or pinned), +1 one viewport
 * past release. `top` is the scroll at which the section seats; `holdEnd` is
 * where it starts to leave — equal to `top` for an unpinned section, the pin
 * release for a pinned one. Both are measured document px, handed in by the
 * timeline from the spans the section triggers register.
 */
export const rawParAt = (
  scroll: number,
  top: number,
  holdEnd: number,
  viewportH: number,
): number => {
  if (viewportH <= 0) return 0
  if (scroll < top) return Math.max(-1, (scroll - top) / viewportH)
  if (scroll > holdEnd) return Math.min(1, (scroll - holdEnd) / viewportH)
  return 0
}

/**
 * Sign-preserving quadratic: steep at the section's edges, zero slope at the
 * seat. This is what makes layers arrive and settle rather than glide — and
 * it lives in the scalar, not the consumer, so every opted-in element agrees.
 */
export const easePar = (raw: number): number => (raw < 0 ? -1 : 1) * raw * raw

export type ParGeometry = { top: number; holdEnd: number; enter: number; exit: number }

/** The value written as `--par`: eased, then scaled by the active edge. */
export const parAt = (scroll: number, geo: ParGeometry, viewportH: number): number => {
  const raw = rawParAt(scroll, geo.top, geo.holdEnd, viewportH)
  return easePar(raw) * (raw < 0 ? geo.enter : geo.exit)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/scroll/parallax.test.ts` then `npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/scroll/parallax.ts src/scroll/parallax.test.ts
git commit -m "feat: pure parallax scalar - eased lift, intensities from ground tones"
```

---

### Task 3: Timeline writes `--par` per frame

Drive the writes from the whole-document trigger that already writes `--seam` — it runs every frame, and the label offsets/spans it can read are the *measured* truth about where each section seats and releases. (The spec sketched a per-section trigger; a second trigger on a pinned element mis-measures its exit without `pinnedContainer` compensation, while the spans already hold the correct range. Amend the spec in this task — docs must match the build.)

**Files:**
- Modify: `src/scroll/timeline.ts` (imports; module state; `measureParEntries`; the whole-document trigger's `onRefresh`/`onUpdate`; `killTimeline`)
- Modify: `docs/superpowers/specs/2026-08-06-parallax-section-transitions-design.md` (mechanism sentence)
- Test: covered by Task 2's unit tests + `npm run typecheck` + Task 5's browser verification (GSAP triggers aren't unit-tested anywhere in this repo)

**Interfaces:**
- Consumes: `parAt`, `edgeIntensities`, `ParGeometry` from `./parallax`; `toneFor` from `./scenes`; existing `getLabelOffset`, `getLabelSpan`, `sceneTriggers`, `LABELS`, `prefersReducedMotion`.
- Produces: `--par` on each section element (`#hero`, `#about`, `#g1`…`#g4`, `#contact`) every frame; absent under reduced motion and after `killTimeline()`. Task 4's CSS consumes it.

- [ ] **Step 1: Add imports and module state** — in `src/scroll/timeline.ts`, extend the existing `./scenes` import with `toneFor`, and add:

```ts
import { edgeIntensities, parAt, type ParGeometry } from './parallax'
```

Below the `seamSpans` declaration, add:

```ts
/**
 * Per-section geometry for the `--par` writes, rebuilt on refresh exactly
 * like `seamSpans` — the offsets and spans it reads only move when the
 * document height does. Empty under reduced motion: with nothing written,
 * every layer's CSS fallback `var(--par, 0)` renders today's layout.
 */
type ParEntry = { el: HTMLElement; geo: ParGeometry; last: string }
let parEntries: ParEntry[] = []
let parViewportH = 0

const measureParEntries = (): ParEntry[] => {
  parViewportH = window.innerHeight
  const intensities = edgeIntensities(LABELS.map(toneFor))
  const entries: ParEntry[] = []
  LABELS.forEach((label, i) => {
    const el = document.getElementById(label)
    const top = getLabelOffset(label)
    const span = getLabelSpan(label)
    if (!el || top === undefined || !span) return
    // A pinned scene holds its seat until the pin releases at span.end; an
    // unpinned section starts leaving the moment it is seated. sceneTriggers
    // only ever holds pinned gallery labels, so membership IS pinned-ness.
    const pinned = sceneTriggers.has(label as GalleryLabel)
    entries.push({ el, geo: { top, holdEnd: pinned ? span.end : top, ...intensities[i]! }, last: '' })
  })
  return entries
}
```

- [ ] **Step 2: Build and write in the whole-document trigger** — in `buildTimeline`'s final `ScrollTrigger.create`, extend `onRefresh`:

```ts
      onRefresh: () => {
        seamSpans = activeSpans()
        parEntries = prefersReducedMotion() ? [] : measureParEntries()
      },
```

And at the end of the same trigger's `onUpdate` (after the `--seam-pin` write's closing brace), add:

```ts
        // The lift. Same channel as --seam and for the same reasons, but
        // written per SECTION element so each subtree scopes its own scalar.
        // toFixed(3) is ~0.06px of translate at these depths — below
        // perception — and the string compare keeps redundant style writes
        // off the hot path: only sections inside their ramps change value.
        const scroll = self.scroll()
        for (const entry of parEntries) {
          const v = parAt(scroll, entry.geo, parViewportH).toFixed(3)
          if (v !== entry.last) {
            entry.last = v
            entry.el.style.setProperty('--par', v)
          }
        }
```

- [ ] **Step 3: Teardown** — in `killTimeline`, after `seamSpans = []`:

```ts
  parEntries = []
  // Removed, not defaulted — same rule as --seam above: the property must be
  // genuinely absent until the next refresh measures again.
  for (const label of LABELS) {
    document.getElementById(label)?.style.removeProperty('--par')
  }
```

- [ ] **Step 4: Typecheck and full test run**

Run: `npm run typecheck` then `npm test`
Expected: no type errors; all suites pass (nothing existing should break — the only touched behaviour is additive).

- [ ] **Step 5: Amend the spec's mechanism sentence** — in `docs/superpowers/specs/2026-08-06-parallax-section-transitions-design.md`, replace the clause "by a lightweight non-pinning ScrollTrigger created in `buildTimeline` alongside each label's existing trigger (`start: 'top bottom'`, `end: 'bottom top'` — ScrollTrigger measures against the pin-spacer, so pinned scenes need nothing special)" with:

> by the whole-document trigger's `onUpdate` — the same per-frame channel that writes `--seam` — using the label offsets and spans the section triggers register on refresh. (Measured, never derived; a second per-section trigger was rejected because a pinned element's exit mis-measures without `pinnedContainer` compensation, while the spans already hold the released range.)

- [ ] **Step 6: Commit**

```bash
git add src/scroll/timeline.ts docs/superpowers/specs/2026-08-06-parallax-section-transitions-design.md
git commit -m "feat: the timeline writes --par onto each section every frame"
```

---

### Task 4: The consumer — one CSS rule, sections opt in

**Files:**
- Modify: `src/styles/index.css` (one rule, next to the other custom utility classes — e.g. after `.page-shell`)
- Modify: `src/sections/Hero.tsx`, `src/sections/About.tsx`, `src/sections/GalleryScene.tsx`, `src/sections/Contact.tsx`

**Interfaces:**
- Consumes: `--par` written by Task 3.
- Produces: the visible effect. No exports.

- [ ] **Step 1: Add the CSS rule** — in `src/styles/index.css`:

```css
/*
 * Parallax layers — the lift. --par (−1…1, eased, intensity-scaled) is
 * written per section by the timeline; --depth is the element's own inline
 * declaration in vh-percent. Positive lags the scroll (the slower world),
 * negative leads it (the rising page). The 0 fallbacks are load-bearing:
 * unset under reduced motion, before first measure, and after teardown,
 * which must all render today's layout exactly.
 */
.par {
  transform: translate3d(0, calc(var(--par, 0) * var(--depth, 0) * 1vh), 0);
  will-change: transform;
}
```

- [ ] **Step 2: Hero opts in** — `src/sections/Hero.tsx`. Add `import type { CSSProperties } from 'react'`. Then:
  - the crop `Placeholder`: append ` par` to its `className` and add `style={{ '--depth': 8 } as CSSProperties}` (Placeholder already accepts `style`),
  - the `<h1>`: append ` par` to `className`, add `style={{ '--depth': -8 } as CSSProperties}`,
  - the tagline `<p>` (mt-[26px]), the fragment `<p>` (mt-[39px]), and the bottom-right meta `<div>`: append ` par` and `style={{ '--depth': -12 } as CSSProperties}` to each.

- [ ] **Step 3: About opts in** — `src/sections/About.tsx`, same import:
  - portrait `Placeholder`: ` par`, `--depth: 8`,
  - `<h2>` and the two-paragraph copy grid `<div>` (order-4): ` par`, `--depth: -8` each,
  - the label row `<div>` (order-1) and the stats `<div>` (order-5): ` par`, `--depth: -12` each.

- [ ] **Step 4: Gallery scenes opt in** — `src/sections/GalleryScene.tsx`, same import:
  - the title block `<div>` (absolute, top-left): ` par`, `--depth: -8`,
  - the progress row `<div>` (bottom): ` par`, `--depth: -12`.
  - Deliberately untouched: the `<nav>` jump links (controls, unlisted → depth 0) and all four presentations (centrepieces belong to the scrub).

- [ ] **Step 5: Contact opts in** — `src/sections/Contact.tsx`, same import:
  - the left column `<div>` (the one wrapping the `<h2>` and the two links): ` par`, `--depth: -8`,
  - the right-hand mural-note `<div>` and the footer bar `<div>`: ` par`, `--depth: -12` each.
  - The spec's "+8 bloom" element does not exist in Contact yet; do NOT invent one — the depth applies whenever that decoration lands.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors (the `as CSSProperties` casts are the repo's established pattern for custom properties).

- [ ] **Step 7: Commit**

```bash
git add src/styles/index.css src/sections/Hero.tsx src/sections/About.tsx src/sections/GalleryScene.tsx src/sections/Contact.tsx
git commit -m "feat: sections opt into the lift with .par and a --depth"
```

---

### Task 5: Full verification

**Files:** none created — this is the gate.

- [ ] **Step 1: Full suite**

Run: `npm test` and `npm run typecheck`
Expected: every suite passes, no type errors.

- [ ] **Step 2: Browser walkthrough** — `npm run dev`, open the site, verify against the visual guide (https://claude.ai/code/artifact/51e6086b-60c5-4b56-8a79-7d8e0138fe00):
  - Hero→About and g4→Contact: full lift (content leads, ground trails).
  - About→g1 and g2→g3: quiet residual only (×0.35) — visibly calmer than the flips.
  - During every pinned scrub (g1–g4 interiors): headings/counters stone-still, dial/track/field motion unchanged.
  - Detail-route round trip (open a piece, come back): scroll restores, no stale offset on any layer (`--par` was removed and re-measured).
  - Merch chip filter change: no layout jump (refresh re-measures).
  - Resize across 939px: no errors, layers re-seat.
- [ ] **Step 3: Reduced motion** — enable "reduce motion" in OS settings (or DevTools rendering emulation): every layer sits exactly where it sits on `main` today; `#hero` and friends carry **no** inline `--par`.
- [ ] **Step 4: Performance sanity** — DevTools performance panel over one full scroll: no layout thrash from the writes (transform-only), style writes only on sections inside their ramps.
- [ ] **Step 5: Depth tuning pass** — with the site running, judge the ±8/±12 values against the maquette's feel; adjust inline `--depth` values only (one commit if changed):

```bash
git add -u src/sections
git commit -m "feat: tune lift depths against the built page"
```

---

## Self-review notes

- **Spec coverage:** scalar + easing (Task 2), intensity derivation from declarations (Tasks 1–2), per-frame writes + teardown + reduced motion (Task 3), CSS consumer + depth map + exclusions (Task 4), guarantees verified (Task 5). Spec's per-section-trigger sentence is amended in Task 3 — the one deliberate deviation, reasoned there.
- **Contact bloom:** spec lists a +8 bloom; no such element exists — Task 4 Step 5 says explicitly not to invent it.
- **Type consistency:** `toneFor`/`Tone` (Task 1) ↔ imports in Tasks 2–3; `ParGeometry`/`parAt`/`edgeIntensities`/`CALM` names match across Tasks 2–3; `--par`/`--depth`/`.par` match across Tasks 3–4.
