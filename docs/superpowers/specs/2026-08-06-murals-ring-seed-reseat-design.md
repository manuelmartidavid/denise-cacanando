# Murals becomes a ring; the seed re-seats at g2|g3

**Date:** 2026-08-06 · **Ruled by:** Marti · **Status:** approved design, pre-implementation

## Why

The collapse-to-seed transition was built for the g1|g2 seam when both sides were rings. g1
(Artworks) has since become the floating field, and `ScrollPage`'s gate — both seam neighbours must
resolve to `'dial'` — has kept the seed dormant ever since. Rather than retire the choreography,
Murals (g3) converts from the x-translate track to a ring, and the seam re-seats at g2|g3: Ovalese
collapses to the seed, and the seed blooms into Murals.

Three decisions were ruled by Marti during brainstorming:

1. **The track code is deleted**, not kept dormant. Nothing would declare `'track'` afterwards.
2. **The Murals ring gets landscape geometry** — square-cornered wide thumbs and a wide centre
   plate — honouring the walls' aspect, at Ovalese-scale circles.
3. **Declaration-first structure**: flip the declarations the machinery already reads; no seam
   generalisation (single-seam scope remains the ruled call), no deferred deletion.

## 1. Scene declaration — `src/scroll/scenes.ts`

The g3 row becomes:

```ts
{ label: 'g3', category: 'murals', presentation: 'dial', seats: 6, length: 220, ground: 'dark', guide: 640, dash: 460, orbit: 326 }
```

- `length` 240 → **220**. Pin length is proportional to piece count (README timeline spec); Murals
  has 7 pieces, exactly Ovalese's count, and Ovalese is 220. The document shortens by 20vh — label
  offsets past g3 shift, and every measured baseline that quotes them must be re-measured, not
  patched arithmetically.
- The `Presentation` union loses `'track'`.
- The row comment ("Only Ovalese and Merchandise are still dials…") is rewritten: three of four
  scenes are dials again; the seed choreography is what differentiates the middle pair, and the
  Artworks field breaks the repetition at the top of the gallery run.

## 2. Ring look — `src/sections/ring/look.ts`

```ts
murals: { slot: 'square', slotW: 340, slotH: 227, thumbW: 150, thumbH: 100 },
```

Landscape, tunable in a browser like every look value — these are Marti's numbers to move. Only
`artworks` remains a zeroed row (field scene, unused); the comment shrinks to say exactly that.

`ringClipRadius` already takes thumb width and height independently, so wide corners are covered by
existing geometry. Add one test row in `ring.test.ts` exercising the murals dims (guide 640, orbit
326, thumb 150×100) so the clip radius over a landscape thumb corner is pinned by a test —
the clip-radius defect (#29) was exactly a corner-vs-edge mistake, and the new shape is the first
non-portrait, non-square thumb through that function.

## 3. Seed re-seat — `src/scroll/seed.ts`

```ts
export const SEED_SEAM = { out: 'g2', in: 'g3' } as const
```

Nearly the whole change; everything downstream is keyed off the declaration:

- `SEED_SEAM_INDEX` derives (`LABELS.indexOf('g2')` = 3). Never hardcoded (invariant 4).
- `seamRole` assigns g2 `'out'`, g3 `'in'`; `Dial` already threads the prop via `GalleryScene`.
- `ScrollPage`'s `seeded` gate reactivates by itself: on desktop non-reduced both g2 and g3 resolve
  to `'dial'`, which is the exact condition it tests. Below 939px or under reduced motion both
  resolve to `'list'` and the seed stays absent, as before.
- `seamAt`, `seamPinnedAt`, `seedPresence`, `--seam`, `--seam-pin`, `--seed`: index-generic, no
  math changes. The absent-until-measured rule, the per-role CSS fallbacks, and `killTimeline`'s
  remove-not-default behaviour all carry unchanged.
- Docstrings rewritten: the seam narrative ("g3 is the Murals track, not a ring") inverts — the
  seam is Ovalese → Murals, and the seams touching the field (g1) keep the plain scroll-away.

**Interactions checked:**

- **Flock collision**: `RADIUS_TIGHT` 4.5 and `shadow-glow-seed` are global — they hold at the new
  seam unchanged. `gather` is 1 at every boundary by construction, so the densest cloud sits on the
  seed at g2|g3 exactly as it did at g1|g2; the ruling that fixed it there fixes it here.
- **Parallax**: g2|g3 is dark|dark, and the lift is gated on ink|cream flips — the two systems do
  not interact at this seam. Correct, not a gap.
- **Known residual, carried not fixed**: the collapsed outgoing ring (now g2) stays tabbable for
  the stretch where the label still reads its own scene but `--seam-pin` has already collapsed it.
  Documented in `Dial.tsx`; closing it still needs its own signal and remains a follow-up.

## 4. Track deletion

- Delete `src/sections/track/` (Track.tsx, Dossier.tsx). `GalleryScene` drops the import and the
  `rendered === 'track'` branch.
- `src/lib/track.ts`: **`trackAt` survives** — the Artworks field publishes its per-frame scalar
  through it. It moves to `src/scroll/timelineMath.ts` (the pure scroll-mapping module) renamed
  **`fractionalIndexAt`**, because "track" will name nothing. Its tests move to
  `timelineMath.test.ts`; the remainder of `lib/track.ts` and `track.test.ts` are deleted.
- `src/scroll/presentation.ts`: `Rendered` loses `'track'`; `resolvePresentation` drops the branch;
  the fallback docstring about the chapter bar and dossier annotation goes.
- `src/scroll/timeline.ts`: imports `fractionalIndexAt` from `./timelineMath`; the comment about
  the field reusing the track's mapping is rewritten — the field is now the function's only
  consumer.
- The chapter bar and dossier annotations leave the scroll page. Mural location data in `src/data`
  is untouched (detail pages do not consume `CHAPTER_LABELS`; Dossier was its only consumer,
  verified by grep). `SnapList` is category-generic, so the compact/reduced fallback for Murals
  renders identically to today.
- `RING_LOOK.murals` stops being a type-required zero row and carries real values; the "track
  scene, unused" comment goes with it.

## 5. Docs and memory

- `HANDOFF.md` revised in place: the seam scope statement ("only the g1→g2 seam"), the module map
  rows for the track files, the seed-section narrative, and every known-good measurement that
  shifts when g3's pin shortens (label offsets, document height, flock spans, `--at` references).
- README (design of record): the murals-track prose updates to describe the ring.
- The `seed-future-ovalese-murals` memory is rewritten once this ships — the intent it records
  becomes fact.

## 6. Testing and verification

**Pure tests** (vitest, node environment — invariant 6, no DOM):

- `seed.test.ts`: the adjacency/role tests are written against the declaration and pass unchanged.
  The `SPANS` fixture stays valid as historical 1440×900 geometry for the index-generic math tests;
  its comment is updated to say the live seam has moved and the fixture is historical.
- `ring.test.ts`: one new row for the murals landscape clip radius (§2).
- `timelineMath.test.ts`: receives `fractionalIndexAt`'s tests.
- `track.test.ts`: deleted with its module.

**Browser verification** at 1440×900 (the browser is the test for anything visual):

- Re-measure the five-moment table at the new seam: g2 pinned → g2 pin release (`--seam-pin` 0,
  ring at opacity 0, still centred at 52%) → boundary (seed at 1) → g3 pin start → g3 pinned.
  Both rings must reach and leave opacity 0 while still co-located with the seed; the seed's
  centre must not move.
- Sweep `--seam` continuity across the band; confirm no re-bloom of g2 past the boundary.
- Confirm `[data-seed]` absent at 390×844 and under `prefers-reduced-motion`; the Murals fallback
  list shows all 7 walls.
- Re-measure label offsets and document height (g3's pin shortened); confirm ground blocks still
  tile end to end and the flock spans re-register.
- Murals dial spot-checks: 6 orbit seats + centre, landscape thumbs upright through rotation
  (screenshot, not computed style), thumb click centres the piece, snap list unaffected.

## Out of scope

- Any second seam or seam generalisation (ruled: single seam).
- The centre-slot ripple shader (waits on imagery).
- Closing the residual tabbable window on the collapsed outgoing ring.
- Detail-page media changes.
