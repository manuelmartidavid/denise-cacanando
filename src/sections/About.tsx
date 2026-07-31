import { Placeholder } from '~/components/Placeholder'
import { artworks, merch, murals, ovalese } from '~/data'

/** Counts come from the data, never from a hardcoded string. */
const STATS = [
  { n: String(artworks.length + ovalese.length + murals.length + merch.length), label: 'Pieces shown' },
  { n: String(ovalese.length).padStart(2, '0'), label: 'Ostrich eggs' },
  { n: String(murals.length).padStart(2, '0'), label: 'Walls painted' },
  { n: '2015', label: 'First show' },
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
    className="relative flex h-screen w-full items-center overflow-clip text-ink"
    style={{ paddingLeft: 118, paddingRight: 72 }}
  >
    <div className="grid w-full items-stretch" style={{ gridTemplateColumns: '1fr 440px', gap: 78, padding: '80px 0' }}>
      <div className="flex flex-col justify-between">
        <div className="flex justify-between font-mono text-caption tracking-apparatus text-ink/55 uppercase">
          <span>About — 02 / 04</span>
          <span>B. 1994, Manila</span>
        </div>

        <div>
          <h2 className="font-display text-about">
            I paint the hour
            <br />
            before something
            <br />
            <em className="italic">closes.</em>
          </h2>

          {/* COPY SLOT — DENISE TO WRITE. Two paragraphs. */}
          <div
            className="mt-10 grid text-body text-ink/72"
            style={{ gridTemplateColumns: '1fr 1fr', gap: 34, maxWidth: 720 }}
          >
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

        <div className="border-t border-ink/25 pt-6">
          <dl className="flex" style={{ gap: 52 }}>
            {STATS.map((s) => (
              <div key={s.label}>
                <dd className="font-display text-stat">{s.n}</dd>
                <dt className="mt-1 font-mono text-caption-sm tracking-stat text-ink/55 uppercase">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="flex flex-col">
        <Placeholder
          label="Portrait of Denise — vertical crop"
          tone="cream"
          className="flex-1 border border-ink/12"
        />
        <div className="mt-3 flex justify-between font-mono text-caption-sm tracking-caption text-ink/50 uppercase">
          <span>Fig. 02</span>
          <span>Parallax 0.9×</span>
        </div>
      </div>
    </div>
  </section>
)
