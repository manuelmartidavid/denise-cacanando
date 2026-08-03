# Task: the between-scene "collapse to a seed" transition

> ## Provenance
>
> Designed **2026-08-03** through brainstorming, after the motion upgrade closed. This is item 3 on
> the handoff's "What's next" list and the first item there that needed nothing from Denise to
> start.
>
> **Four things were decided by the user during design and are not open for re-litigation by an
> implementer.** They are marked **[DECIDED]** where they appear:
>
> 1. The seed is **a real object that persists** across the gap, not a collapse-and-bloom pair.
> 2. Scope is **ring-to-ring gaps only**, which is `g1 -> g2` and nothing else.
> 3. The seed's form is **the Dial's own guide circle, contracted** — not the centred artwork, and
>    not a new ochre mark.
> 4. The driver is **the flock's existing boundary maths**, not a dedicated trigger for the gap.
>
> Unlike every previous spec in this directory, **no code is prescribed below**. Four cycles have now
> found defects in their own spec's code blocks (handoff defects #1, #10, #11, #18), so this one
> describes behaviour, contracts and constraints and leaves the code to the plan.

## Context

README §179: *"Between scenes the ring **collapses to a seed** and the flock's MotionPath progress
owns the gap — the transition *is* the navigation."*

Half of that is already built. `src/three/flock.ts` gathers the butterfly flock into a dense cloud at
each seam between scenes, and the gating cycle made that curve continuous and tested. The ring's half
does not exist: today a gallery scene simply unpins and scrolls away.

**The MotionPath half of README §179 is void and must not be reinstated.** GSAP MotionPath was
deliberately rejected in the flock cycle — it would cost a plugin in the critical-path bundle and add
a second writer to the `frame` channel. That decision stands; only the "collapses to a seed" half of
§179 is being built here.

### The gap this lives in

A pinned scene's ScrollTrigger ends when the pin releases; the next scene's does not start until it
reaches the top of the viewport. Between them is real, empty scroll distance. **Recorded at
1440x900** — treat as illustrative, never embed (invariant 4):

```
g1 pin          1800 .... 4680
                          |<-- 900px gap -->|
g2 pin                              5580 .... 7560
seam midpoint                  5130
band (BAND 0.05)          4392 ......... 5868
```

`createScrubScene` publishes only while its scene is pinned, so **nothing currently publishes
anything across that gap.** That is the hole this fills.

## Goal

As the user scrolls from Artworks (`g1`) to Ovalese (`g2`), the ring contracts into a single small
mark that survives the whole gap, then opens back out into the next scene's ring — so the transition
reads as one continuous object rather than two independent scenes.

## Non-goals

- **The other boundaries.** `g2 -> g3` and `g3 -> g4` touch Murals, which is an x-translate track and
  not a ring. They keep today's plain scroll-away. **[DECIDED]**
- **`about -> g1` and `g4 -> contact`.** Out of scope.
- **Any change to the flock.** Its behaviour must be bit-identical after this work.
- **Any change to what a scene does while pinned.** Rotation, snapping, counters and thumb clicks are
  untouched.

> **A known consequence of the scope, recorded because it was raised and accepted during design:**
> the effect occurs exactly once in the page. It may read as an inconsistency rather than a motif.
> The mechanism below is deliberately built so that adding a boundary later is a matter of naming a
> different seam, not a rewrite — but the track would still need its own collapse treatment designed.

## Architecture

### The seed cannot live in a section

Every section clips to its own pane with `clip` (invariant 10), and during the gap both neighbouring
sections are mid-scroll. Anything section-owned is therefore clipped away exactly when the seed is
supposed to be visible. **The seed gets its own fixed layer**, in the same spirit as `GroundLayer`.

`Dial` places its ring centre at `left: 62% / top: 52%` of its section, and a pinned section's box is
the viewport — so a fixed layer at those same coordinates coincides with both rings' centres with
nothing to measure and no new constant.

**Stacking:** the layer sits at `z-[2]` — above the r3f canvas (`z-[1]`), below `main` (`z-10`). The
grounds are painted by `GroundLayer` at `z-0` and the sections themselves are transparent, so this
keeps the seed off the incoming scene's title while still letting the flock pass in front of it.
**This is a starting position, not a measurement — confirm it in a browser.**

### One signed scalar, on the channel that already exists

The whole-document ScrollTrigger already writes `--progress` to `documentElement` every frame, and
its own comment calls that the legal route for a per-frame value under invariants 1 and 2. The seam
is the same shape of thing and joins it:

```
--seam   -1 ... 0 ... +1
```

- `-1` at the band's entry edge, `0` **exactly** at the g1|g2 midpoint, `+1` at the exit edge.
- Saturated at `-1` before the band and `+1` after it, across the entire rest of the document
  including the other five seams.
- Defined as `sign(p - boundary) * (1 - gather)`, where `gather` is forced to `0` whenever the
  nearest seam is not g1|g2.

**It is deliberately not routed through `onSceneFrame`.** That channel is keyed per gallery label,
and the seed belongs to neither scene — it exists precisely when both have let go.

**Why signed.** `gather` is symmetric about the boundary. An unsigned magnitude would make the
*outgoing* ring bloom open again as it scrolls off the top, because nothing distinguishes "before the
seam" from "after" it. The sign lets each consumer derive its own value in pure CSS with no branching
and no second scalar:

| Consumer | Derivation | Behaviour |
| --- | --- | --- |
| `g1`, outgoing | `clamp(0, 1 + seam, 1)` | open at `-1`, a point at `0`, **stays** a point after |
| `g2`, incoming | `clamp(0, 1 - seam, 1)` | a point until `0`, open by `+1` |
| seed layer | `1 - abs(seam)`, shaped | present only inside the band |

`g4` is also a `Dial` and simply never receives the role, so it is unaffected.

### One targeted change to `flock.ts`

`flockAt` finds the nearest boundary with an inline scan and returns `gather` without saying which
seam produced it. The seed needs the index, to fire only on g1|g2.

**Extract the scan and the ramp as two allocation-free exports**, both used by `flockAt` and by the
seam:

```
nearestSeamIndex(spans, p)  -> number
gatherAt(spans, p, i)       -> number
```

**Neither may allocate.** `flockAt` runs every frame and its docstring is explicit that only a point
genuinely inside a band is permitted to allocate; a helper returning `{ index, gather }` would
allocate 60 times a second on the hot path. Two numbers avoid it entirely.

**This sharing is the entire point of the approach.** The g1|g2 boundary is then computed in exactly
one place, so the ring and the flock cannot drift apart. Two modules independently computing the same
geometry is this repo's most repeated defect — #20 (`Butterflies.tsx` and `flock.ts` disagreeing
about the same frustum, wrong in a docstring for several cycles) and the gating cycle's span fixture,
which was wrong in the safe direction and hid a real discontinuity.

`timeline.ts` may import `flock.ts`: the ban in invariant 2 is one-directional, and `timeline.ts`
already imports the pure `trackAt` from `~/lib/track`.

### What owns what

Two ambiguities worth closing before an implementer has to guess:

- **`SeedLayer` mounts in `ScrollPage`**, as a sibling of `GroundLayer` and `Stage`, which is where
  the page's other document-space and fixed layers already live. It is not a child of any section,
  and it is not inside `main`.
- **`Dial` gains one optional prop naming its role at the seam** — outgoing, incoming, or absent.
  Absent is the default and is what `g4` gets, so a Dial that is not part of a seam behaves exactly
  as it does today. The role selects which of the two derivations in the table above the component
  applies; it carries no other meaning and must not be reused as a general "is this scene special"
  flag. Which scenes are which is a property of the seam, so the roles are assigned where the seam is
  declared, not hardcoded inside `Dial`.

### Resulting flow

```
whole-document ScrollTrigger   (timeline.ts, refreshPriority -1)
    |
    +- nearestSeamIndex / gatherAt      <- flock.ts, pure, shared with the flock
        |
        +- --seam on <html>
            |
            +- SeedLayer   fixed, z-[2]      the contracted guide circle
            +- Dial (g1)                     orbit + guides contract
            +- Dial (g2)                     orbit + guides expand
```

**No new ScrollTrigger**, so invariant 9's load-bearing build order is untouched.

## Behaviour

As `collapse` runs 0 -> 1 for a participating Dial:

- Both guide circles and `--orbit` scale down together toward seed size.
- Thumbs shrink with the orbit and fade out.
- `CentreSlot` fades out.

The fixed layer's dashed circle fades **in** across the same window, reaching full opacity as the
Dial's own guide reaches the same diameter at the same screen coordinates — so the handoff from
section-owned to layer-owned is invisible rather than a swap the eye can catch. **[DECIDED]** that
the seed is this contracted guide circle: it reuses furniture already on screen, so the transition
reads as the scene's own geometry contracting rather than as a new element arriving, and it carries
no dependency on imagery that has not landed.

### The seed must hold, and `gather` alone will not hold it

`gather` is `1 - smoothstep(u)`. It touches 1 at the midpoint and immediately falls away, so a seed
driven by it directly would be fully present for a single instant — a flicker, not the persistence
that was chosen. **A shaping constant gives it a genuine plateau:** full presence once
`gather >= SEED_PLATEAU`, ramping below that.

This also keeps the *feel* independent of the flock. The band's extent is shared — that is the point
— but the seed's shaping is its own, so the transition can be made snappier or lazier without
touching `BAND` and moving the butterflies.

## Gating

Three gates. Each would otherwise ship as a bug:

1. **Reduced motion.** The document collapses to 6300 with zero pin-spacers, so there is no gap to
   cross and no ring to contract. The seed never mounts.
2. **`resolvePresentation` can render a scene as a `list`** below 939px, where there is no ring at
   all. The seed must be gated on **both** g1 and g2 resolving to `dial` — not either one.
3. **The layer is decoration.** `aria-hidden`, `pointer-events-none`. Never a tab stop, and it must
   never intercept a thumb click.

`--seam` is written unconditionally — it is one more property on an element already written every
frame — and the **consumers** are what is gated. This keeps presentation conditionals out of
`timeline.ts`.

## Testing

Invariant 6 splits this cleanly, and the split is not negotiable: vitest is `environment: 'node'` with
`include: ['src/**/*.test.ts']`, every test is a pure-function test by design, and **no jsdom or
component tests may be added.**

### Pure, in `flock.test.ts`

- `--seam` is `0` at the midpoint and `±1` at both band edges.
- The sign flips exactly at the boundary and nowhere else.
- It saturates at `±1` across the rest of the document, including all five other seams.
- It is continuous under a sweep stepped as `k / STEPS`. **Not** an accumulating `p += 1e-4` loop:
  the gating cycle established that an accumulating loop drifts just short of `1.0` and never
  exercises the endpoint, which is the single sample that catches an endpoint discontinuity.
- A degenerate zero-width band steps rather than returning `NaN`.
- **`flockAt` is unchanged.** The existing 25 tests must pass untouched — the extraction is a
  refactor, and any change in flock behaviour is a defect, not an improvement.

### In a browser

- Sweep the band pixel by pixel and assert no step in `--seam`, the same probe that caught the 0.120
  jump on the document's final pixel.
- Screenshot at band entry, midpoint and exit.
- **Explicitly confirm `g1` does not re-bloom** on the falling side. This is the specific failure the
  signed scalar exists to prevent, so it must be observed rather than assumed.
- Confirm the seed sits exactly on both rings' centres.
- Check a short viewport and 1280x800 as well as 1440x900.
- Confirm reduced motion mounts no seed, and that a 390px width mounts no seed.

Screenshots are required, not optional: four defects in this repo (#3, #8, #12, #16) were invisible to
every measurement taken and catchable only by looking.

## Risks and open questions

1. **The ring contracts while still pinned and still rotating.** At 1440x900 the band opens ~288px
   before g1's pin releases, so the last stretch of scrub both turns and shrinks the ring — and the
   idle snap can still pull the user to a stop mid-contraction. This may well read better than a hard
   handoff, but it is a real interaction and must be looked at rather than assumed.
2. **The proportions are viewport-dependent.** `BAND` is 5% of the document: 738px against a 900px
   gap at 1440x900, but 656px against 800px at 1280x800. Nothing breaks, because everything is
   measured — but the transition is slightly tighter on shorter viewports and that is a look
   question.
3. **`z-[2]` is a starting position.** It is reasoned, not measured.
4. **`SEED_PLATEAU`'s value is unknown.** Its existence is settled; the number is a look decision to
   be tuned in a browser, and it is the one constant most likely to need Denise's eye.

### A naming tension, recorded rather than acted on

`flock.ts` will own seam geometry that is not really about butterflies. Its name is historical — it
already owns `spansFrom`, `boundaryAt`, `halfWidthAt`, `ATTRACTORS` and `HOLD`, which is boundary
geometry generally. The alternative, exporting `boundaryAt` and `halfWidthAt` to a sibling module,
widens its API for worse isolation. **Keep the maths where it is; revisit only if a third consumer
appears.** Compare defect #24, where naming a module after its component rather than its effect
produced a case-insensitive filesystem collision.
