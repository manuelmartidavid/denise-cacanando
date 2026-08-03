# Ovalese — Project Handoff

**Read this first.** It is the single current-state document for the site. **Revise it in place;
never add a second one.** The filename is deliberately undated — the four dated handoffs that came
before it each invited a successor, and a stale sibling is worse than no document at all. Supersedes
`2026-07-31-ovalese-handoff.md`, which is deleted, not archived. Its history is in git.

Last revised **2026-08-03**. **The motion upgrade is complete** — all seven phases built, phase 7
verified in a browser and phase 4 ruled on by Denise. One question of hers is still open.

---

## State

**You are not on `main`, and there are now TWO unmerged branches.**

- **`motion-upgrade`** — fourteen commits ahead of `origin/main`, pushed, tracking. **The cycle it is
  named for is finished**, so merging it is a live question rather than a premature one — item 0.
- **`feat/collapse-to-seed`** — cut from `motion-upgrade` at `18412fd`, and where you probably are.
  Seven implementation tasks plus spec and plan. **It depends on `motion-upgrade` being merged
  first**, or it carries that work with it. It is a fast-forward on top.

Nothing has been merged to `main`, which still carries the pre-upgrade flock.

Verified by `git ls-remote`, whose `refs/heads/motion-upgrade` matched local `HEAD` exactly, rather
than by trusting that the push reported success — the same standard the remote's own setup was held
to. `main` is untouched and still carries the pre-upgrade flock; **nothing has been merged**. It is
no longer mid-cycle, so the reason not to merge has gone — but it is still Denise's call, not one to
take on her behalf.

GitHub offered a PR at
`https://github.com/manuelmartidavid/denise-cacanando/pull/new/motion-upgrade`. None was opened.

```
<this>   phase 4: her radius and her count         <- HEAD
f8eccea  handoff revision for the comparison       = verified on origin
c9ac96a  handoff revision for phase 7
32919b8  handoff revision
7b97306  handoff revision for the gating cycle
b5c670b  flock gating: spans, not points
1f84fe6  handoff revision
077dd08  handoff revision
a407340  ember and bone wings, painted petal
3481afa  Instagram handle fix (unrelated, hers)
ef33840  petals rewrite            (phase 6)
d56338c  fold shading              (phase 5)
e71ffb3  orientation + wingbeat    (phases 2, 3)
1814812  silhouette + body         (phase 1)
```

**This block is written one commit behind itself and always will be** — a revision cannot name its
own hash. `f8eccea` is the last hash confirmed on the remote by `ls-remote`; the revision above it is
this one, pushed immediately after it was made. If you find `<this>` still unpushed, that is the
thing to fix before anything else.

**"Push as you go" was broken for most of this cycle** — seven commits accumulated locally before the
branch was pushed at the end of the session, which is exactly the single-copy risk four earlier
handoffs opened with. It held only because nothing went wrong. Push per commit, not per session.

Working tree is **clean of tracked changes**. `git rev-list --count HEAD` answered 96 when that was
written and **101 one commit before this revision** — which is exactly why no count is recorded here
as a fact. Run the command; do not quote either number. See defect #19.

**One trap cost a commit this session and will cost the next one too.** `git rm` **stages** its
deletions immediately. A later bare `git commit` — even one preceded by `git add <one-unrelated-file>`
— sweeps them in. Five texture deletions landed inside the Instagram-handle commit that way. It was
caught by reading `git show --stat` afterwards and unwound with `git reset --soft HEAD~1` while still
local. **Run `git diff --cached --stat` before every commit here, not `git status`** — status shows
what changed, the cached diff shows what you are about to record.

Three earlier cycles are on `main`, all fast-forward: the butterfly flock, the canvas-visibility
fixes, and the mobile layer. `feat/butterfly-flock` and `feat/mobile-responsive` are both deleted.

**There is a git remote now, and `main` is pushed.**
`origin` → `https://github.com/manuelmartidavid/denise-cacanando.git`, **private**. `main` tracks
`origin/main`; verified by `git ls-remote`, whose `refs/heads/main` matched local `HEAD` exactly
rather than by trusting that the push reported success. The four handoffs before this one all opened
with a warning that this machine held the only copy. It no longer does.

**Push as you go.** The risk that warning described comes back the moment local runs ahead of the
remote — it is now a habit to keep, not a task to do.

A plain `git push` is pre-authorised in `.claude/settings.local.json`; force-pushes, `--mirror` and
`--delete` are denied there. **Two traps, both established by testing rather than by reading the
syntax:**

- **A `Bash(...)` rule does not govern the `PowerShell` tool, and git here runs through PowerShell.**
  The same `echo` command was denied under `Bash(...)` and ran unimpeded under PowerShell with only
  the `Bash` rule present. Every rule is written twice, once per tool prefix. A rule that appears to
  do nothing is almost always this.
- **The allow entries are exact matches, deliberately, so they cover bare `git push` and not
  `git push 2>&1 | ...`.** A prefix rule would also authorise `git push origin main --force`, which
  no deny rule catches — the flag lands after the refspec, and `git push origin +main` forces with no
  flag at all. **Blocklisting force-pushes over a free-form command string does not work**; the
  narrow allow list is what actually holds, and the deny entries are only belt-and-braces.

An `auto`-mode session may also approve a push the rules never matched — the classifier reads intent.
**Do not take a successful command as proof that a rule fired.** Probe with a deny on something inert
and confirm it blocks.

**Verification, re-measured on the phase-4 commit, not copied from a report:** `npm run typecheck`
clean · `npm test` → **9 test files / 143 tests passing** · `npm run build` succeeds · critical-path
bundle **404.87 kB**, CSS **35.76 kB**, three.js split into a lazy **900.90 kB** chunk, plus
**141.88 kB** of texture across three PNGs (ember 48.08, bone 43.07, petal 50.73). Console clean apart
from a dev-only `favicon.ico` 404 (there is no `public/favicon.ico`) and three.js's `Clock`
deprecation notice from the r3f stage.

**The figures this replaces were `a407340`'s** — 131 tests, 404.76 / 35.74 / 899.92 — and had been
carried unmeasured across the gating cycle, which is exactly defect #19's failure mode. The 12 new
tests are all in `flock.test.ts`; the three chunk's +0.98 kB is the gating rewrite, **not** phase 4,
which only changed two integers and some prose. Against the pre-upgrade baseline (404.75 / 35.47 /
886.87, no textures) **the three chunk is still the only figure that moved materially**, because
`Stage` is lazy-loaded and everything this cycle added landed behind that split.

**Untracked and deliberately kept:** `.claude/`, `.playwright-mcp/`, and `mob-hero-before.jpeg` /
`mob-about-before.jpeg` — the before-shots the mobile spec's defect table was written from. Worth
keeping until Denise signs off the mobile layer. **None of them are gitignored**, so a `git add .`
sweeps all four in. Add them if that ever becomes annoying; until then they are visible on purpose.

**Also untracked, and duplicates:** `prompts/motion-upgrade-prompt.md` and
`docs/motion-upgrade-prompt.md` are two copies of the same loose prompt, which was already committed
in corrected form as `specs/2026-08-03-motion-upgrade-design.md`. **Read the spec, not either copy** —
the copies are the uncorrected original. Left in place rather than deleted because they are Denise's.

`.claude/settings.local.json` **is** gitignored (`.gitignore:17`) — it is per-machine and not shared.
The existing `*.local` pattern does not cover it: that matches names *ending* in `.local`, and this
one ends in `.json`. A committed `.claude/settings.json` remains possible and is not affected.

---

## What this is

Denise Cacanando's artist portfolio: a single scroll page (Hero → About → four gallery scenes →
Contact) plus one routed detail page per piece. Vite 8 · React 19 · GSAP ScrollTrigger · Lenis ·
Tailwind 4 · react-three-fiber. No CMS — one typed data module per category.

**Design of record:** `README.md` (tokens, per-screen specs, interaction rules) and the static
mockups in `Ovalese Site - Pollen Dial.dc.html`. The mockups draw *frames* of a scroll experience;
the real thing is driven by the timeline. **Do not port their markup.**

**Specs and plans:** `docs/superpowers/specs/` and `docs/superpowers/plans/` — four cycles, all
complete. Their checkboxes were never ticked, so the plan files still *read* as unstarted. They are
not. Treat their prescribed code as a draft, not as truth: see "Defects caught in prescribed code".

**One spec is mid-cycle:** `specs/2026-08-03-motion-upgrade-design.md` — five of its seven phases are
built and committed on `motion-upgrade`. It has no plan beside it. It arrived as a loose untracked
prompt and was committed with its defects corrected in place and marked. Read its provenance block
before its body, and see "The motion upgrade, mid-flight" for what its numbers turned out to be worth.

## Commands

```
npm run dev        # Vite on :5173 — SEE BELOW
npm test           # vitest run — 131 tests
npm run typecheck  # tsc -b --noEmit
npm run build      # tsc -b && vite build
```

**5173 is Denise's, and this cycle she asked for it explicitly** — "updates should all run in 5173".
That reverses the standing instruction below. Start there, and use `--strictPort` so a busy port fails
loudly instead of silently landing you on 5174 while she reloads 5173 and sees nothing change:

```
npm run dev -- --port 5173 --strictPort
```

**`npm run dev` spawns Vite as a child process, so killing the shell orphans the server.** Two
orphaned Vite processes were holding 5173 and 5174 this session, which is why the restart drifted.
Kill by port, having first confirmed what you are killing:

```
Get-NetTCPConnection -LocalPort 5173 -State Listen | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" | Select-Object ProcessId, CommandLine }
```

**Restart, don't HMR, after renaming or deleting a module.** Vite's module graph caches resolutions:
after `petals.ts` was renamed the running server kept serving a stale `/src/three/Petals.ts` and threw
`does not provide an export named 'Petals'` against a file that no longer existed.
`rm -rf node_modules/.vite` and restart.

The old advice — leave 5173 alone, sweep 5180..5195 for a free port — still applies **when she has not
asked for 5173**. Console errors once seen on 5173/5175 (`orbitSeats is not defined`, `lazy is not
defined`) were stale HMR state in a long-lived server, not defects in this tree.

```
5180..5195 | ForEach-Object { "$_ : $(if (Test-NetConnection localhost -Port $_ -InformationLevel Quiet -WarningAction SilentlyContinue) {'IN USE'} else {'free'})" }
```

`vite.config.ts` allows `.ngrok-free.dev` hosts so the site can be opened on a real phone through a
tunnel. `allowedHosts` matches the **Host header** — a bare hostname, never a URL with a scheme — and
the leading dot covers the rotating subdomain a free tunnel hands out.

---

## What's next

Ordered. Nothing here carries the risk the remote did. Items 1 and 2 are waiting on Denise and on
imagery respectively, so **the first two you can actually start alone are 3 and 4** — and 4 is the
largest and highest-value piece of visual work currently specced.

0. **Decide what happens to `motion-upgrade`.** New, and top of the list because it did not exist
   before: the branch has finished the cycle it was opened for, `main` still carries the pre-upgrade
   flock, and fourteen commits are sitting on a branch nobody has reviewed. It is a fast-forward.
   **Ask Denise whether to merge**, and do not merge on the strength of the tests passing — the whole
   point of this cycle is that the tests cannot see what the canvas looks like.
1. **Two provisional mobile decisions await Denise's ruling.** Both shipped and both flagged in code:
   - **The detail-page mobile layout is derived, not specced.** The mockup has no mobile detail
     frame and README §159 covers desktop only. One column, 24px gutters, image well above the
     metadata, 34px title — inferred from the four mocked phone screens.
   - **The merch chip wrap**, where the wrapped second row crosses the first card by ~27px. No mocked
     frame shows a wrapped row.
2. **The r3f ripple/displacement shader on the centre slot.** The seam is built and documented in
   `CentreSlot.tsx` as a single `swapTo(piece)` function — but it would ripple placeholder stripes
   until real imagery lands.
3. **~~Between-scene "collapse to a seed" transition.~~ BUILT on `feat/collapse-to-seed`**, for the
   `g1 -> g2` seam only. Spec, plan and seven tasks, all reviewed. **One look decision is open and it
   is Denise's** — see "The seed, and what it collides with".
4. **~~Finish the motion upgrade.~~ ALL SEVEN PHASES ARE BUILT.** Phase 7 closed with no code change
   ("Phase 7, as verified"); phase 4 closed on Denise's ruling of `RADIUS_WIDE = 16` with
   `FULL_FLOCK = 28` ("The comparison as shot"). **One question is still open, and it is hers:**

   - **Open question — stroke asymmetry direction.** Measured at **63% falling / 37% rising**, so the
     *rising* half is the quick one. The spec's parenthetical asks for "downstroke faster than
     upstroke", the opposite. The formula was left as the spec wrote it because the fold axis does
     not firmly commit to which direction is "down". One character flips it:
     `sin(p - 0.45 * sin(p))`. Denise has not ruled.
5. **Detail-page media:** zoomable artwork, orbitable ovoid, mural crop strip.

**Blocked on Denise, not on us:** all imagery, her copy (every slot is tagged `COPY SLOT` in the
mockups), and most detail-page media. `<Placeholder>` is scaffolding to **delete** when real files
land — it is not a loading state.

**Hers to set, not yours.** Treat any value you find in these as deliberate — several were changed by
hand mid-session, sometimes between one message and the next:

| Constant | Where | Now |
| --- | --- | --- |
| `FULL_FLOCK` | `Stage.tsx` | **28** — chosen off the phase-4 sheet (was 10, was 30, was 1200) |
| `FULL_PETALS` | `Stage.tsx` | **60** (rewrite shipped 130; the points field carried 500) |
| `BONE_SHARE` | `Butterflies.tsx` | **2/5** — 6 ember to 4 bone |
| petal scales | `Petals.tsx`, `aSpin[i*4+3]` | near **0.4–1.0**, far **0.1–0.7** (shipped 1.3–1.9 / 0.55–1.15) |
| `TINTS` | `Petals.tsx` | her five warm tints, replaced once already |
| `RADIUS_WIDE` | `Butterflies.tsx` | **16 — hers, off the sheet, no longer provisional** |

**The far petal band bottoming out at 0.1 is worth one sentence with her.** That is a petal about
0.06 world units across, where the dots this system replaced were 0.035 — the smallest petals in the
field are within touching distance of being dots again, which is the specific thing the rewrite
existed to fix. She may well want that as haze behind a few readable foreground petals; she has not
been asked. Raising only the far floor fixes it without touching count or foreground.

---

## Module map

| Module | Role |
| --- | --- |
| `src/data/*.ts` | One module per category. Counts confirmed 24 / 7 / 7 / 12; titles and dates are placeholders. |
| `src/lib/ring.ts` | Pure ring geometry. Seats + centre slot, `orbitSeats`, index/progress mapping. |
| `src/lib/track.ts` | Pure Murals track geometry — pitch, fractional wall index, bend contract, chapters. |
| `src/lib/snapList.ts` | Pure nearest-item search + centring gutter for the fallback list. |
| `src/scroll/scenes.ts` | Per-scene declarations + `LABELS`. Pure `piecesFor(scene, filter)` + live-reading `activePieces`. Owns `stopIndexFor`, shared by rail and ticker so their active stop cannot disagree. |
| `src/scroll/presentation.ts` | `resolvePresentation(declared, reduced, compact)` → what actually renders. |
| `src/scroll/timelineMath.ts` | Pure pin-length, scroll-mapping, snap-threshold helpers. |
| `src/scroll/timeline.ts` | **Sole owner of GSAP.** `createScrubScene` builds every pinned scene. Holds the label registry. **Build order is load-bearing — invariant 9.** |
| `src/scroll/store.ts` | Two channels: discrete `state` (publishes to React) and per-frame `frame` (never does). |
| `src/routes/ScrollPage.tsx` | The scroll page. Owns scroll save/restore. Mounts `GroundLayer` → `Stage` → `main`. |
| `src/routes/DetailPage.tsx` | One routed leaf per piece. Mobile treatment is **derived, not specced**. |
| `src/sections/GroundLayer.tsx` | Paints each section's ground in document space, behind the canvas. Measures pin-spacers; subscribes to `onTimelineRefresh`. |
| `src/sections/Hero.tsx` | 01. The one section that is `overflow-hidden`, not `clip` — invariant 10. |
| `src/sections/About.tsx` | 02. Four layout tiers; `display: contents` reordering — see below. |
| `src/sections/GalleryScene.tsx` | 03–06. One component, four configurations. Shared furniture; only the middle changes. |
| `src/sections/Contact.tsx` | 07. |
| `src/sections/ring/Dial.tsx` | Pinned rotating presentation (g1, g2, g4). |
| `src/sections/ring/SnapList.tsx` | Pin-free fallback. Category-generic — serves the track too. Its top is `50%` and it knows nothing about the title block's height. |
| `src/sections/ring/CentreSlot.tsx` | Focused piece + cross-fade. **The documented ripple seam.** |
| `src/sections/track/Track.tsx` | Murals row: track, chapter bar, annotation. |
| `src/sections/track/Dossier.tsx` | One wall: context plate + metadata + two detail crops. |
| `src/components/SideRail.tsx` | Desktop nav, `hidden … sm:block`. |
| `src/components/BottomTicker.tsx` | Mobile nav, `sm:hidden`. Same four stops. Progress line reads `--progress`, written every frame by the whole-document trigger — how a per-frame value legally reaches the DOM (invariants 1, 2). |
| `src/three/Stage.tsx` | r3f canvas at **`z-[1]`** — above the grounds, below `main`. Memoised and lazy-loaded. Owns `FULL_FLOCK` / `FULL_PETALS`. |
| `src/three/Petals.tsx` | Instanced petals, **positions closed-form in `uTime`** — no per-frame CPU loop, two uniform writes a frame at any count. Square quad, painted map, normal alpha. Owns `SLIDE_X`, `MARGIN_*`, `NEAR`, `FRIEZE_TIME`. Replaced `Pollen.tsx`, which is deleted. |
| `src/three/flutter.ts` | **Pure.** Wind, gust, sway, the fall coupled to it, and `wrap`. Named for the effect, not the component — `petals.ts` beside `Petals.tsx` differs only in casing and resolves to one path on Windows and default macOS. |
| `src/three/flutter.test.ts` | 22 pure tests. Differentiates every closed form against the velocity it integrates. |
| `src/three/flock.ts` | **Pure.** `flockAt`, `spansFrom`, `ATTRACTORS`, `HOLD`, `BAND`, `clamp01`. No three.js, no React, no `timeline` import. |
| `src/three/flock.test.ts` | 25 pure tests, node environment. Its `BOUNDS` fixture is **read out of the live page**, not derived — see the gating-cycle notes. |
| `src/three/Butterflies.tsx` | One `instancedMesh` — two textured wings plus a body, merged into **one indexed geometry, one draw call**. Custom shader; count comes from `Stage.tsx`, never restate it here. Owns `activeSpans()` and the tuning table. |
| `textures/butterflies/`, `textures/petals/` | Ember + bone wing maps and the petal map, each as a master and a `-256` runtime downscale. **Only the `-256` files are imported.** RGB, no alpha — see the strip note in `a407340`. |

---

## Invariants — do not break these

1. **The scrub value never enters React state; `activeIndex` never enters the frame loop.** Each
   frame reaches the DOM as one scalar via `onSceneFrame`, whose meaning belongs to the presentation:
   degrees written to `--r` by a dial, fractional wall index to `--at` by the track. `activeIndex`
   publishes only when the rounded index changes — never 60/s.
2. **GSAP lives only in `src/scroll/timeline.ts`** (and `useLenis.ts`). No component imports `gsap`
   or `ScrollTrigger` — `GroundLayer` goes through `onTimelineRefresh` for exactly this reason.
   **This is why `flock.ts` may not import `timeline.ts` even transitively.**
3. **The snap goes through Lenis, never `ScrollTrigger.snap`.** Two writers of scroll position fight
   and produce jitter that is miserable to reproduce.
4. **Counts are never hardcoded in a view** — read via `activeCount(scene)` / `activePieces(scene)`.
   Likewise label spans and ground ranges: `spansFrom` and `GroundLayer` both measure, never
   embed the known-good baseline.
5. **The ring is N orbit seats + one centre slot.** Orbit length is `orbitSeats(seats, count)` =
   `min(seats, count - 1)`; both the seat spacing and the rotation must read it.
6. **Vitest is `environment: 'node'`, `include: ['src/**/*.test.ts']`.** No DOM. Every test is a
   pure-function test *by design* — presentations are verified in a browser instead. **Do not add
   jsdom or component tests.**
7. **Design tokens live in `src/styles/index.css` under `@theme`** — except scene geometry, which
   lives in `scenes.ts`, `look.ts`, `lib/track.ts` and `three/flock.ts` because the timeline and the
   motion rule compute with it. Hairlines are 1px. Mono labels are always uppercase and
   letter-spaced — put `uppercase` **on the element itself**, since a `<button>` does not inherit
   `text-transform`. Nothing drops below 8.5px (README §156). Every piece renders `<Placeholder>`.
8. **`THREE.Color` cannot parse `oklch`.** The stage converts tokens to hex by hand and names the
   token in a comment. `--color-ochre-bright` `oklch(0.8 0.09 62)` = `#e8b181`; `--color-sage`
   `oklch(0.68 0.11 150)` = `#63ab74`. **Two canvas-only tokens are authored as hex for this reason
   and are not `oklch` at all** — `--color-bark` `#4a3524` (butterfly bodies) and `--color-ochre-glow`
   `#b8873f`, which only *names* the value the glow rules always wrote literally as
   `rgba(184,135,63,…)`. **`--color-sage` is now unreferenced by any code**: the flock was its only
   consumer and its wings are textured. It is kept because README §119 still specifies sage diamonds
   crossing the cream in About, which is unbuilt; the README's token table says so explicitly.
9. **`buildTimeline` builds in page order, top to bottom, and the whole-document trigger is last
   with `refreshPriority: -1`.** ScrollTrigger refreshes in creation order and applies pin spacing as
   it goes; anything created ahead of the pinned scenes measures a 6300px document. Adding a section
   means inserting it at its page position.
10. **Every section clips to its own pane, with `clip` and not `hidden` — except Hero.** `hidden`
    would make the section a scroll container and desync the Murals track. **`Hero` is
    `overflow-hidden` and always has been**; earlier handoffs said "every section", which described
    code that does not exist. The exception is harmless — but do not "fix" it in passing.
11. **The ground layer's blocks must tile the document end to end.** Each block spans one section's
    scroll range, taken from its pin-spacer where it has one. A gap shows as a strip of bare `body`.
12. **Mobile is the base style; desktop is reached through `sm:` → `lg:` → `xl:`; layout tiers are
    CSS, never JS.** Four tiers — see the table below. `useCompactLayout`'s 939px `matchMedia` flag
    feeds `resolvePresentation` **only**; reading it for layout would put a timeline teardown
    (`killTimeline` unpins four sections and rebuilds every trigger) behind a phone rotation.
    **A rigid track (`440px`) in a variant anchored at `sm` is the bug that cost most of one cycle**
    — it cannot shrink, so it overflows every width down to the breakpoint. Pin fixed geometry to the
    tier that actually has room for it.
13. **Section geometry is utility classes, never inline `style`.** An inline style beats every
    variant, so geometry expressed that way cannot respond at all — the single blocker that shaped
    the whole mobile diff. **Inline `style` remains correct for per-frame plumbing**: `--r`, `--at`,
    `--i` and the transforms computed from them. The distinction is geometry vs. frame data.
14. **GLSL lives in tagged template literals, and three things silently destroy it.** All three have
    now shipped at least once. **A backtick in a GLSL comment terminates the JavaScript template
    literal** — the module fails to parse, the React subtree dies, and HMR cannot recover it. **A
    non-ASCII character** — an em dash from ordinary prose — is outside the character set GLSL ES
    accepts, and some drivers reject it even inside a comment. **A redeclared local** is an error,
    not shadowing: `float p` for a beat phase collided with `vec3 p` for a scaled position, the
    program never linked, and the entire flock vanished with no visible cause. A fourth, cheaper to
    catch: **a varying declared in one shader and not the other.** `tsc` and the test suite see none
    of this — it is all inside a string. Sweep before trusting a shader edit:

    ```
    node -e "const fs=require('fs');const src=fs.readFileSync(process.argv[1],'utf8').split('\n');let sh=null,d={};const vV=new Set(),vF=new Set();src.forEach((l,i)=>{const m=l.match(/const (VERTEX|FRAGMENT) = /);if(m){sh=m[1];d={};return}if(sh&&l.trim()==='\`'){sh=null;return}if(!sh)return;if(/[^\x00-\x7F]/.test(l))console.log('NON-ASCII '+(i+1));if(l.includes(String.fromCharCode(96)))console.log('BACKTICK '+(i+1));const v=l.match(/^\s*varying\s+\w+\s+(\w+)\s*;/);if(v)(sh==='VERTEX'?vV:vF).add(v[1]);const g=l.match(/^\s*(float|vec[234]|int|bool)\s+(\w+)\s*=/);if(g){if(d[g[2]])console.log('DUP '+g[2]+' '+(i+1));else d[g[2]]=i+1}});[...vF].filter(x=>!vV.has(x)).forEach(x=>console.log('VARYING MISMATCH '+x))" src/three/Butterflies.tsx
    ```

### The four layout tiers

| Tier | Range | About | Gutters |
| --- | --- | --- | --- |
| phone | `< 640` | one column, portrait in flow, bottom ticker | 24 |
| tablet | `sm` 640–1023 | one column, portrait in flow, side rail, 56px headline | 64 / 40 |
| small desktop | `lg` 1024–1279 | two columns, 320px portrait, one copy column | 80 / 48 |
| desktop | `xl` ≥ 1280 | **the design-viewport geometry** — 440px track, 78px gap, two copy columns, 74px headline | 118 / 72 |

`Contact` and `GalleryScene` follow the same gutter ladder so the three sections never disagree at
the same width. Contact's reserved form slot waits for `lg`, where the two-up row has room for it.

---

## How to verify UI work here

Invariant 6 means **the browser is the test** for anything visual. Every trap below has already cost
a cycle.

- **Drive the page as the active tab.** Lenis runs off a GSAP ticker on `requestAnimationFrame`; in
  an occluded or background tab rAF is throttled and nothing Lenis-driven moves. Call
  `bringToFront()` and **measure the tick rate before trusting anything**. Healthy readings vary by
  machine — cycles have measured 26–27, 61–62, and 23–62 ticks/500 ms. **Do not carry a threshold
  across machines**; take a reading, and if it is ~1, fix the focus before concluding anything.
  Scroll with `lenis.scrollTo` or real wheel input, **never `window.scrollTo`** — Lenis owns the
  scroll position.
- **A computed style is not what you see.** One cycle asserted `getComputedStyle().transform` and
  reported a clean ±8° bend while the planes rendered flat, because the parent lacked
  `transform-style: preserve-3d`. **Look at a screenshot, and press Tab.**
- **A framebuffer readback is not looking either.** An agent that could not screenshot used
  `gl.readPixels`, got exactly the right alpha and exactly the right ochre, and was structurally
  blind to the marks being the wrong *shape*.
- **For shader work, read the dev server's own log — the browser console is already in it.** When
  `npm run dev` runs as a background task, Vite forwards client `console.error` into that task's
  output, including the full `THREE.WebGLProgram: Shader Error` with its numbered source listing and
  a `>` marker on the offending line. **This is the cheapest possible check and it was ignored for a
  whole phase** (defect #22). Strip the ANSI codes and the NULs, then filter:

  ```
  tail -c 4000 <task-output-file> | tr -d '\000' | sed 's/\x1b\[[0-9;]*m//g' | grep -E "ERROR:|Shader Error|^[0-9]+:[0-9]+:[0-9]+ (AM|PM)"
  ```

  **Check the timestamps.** An error from an intermediate save, followed by a later clean `hmr
  update`, means it is already fixed — three times this session a stale error was still the newest
  matching line. The last *event* is what matters, not the last error.
- **Vary viewport height, not just width.** One regression — five sections spilling outside their
  boxes — was invisible because every check used 920/960/1440 widths at a single 900px height. Check
  at least one short viewport.
- **Section-by-section, not once per viewport.** A section only lays out correctly once it is the one
  on screen. Scroll to each label before probing it.

### Getting a browser

**Playwright is not a dependency of this project and there is no Playwright MCP server in a plain
session.** Install **`playwright-core`**, not `playwright`, into a scratch directory and run a plain
Node script from there:

```
npm install playwright-core --no-save     # in a scratch dir, NOT the project
```

`playwright-core` ships no postinstall browser download, so the version mismatch the `npx playwright`
route hits — it wanted `chromium-1232` where the machine has `chromium-1228` — never arises, and
nothing is added to the project. Point `chromium.launch` at the browser already on disk:

```
executablePath: '%LOCALAPPDATA%\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe'
```

Check that path before reusing it — the machine also carries `chromium-1217` and several
`mcp-chrome-*` builds. Launch **headed**, then `bringToFront()`.

Two things the app does not expose, both needed for probing, and both with a trap:

- **`ScrollTrigger`** is not on `window`. A bare `import('gsap/ScrollTrigger')` fails — a bare
  specifier does not resolve in the browser. Import the exact URL the app already loaded, version
  query and all, found via `performance.getEntriesByType('resource')`; a different query string
  fetches a second copy with an empty trigger list.
- **Lenis** is not on `window` either. `import('/src/scroll/useLenis.ts').getLenis()` works **only on
  a page not HMR-edited since load** — after an edit Vite serves a stamped URL and the fresh module's
  instance is `null`. Reload first and assert the instance came back non-null.

### Probe corrections — three in the mobile plan report defects that are not real

- **A label map keyed on `t.vars.id` is always empty.** `createLabelTrigger` never sets an `id`. Key
  on the trigger *element*: for a section's `top top` label trigger, `start` **is** the label offset.
  **`contact` is the exception** — its trigger is `top 25%`, so its `start` is
  `offset − 0.25 × viewportHeight` (14535 at 1440×900, for a real offset of 14760). A `contact`
  reading of 14535 is correct, not the old 5400 defect returning.
- **`main > section` silently skips all four gallery scenes.** ScrollTrigger wraps each pinned scene
  in a pin-spacer, so they are no longer direct children of `main`. Use `section[id]`.
- **A vertical-fit probe counts a wrapper's own `padding-bottom` as content.** About's inner column
  carries `pb-[86px]` *as* the ticker clearance, so a naive probe reports +67px of overflow at
  390×844 where the last real content edge clears the ticker by 19px. Measure the last laid-out
  child, not the padding box.

Two more:

- Matching `/\d\d \/ \d\d/` against a scene's text finds a *dossier's* `WALL 01 / 07` metadata, not
  the progress row. Match the element whose entire text is `nn / nn`.
- **Hero's cream circle always reads as viewport overflow.** It bleeds off-edge by design inside
  `overflow-hidden` (left −120 at mobile, −250 at desktop). Two entries — the circle and its own
  placeholder label — are the clean baseline, not a defect.

---

## Decisions already ruled on — do not re-open

### Set by Denise, by hand

**`FULL_POLLEN` 4000 → 500 and `FULL_FLOCK` 1200 → 30** (`Stage.tsx`), after seeing the canvas working
for the first time. **Both have since moved again** — see the table under "Hers to set, not yours",
which is the current record. README §183–184 match the 500/30 figures and are now stale.

**The radius and the count are one decision** — tuning `RADIUS_WIDE` without fixing the count, or
vice versa, chases a moving target. The `instancedMesh` architecture is count-independent (placement
is vertex-shader uniforms, so per-frame CPU cost is O(1) at 10 or 1,200); a smaller count is **purely
a look decision**, never a performance fix. That is now true of the petals as well, which became
analytic in phase 6.

**Every density figure measured before that cut is a proportion, not an absolute.**

### From the mobile cycle

**`display: contents` is how About reorders across a container boundary.** Mobile wants label →
headline → **portrait** → copy → stats, and the portrait lives in the desktop grid's *second column*.
Below `lg` the two wrapper divs are `contents`, which removes their boxes and promotes their children
to direct flex items of the outer column where `order-*` sequences them; at `lg` every wrapper takes
its box back. The alternative — rewriting the desktop grid — would have risked "1440 unchanged" for
no gain.

**The portrait is the block that yields when the column is short of room, and Denise chose it** —
over shrinking it while dropping the second copy paragraph, and over declaring 390×844 the floor.
Below `lg` it takes `min(320px, 30vh)` and disappears entirely under 700px of height, capped at
`max-width: 1023px` so it only ever applies while the portrait is in the flow.

**JSX drops the whitespace around a line-broken element.** About's and Contact's headlines break with
`<br className="hidden lg:inline" />`; once those are `display: none` the words butt together —
"I paint the hour**before something**closes", "Commissions,**walls**". The explicit `{' '}` on either
side is **load-bearing**. **Any future `hidden` `<br>` needs the same.**

**The merch chips win their overlap with the snap list.** Four chips need 366px against the 342px a
390 viewport leaves, and shrinking the type would break the 8.5px floor, so they wrap; `SnapList`'s
top is `50%` and knows nothing about the title block's height, so the second row runs ~27px over the
first card. Chips are controls, the card is a placeholder — they carry an opaque cream ground to stay
legible. **Provisional.**

**The ticker's cream flip is driven by the same `ground` prop as the rail.** The two navs share
`stopIndexFor` and are never both visible.

**Mobile drops nothing structural.** README §197 is a requirement, not a nice-to-have.

### From the canvas-visibility cycle

**The ground lives in `GroundLayer`, in document space** — not on the sections, and not in one fixed
element. The obvious alternative (one fixed full-screen ground driven by the active label) is wrong
at the ink/cream boundaries: the label only flips once the incoming section reaches the top of the
viewport, so Merchandise's cream content would spend a whole viewport on Murals' ink. Document-space
blocks make the boundary slide exactly as an opaque section background did.

**`Stage` is `z-[1]`, not `z-0`.** The stack is ground `z-0` → canvas `z-1` → `main` `z-10`.

### From the butterfly flock cycle

**No GSAP MotionPath.** README §175 names it as the flock's driver; the spec deliberately rejected it
— it would cost a plugin in the critical-path bundle and add a second writer to the `frame` channel.

**`frame.attractor` was deleted, not filled in.** The flock runs r3f-reads-progress, so the field
would only ever publish a permanent zero that reads as live state.

**`activeSpans()` lives in `Butterflies.tsx`, not `flock.ts`** — `flock.ts` is imported by a
node-environment test and must not reach `timeline.ts` even transitively (invariant 2). It was
`activeWaypoints()` and read `getLabelOffset`; the reason it lives where it does is unchanged.

**~~Wing geometry is two triangles apexed at `y = 0`, not two quads.~~ SUPERSEDED by phase 1 of the
motion upgrade.** The reasoning was sound for a rhombus — the only rotation is about `y`, which
scales `x` by `cos(flap)` and never touches `y`, so a quad with corners `(±1, ±0.6)` stays an
axis-aligned rectangle at every flap value. It is simply no longer the shape: wings are a four-bezier
`ShapeGeometry` outline whose silhouette does not depend on the flap at all. **Kept here because the
entry read "do not simplify it back", and a future cycle finding bezier curves where this promised
triangles should know it was replaced deliberately, not eroded.**

### From the flock gating cycle

**A boundary is the midpoint between one span's end and the next's start — not either endpoint.**
The task spec asserted the sections are contiguous and warned against modelling the transition as a
gap. That is true of the unpinned sections (hero ends exactly where about begins) and **false of
every pinned one**: a pin's trigger ends when it releases, and the next section's does not start
until it reaches the top, so g1 ends at 4680 and g2 starts at 5580 with a real 900px gap between.
The midpoint is correct for both shapes and is why it was chosen. Do not "simplify" it to
`spans[i].to`.

**`BAND` is a *maximum* half-width, not the width.** `halfWidthAt` clamps it to half the distance to
the neighbouring boundary, and the outermost two against the ends of the document. Both clamps are
load-bearing, and neither is theoretical:

- Hero and About are one viewport each — about 0.06 of the document, narrower than a full 0.10-wide
  band. Unclamped, their bands overlap; where they do, the nearest boundary driving `target` and
  `hold` flips mid-span and **both jump ~0.2** at that seam, which the velocity EMA turns into a
  visible lurch.
- Contact's section starts 225px from the bottom, so the final band ran **past maxScroll** and
  `presence` stepped **0.120** on the document's last pixel, where `p >= last.to` short-circuits to
  the held value.

Clamped, adjacent bands can at worst meet at a point where both have `gather === 0`, so they agree
there by construction. **This is a deliberate departure from the task spec**, which specified `BAND`
as a single constant and required only that short spans not produce NaN.

**The `flock.test.ts` fixture is read out of the live page, not derived.** An earlier version
computed Contact's trigger start as 14085, reasoning that `'top 25%'` meant three quarters of a
viewport early. It is **14535** — 25% *down* from the top. Being wrong in the safe direction is what
hid the last-pixel discontinuity above, because a fixture that ends its final band before `p = 1`
never exercises the short-circuit. Re-read the values with `getLabelSpan` rather than recomputing
them.

**The continuity test steps `k / STEPS`, not `p += 1e-4`.** An accumulating loop drifts just short of
1.0 and never compares the band against the value the `p >= last.to` short-circuit holds — which is
the single sample that catches the bug above.

**~~Not verified: the component wiring under a live render.~~ VERIFIED in phase 7.** `place()` writing
`uPresence` was observed running, at three scroll positions, with the values the maths predicts. The
two failed attempts recorded here — r3f v9 exposes no `__r3f` on the canvas, and the fiber walk found
no store — were both attempts to reach the *scene graph*. **Going under it instead is what worked, and
it is the technique to reuse:** hook `WebGL2RenderingContext.prototype.getUniformLocation` from an
init script to tag each returned location with its name, then hook `uniform1f` to record name → value,
and `drawElementsInstanced` to record index and instance counts. That needs no app internals, no r3f
version knowledge, and survives any refactor above the GL layer. See "Phase 7, as verified".

### From the pollen fix, and what the petals rewrite did to it

**The extent is read from the camera, never hardcoded.** r3f's `viewport` reports the visible extent
in world units at the `z = 0` plane, so the field follows the aspect ratio instead of assuming one.
**Do not replace it with a constant** — a constant is what was wrong, and it is wrong at a different
amount at every width. This survives the rewrite: it now sizes the wrap box.

**A resize re-scatters the field, and that is deliberate.** It is the only way the box can follow a
new aspect, and a reshuffle behind the page costs less than carrying normalised coordinates through
the drift. If it ever *does* read as a pop — the realistic case is a phone's URL bar collapsing
mid-scroll — the fix is normalised coordinates, not a frozen box.

**Two entries here died with `Pollen.tsx`:**

- *"Each particle spreads across the frustum at its own `z`."* Replaced by fixed margins on the wrap
  box — `MARGIN_X 2.2`, `MARGIN_Y 1.4` — sized against the frustum **at the far plane**, where the
  visible half-extents are about 1.3× those at `z = 0`. They are not slack, and they carry no
  allowance for petal size: push a scale far past ~1.9 and a petal starts wrapping with a corner
  still on screen, which reads as a blink.
- *"`SLIDE_X` is one constant used twice."* No longer true, and the reason is worth keeping.
  `uSlide` is now added **before** the `mod()` wrap rather than applied as `mesh.position.x`.
  Translating a field after folding it empties the trailing edge as the document scrolls — which is
  precisely what that doubled-up `SLIDE_X` allowance existed to pay for. Folding afterwards makes the
  allowance unnecessary, so `SLIDE_X` now does one job.

### From the motion upgrade

**The steering sum carries an always-present unit resting vector, and that is load-bearing.** A
butterfly faces the direction of `uFlockVel + drift + rest`. At the contact section `uSettle` is 1,
which zeroes the drift, and the target has stopped moving so `uFlockVel` has decayed to zero — the
sum would be exactly zero and `atan(0,0)` is undefined, snapping the whole flock to one shared
heading. It would hit the reduced-motion frieze hardest, where `uFlockVel` is never written at all.
**Removing the degenerate case beats special-casing it**: there is no branch to get wrong, and the
frieze gets varied headings for free. Verified — 8 instances at `uSettle = 1` give 8 distinct
headings with `|v|` exactly 1.

**The body carries `aWing = 0`, and three separate behaviours fall out of that one fact.** `cos(0)`
is 1 and `sin(0)` is 0, so the body never rotates with the flap; the fragment shader recovers it as
`1 - abs(aWing)` to paint it bark; and the fold-shading factor lands at exactly 1 there, leaving the
brown flat. **No branches, no extra attributes, no exemptions.** Do not "clarify" it into a flag.

**The flap-glide envelope shuts itself off without a branch or a `step()`.** Past the flapping window
the normalised position exceeds 1, where the closing `smoothstep` is already saturated. Verified over
3,000 samples: zero leakage into the glide phase.

**The held dihedral is keyed off cycle length, never off `aTint`.** `aTint` drives the ember/bone
split, so keying dihedral off it would make bone butterflies visibly flatter than ember ones — a
correlation nobody asked for and everybody would eventually see.

**The petal quad is square because the map is square.** The painted petal is 1.45:1 inside a square
image; mapping that onto a 1.76:1 quad stretches it to roughly 2.55:1. **The quad's aspect must match
the map's, not the petal's** — the artwork carries its own proportions inside the square, and the
silhouette measures 95.3% of the map's width by 65.6% of its height. Both curl terms are normalised
to that silhouette rather than the quad, or the petal's own edge sits at 43% of the intended cup.

**Both wing maps are sampled every fragment and one is discarded.** That is deliberate: it keeps the
flock a single draw call rather than splitting it into an ember mesh and a bone mesh. Two texture
fetches a fragment is the cheaper half of that trade at this instance count.

**Textures are `import`ed, never referenced as `/textures/...` strings.** Vite then hashes them into
the build and a rename **fails the build** instead of failing silently at runtime.

**Every asynchronously-loaded texture must `invalidate()` on load.** Under `frameloop: 'demand'` the
reduced-motion frieze draws exactly one frame, almost certainly before a PNG has decoded, and would
keep the untextured frame forever. This bit twice: the wing maps were built with it, and the petal
map needed it added because the canvas texture it replaced had been synchronous.

### Testing analytic motion

`Petals` computes position in closed form from `uTime`. **That architecture invites exactly one
failure, and it is invisible.** A displacement that is not the true antiderivative of its intended
velocity still animates perfectly smoothly — it just animates *different motion*. No amount of
looking at the page catches it.

So `flutter.test.ts` differentiates every closed form numerically and checks it against the velocity
it claims to integrate. **That is the point of those 22 tests**; the range and continuity assertions
are secondary. If you add motion to that shader, add the antiderivative to `flutter.ts` and the
derivative check beside it — do not write the formula only in GLSL, where nothing can test it.

The constants live in `flutter.ts` and are interpolated into the shader, so the numbers exist once.
**The formulas necessarily exist twice**, in TypeScript and in GLSL, and nothing enforces that they
agree. Change one, change the other.

`wrap` is tested for a reason that looks pedantic and is not: **GLSL's `mod` returns a non-negative
result for a positive divisor and JavaScript's `%` keeps the dividend's sign**, so the obvious
translation of the shader's wrap line is wrong for every petal that has drifted negative.

### Carried forward

**`refreshTimeline()` is not a no-op. Do not remove it.** The refresh drives an `onUpdate`, and that
is the only thing recomputing the ring's rotation for a newly filtered count. Measured with it
removed: seats re-render 6 → 4 correctly while `--r` stays frozen at 300.10° for over a second where
109.13° is right.

**Scroll restore needs all three of these.** Each was hiding the next:

1. The offset is written through on **every scroll**, and deliberately **not** again on cleanup.
   Teardown is too late to read `scrollY`: `killTimeline()` unpins four sections and collapses the
   document first, and a save there overwrote a correct offset with the clamped one (3428 → 388).
2. The restore waits for `refreshAfterFonts`' callback, **not** a bare `rAF`. Creating a pinned
   trigger does not lay out its pin spacer; only the refresh does.
3. `lenis.resize()` runs before the `scrollTo`. Lenis caches its scroll limit and recomputes only
   from an async ResizeObserver.

The `sessionStorage` read also happens at effect setup, *before* the listener is attached.

**Geometry deliberately is not in `index.css`.** Seventeen tokens mirroring the scene numbers sat
there referenced by nothing and were deleted rather than wired up: the timeline computes with these
values, which CSS cannot do.

**`scrub: 1` was removed from the scrub triggers; do not re-add it.** Removing it flips
ScrollTrigger's internal `isToggle`, so this is *empirically equivalent, not provably inert*. Tested:
merch chip clicked mid-pin, scroll unchanged at y=10424, `--r` moved 300.10° → 109.13° within 16ms.

**Keyboard focus on the track uses `:focus-visible`, not a pointer flag.** A `pointerdown` flag
latches — a click on the row's gutter focuses nothing, so the flag survives and swallows the next
genuine Tab.

**Kept deliberately despite zero consumers:** `src/scroll/usePresentation.ts` and `sceneCount` in
`scenes.ts`. `RING_LOOK.murals` is a type-required zero row, not an orphan.

**Cream-ground dial chrome** uses `border-ink/25` uniformly rather than a 12/25 staircase.

---

## Known-good measurements

A regression baseline. Confirmed in a real browser at 1440×900 unless marked, on `5e95ecc`.

### Responsive matrix

| Viewport | Overflow beyond the hero circle | Worst section fit | Note |
| --- | --- | --- | --- |
| 360 × 640 | 0 | About **−43** | portrait hidden; all copy + 3 stats survive |
| 390 × 844 | 0 | About **−19** | the mocked mobile frame; portrait shown |
| 414 × 896 | 0 | About **−71** | |
| 640 × 844 | 0 | About **−23** | tablet tier; portrait at 30vh |
| 768 × 900 | 0 | About **−111** | tablet tier |
| 1440 × 900 | 0 | About **−220** | design viewport |

Negative is clearance. **Widths swept clean for horizontal overflow: 640, 768, 900, 1024, 1100, 1280,
1440.** Nothing overflows its 100vh clip at 640×844, 640×640, 768×900, 820×1180, 1024×768, 1024×900,
1100×900, 1280×900 or 1440×900.

- Every gallery scene and Contact clear the ticker by exactly **24px** at all three phone widths.
- **The ticker flips at the label boundary, not before it**: at 390×844 the active stop is `01 Hero`
  through scrollY 844 and `02 About` from 845, the bar flipping to cream at the same pixel. **A
  screenshot taken at exactly the boundary offset looks like the flip failed. It has not.**
- Ticker progress line travels monotonically: widths 0 → 59 → 63 → 67 → 89 → 118 across the document.
- Detail leaves at 390×844 (`/artworks/…`, `/ovalese/…`, `/murals/…`): **zero overflow on all three**,
  single column, image well above the metadata, title 34px, enquire button spanning the full 327px
  column at 43px tall, prev/next side by side without collision.
- At 390×844, tapping the centred g1 card opens `/artworks/floral-bouquet`; going back restores
  scroll to **exactly** the departure offset (1888 → 1888).
- Reduced motion at 390×844 and 1440×900: document collapses to **6300**, **zero pin-spacers**, all
  four scenes are snap lists, link counts **24 / 7 / 7 / 12** — every piece still reachable.
- **Reduced-motion canvas, at 1440×900** (`32919b8`): two instanced draws a frame — flock
  **291 indices × 10**, petals **150 × 60** — and **6 draws in the whole session**, so `demand` is
  holding. `uTime` **12.3**, `uRestBreath` **0**. `uPresence` **1** at scrollY 0, **0.35** at 3150
  (the `FRIEZE_FLOOR` path), **1** at 5400 with `uSettle` **1**. Two screenshots 3 s apart are
  **byte-identical**. At 390×844 only the petal draw exists, at **15** instances.

### Timeline and canvas

- Document is **17.4 viewports (`scrollHeight` 15660)**; `maxScroll` = **14760**.
- **Label offsets: `hero 0 · about 900 · g1 1800 · g2 5580 · g3 8460 · g4 11520 · contact 14760`.**
  (`contact`'s *trigger start* reads 14535 — see probe corrections.)
- The whole-document trigger ends at **14760**; `frame.progress` tracks `scrollY / 14760` exactly:
  250 → 0.0170, 3321 → 0.2250, 5400 → 0.3659, 8144 → 0.5518, 12006 → 0.8134, 14760 → 1.
- **The rail's Contact diamond lands at 14760** with Contact's top at viewport top.
- **Flock spans** (`getLabelSpan`, document px, read off the live page at 1440×900):
  `hero 0–900 · about 900–1800 · g1 1800–4680 · g2 5580–7560 · g3 8460–10620 · g4 11520–13860 ·
  contact 14535–15660`. A pinned scene's span is its **whole pin**, `self.start` to `self.end`.
  Note the gaps: g1's pin ends at 4680 but g2 does not start until 5580 — one viewport of g1
  unpinning and scrolling away. Contact's end is past maxScroll and clamps to progress 1.
- Flock `presence` across the document: **1** at hero, **0.45** through about, **exactly 0** through
  every gallery pin core, **1** in each of the three inter-pin gaps, **1** at the foot. The draw is
  skipped for **49%** of the document. Worst per-pixel step in `presence` is **0.0033** — swept all
  14,760 pixels, so there is no seam anywhere.
- Ground blocks tile **0 → 15660** exactly, boundaries at every label offset. Also tile at 920, 960,
  1024×640 and 1280×800.
- The ink/cream seam slides: at scrollY 11100 the boundary sits at **420px**, matching g4's viewport
  top.
- Sections refuse `scrollLeft` / `scrollTop`. **Spill at 1440×900 is not literally 0 everywhere** —
  Hero measures **+40 / +40**, the 980px circle centred in a 900px box, deliberate. Every other
  section is *negative*: about −140/−140, g1 −64/−50, g2 −64/−44, g3/g4 −64/−52, contact −237/−52.
  The claim that holds is "no section spills content it does not mean to".
- Murals: `--at` spans **0 → 3 → 6**; centred dossier **816** wide, neighbours **749.4 / 689.7 / 630**.
- Scroll restore exact from **3428, 9180 and 12371**, and survives a hard refresh.
- Bundle **on `a407340`**: critical path **404.76 kB**, CSS **35.74 kB**, lazy three chunk
  **899.92 kB**, textures **141.88 kB** across three PNGs (ember 48.08, bone 43.07, petal 50.73).
  Before the motion upgrade: 404.75 / 35.47 / 886.87 and no textures at all. **The three chunk is the
  only figure that moved materially** (+13.05 kB) — the critical path moved 0.01 kB, because `Stage`
  is lazy-loaded and everything added this cycle landed behind that split.
- `textures/` is **1.1 MB on disk** across two folders, holding a master and a `-256` runtime
  downscale of each of the three maps. Only the `-256` files are imported and only they are built.
- At **1280×800**: `hero 0 · about 800 · g1 1600 · g2 4960 · g3 7520 · g4 10240 · contact 13120`,
  maxScroll 13120. Recorded because the flock comparison was shot there.

### Older baseline, still believed good

- Artworks counter climbs `01 / 24` → `24 / 24`, reaching 24/24 while still pinned.
- Idle snap overshoots, then pulls *backwards* onto the stop and holds. The residual is integer-scroll
  quantisation — stop 20 sits at 4304.35 and the browser can only rest on 4304.
- The snap never fires mid-gesture: 14 wheel events at 70ms intervals, strictly monotonic.
- A thumb click rotates that piece to centre without navigating. Chapter jump moves `--at` 4→0
  without navigating.
- Merch chips re-bloom: jackets → 4 thumbs at exactly 90° gaps; earrings → 0 thumbs, centre only,
  `01 / 01`.

---

## The motion upgrade, mid-flight

What was built, in the spec's own numbering. Each phase is a commit; the hashes are under "State".

| Phase | | Note |
| --- | --- | --- |
| 1 · silhouette + body | done | Four-bezier wing outline, mirrored, plus a body ellipse. Wings, body and mirror merged into **one indexed geometry — one draw call**, not the two the spec allowed. |
| 2 · velocity orientation | done | `uFlockVel` is a fifth uniform, an EMA of the target's frame-to-frame delta. Bank from the drift's analytic second derivative. |
| 3 · flap–glide | done | Asymmetric stroke, duty-cycled envelope, settle damping, resting open–close, lift bob. |
| 4 · scale / count / radius | done | **`RADIUS_WIDE` 16, `FULL_FLOCK` 28 — Denise's, off the shot 2x2.** Only those two constants moved; `aScale`, `FOREGROUND` and `BONE_SHARE` are untouched **on purpose**, because the frames she approved were rendered with their current values. |
| 5 · fold shading | done | Reuses the flap cosine already computed. Free. |
| 6 · petals | done | `Pollen.tsx` deleted; `Petals.tsx` + `flutter.ts` + 22 tests. |
| 7 · reduced motion | done | Both friezes verified in a browser under `reducedMotion: 'reduce'`. **No code changed** — the phase was a check, and the check passed. See "Phase 7, as verified". |

**The spec's numbers were mostly good and twice badly wrong**, which calibrates how much to trust the
rest of it. Both errors were caught by measuring rather than by looking:

- **`BANK_GAIN` at the spec's implied scale pinned the bank to its clamp essentially always** — a
  snap between two fixed extremes rather than a roll. The drift's angular velocity is far larger than
  it looks: mean 2.5–8.1 rad/s over the `aSpeed` range, peaks above 20. It is now **0.03**, where the
  mean bank is 4–14°.
- **`RADIUS_WIDE = 32` was tuned at 1,200 instances and is catastrophic at 10** — roughly one
  butterfly in frame at rest, which is why nothing could be judged on screen at all. Dropped to a
  **provisional 10** in phase 1 purely so the silhouette was visible.

**One deliberate improvement on the spec:** it permitted approximating the gust integral with "a slow
sine, exactness doesn't matter". It was derived exactly instead — `max(0, sin u)³` climbs by exactly
4/3 per positive half-cycle and is flat across the negative half — for about the same cost and C³
continuity at the seams.

**One deliberate departure toward Denise's art:** the spec asks for a body ~0.7 wing-units long,
which sits it wholly inside the wing span. Her texture preview drew it running nearly the full wing
height and much narrower, and the preview was the newer artifact. The body follows the preview.

### The RADIUS_WIDE comparison

`RADIUS_WIDE` scales **only the dispersed state**, where `gather` is 0 and the spread is `RADIUS_WIDE`
rather than `RADIUS_TIGHT` (3.5). **The dense migrating cloud is identical at every candidate value**
— only the resting state differs, which is the state a visitor spends their reading time in.

**Where to shoot it changed completely, and the old instruction is now the worst possible advice.**
It said to capture at exact label offsets. Under the gating rewrite a gallery label offset *is* a
seam — `registerLabel` stores a pin's start, and the boundary between the previous span and that one
sits on it — so those are the frames where `gather` is **1**, the migrating cloud, the one state the
comparison is not about. Worse, the four gallery scenes now hold `presence` at **0** through their
cores, so there is no resting flock to photograph there at any radius.

**The dispersed state now exists only in hero, about and contact.** Shoot it at **scrollY 0**
(`presence` 1, `gather` 0) and at **1350**, the midpoint of about (`presence` 0.45, `gather` 0). The
foot of the document at **14760** is the third, and is the landed state with `settle` 1.

A screenshot at scrollY 12100 once looked heavily speckled and was described as the flock crowding
the content; that position was mid-leg at `gather` ≈ 0.95. **It draws nothing at all now** — 12100 is
1030px from the g3/g4 seam, past the 738px band, so `presence` is 0 and the mesh is skipped.

**The old comparison is now void in both directions and should not be consulted.** Its frames were
shot at `FULL_FLOCK = 1200` *and* at the rhombus geometry, at radii 32/52/76/110. The flock is now 10
recognisable textured butterflies several times the size, at radius 10. Neither the absolute density
nor the rank order transfers — a "thin residue" of rhombi and a thin residue of butterflies are not
the same picture. The artifact
(**https://claude.ai/code/artifact/adb62663-51f2-44e6-bd90-62cf2fc94529**) is kept only as a record of
what was once shown to Denise.

**To shoot the phase-4 comparison:** edit the constant, **reload** — it is baked into the vertex
shader as a literal, so HMR alone will not do it — and capture in the three places above, **for the
viewport in use**: read the spans from `getLabelSpan` rather than reusing the px figures in this
file. Scale hero and about's positions from the spans you read, not from 0/1350. Vary `FULL_FLOCK` in
the same sweep: radius and count are one decision.

**One trap, which killed two runs of that sweep.** Editing tracked source while a page is open races
Vite's watcher: on Windows the HMR event lands *after* the deliberate wait and after the reload, and
the forced navigation garbage-collects whatever `page.evaluate` is in flight — the error is
`Resulting promise was garbage collected`, which does not name HMR at all and reads like a Playwright
bug. Waiting longer does not fix it. **Park the page on `about:blank` before writing the file**: with
no client connected there is no HMR event to race. Restore the constants from `git checkout` in a
`finally`, not by writing the originals back, so a mid-run failure cannot leave the tree edited.

### The comparison as shot

**It exists now, and it is waiting on Denise:**
**https://claude.ai/code/artifact/a18602a5-4ece-4fe3-8135-e3054c37d172**

Shot on `c9ac96a` at 1440×900, as a 2×2 — `RADIUS_WIDE` ∈ {10, 16} against `FULL_FLOCK` ∈ {10, 28} —
in the three frames above. About's midpoint resolved live to **1350**, matching the figure in this
file at this viewport; every stop landed on its exact pixel. **Each frame was confirmed to be the
state the comparison is about** rather than assumed: the uniform hook read `gather` ≈ 0 in all twelve,
with `presence` 1 / 0.45 / 1 and `settle` 0 / 0 / 1.

**She chose `RADIUS_WIDE = 16` with `FULL_FLOCK = 28`, and it is committed.**

**One claim made off that sheet was wrong, and it is recorded as defect #28.** The read that
"widening the radius almost exactly cancels the count — both `r10-n10` and `r16-n28` land 4-5 in
frame" was eyeballed off **one screenshot each**, and the scatter is unseeded `Math.random()`: every
load is a fresh draw. Monte Carlo over 20,000 trials gives the real picture, and it is nothing like
cancellation — at the foot `r10-n10` averages **3.10** and `r16-n28` **6.83**, a factor of 2.2. The
p10–p90 spread at the chosen setting is **4 to 10**, which is wide enough that the two frames I
compared were simply an unlucky pairing. **Count is the dominant lever; radius is weaker and its
strength depends on whether the attractor sits inside the frame** — full table in `RADIUS_WIDE`'s
docstring. None of this changes what Denise picked: she chose a look from real frames, and 16/28 is
what she chose.

Three things worth knowing before reading the sheet, none of which are settled by it:

- **The hero is thin at every candidate**, including the densest. At these radii the spread pushes
  most of the flock past the frustum edge, so the landing frame shows one or two butterflies whatever
  the count. If the hero specifically needs to read as populated, that is a *separate* lever from
  either of these two — it is the hero attractor's own spread, not the global radius.
- **The foot is where the choice actually reads.** ~~`r10-n28` lands roughly 9–10 in frame; `r10-n10`
  and `r16-n28` both land 4–5.~~ **Those were single draws — see the correction above.** The measured
  means at the foot are 3.10 / 9.32 / 2.17 / 6.83 for the four candidates in sheet order.
- **Clipping at the foot is real and visible**: instances cluster low and left, and some are cut by
  the bottom edge. Denise may read that as a defect rather than as a choice; it is neither, it is
  what `ATTRACTORS.contact` plus the radius happens to produce.

### Phase 7, as verified

Measured on `32919b8` in headed Chromium at `reducedMotion: 'reduce'` — a real media-query emulation,
not a class or a stubbed hook. **The phase changed no code**; every claim it existed to test held.
Recorded in this much detail because "verified" is the word defects #13 and #22 were both written
with, and neither had a measurement behind it.

| Claim | How it was checked | Result |
| --- | --- | --- |
| Reduced motion is actually in force | `matchMedia` in page | `true` |
| Document collapses, pins gone | `scrollHeight`, `.pin-spacer` count | **6300**, **0 spacers** — matches the existing baseline |
| The frieze is genuinely static | two full screenshots 3 s apart, `Buffer.compare` | **byte-identical** |
| `frameloop: 'demand'` holds | instanced draws recorded over the whole session | **6 total** (3 frames × 2 meshes), then nothing |
| Petals freeze at `FRIEZE_TIME` | `uTime` uniform | **12.3** |
| The petal field is not a grid of face-on petals | screenshot | varied scale, rotation and tint — the reason `FRIEZE_TIME` is not 0 |
| The flock is one draw call | `drawElementsInstanced` | **291 indices × 10 instances**, once per frame |
| Resting open-close is switched off | `uRestBreath` | **0** |
| `place()` writes `uPresence` — *the gating cycle's open item* | `uniform1f` hook | **1** at hero, **0.35** in g2, **1** at the foot |
| `FRIEZE_FLOOR` saves a gallery visitor from an empty canvas | load at scrollY 3150 via scroll restore | `uPresence` **0.35**, flock still drawn, visible in the screenshot |
| The degenerate `atan(0,0)` never happens | screenshot at the foot, where `uSettle` = 1 **and `uFlockVel` is never written at all** | headings visibly **varied**, not collapsed to one |
| Compact drops the flock, keeps petals at 25% | draws at 390×844 | **one** shape, `150i × 15`; no butterfly uniforms compiled at all |

**Reaching the uniforms is the reusable part.** The scene graph is unreachable in r3f v9 — both routes
the gating cycle tried still fail. Going *under* it works and is version-proof: an init script that
tags `getUniformLocation` results with their names, then records `uniform1f` and
`drawElementsInstanced`. `phase7b.mjs` in the session scratchpad is the whole thing, about 30 lines.

**Two things this cannot tell you, so do not let the table imply them.** It says nothing about whether
the frieze looks *good* — that is phase 4's density question, and at `RADIUS_WIDE = 10` the foot of
the document clusters its butterflies low and left with several clipped by the bottom edge. And the
frieze reflects the scroll position at the moment fonts settle and **does not follow the visitor down
the page**, which is the spec's intent, not a defect — a reduced-motion visitor who scrolls keeps the
frieze they landed with.

---

## The seed, and what it collides with

Built on `feat/collapse-to-seed`. Spec: `specs/2026-08-03-collapse-to-seed-design.md`. Plan:
`plans/2026-08-03-collapse-to-seed.md`. **Only the `g1 -> g2` seam** — g3 is the Murals track, not a
ring, so the two seams touching it keep the plain scroll-away. That was Denise's scope call, and the
cost was stated when she made it: the effect happens once in the whole page.

The whole-document trigger now writes two more properties beside `--progress`: **`--seam`** (signed,
-1 -> 0 -> +1 across the seam's band) and **`--seed`** (0..1, the mark's presence). Both come from the
same `boundaryAt` / `halfWidthAt` / `gatherAt` the flock uses, so **the ring and the flock cannot
drift apart** — that sharing is the point of the design, not an optimisation.

**Three things worth knowing before touching it:**

- **`--seam` is deliberately NOT written until spans are measured.** Do not "fix" that by adding a
  default. The two rings derive opposite values from it — outgoing is open at -1, incoming at +1 —
  so **no single value leaves both open**. The per-role CSS fallbacks `var(--seam, -1)` and
  `var(--seam, 1)` only apply while the property is genuinely absent, and that is what keeps g1 from
  rendering collapsed on load. This was caught in review, not in the browser.
- **`seamAt` skips the nearest-boundary scan on purpose.** `halfWidthAt` clamps every band to at most
  half the distance to its neighbours, so `gatherAt` is provably 0 outside its own band. There is a
  test sweeping every boundary that pins exactly this, because the omission depends on it.
- **`SEED_PLATEAU = 0.55` exists because `gather` is a hump, not a plateau.** Driven straight from
  `gather`, the seed would be fully present for one instant and read as a flicker rather than
  something that persists. Measured: it now holds at 1 across 664px.

### The collision, which is Denise's to rule on

**At the exact midpoint the seed is invisible, because the flock is densest there.** Both peak at the
same boundary — by construction, since they share the maths. The seed's dashed ring reads clearly at
the quarter and three-quarter points and is swamped at the middle by the migrating cloud.

**This is not a bug and should not be "fixed" by decoupling them.** Decoupling is what the shared
maths exists to prevent. It is a look decision, and the options are: raise `SEED_PX` from 24 so the
mark survives the cloud; give it a backing glow; lower `HOLD` at that seam so fewer butterflies
gather; or accept it, on the reading that the flock crossing the seam *is* the transition and the
seed is punctuation either side of it. **Ask her; do not pick one.**

### The second open ruling: the two marks are not always in the same place

**The seed is `fixed` at 52% of the viewport. The ring is `absolute` at 52% of its own section.** Those
coincide **only while GSAP has the section pinned**, and the collapse ramp runs past pin release.

Worked through on the fixture geometry: g1's pin releases at 4680 but the boundary is at 5130, so
across those 450px the ring's centre travels from y≈468 to y≈18 while the seed stays at y≈468. At the
moment `seedPresence` first saturates, g1 is only ~55% collapsed — a 217px guide circle at opacity
0.45, centred **137px above** a fully-bright 24px dot. Mirrored on the way in: at the boundary g2's
ring centre is still below the fold.

**This contradicts a [DECIDED] item in the spec** — "the handoff from section-owned to layer-owned is
invisible rather than a swap the eye can catch" — and the browser pass did not cover it, because
nothing in it checked that the two centres coincide. Found by the final review reasoning about the
geometry, not by looking.

Two ways out, and it is a look call: compress the ring's own collapse into the *pinned* portion of the
band, so it reaches a point by pin release; or accept the drift and stop claiming the handoff is
invisible. **Do not pick one without Denise.**

### What the final review changed after the tasks were done

Five fixes landed after the whole-branch review, none of them cosmetic:

- **`killTimeline` was leaving `--seam` and `--seed` on `<html>`.** The absent-until-measured
  guarantee therefore held only for a visitor's first page view; after one detail-route round trip the
  properties persisted stale. Now removed, not defaulted — defaulting is the thing that cannot work.
- **`activeSpans()` is now shared** between `timeline.ts` and `Butterflies.tsx` instead of the same
  `spansFrom(...)` expression appearing in both. Sharing the ramp while duplicating the normalisation
  left the drift channel open one level up, which is defect #20's shape exactly.
- **The collapsed ring's thumbs stayed clickable and tab-focusable at `opacity: 0`** — an invisible
  cluster of labelled buttons near the top of the screen for ~450px of scroll. Now clipped out of
  hit-testing via `clip-path` on `--collapse`, and `inert` from the **discrete** label channel.
  **A residual window remains** where the label still reads `g1` while the ring is already collapsed;
  it is commented in the code rather than papered over.
- **Every `seedPresence` test passed for a step function**, which is precisely the shape
  `SEED_PLATEAU` exists to prevent. There is now an assertion on the ramp that fails against a step.
- **Two docstrings overclaimed.** They said `seamAt` may skip the nearest-boundary scan *because* of
  `halfWidthAt`'s clamping. It does not: `gatherAt` returns 0 outside its own band by its own branch,
  for any half-width. The clamp matters to `flockAt`, not to `seamAt`. The test named for that
  property restated the implementation and could not fail; it is now an adjacent-band disjointness
  assertion, which can.

### Verified in a browser, at 1440x900 unless noted

Continuity swept **every pixel** of the band: worst step in `--seam` is **0.00325**, and it crosses 0
at exactly the computed boundary (5130 at this viewport). `--seed` holds at exactly 1 across **37
consecutive samples / 664px**. g1 holds `matrix(0.04, ...)` with `opacity: 0` at every sample past the
boundary out to twice the half-width — **it does not re-bloom**, which is the specific failure the
signed scalar exists to prevent. `[data-seed]` is absent at 390x844 and under `prefers-reduced-motion`
(where pin-spacers are 0). Reads correctly at 1280x800 and at a short 1440x700.

**The flock is bit-identical.** `uPresence` / `uGather` / `uSettle` match the values recorded in this
file at hero, About's midpoint (**0.4498**) and the foot — so extracting the shared helpers out of
`flockAt` changed nothing, which was the one thing that pass had to establish.

**Measured on the branch tip:** `npm run typecheck` clean · `npm test` -> **10 files / 158 tests** ·
`npm run build` succeeds · critical path **407.47 kB**, CSS **35.78 kB**, lazy three chunk
**899.55 kB**. The three chunk *shrank* 1.35 kB against the phase-4 measurement — the helper
extraction, not a regression.

### One environment trap this cycle cost real time

**A long-running dev server carries a stale per-module Vite HMR query string.** A raw
`import('/src/scroll/timeline.ts')` from a probe then resolves to a *second copy* of the module whose
label registry is empty, so `getLabelSpan` returns `undefined` and every span reads as unmeasured.
Resolve the URL the app actually loaded via `performance.getEntriesByType('resource')` and import
that exact string, query and all. This is the same hazard the "Getting a browser" section records for
`ScrollTrigger`, now confirmed for any app module.

---

## Defects caught in prescribed code

Kept because it calibrates how much to trust a written spec here — **including specs and plans
written in this repo by previous cycles.**

1. A test asserting `needsSnap(0.5, 7) === true`, which is impossible (0.5 *is* stop 3 of 7).
2. A duplicated `ScrollTrigger.create` label block → extracted as `createLabelTrigger`.
3. **A CSS transform leaving every orbit thumb tilted by its seat angle** — the counter-rotation
   cancelled the ring's spin but not the seat's own placement.
4. Murals track copy showing under the `list` presentation on every dial scene.
5. A double cross-fade on merch filter clicks, plus a reset fighting the route-return scroll restore.
6. **A snap list whose last three pieces could never become active** — no centring gutter.
7. **Chapter-bar labels rendering in mixed case**, because `<button>` does not inherit
   `text-transform`. Now part of invariant 7.
8. **The ±8° plane bend rendering flat**, because the row lacked `transform-style: preserve-3d`.
   Reported as verified by measurements that could not have detected it.
9. **`g3` documented as pinning when it never pinned at all.** That error survived a spec, a plan and
   a handoff before anyone measured the document height.
10. **A plan that mandated code its own verification step names as the failure signature.** The flock
    plan's Step 5 read "if the marks render as perfect rectangles rather than diamonds, the wing
    rotation is wrong" — while the plan's own code block *guaranteed* rectangles.
11. **A test that could not fail.** A review asked for a test pinning the `span > 0` guard and
    supplied a waypoint list that can never reach the negative-span segment.
12. **A framebuffer readback substituted for looking.**
13. **Two handoffs stating that pollen was shipped and working.** It had never been visible to
    anyone — the canvas was occluded from the moment it was added.
14. **A fix whose verification pass had a shape-shaped hole in it.** Verified across 920/960/1440
    *widths* at a single 900px *height*, and shipped a regression only visible at short viewports.
15. **A handoff claiming `.claude/worktrees/gallery-ring-timeline/` "still contains nothing".** It
    contains six PNGs and a `.playwright-mcp` directory. Written twice without being checked.
16. **A prescribed headline reading "I paint the hourbefore somethingcloses" at mobile.** The mobile
    plan's own code hid the line-break `<br>`s, and JSX drops the whitespace around them. Invisible
    to every measurement in the plan; caught only by looking at a screenshot. **The fourth entry here
    that only a screenshot could catch** — see #3, #8, #12.
17. **A spec asserting a fix it did not contain.** The mobile spec §62 claimed "this design fixes
    About's grid at 768 too". It moved the geometry behind `sm:` at the *same values*, so 768 stayed
    bit-identical — measured on both trees. Fixed afterwards by the `lg`/`xl` tiers. **A spec claiming
    a defect "falls out" of a change is a claim to measure, not to believe.**
18. **Three probes in the mobile plan that cannot report what they claim.** See "Probe corrections".
    Written into the plan and never run before it was committed.
19. **Two numbers in the immediately preceding handoff that no build produces.** CSS was recorded as
    **35.33 kB** where it builds at **35.47**, and the commit count as **80** while `HEAD` sat on the
    81st. Caught by building the tree twice — with and without the pollen change — rather than
    assuming a moved figure was the change's fault. **A figure in this file is only worth what the
    command that produced it is**; the CSS one was carried across revisions unmeasured.
20. **A comment's arithmetic that never matched its own inputs.** `Butterflies.tsx` derived its 0.62
    squash from a frustum "13.1 wide", where `2 · 10 · tan(22.5°) · 1.6` is **13.255**. The constant
    0.62 was right the whole time — 8.28 / 13.3 — so nothing rendered wrong, and the wrong width sat
    there through every cycle that cited the docstring as the authority on the frustum.
21. **A permission rule that governed nothing, declared working because the next command succeeded.**
    A `Bash(git push:*)` allow rule was written, `git push` was then run through the **PowerShell**
    tool, it succeeded, and the rule was reported as live. The rule was inert — the auto-mode
    classifier had approved the command on its own reading of intent. The force-push deny sitting
    beside it was equally inert, and a config believed to be blocking history rewrites was blocking
    nothing. Caught only by *deliberately triggering the deny* on an inert command and watching it
    fail to fire. **A success proves the command ran, never that your rule is why.**
22. **A phase reported as working while the entire flock was invisible.** Phase 3 was verified by
    porting the wingbeat maths to JavaScript, checking the envelope and the duty cycle, and running
    `typecheck` and 109 tests — all of which passed, and none of which can see inside a GLSL string.
    The shader had a redefined local and never linked. **The dev server had been piping the browser
    console into its own log the whole time**, where the error sat in plain text. Reported as done;
    Denise found it. **A green test suite is not evidence about a shader. Read the console.**
23. **Three separate GLSL-in-template-literal hazards, shipped over four commits.** A backtick in a
    comment killed the module; em dashes in comments sat in two already-committed lines and were
    rejectable by drivers other than this machine's; a redeclared local produced #22. Now swept
    mechanically — invariant 14.
24. **A pure module named to collide with its component on a case-insensitive filesystem.**
    `petals.ts` beside `Petals.tsx` resolves to one path on Windows and default macOS. `tsc` caught
    it, and the running dev server had already proved it by serving a stale `/src/three/Petals.ts`
    after the rename. Renamed to `flutter.ts`, following `flock.ts` in naming the effect rather than
    the component. **The convention was there to copy and was not.**
25. **`git rm` deletions swept into an unrelated commit by a bare `git commit`.** Five texture
    deletions landed inside the Instagram-handle fix. Caught by reading `git show --stat` after
    committing, unwound with `git reset --soft` while still local. **`git status` shows what changed;
    `git diff --cached --stat` shows what you are about to record.** Only the second one would have
    prevented this.
26. **A spec constant that was right in form and wrong by an order of magnitude.** `BANK_GAIN` at the
    spec's implied scale saturated its own clamp at essentially all times, turning a roll into a
    two-position snap. Nothing in the spec was self-contradictory — the number was simply never
    measured against the drift's real angular velocity. **The prototype these numbers came from is
    not in the repo; there is no way to check them except by measuring in situ.**
27. **A figure asserted from a formula rather than from its inputs.** Fold shading was described to
    Denise as darkening wings "up to ~38%", the range of `0.62 + 0.38·cos`. The beat only reaches
    ~1.05 rad, so the real figure is about **19%**. The formula was right; the claim about what it
    would look like was not, and it was made before anything rendered.

28. **A density generalised from one screenshot per candidate, in a system whose scatter is random
    every load.** `instanceAttributes` places instances with unseeded `Math.random()`, so a frame is
    one sample, not the look of a setting. Two frames were compared by eye and reported as "the
    radius cancels the count"; the real means differ by 2.2x, and the p10–p90 spread at the chosen
    setting is 4 to 10 instances — wide enough that the pairing that produced the claim is an
    ordinary draw. **Caught by noticing the shipped page looked denser than the comparison frame it
    was supposed to match**, then measuring instead of re-screenshotting. **A screenshot of a
    randomised system is evidence about one draw and nothing else** — the sibling of defect #12,
    where a readback was substituted for looking. Here looking *was* the problem.

## Open minor findings

Reviewed, judged non-blocking, deliberately not fixed.

- **~~`flock.ts:127`'s length guard also rejects arrays *longer* than 7, which the doc comment does
  not say.~~** Still true of `spansFrom`, but no longer undocumented — there is now a test asserting
  it, so the behaviour is deliberate rather than incidental.
- **`Butterflies.tsx`'s `useFrame` reads `document.documentElement.scrollHeight` every frame**, which
  forces layout, unconditionally. A deliberate tradeoff, commented in the code.
- **~~`flockAt`'s `span > 0` ternary is unreachable.~~ GONE with the gating rewrite** — `flockAt` no
  longer divides by a span length at all; every ramp is driven by the band half-width. The 2,000,000-
  and 500,000-trial fuzzes that proved it unreachable were about code that no longer exists. The
  equivalent guard now is `w > 0` in `flockAt`, and that one **is** reachable: coincident boundaries
  (a zero-length span between two others) produce it, and there is a test.
- **`GroundLayer` re-measures on a rAF after mount**, because child effects run before the parent's
  `buildTimeline`. Harmless — the page is at scroll 0 and hero's block is correct either way.
- **`w-rail` in `SideRail.tsx` has no `--width-rail` token behind it**, so Tailwind emits nothing and
  the rail is content-sized (roughly x 30–50). Band gutters were chosen to clear that measured
  extent, not the class.

## Housekeeping

`.claude/worktrees/gallery-ring-timeline/` is registered to no worktree (`git worktree list` shows
only the main checkout) but is **not empty** — six PNGs and a `.playwright-mcp` directory left by the
flock cycle. Safe to delete.

`.superpowers/` is git-ignored scratch and is expected to be deleted.
