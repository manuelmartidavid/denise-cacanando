# Murals Ring + Seed Re-seat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Murals scene (g3) from the x-translate track to a landscape-thumbed ring, delete the track presentation, and re-seat the collapse-to-seed seam at g2|g3 so Ovalese collapses to the seed and Murals blooms from it.

**Architecture:** Declaration-first — flip the declarations the machinery already reads (`GALLERY_SCENES`, `RING_LOOK`, `SEED_SEAM`); everything downstream (`seamAt`, `seamPinnedAt`, `ScrollPage`'s seeded gate, `Dial`'s seam prop) is keyed off them and follows without math changes. `trackAt` survives as `fractionalIndexAt` in `timelineMath.ts` because the Artworks field pans on it; the rest of the track code is deleted.

**Tech Stack:** Vite 8 · React 19 · GSAP ScrollTrigger · Lenis · Tailwind 4 · vitest (node env, pure functions only).

**Spec:** `docs/superpowers/specs/2026-08-06-murals-ring-seed-reseat-design.md` — read it first.

## Global Constraints

- **Invariant 2:** GSAP lives only in `src/scroll/timeline.ts`. No component imports gsap or ScrollTrigger.
- **Invariant 4:** counts are never hardcoded in a view — `activeCount(scene)` / `activePieces(scene)`. `SEED_SEAM_INDEX` derives from `LABELS.indexOf`, never a literal.
- **Invariant 6:** vitest is node-environment, `src/**/*.test.ts`, pure functions only. **Do not add jsdom or component tests.** The browser is the test for anything visual (Task 6).
- **Ruled look values (Marti, 2026-08-06), not yours to move:** g3 `seats: 6, length: 220, guide: 640, dash: 460, orbit: 326`; `RING_LOOK.murals = { slot: 'square', slotW: 340, slotH: 227, thumbW: 150, thumbH: 100 }`.
- **Before every commit:** `git diff --cached --stat` (never trust `git status`). `git rm` stages its deletions immediately — commit the deletion task promptly.
- **Push per commit** and verify with `git ls-remote origin main`, not by trusting the push output.
- Commit messages with double quotes in them must go through `git commit -F <file>` (PowerShell here-strings word-split on embedded quotes). The messages below have none, so `-m` is fine. Repo style is lowercase `feat:`/`docs:`/`refactor:` with a plain-speech clause.
- After deleting modules, a running Vite dev server holds a stale module graph — restart it (`rm -rf node_modules/.vite` first) rather than trusting HMR.
- Never quote a stale measurement: the g3 pin shortens (240vh → 220vh), so every label offset past g3 moves. Task 6 re-measures; Tasks 1–5 must not copy old numbers into new prose except where explicitly marked historical.

---

### Task 1: Move `trackAt` to `timelineMath.ts` as `fractionalIndexAt`

The Artworks field publishes its per-frame scalar through this function; it must survive the track deletion. Move it first so Task 3's deletion is pure removal.

**Files:**
- Modify: `src/scroll/timelineMath.ts` (append one function)
- Modify: `src/scroll/timelineMath.test.ts` (append one describe block)
- Modify: `src/scroll/timeline.ts:18` (import), `src/scroll/timeline.ts:400-408` (call site + comment)
- NOT touched: `src/lib/track.ts` — it keeps its own `trackAt` until Task 3 deletes the whole module.

**Interfaces:**
- Produces: `fractionalIndexAt(p: number, count: number): number` — piece 0 at p=0, piece n−1 at p=1, 0 for empty. Exact same body as `trackAt`.
- Consumers after this task: `timeline.ts` only (the field's publish path).

- [ ] **Step 1: Write the failing tests**

In `src/scroll/timelineMath.test.ts`, extend the import and append after the `needsSnap` describe:

```ts
import { SNAP_EPSILON, fractionalIndexAt, needsSnap, pinLengthPx, scrollAtProgress } from './timelineMath'
```

```ts
describe('fractionalIndexAt', () => {
  it('puts piece 0 at p=0 and piece n-1 at p=1', () => {
    expect(fractionalIndexAt(0, 7)).toBe(0)
    expect(fractionalIndexAt(1, 7)).toBe(6)
  })

  it('is linear in between', () => {
    expect(fractionalIndexAt(0.5, 7)).toBeCloseTo(3, 10)
  })

  it('pins a single-piece category at 0 for every progress', () => {
    expect(fractionalIndexAt(0, 1)).toBe(0)
    expect(fractionalIndexAt(0.5, 1)).toBe(0)
    expect(fractionalIndexAt(1, 1)).toBe(0)
  })

  it('never goes negative on an empty category', () => {
    expect(fractionalIndexAt(1, 0)).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/scroll/timelineMath.test.ts`
Expected: FAIL — `fractionalIndexAt` is not exported.

- [ ] **Step 3: Implement**

Append to `src/scroll/timelineMath.ts`:

```ts
/**
 * Fractional piece index at progress p — piece 0 at p=0, piece n-1 at p=1.
 * The scalar the Artworks field pans on: the timeline publishes it per frame
 * and the field writes it to --at. Formerly `trackAt` in lib/track.ts, from
 * when the Murals track unrolled on the same mapping; the field is its one
 * consumer now.
 */
export const fractionalIndexAt = (p: number, count: number): number =>
  p * Math.max(0, count - 1)
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/scroll/timelineMath.test.ts`
Expected: PASS (all four new tests).

- [ ] **Step 5: Switch `timeline.ts` to it**

In `src/scroll/timeline.ts`:
- Delete line 18: `import { trackAt } from '~/lib/track'`
- Line 17 becomes: `import { fractionalIndexAt, needsSnap, pinLengthPx, scrollAtProgress } from './timelineMath'`
- In `buildTimeline`, the call site (currently `? trackAt`) becomes `? fractionalIndexAt`, and in the comment above it replace `so it reuses \`trackAt\` rather than` with `so it reuses \`fractionalIndexAt\` rather than`. (The comment's full rewrite happens in Task 3 when the `'track'` branch goes.)

- [ ] **Step 6: Typecheck and full suite**

Run: `npm run typecheck` then `npm test`
Expected: both clean. `track.test.ts` still passes — its module is untouched.

- [ ] **Step 7: Commit and push**

```bash
git add src/scroll/timelineMath.ts src/scroll/timelineMath.test.ts src/scroll/timeline.ts
git diff --cached --stat
git commit -m "refactor: the field's scalar moves to timelineMath as fractionalIndexAt"
git push
git ls-remote origin main
```

---

### Task 2: Declare the Murals dial

Flip the g3 declaration and give `RING_LOOK.murals` real landscape values. After this task the site renders Murals as a ring (Dial is fully generic); the track components become unreferenced but still compile — Task 3 removes them.

**Files:**
- Modify: `src/scroll/scenes.ts:75` (the g3 row only — types and comments wait for Task 3)
- Modify: `src/sections/ring/look.ts:12-24`
- Test: `src/lib/ring.test.ts` (one new test in the `ringClipRadius` describe)

**Interfaces:**
- Produces: `GALLERY_SCENES[2]` = `{ label: 'g3', category: 'murals', presentation: 'dial', seats: 6, length: 220, ground: 'dark', guide: 640, dash: 460, orbit: 326 }`; `RING_LOOK.murals` = `{ slot: 'square', slotW: 340, slotH: 227, thumbW: 150, thumbH: 100 }`. Task 4's seam and Task 6's measurements rely on these exact values.

- [ ] **Step 1: Add the landscape clip-radius test**

In `src/lib/ring.test.ts`, inside `describe('ringClipRadius', ...)` after the square-thumb test:

```ts
  /**
   * Murals is the first landscape (non-square, non-portrait) thumb through
   * this function. Written before the declaration flip as a pinning test —
   * ringClipRadius is already general, so this passes immediately; what it
   * guards is the new geometry class staying covered if the formula is ever
   * "simplified" back toward a width-only term.
   */
  it('reaches the corner of a landscape thumb, not its long edge', () => {
    expect(ringClipRadius(640, 326, 150, 100)).toBeGreaterThanOrEqual(326 + Math.hypot(150, 100) / 2)
    expect(ringClipRadius(640, 326, 150, 100)).toBeGreaterThan(326 + 150 / 2)
  })
```

Run: `npx vitest run src/lib/ring.test.ts`
Expected: PASS — this is a pinning test (the function is already general); the red step is inapplicable and that is documented in the test comment.

- [ ] **Step 2: Flip the g3 row in `scenes.ts`**

Replace line 75:

```ts
  { label: 'g3', category: 'murals', presentation: 'track', seats: 0, length: 240, ground: 'dark', guide: 0, dash: 0, orbit: 0 },
```

with:

```ts
  { label: 'g3', category: 'murals', presentation: 'dial', seats: 6, length: 220, ground: 'dark', guide: 640, dash: 460, orbit: 326 },
```

`length` 220, not 240: pin length is proportional to piece count and Murals has 7 pieces — exactly Ovalese's count, and Ovalese is 220.

- [ ] **Step 3: Fill `RING_LOOK.murals` in `look.ts`**

Replace the comment block and record (lines 12–24) with:

```ts
/**
 * Slot and thumb geometry per category — README "Spacing & geometry".
 *
 * Murals is landscape on purpose: the walls are wide, and an upright crop
 * would misrepresent them. The values are Marti's (ruled 2026-08-06) and are
 * browser-tunable by him only. Artworks is zeroed: it is the floating field
 * (`sections/field`), not a ring — the entry stays so the record is total
 * over CategoryId, not because anything reads it.
 */
export const RING_LOOK: Record<CategoryId, RingLook> = {
  artworks: { slot: 'square', slotW: 0, slotH: 0, thumbW: 0, thumbH: 0 }, // field scene, unused
  ovalese: { slot: 'ovoid', slotW: 248, slotH: 312, thumbW: 98, thumbH: 124 },
  merch: { slot: 'square', slotW: 250, slotH: 250, thumbW: 150, thumbH: 150 },
  murals: { slot: 'square', slotW: 340, slotH: 227, thumbW: 150, thumbH: 100 },
}
```

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npm test` then `npm run typecheck`
Expected: clean. Note `ring.test.ts`'s existing `dials` loop (`GALLERY_SCENES.filter((s) => s.presentation === 'dial')`) now includes murals automatically — the corner-clearance and guide-coverage tests cover the new scene without edits.

- [ ] **Step 5: Commit and push**

```bash
git add src/scroll/scenes.ts src/sections/ring/look.ts src/lib/ring.test.ts
git diff --cached --stat
git commit -m "feat: murals declares a landscape ring - six wall crops on the ovalese-scale circles"
git push
git ls-remote origin main
```

---

### Task 3: Delete the track

Pure removal plus the type narrowing that forces it to be complete. Nothing declares `'track'` after Task 2, so the compiler is the safety net: narrow the types first, then delete what no longer compiles.

**Files:**
- Modify: `src/scroll/scenes.ts:34,41-47` (type + docstring)
- Modify: `src/scroll/presentation.ts` (full contents below)
- Modify: `src/sections/GalleryScene.tsx:12,21-26,179` (import, header comment, branch)
- Modify: `src/scroll/timeline.ts:400-408` (branch + comment)
- Delete: `src/sections/track/Track.tsx`, `src/sections/track/Dossier.tsx`, `src/lib/track.ts`, `src/lib/track.test.ts`

**Interfaces:**
- Produces: `Presentation = 'dial' | 'field'`; `Rendered = 'dial' | 'list' | 'field'`. Task 4+ code and comments must not reference `'track'`.
- Consumes: `fractionalIndexAt` from Task 1 (already wired into `timeline.ts`).

- [ ] **Step 1: Narrow the types and rewrite the scene docstring in `scenes.ts`**

Line 34: `export type Presentation = 'dial' | 'track' | 'field'` → `export type Presentation = 'dial' | 'field'`

Replace the `presentation` field docstring (lines 41–47):

```ts
  /**
   * `dial` rotates and pins, `field` pans a 2D scatter. Three of the four
   * scenes are dials again — what varies the middle pair now is the seed
   * choreography (Ovalese collapses to the seed, Murals blooms from it), and
   * the Artworks field breaks the repetition at the top of the run.
   */
```

Also update the guide/dash/orbit field comments on the type (lines 55–59): each says `0 in \`track\` mode.` — change all three to `0 in \`field\` mode.`

- [ ] **Step 2: Replace `src/scroll/presentation.ts` contents**

```ts
import type { Presentation } from './scenes'

/** What actually renders, as opposed to what the scene declares. */
export type Rendered = 'dial' | 'list' | 'field'

/**
 * Both presentations fall back to the pin-free list under reduced motion or
 * below 900px. Every piece stays reachable through the same route either way,
 * which is the hard requirement.
 *
 * The list is category-generic, so the seven mural walls come through it as
 * cards linking to the same `/murals/<slug>` route the dial's centre slot
 * links to.
 */
export const resolvePresentation = (
  declared: Presentation,
  reduced: boolean,
  compact: boolean,
): Rendered => {
  if (reduced || compact) return 'list'
  if (declared === 'field') return 'field'
  return 'dial'
}
```

- [ ] **Step 3: Remove the track from `GalleryScene.tsx`**

- Delete line 12: `import { Track } from './track/Track'`
- Delete line 179: `{rendered === 'track' && <Track scene={scene} activeIndex={index} />}`
- In the header comment (lines 21–26), replace `a pinned rotating dial, a pin-free snap list, or (Murals) the x-translate track.` with `a pinned rotating dial, the Artworks field, or the pin-free snap list.`
- In the `<section>` comment (lines 57–63), the sentence `tabbing to an off-screen dossier then sets section.scrollLeft and leaves the track desynced from --at` names the dead presentation as its example — replace with `tabbing to off-screen content then sets section.scrollLeft and desyncs what a per-frame property placed (this bit as a real bug when Murals was an x-translate track).`

- [ ] **Step 4: Drop the `'track'` branch in `timeline.ts`**

In `buildTimeline`, `rendered === 'track' || rendered === 'field'` becomes `rendered === 'field'`, and the comment above the `createScrubScene` call (lines 400–403) becomes:

```ts
    // The pinned presentations differ only in the scalar they publish: the
    // field pans on a fractional piece index, a dial rotates by degrees.
```

(Keep the separate `orbitSeats` comment beside the dial arm unchanged.)

- [ ] **Step 5: Delete the four files**

```bash
git rm src/sections/track/Track.tsx src/sections/track/Dossier.tsx src/lib/track.ts src/lib/track.test.ts
```

`git rm` stages immediately — this task commits before anything else is staged.

- [ ] **Step 6: Sweep for stragglers**

Grep `src/` for `track` (case-insensitive). Expected survivors, all legitimate: `trackProgress` in `lib/ring.ts` and its callers (the progress-bar track — unrelated), `tracking-caption` Tailwind classes, and the rewritten comments above. If `SnapList.tsx` carries a "serves the track too" comment, change it to say the list is category-generic and serves every scene's fallback. Any other hit that means the Murals x-translate is stale prose — rewrite it to name the dial, matching the surrounding comment voice.

- [ ] **Step 7: Typecheck, full suite, build**

Run: `npm run typecheck`, `npm test`, `npm run build`
Expected: all clean. The suite shrinks by `track.test.ts` — re-measure the count, do not quote a remembered one.

- [ ] **Step 8: Commit and push**

```bash
git diff --cached --stat
git add src/scroll/scenes.ts src/scroll/presentation.ts src/sections/GalleryScene.tsx src/scroll/timeline.ts
git diff --cached --stat
git commit -m "feat: the murals track is deleted - g3 is a dial and the field owns fractionalIndexAt"
git push
git ls-remote origin main
```

If a dev server is running, restart it now: deleted modules poison Vite's graph (`rm -rf node_modules/.vite` first).

---

### Task 4: Re-seat the seed at g2|g3

The one-line declaration change plus the docstring/comment sweep that keeps the prose honest. `ScrollPage`'s `seeded` gate goes live on its own after this — both seam neighbours resolve to `'dial'` on desktop non-reduced, so `SeedLayer` mounts again for the first time since g1 became the field.

**Files:**
- Modify: `src/scroll/seed.ts:14-20` (declaration + docstring), `src/scroll/seed.ts:52-81` (`seamPinnedAt` docstring, one sentence)
- Test: `src/scroll/seed.test.ts:13-18` (fixture comment), `:49-53` (role test)
- Modify: `src/sections/ring/Dial.tsx:50-58,82-91` (two comments)
- Modify: `src/scroll/timeline.ts:455-463` (one comment)

**Interfaces:**
- Produces: `SEED_SEAM = { out: 'g2', in: 'g3' }`. `SEED_SEAM_INDEX` derives to 3 via `LABELS.indexOf` — never write the 3.
- Consumes: g2 and g3 both declaring `presentation: 'dial'` (Task 2).

- [ ] **Step 1: Write the failing test**

In `src/scroll/seed.test.ts`, replace the role test (lines 49–53):

```ts
  it('assigns a role to the two participants and nobody else', () => {
    expect(seamRole(SEED_SEAM.out)).toBe('out')
    expect(seamRole(SEED_SEAM.in)).toBe('in')
    expect(seamRole('g1')).toBeUndefined()
    expect(seamRole('g4')).toBeUndefined()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/scroll/seed.test.ts`
Expected: FAIL — `seamRole('g1')` is `'out'` under the old declaration. (This is the regression the test now guards: the field must never carry a seam role.)

- [ ] **Step 3: Flip the declaration**

In `src/scroll/seed.ts`, replace lines 14–20 (comment + declaration):

```ts
/**
 * The one seam that collapses. Ring-to-ring only: Ovalese hands off to Murals
 * through the seed. The seams touching the Artworks field (g1) keep the plain
 * scroll-away — a field is not a ring, so there is nothing on that side to
 * collapse. Built at g1|g2 on 2026-08-03 when both of those were rings;
 * re-seated here 2026-08-06 when Murals became one and g1 stopped being one.
 */
export const SEED_SEAM = { out: 'g2', in: 'g3' } as const
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/scroll/seed.test.ts`
Expected: PASS — every other test in the file is written against the declaration or against the index-generic maths, and none needs edits.

- [ ] **Step 5: Mark the fixture historical**

Replace the fixture comment in `seed.test.ts` (lines 13–18):

```ts
/**
 * 1440x900 geometry as measured 2026-08-04, in progress units — historical:
 * read off the live page when the seam was g1|g2 and g3 was the 240vh track.
 * Still a valid fixture for the index-generic maths (`seamPinnedAt` is tested
 * at SEAM = 2 regardless of where the live seam sits), and kept because it was
 * measured rather than derived — the discipline flock.test.ts's BOUNDS keeps.
 * The live seam is now g2|g3; its browser measurements live in HANDOFF.md.
 */
```

- [ ] **Step 6: Sweep the prose that hardcodes the old seam**

Three comments state g1/g2 as current fact; make them role-generic, keeping the measured numbers as history:

1. `src/scroll/seed.ts`, `seamPinnedAt` docstring: replace the sentence `\`seamAt\` reaches 0 at the boundary, which for the \`g1 -> g2\` seam is 450px *past* g1's pin release — so driving the collapse from it left a half-collapsed ring drifting up the screen while a fully-bright seed stayed put, ~137px apart.` with `\`seamAt\` reaches 0 at the boundary, which sits well past the outgoing pin's release — 450px past it at the seam this was measured on (then g1 -> g2) — so driving the collapse from it left a half-collapsed ring drifting up the screen while a fully-bright seed stayed put, ~137px apart.`
2. `src/sections/ring/Dial.tsx`, the `collapsedAway` comment: `so it never applies to \`g4\` or to \`g2\` while it is still opening` → `so it never applies to \`g4\` or to \`g3\` while it is still opening`.
3. `src/sections/ring/Dial.tsx`, the `collapse` docstring: `\`--seam\` reaches 0 at the boundary, which is 450px past g1's pin release` → `\`--seam\` reaches 0 at the boundary, well past the outgoing pin's release (450px past it where this was measured)`.
4. `src/scroll/timeline.ts`, the `--seam` onUpdate comment: `g1 (outgoing) reads --seam open at -1 and g2 (incoming) reads it open at +1` → `the outgoing ring reads --seam open at -1 and the incoming one reads it open at +1`.

- [ ] **Step 7: Typecheck and full suite**

Run: `npm run typecheck` then `npm test`
Expected: clean.

- [ ] **Step 8: Commit and push**

```bash
git add src/scroll/seed.ts src/scroll/seed.test.ts src/sections/ring/Dial.tsx src/scroll/timeline.ts
git diff --cached --stat
git commit -m "feat: the seed re-seats at g2|g3 - ovalese collapses and murals blooms"
git push
git ls-remote origin main
```

---

### Task 5: Docs — README and HANDOFF

The README is the design of record and HANDOFF is the current-state document (revise in place, never add a second). Numbers that Task 6 will re-measure are left explicitly marked, not guessed.

**Files:**
- Modify: `README.md` (edits listed below, by current line)
- Modify: `docs/superpowers/HANDOFF.md` (edits listed below)

- [ ] **Step 1: README edits**

1. Line 100 (ring geometry bullet) becomes:
   `- Ring geometry (desktop): outer guide circle 640px (Ovalese, Murals), 600px (Merch); dashed inner guide 460px; thumb orbit radius 326px (Ovalese, Murals) / 296px (Merch); centre slot 248 × 312px ovoid (Ovalese), 340 × 227px landscape plate (Murals), 250px square (Merch). **Artworks carries no ring geometry at all** — it is the field.`
2. Line 101 becomes: `- Thumb sizes: 98 × 124px ovoid (Ovalese), 150 × 100px landscape (Murals), 150px square (Merch).`
3. §05 (lines 154–159) becomes:

   ```markdown
   ### 05 · Gallery scene 03 — Murals (pinned ~220vh)
   The ring, landscape: six 150 × 100px wall crops orbit a 340 × 227px square-cornered centre plate — wide thumbs honouring wide walls. The seed choreography arrives here: Ovalese collapses to the seed across the g2|g3 gap and this ring blooms from it.

   No full-width photograph of these walls exists, so a wall is **never faked as a panorama** — every crop is taken from the widest angle available, and the context + detail pairing lives on the wall's detail page (§09), where it always did. The chapter bar (BGC · Layaw) left the scroll page with the track; `location` stays in the data and on the wall pages. Progress `02 / 07`.
   ```

4. Line 194: `**320vh / 220vh / 240vh / 260vh**` → `**320vh / 220vh / 220vh / 260vh**`.
5. Line 197 (`- Scene 03 (Murals) swaps rotation for an **x-translate track**.`) — delete the bullet.
6. Mechanics table (lines 309–318): row `| 03 Murals | \`track\` | Dossiers on an x-translate. |` → `| 03 Murals | \`dial\` | The ring again, landscape crops for wide walls. |`; row 02's `The one place the ring survives.` → `The Pollen Dial.`; and the paragraph below (316–318) becomes:
   `Three of the four are dials again — but not the same picture twice: the middle pair is differentiated by the seed choreography (Ovalese collapses to the seed; Murals blooms from it), and the Artworks field breaks the run at the top.`
7. Lines 320–328 (full-bleed rejection): keep, but change `the dossier is the response to that constraint, not a style choice` → `the dossier — now living on the wall's detail page — is the response to that constraint, not a style choice`.
8. The field section (lines 330–334) first paragraph becomes:
   `Pan arrives as --at, a fractional piece index published by fractionalIndexAt (scroll/timelineMath.ts).`
9. Grep README for remaining `track` hits; leave the mockup-copy table row (§291) — it documents what the static mockups say, and they still draw the track — and leave `trackProgress`/progress-bar senses. Fix anything else that states the x-translate as current.

- [ ] **Step 2: HANDOFF edits**

1. `Last revised **2026-08-04**.` → `Last revised **2026-08-06**.`
2. In **State**, add after the seed paragraph: `**Murals is a ring and the seed seam is g2|g3 as of 2026-08-06** — the track presentation is deleted (Track.tsx, Dossier.tsx, lib/track.ts), the field's scalar lives in timelineMath.ts as fractionalIndexAt, and the seed choreography reactivated the moment both seam neighbours resolved to dials. Spec: specs/2026-08-06-murals-ring-seed-reseat-design.md.`
3. §"The seed, and what it collides with": `**Only the \`g1 -> g2\` seam** — g3 is the Murals track, not a ring, so the two seams touching it keep the plain scroll-away. That was Marti's scope call, and the cost was stated when he made it: the effect happens once in the whole page.` → `**Only the \`g2 -> g3\` seam** — Ovalese collapses to the seed and Murals blooms from it (re-seated 2026-08-06; originally built at g1|g2 when both of those were rings). The seams touching the Artworks field keep the plain scroll-away — single-seam scope is still Marti's ruled call, and the effect still happens once in the whole page.`
4. Module map: delete the `src/sections/track/Track.tsx` and `src/sections/track/Dossier.tsx` rows; the `src/lib/track.ts` row becomes `| ~~src/lib/track.ts~~ | Deleted 2026-08-06 with the track; \`fractionalIndexAt\` (the field's scalar, formerly \`trackAt\`) lives in \`scroll/timelineMath.ts\`. |`; the `Dial.tsx` row's `(g1, g2, g4)` → `(g2, g3, g4)`; the `SnapList.tsx` row's `Category-generic — serves the track too.` → `Category-generic — serves every scene's fallback.`
5. §"Carried forward": in the *kept deliberately despite zero consumers* line, drop `\`RING_LOOK.murals\` is a type-required zero row, not an orphan.` — it now has real values and a real consumer.
6. §"Known-good measurements": do NOT rewrite the numbers here — prepend to the section: `**The 2026-08-06 murals-ring conversion shortened g3's pin (240vh → 220vh): every label offset past g3, the document height, the flock spans and the seed tables below are stale until re-measured. Task 6 of plans/2026-08-06-murals-ring-seed-reseat.md re-measures them; trust nothing below this line at g3 or later until it does.**` (Task 6 replaces the stale figures and removes this banner.)
7. Grep HANDOFF for `Murals track` / `the track` and fix any remaining current-tense statement (the *historical* defect entries — #4, #9 — stay as written; they describe what happened).

- [ ] **Step 3: Commit and push**

```bash
git add README.md docs/superpowers/HANDOFF.md
git diff --cached --stat
git commit -m "docs: readme and handoff catch up with the murals ring and the g2|g3 seam"
git push
git ls-remote origin main
```

---

### Task 6: Browser verification, fresh measurements, memory

Invariant 6: the browser is the test for everything visual. Every trap below has cost a cycle — follow HANDOFF §"How to verify UI work here" to the letter (active tab, `lenis.scrollTo` never `window.scrollTo`, measure the tick rate first, screenshots not computed styles).

**Files:**
- Modify: `docs/superpowers/HANDOFF.md` (replace stale measurements, remove the Task 5 banner, record the new seed table)
- Delete: the auto-memory file `seed-future-ovalese-murals.md` and its `MEMORY.md` index line (the intent it records is now fact in the repo)

- [ ] **Step 1: Start the dev server on a free port**

Sweep 5180–5195 for a free port (HANDOFF §Commands has the one-liner) unless Marti has asked for 5173 this session. Run `npm run dev -- --port <port> --strictPort` as a background task. Remember the server log doubles as the browser console.

- [ ] **Step 2: Establish the new geometry at 1440×900**

Resolve app modules the way HANDOFF prescribes (via `performance.getEntriesByType('resource')`, never a bare import). Read the label offsets and spans off the live page (`getLabelOffset` / `getLabelSpan` per label). Expect every offset from g3 onward to be smaller than the 2026-08-04 table (g3's pin shortened by 180px at 900vh viewport height); record the actual numbers, derive nothing.

- [ ] **Step 3: The five-moment table at the new seam**

At the measured g2 pin release, boundary, and g3 pin start (plus one pinned sample either side), record `--seam-pin`, `--seed`, both rings' opacity and centre-y, and the seed mark's centre-y. The claims that must hold, exactly as they held at the old seam:
- g2's ring reaches opacity 0 at its pin release, centre still at 52% of the viewport, co-located with the seed.
- The seed holds presence 1 across the plateau; its centre never moves.
- g3's ring is at opacity 0 (not yet opening) until its own pin starts, and opens from the seed's position.
- No re-bloom: g2 stays at opacity 0 at every sample past the boundary out to twice the half-width.

- [ ] **Step 4: Continuity and the murals dial itself**

- Sweep `--seam` across the band pixel-stepped; record the worst per-pixel step (the old seam's was 0.00325 — expect the same order).
- Screenshot the Murals dial mid-pin: 6 landscape thumbs upright + centre plate (a screenshot, not a transform readback — shapes only show in pixels). Press Tab through it.
- Click a thumb → the piece centres. Click a centre-slot → `/murals/<slug>` opens; going back restores scroll exactly.
- Confirm the seven-wall count in the progress row (`01 / 07` → `07 / 07` across the pin).

- [ ] **Step 5: The states where the seed must be absent**

- 390×844: `[data-seed]` absent; Murals renders the snap list with all 7 walls reachable.
- `prefers-reduced-motion`: seed absent, zero pin-spacers, Murals is a list, document collapses to its unpinned height.

- [ ] **Step 6: Update HANDOFF with the fresh numbers**

Replace the stale label-offset line, flock spans, document height, and the seed section's five-moment table with the measured values; delete the Murals `--at` measurement line (`--at` no longer exists); remove the Task 5 stale-measurements banner. Re-run `npm test` and `npm run build` and record the re-measured test count and bundle sizes (never quote the old ones).

- [ ] **Step 7: Retire the auto-memory**

Delete `C:\Users\Marti\.claude\projects\C--Users-Marti-Documents-Projects-DenisePortfolio\memory\seed-future-ovalese-murals.md` and its line in `MEMORY.md` in the same directory — the intent it recorded is now on `main`, and memory must not duplicate what the repo records.

- [ ] **Step 8: Commit and push**

```bash
git add docs/superpowers/HANDOFF.md
git diff --cached --stat
git commit -m "docs: handoff carries the measured g2|g3 seed choreography"
git push
git ls-remote origin main
```

---

## Self-review notes

- Spec coverage: §1 → Task 2 (+ Task 3 types), §2 → Task 2, §3 → Task 4, §4 → Tasks 1 and 3, §5 → Tasks 5 and 6, §6 → Tasks 1–4 (pure tests) and 6 (browser).
- Type consistency: `fractionalIndexAt(p, count)` is named identically in Tasks 1, 3, 5; `Presentation = 'dial' | 'field'` and `Rendered = 'dial' | 'list' | 'field'` appear only after Task 3.
- Ordering: Task 1 before 3 (the field's scalar must have a home before its module dies); Task 2 before 3 (the compiler forces completeness of the deletion only once nothing declares `'track'`); Task 4 after 2 (the gate needs both dials); 5–6 last.
