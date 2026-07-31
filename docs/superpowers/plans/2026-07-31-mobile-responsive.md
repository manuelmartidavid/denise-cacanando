# Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site the mobile layer it was never built with, so all seven scroll sections and the detail pages render correctly at 390 × 844.

**Architecture:** Mobile becomes the base style and today's desktop geometry moves behind Tailwind's `sm:` variant (640px). The blocker is that every section hardcodes geometry as **inline styles**, which no CSS variant can override — so each section's geometry moves from `style={{}}` to utility classes first. The existing 939px JS `compact` flag is not touched: layout stays in CSS so a phone rotate never rebuilds the timeline. The side rail hides below `sm` and a new bottom ticker takes over, its progress line driven by a CSS variable written where `frame.progress` already is.

**Tech Stack:** Vite 8 · React 19 · Tailwind 4 (`@theme` tokens in `src/styles/index.css`) · GSAP ScrollTrigger · Lenis · Vitest (node environment) · Playwright for browser verification.

**Spec:** `docs/superpowers/specs/2026-07-31-mobile-responsive-design.md`

## Global Constraints

These apply to **every** task. Violating one is a failed task even if the visible result looks right.

- **Sections keep their `h-screen` box and their existing clipping mode.** Never convert a section to `min-h-screen` or change its height — GroundLayer measures pin-spacers and the label offsets derive from these boxes (invariants 9, 10, 11).
- **`overflow-clip`, never `overflow-hidden`** on About, Contact and `GalleryScene`. `hidden` reintroduces a scroll container and desyncs the Murals track (invariant 10).
- **Hero stays `overflow-hidden`.** It is the one section `b5ea535` did not convert. Pre-existing; do not "fix" it here.
- **GSAP only in `src/scroll/timeline.ts`.** No component imports `gsap` or `ScrollTrigger` (invariant 2).
- **The frame channel never publishes to React** (invariant 1). Per-frame values reach the DOM as CSS custom properties only.
- **Counts are never hardcoded in a view** — read via `activeCount(scene)` / `activePieces(scene)` (invariant 4).
- **Vitest is `environment: 'node'`, `include: ['src/**/*.test.ts']`. Do NOT add jsdom or component tests** (invariant 6). Only pure functions get unit tests; everything visual is verified in a browser.
- **Mono labels carry `uppercase` on the element itself** — a `<button>` does not inherit `text-transform` (invariant 7, defect #7).
- **Nothing drops below 8.5px** (README §156).
- **Do not touch `RADIUS_WIDE` (`Butterflies.tsx:42`), `FULL_FLOCK` or `FULL_POLLEN` (`Stage.tsx:7-8`).** They are the user's, set by hand.
- **Desktop at 1440 × 900 must be behaviourally unchanged.** Regression baseline: label offsets `hero 0 · about 900 · g1 1800 · g2 5580 · g3 8460 · g4 11520 · contact 14760`, `scrollHeight` 15660, ground blocks tiling 0 → 15660, 0 spill per section.
- **Inline `style` is still correct for per-frame plumbing** — `--r`, `--at`, `--i`, and transforms computed from them. Only *geometry* moves to classes.
- Dev server: `npm run dev -- --port 5180 --strictPort` (already running). **Leave port 5173 alone.**

---

## Shared verification probes

Several tasks use these. Run them through Playwright's `browser_evaluate` against `http://localhost:5180/`.

**Probe A — viewport overflow.** Returns elements escaping the viewport, ignoring legitimate horizontal scrollers (`SnapList` is `overflow-x-auto` by design).

```js
() => {
  const vw = document.documentElement.clientWidth
  const bad = []
  for (const el of document.querySelectorAll('main *')) {
    const b = el.getBoundingClientRect()
    if (!b.width && !b.height) continue
    let inScroller = false
    for (let p = el.parentElement; p && p.tagName !== 'MAIN'; p = p.parentElement) {
      const ov = getComputedStyle(p).overflowX
      if (ov === 'auto' || ov === 'scroll') { inScroller = true; break }
    }
    if (inScroller) continue
    if (b.right > vw + 1 || b.left < -1) {
      bad.push({
        sec: el.closest('section')?.id, tag: el.tagName,
        left: Math.round(b.left), right: Math.round(b.right),
        text: (el.textContent || '').trim().slice(0, 30),
      })
    }
  }
  return { vw, count: bad.length, bad: bad.slice(0, 20) }
}
```

**Probe B — vertical fit against the ticker.** Content must fit inside `100vh − 62px`.

```js
() => {
  const TICKER = window.innerWidth < 640 ? 62 : 0
  const out = []
  for (const sec of document.querySelectorAll('main > section')) {
    const r = sec.getBoundingClientRect()
    let minT = Infinity, maxB = -Infinity
    for (const el of sec.querySelectorAll('*')) {
      const b = el.getBoundingClientRect()
      if (!b.width && !b.height) continue
      minT = Math.min(minT, b.top); maxB = Math.max(maxB, b.bottom)
    }
    out.push({
      id: sec.id,
      contentH: Math.round(maxB - minT),
      budget: Math.round(r.height - TICKER),
      overflowsTicker: Math.round(maxB - (r.bottom - TICKER)),
    })
  }
  return out
}
```

**Probe C — desktop regression baseline.** Must match the Global Constraints numbers exactly.

```js
() => {
  const ST = window.ScrollTrigger
  const labels = {}
  if (ST) for (const t of ST.getAll()) if (t.vars.id) labels[t.vars.id] = Math.round(t.start)
  const spill = []
  for (const sec of document.querySelectorAll('main > section')) {
    const r = sec.getBoundingClientRect()
    let maxB = -Infinity, minT = Infinity
    for (const el of sec.querySelectorAll('*')) {
      const b = el.getBoundingClientRect()
      if (!b.width && !b.height) continue
      minT = Math.min(minT, b.top); maxB = Math.max(maxB, b.bottom)
    }
    spill.push({ id: sec.id, above: Math.round(r.top - minT), below: Math.round(maxB - r.bottom) })
  }
  return { scrollHeight: document.documentElement.scrollHeight, labels, spill }
}
```

**Before trusting any browser reading**, confirm the tab is frontmost and rAF is healthy — a reading near 1 tick/500 ms means fix focus first, not that the code is broken:

```js
async () => { let n = 0; const t0 = performance.now()
  await new Promise(r => { const l = () => { n++; performance.now() - t0 < 500 ? requestAnimationFrame(l) : r() }; requestAnimationFrame(l) })
  return n }
```

**Baseline before any change:** Probe A at 390 × 844 returns **count: 47**.

---

## File structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/styles/index.css` | modify | Mobile type tokens in `@theme` |
| `src/scroll/scenes.ts` | modify | Gains `stopIndexFor` — shared by rail and ticker |
| `src/scroll/scenes.test.ts` | modify | Pure test for `stopIndexFor` |
| `src/scroll/timeline.ts` | modify | Writes `--progress` alongside `frame.progress` |
| `src/components/BottomTicker.tsx` | **create** | The mobile bottom ticker |
| `src/components/SideRail.tsx` | modify | Hides below `sm`; consumes shared `stopIndexFor` |
| `src/routes/ScrollPage.tsx` | modify | Mounts the ticker |
| `src/sections/Hero.tsx` | modify | Mobile hero |
| `src/sections/About.tsx` | modify | Mobile About — single column |
| `src/sections/GalleryScene.tsx` | modify | Mobile gallery furniture |
| `src/sections/Contact.tsx` | modify | Mobile contact |
| `src/routes/DetailPage.tsx` | modify | Mobile detail leaf (derived, not specced) |

Tasks 1–4 come first because the ticker changes the vertical budget every section is laid out against. Doing About before the ticker would mean redoing its bottom clearance.

---

### Task 1: Mobile type tokens

**Files:**
- Modify: `src/styles/index.css` (the `@theme` block, after each desktop counterpart)

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind classes `text-hero-m`, `text-about-m`, `text-scene-m`, `text-contact-m`, `text-enquire-m`, `text-fragment-m`, `text-stat-m`, `text-body-m`, `text-leaf-m`. Every later section task uses these.

`--text-hero-m`, `--text-stat-m` and `--text-body-m` already exist and are referenced by nothing — leave them where they are and add only the missing six. `--text-leaf-m` is not in the spec's table; it is added here for the detail-page title in Task 9, which the spec marks as derived.

- [ ] **Step 1: Add the six missing tokens**

In `src/styles/index.css`, inside `@theme`, add each new token directly beneath its desktop counterpart:

```css
  --text-about: 74px;
  --text-about--line-height: 1.02;
  --text-about--letter-spacing: -0.01em;
  --text-about-m: 40px;
  --text-about-m--line-height: 1.04;

  --text-scene: 96px;
  --text-scene--line-height: 0.94;
  --text-scene-m: 44px;
  --text-scene-m--line-height: 1;

  --text-contact: 104px;
  --text-contact--line-height: 0.94;
  --text-contact-m: 46px;
  --text-contact-m--line-height: 1;

  --text-leaf: 62px;
  --text-leaf--line-height: 1;
  --text-leaf-m: 34px;
  --text-leaf-m--line-height: 1.05;

  --text-enquire: 32px;
  --text-enquire--line-height: 1;
  --text-enquire-m: 21px;
  --text-enquire-m--line-height: 1.3;

  --text-fragment: 25px;
  --text-fragment--line-height: 1.5;
  --text-fragment-m: 17px;
  --text-fragment-m--line-height: 1.45;
```

Leave `--text-hero-m`, `--text-stat-m` and `--text-body-m` exactly as they are.

- [ ] **Step 2: Verify the tokens compile into utilities**

Run: `npm run build`
Expected: succeeds.

Then in the browser at `http://localhost:5180/`, confirm Tailwind actually generated a class (a token that no markup references yet is still emitted by `@theme`, but this proves the syntax parsed):

```js
() => {
  const el = document.createElement('div')
  el.className = 'text-about-m'
  document.body.appendChild(el)
  const size = getComputedStyle(el).fontSize
  el.remove()
  return size
}
```

Expected: `"40px"`. If it returns `16px`, the token name is wrong.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/styles/index.css
git commit -m "feat: add the mobile type tokens the scale was missing

--text-hero-m, --text-stat-m and --text-body-m have been defined and
referenced by nothing since the scale was written. Six more are needed
before any section can respond; --text-leaf-m serves the detail leaf,
whose mobile treatment is derived rather than mocked."
```

---

### Task 2: Extract the rail stop lookup as a pure function

**Files:**
- Modify: `src/scroll/scenes.ts` (add after `RAIL_STOPS`, around line 15)
- Modify: `src/components/SideRail.tsx:5-7` (delete the local copy, import instead)
- Test: `src/scroll/scenes.test.ts`

**Interfaces:**
- Consumes: `RAIL_STOPS`, `Label` from `scenes.ts`.
- Produces: `stopIndexFor(label: Label): number` — exported from `~/scroll/scenes`. Task 4's `BottomTicker` imports it.

This is the only genuinely unit-testable piece of the whole plan, so it gets a real TDD cycle. Everything else is verified in a browser by design (invariant 6).

- [ ] **Step 1: Write the failing test**

Add to `src/scroll/scenes.test.ts`. Import `stopIndexFor` and `RAIL_STOPS` by adding them to the existing import block from `./scenes`:

```ts
describe('stopIndexFor', () => {
  it('maps each non-gallery label to its own rail stop', () => {
    expect(stopIndexFor('hero')).toBe(0)
    expect(stopIndexFor('about')).toBe(1)
    expect(stopIndexFor('contact')).toBe(3)
  })

  it('lights the single Gallery stop for every gallery label', () => {
    // Four scenes share one diamond — g2, g3 and g4 are not rail targets.
    for (const label of ['g1', 'g2', 'g3', 'g4'] as const) {
      expect(stopIndexFor(label)).toBe(2)
    }
  })

  it('returns an index that exists in RAIL_STOPS for every label', () => {
    for (const label of LABELS) {
      const i = stopIndexFor(label)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(RAIL_STOPS.length)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- scenes`
Expected: FAIL — `stopIndexFor is not exported` / is not a function.

- [ ] **Step 3: Implement it**

In `src/scroll/scenes.ts`, directly beneath `RAIL_STOPS`:

```ts
/**
 * Which rail stop a label lights. The four gallery scenes share one diamond, so
 * g2–g4 are not themselves rail targets and fall through to the Gallery stop.
 *
 * Lives here rather than in the rail because two presentations consume it — the
 * desktop side rail and the mobile bottom ticker — and a second copy would be a
 * second thing to keep in step with RAIL_STOPS.
 */
export const stopIndexFor = (label: Label): number => {
  const direct = RAIL_STOPS.findIndex((stop) => stop.target === label)
  return direct >= 0 ? direct : GALLERY_STOP
}

/** Index of the Gallery diamond in RAIL_STOPS — the fallback for g2–g4. */
const GALLERY_STOP = 2
```

`GALLERY_STOP` is a `const` declaration used by a function defined above it; that is fine because the function body only runs after module evaluation. If it reads awkwardly, move the `const` above `stopIndexFor`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- scenes`
Expected: PASS.

- [ ] **Step 5: Point SideRail at the shared function**

In `src/components/SideRail.tsx`, delete lines 5–7:

```tsx
/** Gallery labels all light the same rail stop. */
const stopIndexFor = (label: string) =>
  label === 'hero' ? 0 : label === 'about' ? 1 : label === 'contact' ? 3 : 2
```

and change the import on line 1 to:

```tsx
import { RAIL_STOPS, stopIndexFor } from '~/scroll/scenes'
```

- [ ] **Step 6: Verify nothing broke**

Run: `npm test && npm run typecheck`
Expected: all pass, 106 + 3 new tests.

In the browser at 1440 × 900, scroll to each section and confirm the correct diamond is filled. The rail's active diamond is the one with `size-[11px]`:

```js
() => ({ label: document.querySelector('[aria-current="true"]')?.getAttribute('aria-label') })
```

Expected at the top of the page: `"Go to Hero"`.

- [ ] **Step 7: Commit**

```bash
git add src/scroll/scenes.ts src/scroll/scenes.test.ts src/components/SideRail.tsx
git commit -m "refactor: share the rail stop lookup with the coming ticker

The mobile ticker lights the same four stops from the same labels. Moving
the lookup next to RAIL_STOPS means the mapping and the stop list cannot
drift apart, and makes it testable in the node environment."
```

---

### Task 3: Publish whole-document progress as a CSS variable

**Files:**
- Modify: `src/scroll/timeline.ts:290-292` (the whole-document trigger's `onUpdate`)

**Interfaces:**
- Consumes: nothing.
- Produces: `--progress` on `document.documentElement`, a unitless `0`–`1` string, updated every frame. Task 4's ticker reads it as `calc(var(--progress) * 100%)`.

This is the seam that keeps the ticker's progress line off the React render path. The whole-document trigger already computes exactly the number the line needs.

- [ ] **Step 1: Write the variable alongside `frame.progress`**

In `src/scroll/timeline.ts`, in the whole-document `ScrollTrigger.create` at the bottom of `buildTimeline`, replace the `onUpdate` body:

```ts
      onUpdate: (self) => {
        frame.progress = self.progress
        // The mobile ticker's progress line. A CSS custom property is how a
        // per-frame value legally reaches the DOM here: it keeps the scrub out
        // of React state (invariant 1) and keeps GSAP inside this module
        // (invariant 2) — the ticker only ever reads --progress.
        document.documentElement.style.setProperty('--progress', String(self.progress))
      },
```

- [ ] **Step 2: Verify it tracks scroll across the whole document**

In the browser at 1440 × 900, read the variable at several offsets. It must match `scrollY / 14760`, not saturate early — a value stuck at 1 from a third of the way down is defect (c) returning:

```js
async () => {
  const read = () => getComputedStyle(document.documentElement).getPropertyValue('--progress').trim()
  const out = []
  for (const y of [0, 3321, 8144, 12006, 14760]) {
    window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y)
    await new Promise(r => setTimeout(r, 250))
    out.push({ y: Math.round(window.scrollY), progress: read() })
  }
  return out
}
```

Expected: monotonically increasing, ≈ `0`, `0.225`, `0.552`, `0.813`, `1`.

- [ ] **Step 3: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: clean, all pass.

- [ ] **Step 4: Commit**

```bash
git add src/scroll/timeline.ts
git commit -m "feat: publish document progress as --progress for the ticker

The whole-document trigger already computes it for frame.progress. Writing
it to a CSS variable is what lets the ticker's progress line animate every
frame without the scrub entering React state."
```

---

### Task 4: The bottom ticker

**Files:**
- Create: `src/components/BottomTicker.tsx`
- Modify: `src/components/SideRail.tsx:26` (hide below `sm`)
- Modify: `src/routes/ScrollPage.tsx:7` and `:127` (import and mount)

**Interfaces:**
- Consumes: `RAIL_STOPS`, `stopIndexFor` (Task 2), `--progress` (Task 3), `scrollToLabel` from `~/scroll/timeline`, `useScrollState` from `~/scroll/store`.
- Produces: `BottomTicker({ ground }: { ground?: 'dark' | 'cream' })`.

The ticker reuses `text-caption-sm` (9px) and `tracking-caption-wide` (0.14em) — both already exist, so no new token.

- [ ] **Step 1: Create the component**

Create `src/components/BottomTicker.tsx`:

```tsx
import { RAIL_STOPS, stopIndexFor } from '~/scroll/scenes'
import { scrollToLabel } from '~/scroll/timeline'
import { useScrollState } from '~/scroll/store'

type Props = {
  /** Cream grounds (About, Merchandise) flip the bar and its type to ink. */
  ground?: 'dark' | 'cream'
}

/**
 * The mobile counterpart to the side rail — README §153. A 62px bar with the
 * same four stops, and a 1px progress line above it.
 *
 * The line is driven by `--progress`, written every frame by the whole-document
 * ScrollTrigger in `scroll/timeline.ts`. That is deliberate: the scrub is a
 * per-frame value and must never enter React state (invariant 1), so it reaches
 * the DOM as a custom property and CSS does the rest.
 *
 * Hidden at `sm` and up, where `SideRail` takes over. The two are never both
 * visible, and they share `stopIndexFor` so their active stop cannot disagree.
 */
export const BottomTicker = ({ ground = 'dark' }: Props) => {
  const { label } = useScrollState()
  const active = stopIndexFor(label)
  const onDark = ground === 'dark'

  return (
    <nav
      aria-label="Sections"
      className={`fixed inset-x-0 bottom-0 z-40 border-t sm:hidden ${
        onDark ? 'border-cream/14 bg-ink/72' : 'border-ink/16 bg-cream/82'
      }`}
      style={{ backdropFilter: 'blur(6px)' }}
    >
      {/* Progress line, sitting on the bar's top hairline. */}
      <div
        className={`absolute inset-x-0 -top-px h-px ${onDark ? 'bg-cream/16' : 'bg-ink/16'}`}
        aria-hidden="true"
      >
        <div className="h-px bg-ochre" style={{ width: 'calc(var(--progress, 0) * 100%)' }} />
      </div>

      <div className="flex h-[62px] items-center justify-between px-[22px]">
        {RAIL_STOPS.map((stop, i) => (
          <button
            key={stop.target}
            type="button"
            onClick={() => scrollToLabel(stop.target)}
            aria-current={i === active ? 'true' : undefined}
            className={`font-mono text-caption-sm tracking-caption-wide uppercase ${
              i === active
                ? onDark
                  ? 'text-ochre-bright'
                  : 'text-ochre-deep'
                : onDark
                  ? 'text-cream/35'
                  : 'text-ink/35'
            }`}
          >
            {stop.n} {stop.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
```

`uppercase` is on the `<button>` itself — a button does not inherit `text-transform` (invariant 7, defect #7).

- [ ] **Step 2: Hide the side rail below `sm`**

In `src/components/SideRail.tsx`, the `<nav>` className template literal currently begins:

```tsx
      className={`fixed left-[30px] top-1/2 z-40 w-rail -translate-y-1/2 select-none ${
```

Change it to:

```tsx
      className={`fixed left-[30px] top-1/2 z-40 hidden w-rail -translate-y-1/2 select-none sm:block ${
```

- [ ] **Step 3: Mount the ticker**

In `src/routes/ScrollPage.tsx`, add the import beneath the `SideRail` import on line 7:

```tsx
import { BottomTicker } from '~/components/BottomTicker'
```

and mount it directly after `<SideRail ground={ground} />` on line 127:

```tsx
      <SideRail ground={ground} />
      <BottomTicker ground={ground} />
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck && npm test`
Expected: clean, all pass.

- [ ] **Step 5: Verify the swap, the active stop and the cream flip**

At **390 × 844**, confirm exactly one navigation is visible and the ticker is 62px tall at the bottom:

```js
() => {
  const navs = [...document.querySelectorAll('nav[aria-label="Sections"]')]
  return navs.map(n => {
    const r = n.getBoundingClientRect()
    const cs = getComputedStyle(n)
    return {
      visible: cs.display !== 'none',
      top: Math.round(r.top), height: Math.round(r.height),
      bg: cs.backgroundColor,
      active: n.querySelector('[aria-current="true"]')?.textContent?.trim(),
      line: n.querySelector('.bg-ochre')?.getBoundingClientRect().width,
    }
  })
}
```

Expected at 390 × 844, scrolled to the top: one entry `visible: false` (the rail) and one `visible: true` with `height: 62`, `top: 782`, `active: "01 Hero"`, and `line` near 0.

Then scroll to About (`scrollY` 844 at this viewport — read it, do not assume) and re-run. Expected: `active: "02 About"` and a **cream** `bg`. Scroll deep into Merchandise and expect cream again.

At **1440 × 900**, re-run: the rail must be `visible: true` and the ticker `visible: false`.

- [ ] **Step 6: Confirm the progress line actually travels**

At 390 × 844, sample the line width at several offsets:

```js
async () => {
  const out = []
  const max = document.documentElement.scrollHeight - window.innerHeight
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const y = Math.round(max * f)
    window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y)
    await new Promise(r => setTimeout(r, 250))
    const line = document.querySelector('nav[aria-label="Sections"] .bg-ochre')
    out.push({ f, width: Math.round(line.getBoundingClientRect().width) })
  }
  return out
}
```

Expected: widths climbing roughly 0 → 98 → 195 → 293 → 390. A line stuck at 0 means `--progress` is not reaching the element; a line stuck at full width means the document trigger saturated.

- [ ] **Step 7: Take a screenshot and look at it**

Screenshot at 390 × 844. Confirm by eye that the ticker reads `01 HERO 02 ABOUT 03 GALLERY 04 CONTACT`, is uppercase, does not wrap, and that the active label is ochre. A computed style is not looking (defect #8).

- [ ] **Step 8: Commit**

```bash
git add src/components/BottomTicker.tsx src/components/SideRail.tsx src/routes/ScrollPage.tsx
git commit -m "feat: add the mobile bottom ticker and hide the rail below sm

README §153's ticker, which useCompactLayout's docstring has claimed
existed since the compact breakpoint was added. Shares stops and the
active-stop lookup with the rail; the progress line reads --progress so
the scrub stays out of React."
```

---

### Task 5: Hero at mobile

**Files:**
- Modify: `src/sections/Hero.tsx` (all four absolutely-positioned blocks plus the circle)

**Interfaces:**
- Consumes: `text-hero-m`, `text-fragment-m` (Task 1).
- Produces: nothing other tasks consume.

Two desktop `top` values are currently computed inline from the type scale: `104 + 132 * 0.86 * 2 + 28` = **359.04** and `104 + 132 * 0.86 * 2 + 64` = **395.04**. They become arbitrary values with the decimal kept, so desktop does not shift by a fraction.

The fragment is the live bug: it is cream on the cream circle and invisible. README §154 names this exact trap and puts the fragment **inside the circle in ink**.

- [ ] **Step 1: Rewrite the section body**

Replace the contents of `src/sections/Hero.tsx` after the imports:

```tsx
/**
 * 01 · Hero — `/`, 100vh, not pinned.
 *
 * Mobile (README §150, §154): the name drops to 54px and goes left-aligned, the
 * circle shrinks to 480px and sits low-left, and the fragment moves INSIDE the
 * circle in ink. Cream-on-cream is the named trap here — the fragment was
 * invisible at every width below the design viewport. Watch it if you move
 * anything.
 *
 * `overflow-hidden` rather than `overflow-clip`: this is the one section
 * b5ea535 left alone, and changing it is out of scope.
 *
 * SCAFFOLD: grounds, gutters and the type scale are in place. Still to come —
 * the crop's rotate 0.4°/100px + scale 1→1.08, pollen drift, and the flock
 * idling low-left out of the crop's edge.
 */
// Ground is painted by GroundLayer, behind the canvas — see that file.
export const Hero = () => (
  <section id="hero" className="relative h-screen w-full overflow-hidden">
    {/* Cream circle — 480px low-left on mobile, 980px bleeding off-edge at sm. */}
    <Placeholder
      label="Signature floral — circular crop"
      tone="cream"
      className="absolute size-[480px] rounded-full sm:size-[980px] sm:-translate-y-1/2"
      style={undefined}
    />

    <h1 className="absolute z-10 text-left font-display text-hero-m text-cream sm:text-right sm:text-hero sm:mix-blend-difference">
      Denise
      <br />
      <em className="italic">Cacanando</em>
    </h1>

    <p className="absolute z-10 text-left font-mono text-ph tracking-[0.22em] text-ochre-bright uppercase sm:text-right sm:text-label-lg sm:tracking-tagline">
      Flowers · Butterflies · Walls · Shells
    </p>

    <p className="absolute z-10 max-w-[230px] text-left font-display text-fragment-m italic text-ink/78 sm:max-w-[360px] sm:text-right sm:text-fragment sm:text-cream/70">
      {/* COPY SLOT — DENISE TO WRITE. Length and tone guide only. */}
      A held breath before the petals let go — the hour when the garden decides
      what it will keep.
    </p>

    <div className="absolute z-10 hidden text-right font-mono text-meta tracking-caption text-cream/40 uppercase sm:block">
      <p>Manila, PH — Oil · Acrylic · Watercolour · Pastel · Ballpen · Walls</p>
      <p className="mt-2 text-cream/60">Scroll ↓</p>
    </div>
  </section>
)
```

Positions cannot live in `style` any more, so add them as classes. Apply these to the four elements above, replacing the `style={undefined}` on the Placeholder and adding to each `className`:

- Circle: `left-[-120px] top-[280px] sm:left-[-250px] sm:top-1/2` — delete the `style` prop entirely.
- `<h1>`: `left-6 top-[110px] sm:left-auto sm:right-[72px] sm:top-[104px]`
- Tagline `<p>`: `left-6 top-[240px] sm:left-auto sm:right-[72px] sm:top-[359.04px]`
- Fragment `<p>`: `left-6 top-[312px] sm:left-auto sm:right-[72px] sm:top-[395.04px]`
- Bottom meta `<div>`: `sm:right-[72px] sm:bottom-[52px]`

Note `sm:-translate-y-1/2` on the circle restores desktop's vertical centring, which the removed `style` used to do. On mobile there is no transform — `top-[280px]` is absolute, as mocked.

`text-ph` is 8.5px, the documented floor.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Verify no overflow and the fragment is legible**

At 390 × 844, run **Probe A**. Expected: no entries with `sec: "hero"`.

Then confirm the fragment is ink over the circle and actually contrasts — this is the whole point of the task:

```js
() => {
  const frag = [...document.querySelectorAll('#hero p')].find(p => p.textContent.includes('held breath'))
  const r = frag.getBoundingClientRect()
  const circle = document.querySelector('#hero [role="img"]').getBoundingClientRect()
  return {
    color: getComputedStyle(frag).color,
    fontSize: getComputedStyle(frag).fontSize,
    fragBox: { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) },
    circleBox: { l: Math.round(circle.left), t: Math.round(circle.top), r: Math.round(circle.right), b: Math.round(circle.bottom) },
    insideCircle: r.top >= circle.top && r.bottom <= circle.bottom && r.left >= circle.left,
  }
}
```

Expected: `color` an `rgba(13, 12, 10, …)` ink, `fontSize: "17px"`, `insideCircle: true`.

- [ ] **Step 4: Screenshot and look**

Screenshot at 390 × 844. The name must read **"Denise Cacanando"** in full — the pre-fix render cut it to "nando". The fragment must be readable dark text on the cream circle. Compare against the first mocked mobile frame.

- [ ] **Step 5: Verify desktop is unchanged**

At 1440 × 900, run **Probe C**. Expected: `scrollHeight: 15660`, hero spill `above: 170, below: 170` (hero has always spilled and has always clipped it), and the seven label offsets unchanged.

Screenshot at 1440 × 900 and compare with the desktop hero: name right-aligned at 132px with the difference blend, fragment cream on the right, circle bleeding off the left edge.

- [ ] **Step 6: Commit**

```bash
git add src/sections/Hero.tsx
git commit -m "feat: lay out the hero for mobile and rescue the fragment

The fragment was cream on the cream circle at every width — README §154
names this exact trap and puts it inside the circle in ink. Positions move
from inline styles to classes because inline styles beat every variant;
the two computed desktop offsets keep their .04px so nothing shifts."
```

---

### Task 6: About at mobile — the section that prompted this work

**Files:**
- Modify: `src/sections/About.tsx` (the `STATS` table and the whole grid)

**Interfaces:**
- Consumes: `text-about-m`, `text-stat-m`, `text-body-m` (Task 1).
- Produces: nothing other tasks consume.

**The hard part is source order.** Desktop is two columns — copy left, portrait right. Mobile wants label → headline → **portrait** → copy → stats, so the portrait has to interleave into the middle of the left column's children.

The technique: `display: contents` on the wrapper divs at base, which removes their boxes and promotes their children to direct flex items of the outer container, then `order-*` puts those children in mocked order. At `sm` every wrapper gets its box back and the layout is **exactly today's**. This is what keeps desktop untouched — no grid rewrite, no change to `justify-between`.

- [ ] **Step 1: Give the stats table mobile labels and a mobile flag**

Replace the `STATS` constant at the top of `src/sections/About.tsx`:

```tsx
/**
 * Counts come from the data, never from a hardcoded string.
 *
 * `short` is the abbreviated label the mocked mobile frame uses; `wide` marks
 * the one stat that does not fit at 390 and is hidden there (README §155 keeps
 * PIECES / EGGS / WALLS). It is hidden in CSS rather than spliced out of the
 * array, so both layouts read from one list.
 */
const STATS = [
  { n: String(artworks.length + ovalese.length + murals.length + merch.length), label: 'Pieces shown', short: 'Pieces' },
  { n: String(ovalese.length).padStart(2, '0'), label: 'Ostrich eggs', short: 'Eggs' },
  { n: String(murals.length).padStart(2, '0'), label: 'Walls painted', short: 'Walls' },
  { n: '2015', label: 'First show', short: 'First show', wide: true },
]
```

- [ ] **Step 2: Rewrite the layout**

Replace the `About` component body:

```tsx
// Ground is painted by GroundLayer, behind the canvas — see that file.
export const About = () => (
  <section
    id="about"
    className="relative flex h-screen w-full items-start overflow-clip px-6 text-ink sm:items-center sm:px-0 sm:pl-[118px] sm:pr-[72px]"
  >
    {/*
      Mobile is one column in mocked order: label → headline → portrait → copy
      → stats. The portrait lives in the second grid column at sm, so on mobile
      the two wrappers become `display: contents` and their children reorder as
      direct flex items. At sm every wrapper takes its box back and the layout
      is exactly the desktop one — which is why this does not disturb 1440.
    */}
    <div className="flex w-full flex-col pt-[74px] pb-[86px] sm:grid sm:items-stretch sm:gap-[78px] sm:py-20 sm:[grid-template-columns:1fr_440px]">
      <div className="contents sm:flex sm:flex-col sm:justify-between">
        <div className="order-1 flex justify-between font-mono text-caption tracking-apparatus text-ink/55 uppercase sm:order-none">
          <span>About — 02 / 04</span>
          <span className="hidden sm:inline">B. 1994, Manila</span>
        </div>

        <div className="contents sm:block">
          <h2 className="order-2 mt-5 font-display text-about-m sm:order-none sm:mt-0 sm:text-about">
            I paint the hour
            <br className="hidden sm:inline" />
            before something
            <br className="hidden sm:inline" />
            <em className="italic">closes.</em>
          </h2>

          {/* COPY SLOT — DENISE TO WRITE. Two paragraphs. */}
          <div className="order-4 mt-5 grid max-w-[720px] grid-cols-1 gap-[22px] text-body-m text-ink/72 sm:order-none sm:mt-10 sm:grid-cols-2 sm:gap-[34px] sm:text-body">
            <p>
              Placeholder paragraph standing in for Denise's own words about how
              the work begins — the walk, the light, the flower already past its
              best. Length and tone guide only.
            </p>
            <p>
              Placeholder paragraph standing in for the second half: shells,
              walls, and why a surface that curves away from you asks to be
              painted differently than one that does not.
            </p>
          </div>
        </div>

        <div className="order-5 mt-5 border-t border-ink/25 pt-4 sm:order-none sm:mt-0 sm:pt-6">
          <dl className="flex gap-[26px] sm:gap-[52px]">
            {STATS.map((s) => (
              <div key={s.label} className={s.wide ? 'hidden sm:block' : ''}>
                <dd className="font-display text-stat-m sm:text-stat">{s.n}</dd>
                <dt className="mt-1 font-mono text-caption-sm tracking-stat text-ink/55 uppercase">
                  <span className="sm:hidden">{s.short}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="contents sm:flex sm:flex-col">
        <Placeholder
          label="Portrait of Denise — vertical crop"
          tone="cream"
          className="order-3 mt-5 h-[250px] border border-ink/12 sm:order-none sm:mt-0 sm:h-auto sm:flex-1"
        />
        <div className="order-6 mt-3 hidden justify-between font-mono text-caption-sm tracking-caption text-ink/50 uppercase sm:order-none sm:flex">
          <span>Fig. 02</span>
          <span>Parallax 0.9×</span>
        </div>
      </div>
    </div>
  </section>
)
```

The grid template uses `sm:[grid-template-columns:1fr_440px]` because Tailwind's `grid-cols-[1fr_440px]` would also need the `grid` display class — this form sets only the template and reads closer to the original inline value.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Verify the order, the overflow and the vertical fit**

At 390 × 844, confirm the visual order is exactly the mocked one:

```js
() => {
  const sec = document.getElementById('about')
  const named = [
    ['label', sec.querySelector('span')],
    ['headline', sec.querySelector('h2')],
    ['portrait', sec.querySelector('[role="img"]')],
    ['copy', sec.querySelector('p')],
    ['stats', sec.querySelector('dl')],
  ]
  return named
    .map(([name, el]) => ({ name, top: Math.round(el.getBoundingClientRect().top) }))
    .sort((a, b) => a.top - b.top)
}
```

Expected order top to bottom: `label, headline, portrait, copy, stats`.

Run **Probe A**: no entries with `sec: "about"`.
Run **Probe B**: About's `overflowsTicker` must be `≤ 0` — content must clear the 62px ticker.

Confirm the fourth stat is hidden and the labels are abbreviated:

```js
() => [...document.querySelectorAll('#about dl > div')].map(d => ({
  text: d.textContent.trim(),
  shown: getComputedStyle(d).display !== 'none',
}))
```

Expected: four entries, the `2015` one `shown: false`, and the visible three reading `Pieces` / `Eggs` / `Walls`.

- [ ] **Step 5: Screenshot and look**

Screenshot at 390 × 844 and compare with the second mocked mobile frame. The portrait must sit between the headline and the copy, the copy must be one column, and nothing may be cut off at the right edge.

- [ ] **Step 6: Verify the short viewport**

Resize to **360 × 640** and re-run Probes A and B. This is the floor, and it is where defect #14 hid: `b5ea535` was verified at one viewport height and shipped a regression only visible at 640. If `overflowsTicker` is positive here, reduce the mobile margins (`mt-5` → `mt-4`) rather than growing the section.

- [ ] **Step 7: Verify desktop is untouched**

At 1440 × 900, run **Probe C**. Expected: About spill `above: 0, below: 0`, `scrollHeight: 15660`, offsets unchanged.

Screenshot at 1440 × 900 and confirm two columns, four stats with full labels, `B. 1994, Manila` present, and `Fig. 02 / Parallax 0.9×` under the portrait.

- [ ] **Step 8: Commit**

```bash
git add src/sections/About.tsx
git commit -m "feat: lay About out in one column at mobile

The section the report named. Its portrait column sat at x 537-977 on a
375px viewport — entirely off-screen — and the 1fr 440px grid put the
copy's second column past the edge with it.

Mobile order interleaves the portrait between headline and copy, which
needs it to cross a container boundary; `display: contents` at base does
that and hands every wrapper its box back at sm, so 1440 is untouched."
```

---

### Task 7: Gallery scene furniture at mobile

**Files:**
- Modify: `src/sections/GalleryScene.tsx:69` (title block), `:128` (category list), `:103` (chips), `:153-156` (progress row)

**Interfaces:**
- Consumes: `text-scene-m` (Task 1).
- Produces: nothing other tasks consume.

The snap list itself already works at mobile and its gutter comes from `snapListGutter()` — **do not touch `SnapList.tsx` or `lib/snapList.ts`.** Only the surrounding furniture moves.

- [ ] **Step 1: Move the title block**

Replace the title block's opening tag (line 69):

```tsx
      <div className="absolute z-10 left-6 top-[70px] sm:left-[118px] sm:top-16">
```

and the `<h2>` inside it:

```tsx
        <h2 className="mt-3 font-display text-scene-m sm:mt-4 sm:text-scene">
```

- [ ] **Step 2: Let the merch chips wrap**

The chip row (line 103) becomes:

```tsx
          <div className="mt-6 flex flex-wrap gap-2">
```

- [ ] **Step 3: Hide the category list below `sm`**

The category list (line 128) becomes:

```tsx
      <ul className="absolute z-10 hidden text-right sm:block sm:right-[72px] sm:top-16">
```

It collides with the title block at 390 and the mocked frame replaces it with the count line already rendered under the title.

- [ ] **Step 4: Clear the ticker with the progress row**

The progress row (lines 153–156) becomes:

```tsx
      <div className="absolute z-10 flex items-center gap-4 left-6 right-6 bottom-[86px] sm:left-[118px] sm:right-[72px] sm:bottom-[52px]">
```

86px = the 62px ticker plus a 24px gutter.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck && npm test`
Expected: clean, all pass.

- [ ] **Step 6: Verify all four scenes**

At 390 × 844, run **Probe A**. Expected: no entries with `sec` of `g1`, `g2`, `g3` or `g4`.

Confirm the title block and the snap list do not overlap on any scene:

```js
() => ['g1','g2','g3','g4'].map(id => {
  const sec = document.getElementById(id)
  const title = sec.querySelector('h2').getBoundingClientRect()
  const scroller = sec.querySelector('[class*="overflow-x-auto"]')?.getBoundingClientRect()
  const row = sec.querySelector('.absolute.flex.items-center')?.getBoundingClientRect()
  return {
    id,
    titleBottom: Math.round(title.bottom),
    listTop: scroller ? Math.round(scroller.top) : null,
    overlap: scroller ? Math.round(title.bottom - scroller.top) : null,
    rowBottom: row ? Math.round(row.bottom) : null,
    clearsTicker: row ? row.bottom <= sec.getBoundingClientRect().bottom - 62 : null,
  }
})
```

Expected: `overlap` ≤ 0 on every scene, `clearsTicker: true` on every scene.

Confirm the merch chips wrap rather than overflow — scroll to g4 and re-run **Probe A**.

- [ ] **Step 7: Verify the pieces are still reachable**

At 390 × 844, scroll to g1, tap the centred card, confirm the detail route opens, go back, and confirm the scroll position is restored. This is the hard requirement that the fallback presentation exists to protect.

- [ ] **Step 8: Screenshot and look**

Screenshot g2 (Ovalese) at 390 × 844 and compare with the third mocked mobile frame.

- [ ] **Step 9: Verify desktop is untouched**

At 1440 × 900, run **Probe C**. Expected: all four gallery sections spill `0/0`, offsets and `scrollHeight` unchanged. Screenshot g1 and confirm the dial, the top-right category list and the progress row all sit where they did.

- [ ] **Step 10: Commit**

```bash
git add src/sections/GalleryScene.tsx
git commit -m "feat: fit the gallery furniture to mobile

Title block, chips and progress row move to 24px gutters and clear the
ticker; the scene title drops to 44px. The top-right category list hides
below sm, where it collided with the title block — the mocked frame
replaces it with the count line already under the title.

SnapList and its gutter are untouched; they already worked."
```

---

### Task 8: Contact at mobile

**Files:**
- Modify: `src/sections/Contact.tsx` (section padding, headline, link row, footer)

**Interfaces:**
- Consumes: `text-contact-m`, `text-enquire-m` (Task 1).
- Produces: nothing other tasks consume.

- [ ] **Step 1: Rewrite the section**

Replace the `Contact` component body:

```tsx
// Ground is painted by GroundLayer, behind the canvas — see that file.
export const Contact = () => (
  <section
    id="contact"
    className="relative flex h-screen w-full flex-col justify-center overflow-clip px-6 text-cream sm:px-0 sm:pl-[118px] sm:pr-[72px]"
  >
    <div className="flex w-full flex-col items-start sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-display text-contact-m sm:text-contact">
          Commissions,
          <br className="hidden sm:inline" />
          walls, <em className="italic">and</em>
          <br className="hidden sm:inline" />
          everything else.
        </h2>

        <div className="mt-10 flex flex-col gap-[26px] sm:mt-14 sm:flex-row sm:gap-[74px]">
          <div>
            <p className="font-mono text-ph tracking-apparatus text-cream/45 uppercase sm:hidden">
              Email
            </p>
            <a
              href="mailto:hello@denisecacanando.com"
              className="mt-2 block border-b border-cream/30 pb-[6px] font-display text-enquire-m transition-colors hover:border-ochre-bright hover:text-ochre-bright sm:mt-0 sm:inline-block sm:text-enquire"
            >
              hello@denisecacanando.com
            </a>
          </div>
          <div>
            <p className="font-mono text-ph tracking-apparatus text-cream/45 uppercase sm:hidden">
              Instagram
            </p>
            <a
              href="https://instagram.com/ovalese"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block border-b border-cream/30 pb-[6px] font-display text-enquire-m transition-colors hover:border-ochre-bright hover:text-ochre-bright sm:mt-0 sm:inline-block sm:text-enquire"
            >
              @ovalese
            </a>
          </div>
        </div>
      </div>

      {/* Form slot reserved — email + Instagram ship first. */}
      <div className="hidden max-w-[280px] text-right font-mono text-caption tracking-caption text-cream/40 uppercase sm:block">
        <p>Form comes later — slot reserved</p>
        <p className="mt-2">Mural enquiries: include wall dimensions</p>
      </div>
    </div>

    <div className="absolute flex justify-between border-t border-cream/12 pt-5 font-mono text-caption-sm tracking-caption text-cream/45 uppercase left-6 right-6 bottom-[86px] sm:left-[118px] sm:right-[72px] sm:bottom-[52px]">
      <span>© Denise Cacanando 2026</span>
      <span>Manila, PH</span>
    </div>
  </section>
)
```

The two links keep their own `<div>` wrappers at both widths — that is what lets the mobile-only `EMAIL` / `INSTAGRAM` labels sit above each one without disturbing the desktop row, which is now `sm:flex-row` with the same 74px gap.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Verify**

At 390 × 844, run **Probe A**: no entries with `sec: "contact"`. Run **Probe B**: `overflowsTicker` ≤ 0.

Confirm the links stacked and are comfortably tappable — a 21px serif link with 8px padding clears the 44px touch target only with its label, so measure the whole block:

```js
() => [...document.querySelectorAll('#contact a')].map(a => {
  const r = a.getBoundingClientRect()
  return { text: a.textContent.trim(), top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) }
})
```

Expected: two entries at different `top` values (stacked, not side by side), neither wider than 342.

- [ ] **Step 4: Screenshot and look**

Screenshot at 390 × 844 and compare with the fourth mocked mobile frame.

- [ ] **Step 5: Verify desktop is untouched**

At 1440 × 900, run **Probe C**: contact spill `0/0`, `contact` offset still **14760**, `scrollHeight` 15660. Screenshot and confirm the two links are side by side at 32px with the 74px gap, and the reserved form slot is back on the right.

- [ ] **Step 6: Commit**

```bash
git add src/sections/Contact.tsx
git commit -m "feat: stack the contact links and headline at mobile

Headline to 46px, links stacked with the mocked EMAIL / INSTAGRAM labels,
footer clears the ticker. The reserved form-slot note hides below sm, as
the mocked frame has it."
```

---

### Task 9: Detail pages at mobile — derived, not specced

**Files:**
- Modify: `src/routes/DetailPage.tsx:45-48` (main padding), `:50` (top bar), `:59` (grid), `:93` (title)

**Interfaces:**
- Consumes: `text-leaf-m` (Task 1).
- Produces: nothing other tasks consume.

**The mockup has no mobile detail frame.** This treatment is derived from the four mocked mobile screens and is provisional — Denise may correct it. Say so in the commit, and do not let a later reader mistake it for specced.

There is no ticker on a detail route (it is a separate route with no rail either), so nothing needs 86px of bottom clearance here.

- [ ] **Step 1: Make the page padding responsive**

Replace the `<main>` opening tag (lines 45–48):

```tsx
    <main className="min-h-screen bg-ink px-6 pt-[74px] pb-16 text-cream sm:px-[72px] sm:pt-[104px] sm:pb-24">
```

- [ ] **Step 2: Stack the top bar**

Replace line 50:

```tsx
      <div className="mb-8 flex flex-col gap-2 font-mono text-caption tracking-caption uppercase sm:mb-12 sm:flex-row sm:justify-between sm:gap-0">
```

- [ ] **Step 3: Collapse the grid to one column**

Replace line 59:

```tsx
      <div className="grid grid-cols-1 gap-8 sm:gap-16 sm:[grid-template-columns:1fr_420px]">
```

- [ ] **Step 4: Drop the title size**

Replace line 93:

```tsx
          <h1 className="mt-3 font-display text-leaf-m sm:mt-4 sm:text-leaf">{piece.title}</h1>
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Verify on a real leaf of each kind**

Navigate to `/artworks/<slug>`, `/ovalese/<slug>` and `/murals/<slug>` at 390 × 844. Read a real slug from the data rather than guessing:

```js
() => [...document.querySelectorAll('a[href^="/"]')].slice(0, 5).map(a => a.getAttribute('href'))
```

On each, run a variant of **Probe A** scoped to `main` (a detail page has no `<section>`):

```js
() => {
  const vw = document.documentElement.clientWidth
  const bad = []
  for (const el of document.querySelectorAll('main *')) {
    const b = el.getBoundingClientRect()
    if (!b.width && !b.height) continue
    if (b.right > vw + 1 || b.left < -1) bad.push({ tag: el.tagName, right: Math.round(b.right), text: (el.textContent||'').trim().slice(0,30) })
  }
  return { vw, count: bad.length, bad: bad.slice(0, 10) }
}
```

Expected: `count: 0` on all three.

Confirm the image well is above the metadata (single column, not side by side):

```js
() => {
  const well = document.querySelector('main [role="img"], main .grid > div')
  const dl = document.querySelector('main dl')
  return { wellTop: Math.round(well.getBoundingClientRect().top), dlTop: Math.round(dl.getBoundingClientRect().top) }
}
```

Expected: `wellTop < dlTop`.

- [ ] **Step 7: Verify the enquire button and prev/next**

Confirm the ENQUIRE button spans the column and the prev/next row does not overflow. Screenshot and look — a serif piece title can be long, and the prev/next row puts two of them side by side.

- [ ] **Step 8: Verify desktop is untouched**

At 1440 × 900, load the same three leaves. The grid must still be `1fr 420px` with a 64px gap, padding 72/104/96, title 62px. Screenshot one and compare.

- [ ] **Step 9: Commit**

```bash
git add src/routes/DetailPage.tsx
git commit -m "feat: stack the detail leaf at mobile

DERIVED, NOT SPECCED: the mockup has no mobile detail frame and README
§159 covers desktop only. Treatment follows the four mocked mobile screens
— one column, 24px gutters, image well above the metadata — and should be
treated as provisional until Denise rules on it."
```

---

### Task 10: Full-matrix verification and documentation

**Files:**
- Modify: `README.md` §183–184 (the pollen/flock counts the last cycle left disagreeing with the build)
- Modify: `docs/superpowers/2026-07-31-ovalese-handoff.md` (current state, new invariants, corrected invariant 10)

No source changes. This task is the gate: it proves the whole matrix rather than one viewport at a time, which is exactly the hole defect #14 went through.

- [ ] **Step 1: Run the full viewport matrix**

For each of **360 × 640**, **390 × 844**, **414 × 896**, **640 × 844**, **768 × 900**, **1440 × 900**: confirm rAF health first, then run **Probe A** and **Probe B**, and take one screenshot of Hero, About, a gallery scene and Contact.

Expected: Probe A `count: 0` at every viewport. Probe B `overflowsTicker ≤ 0` at every viewport below 640.

Record the numbers. Do not carry a rAF threshold across machines — take a reading.

- [ ] **Step 2: Run the desktop regression baseline**

At 1440 × 900, run **Probe C**.

Expected exactly: `scrollHeight: 15660`; offsets `hero 0 · about 900 · g1 1800 · g2 5580 · g3 8460 · g4 11520 · contact 14760`; every section spill `0/0` except hero's `170/170`.

Also confirm the ground blocks still tile end to end with no bare-body strip:

```js
() => {
  const blocks = [...document.querySelectorAll('[aria-hidden="true"] > div')]
    .map(d => ({ top: Math.round(parseFloat(d.style.top)), h: Math.round(parseFloat(d.style.height)) }))
    .sort((a, b) => a.top - b.top)
  const gaps = []
  for (let i = 1; i < blocks.length; i++) {
    const prevEnd = blocks[i - 1].top + blocks[i - 1].h
    if (Math.abs(blocks[i].top - prevEnd) > 1) gaps.push({ at: blocks[i].top, gap: blocks[i].top - prevEnd })
  }
  const last = blocks[blocks.length - 1]
  return { first: blocks[0]?.top, end: last ? last.top + last.h : null, gaps, docHeight: document.documentElement.scrollHeight }
}
```

Expected: `first: 0`, `end: 15660`, `gaps: []`.

- [ ] **Step 3: Confirm reduced motion still behaves**

With `prefers-reduced-motion: reduce` emulated, at 390 × 844 and 1440 × 900: pins release, rings are snap lists, every piece still reachable.

- [ ] **Step 4: Run the full suite and build**

```bash
npm run typecheck && npm test && npm run build
```

Expected: clean; **109 tests** (106 plus Task 2's three); build succeeds. Record the critical-path bundle size and compare against **401.35 kB** — the ticker is a small component and three.js is unchanged, so a large jump means something got pulled into the critical path.

- [ ] **Step 5: Check the console**

Expected: clean apart from the pre-existing three.js `Clock` deprecation notice and the dev-only `favicon.ico` 404. Anything else is new and must be explained before this task closes.

- [ ] **Step 6: Reconcile README §183–184 with the build**

The last cycle cut `FULL_POLLEN` 4000 → 500 and `FULL_FLOCK` 1200 → 30 by hand and recorded that the README still says "~4k" and "~1,200 instances". The design of record should not disagree with the build. Update those two figures to the shipped counts, noting they were set by hand.

Do **not** change the counts themselves.

- [ ] **Step 7: Revise the handoff**

Revise `docs/superpowers/2026-07-31-ovalese-handoff.md` in place — one current-state document, never accumulated. It must record:

- Mobile is implemented; the branch state and the new HEAD.
- **Two new invariants:** (12) mobile is the base style and desktop lives behind `sm:`, with layout tiers in CSS and never in JS, because a JS flip rebuilds the timeline; (13) section geometry is expressed as utility classes, never inline `style`, because inline styles beat every variant — inline `style` remains correct for `--r` / `--at` / `--i` plumbing.
- **A correction to invariant 10:** it claims every section clips with `clip` not `hidden`, but Hero is still `overflow-hidden` and always was. State the exception rather than leaving the invariant describing code that does not exist.
- The new known-good measurements from Steps 1–2, at every viewport in the matrix.
- That the detail-page mobile layout is **derived, not specced**, and is the first thing to re-check when Denise rules on it.
- Move "Mobile bottom ticker and the rail's cream-ground flip" out of *What's next* — it is done.

- [ ] **Step 8: Commit**

```bash
git add README.md docs/superpowers/2026-07-31-ovalese-handoff.md
git commit -m "docs: record the mobile layer and reconcile the counts

Handoff revised in place with the new invariants, the corrected invariant
10 (hero is overflow-hidden, not clip) and the measurements from the full
viewport matrix. README §183-184 now state the shipped pollen and flock
counts instead of the pre-cut figures."
```

- [ ] **Step 9: Report honestly**

State the measured results, including anything that did not pass. If a viewport in the matrix still shows overflow, say so with the numbers rather than reporting the task complete — the repo's defect list has two entries that are precisely this failure (#8, #12).

---

## Self-review

**Spec coverage.** Every section of the spec maps to a task: tiers → Task 1 + the `sm:` usage throughout; inline-style blocker → Tasks 5–9; type scale → Task 1; Hero/About/Gallery/Contact → Tasks 5–8; rail → ticker → Task 4; progress line → Task 3; shared stop logic → Task 2; detail pages → Task 9; constraints → Global Constraints; verification → Task 10.

**One deliberate addition beyond the spec:** `--text-leaf-m` (Task 1) for the detail-page title. The spec's token table lists eight; the detail-page section is marked derived, and its title needed a mobile size. Flagged here so it is not mistaken for drift.

**Known risk, called out rather than hidden — and pre-verified.** Task 6's `display: contents` technique is the one non-obvious mechanism in the plan. It is used because the portrait must cross a container boundary to sit between the headline and the copy, and the alternative — rewriting the desktop grid — would put the "desktop unchanged" requirement at risk.

It was tested in the browser before this plan was committed, on a detached element with the same nesting About has (two `contents` wrappers, one of them nested):

- With `contents`, visual order came out `label, headline, portrait, copy, stats` — exactly the mocked order.
- With `contents` removed, the portrait returned below the stats, i.e. normal nesting, which is the `sm:` case.

So the mechanism is known to work; what Task 6 Step 4 verifies is that it works *in About's real markup*. If it somehow misbehaves there, the fallback is an explicit `sm:grid-rows-[auto_1fr_auto]` placement, which changes desktop and must then be re-verified against Probe C.

**Type consistency.** `stopIndexFor(label: Label): number` is defined in Task 2 and consumed in Task 4 under that exact name. `--progress` is written in Task 3 and read in Task 4 under that exact name. `STATS` gains `short` and `wide` in Task 6 Step 1 and both are consumed in Step 2.
