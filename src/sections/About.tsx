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
            {/*
              The explicit spaces are load-bearing. JSX drops the whitespace
              around a line-broken element, so once these <br>s are display:none
              at mobile the words butt together — "hourbefore somethingcloses".
            */}
            I paint the hour{' '}
            <br className="hidden sm:inline" />
            before something{' '}
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
        {/*
          The portrait is the one block that yields on a short phone. At 360x640
          the five blocks need 763px against the 578px the ticker leaves, and the
          portrait plus its margin is 270px of that — dropping it brings the
          section to 493px and keeps every word of copy and all three stats.
          The query carries `max-width: 639px` so a short *desktop* window, where
          the portrait is a flex-1 column and costs nothing, is untouched.
        */}
        <Placeholder
          label="Portrait of Denise — vertical crop"
          tone="cream"
          className="order-3 mt-5 h-[250px] border border-ink/12 [@media(max-height:700px)_and_(max-width:639px)]:hidden sm:order-none sm:mt-0 sm:h-auto sm:flex-1"
        />
        <div className="order-6 mt-3 hidden justify-between font-mono text-caption-sm tracking-caption text-ink/50 uppercase sm:order-none sm:flex">
          <span>Fig. 02</span>
          <span>Parallax 0.9×</span>
        </div>
      </div>
    </div>
  </section>
)
