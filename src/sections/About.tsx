import { Placeholder } from '~/components/Placeholder'
import { artworks, merch, murals, ovalese } from '~/data'

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

/**
 * 02 · About — 100vh, cream ground. The first palette flip.
 *
 * SCAFFOLD: layout grid and stats are wired. Still to come — per-line text
 * reveal (SplitText or per-line clip), portrait parallax 0.9×, and the two
 * ochre/sage diamonds drifting across the cream.
 */
// Ground is painted by GroundLayer, behind the canvas — see that file.
export const About = () => (
  <section
    id="about"
    className="relative flex h-screen w-full items-start overflow-clip px-6 text-ink sm:px-0 sm:pl-16 sm:pr-10 lg:items-center lg:pl-20 lg:pr-12 xl:pl-[118px] xl:pr-[72px]"
  >
    {/*
      One column until `lg`, in mocked order: label → headline → portrait →
      copy → stats. The portrait lives in the second grid column on desktop, so
      below lg the two wrappers become `display: contents` and their children
      reorder as direct flex items. At lg every wrapper takes its box back and
      the layout is exactly the desktop one — which is why this does not
      disturb 1440.

      The split is at `lg` (1024) and NOT at `sm`, because the desktop grid's
      440px portrait track is rigid: the 1fr copy column collapses to
      min-content and the portrait lands at x 537-977 no matter how narrow the
      viewport is. That overflowed at every width from 640 to 1023 — measured
      identically at 640, 768 and 900.

      Three tiers, then: one column below lg; the two-column composition from lg
      with a 320px portrait, a single copy column and the 56px headline, because
      1024 fits the grid but not the full desktop type; and today's exact
      geometry — 440px track, 78px gap, 118/72 gutters, two copy columns, 74px
      headline — from xl. 1280 and 1440 are therefore untouched.
    */}
    <div className="flex w-full flex-col pt-[74px] pb-[86px] sm:pt-20 sm:pb-20 lg:grid lg:items-stretch lg:gap-[48px] lg:py-20 lg:[grid-template-columns:1fr_320px] xl:gap-[78px] xl:[grid-template-columns:1fr_440px]">
      <div className="contents lg:flex lg:flex-col lg:justify-between">
        <div className="order-1 flex justify-between font-mono text-caption tracking-apparatus text-ink/55 uppercase lg:order-none">
          <span>About — 02 / 04</span>
          <span className="hidden sm:inline">B. 1994, Manila</span>
        </div>

        <div className="contents lg:block">
          <h2 className="order-2 mt-5 font-display text-about-m sm:text-about-t lg:order-none lg:mt-0 xl:text-about">
            {/*
              The explicit spaces are load-bearing. JSX drops the whitespace
              around a line-broken element, so once these <br>s are display:none
              the words butt together — "hourbefore somethingcloses".
            */}
            I paint the hour{' '}
            <br className="hidden lg:inline" />
            before something{' '}
            <br className="hidden lg:inline" />
            <em className="italic">closes.</em>
          </h2>

          {/* COPY SLOT — DENISE TO WRITE. Two paragraphs. */}
          <div className="order-4 mt-5 grid max-w-[720px] grid-cols-1 gap-[22px] text-body-m text-ink/72 sm:mt-8 sm:text-body lg:order-none lg:mt-10 xl:grid-cols-2 xl:gap-[34px]">
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

        <div className="order-5 mt-5 border-t border-ink/25 pt-4 sm:mt-8 lg:order-none lg:mt-0 lg:pt-6">
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

      <div className="contents lg:flex lg:flex-col">
        {/*
          The portrait is the block that yields whenever the column is short of
          room, because copy and stats are the section's reason to exist.

          Below `lg` it is in the flow and costs its full height, so it takes it
          from the viewport: `min(320px, 30vh)` shrinks it on short windows
          instead of pushing the stats past the clip. Below 700px of height it
          goes entirely — at 360x640 the five blocks want 763px against the
          578px the ticker leaves, and dropping it recovers 270px.

          The hide is capped at `max-width: 1023px` so it only ever applies while
          the portrait is in the flow. From lg it is a `flex-1` column beside the
          copy, costs nothing vertically, and is always shown.
        */}
        <Placeholder
          label="Portrait of Denise — vertical crop"
          tone="cream"
          className="order-3 mt-5 h-[250px] border border-ink/12 [@media(max-height:700px)_and_(max-width:1023px)]:hidden sm:mt-8 sm:h-[min(320px,30vh)] lg:order-none lg:mt-0 lg:h-auto lg:flex-1"
        />
        {/* Belongs to the portrait column, so it waits for that column to exist. */}
        <div className="order-6 mt-3 hidden justify-between font-mono text-caption-sm tracking-caption text-ink/50 uppercase lg:order-none lg:flex">
          <span>Fig. 02</span>
          <span>Parallax 0.9×</span>
        </div>
      </div>
    </div>
  </section>
)
