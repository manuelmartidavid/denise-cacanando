import { Link, useParams } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import { resolvePiece } from '~/data'

const STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  sold: 'Sold',
  commission: 'Commission',
  showcase: 'Showcase',
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 09 · Detail pages — `/:category/:slug`. Real routes, not modals: linkable,
 * shareable, back-button correct.
 *
 * SCAFFOLD: the shared skeleton, metadata table and prev/next are real. Still
 * to come — the zoomable uncropped image (artwork), the orbitable ovoid with
 * its four angle thumbs (Ovalese), and the detail-crop strip (mural).
 */
export const DetailPage = () => {
  const { category, slug } = useParams()
  const resolved = resolvePiece(category, slug)

  if (!resolved) {
    return (
      <main className="grid h-screen place-items-center bg-ink text-cream">
        <div className="text-center">
          <p className="font-mono text-caption tracking-apparatus text-cream/45 uppercase">
            404 — no such piece
          </p>
          <Link to="/" className="mt-4 block font-display text-leaf hover:text-ochre-bright">
            Back to the ring
          </Link>
        </div>
      </main>
    )
  }

  const { piece, index, prev, next, category: cat } = resolved
  const isOvalese = cat.id === 'ovalese'

  return (
    <main
      className="min-h-screen bg-ink text-cream"
      style={{ paddingLeft: 72, paddingRight: 72, paddingTop: 104, paddingBottom: 96 }}
    >
      {/* Top bar */}
      <div className="mb-12 flex justify-between font-mono text-caption tracking-caption uppercase">
        <Link to="/" className="text-cream/60 hover:text-ochre-bright">
          ← Back to the ring · /{cat.path}/{piece.slug}
        </Link>
        <span className="text-cream/45">
          {pad(index + 1)} / {pad(cat.pieces.length)} — {cat.label}
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 420px', gap: 64 }}>
        {/* Left well */}
        <div>
          {isOvalese ? (
            <div
              className="grid aspect-[4/5] place-items-center"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 40%, #191411, #0a0908 68%)',
              }}
            >
              <p className="font-mono text-caption tracking-apparatus text-cream/35 uppercase">
                3D viewer — drag to orbit · scroll to zoom · double-tap resets
              </p>
            </div>
          ) : (
            <Placeholder
              label={piece.images[0]?.alt ?? piece.title}
              tone="dark"
              className="ph-lg aspect-[4/5] w-full bg-ink-deep"
            />
          )}
          {!isOvalese && (
            <p className="mt-3 font-mono text-caption-sm tracking-caption text-cream/40 uppercase">
              The ring crops to a circle; the page never does
            </p>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col">
          <p className="font-mono text-label tracking-apparatus text-ochre uppercase">
            {cat.label} — {piece.year}
          </p>
          <h1 className="mt-4 font-display text-leaf">{piece.title}</h1>

          <dl className="mt-10">
            {[
              ['Medium', piece.medium],
              ['Size', piece.size],
              [isOvalese ? 'Shots used' : 'Year', isOvalese ? '08 angles → 2K map' : String(piece.year)],
              ['Status', STATUS_LABEL[piece.status] ?? piece.status],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between border-t border-cream/12"
                style={{ padding: '11px 0' }}
              >
                <dt className="font-mono text-caption tracking-caption text-cream/45 uppercase">
                  {label}
                </dt>
                <dd
                  className={`font-mono text-caption tracking-caption uppercase ${
                    label === 'Status' && piece.status === 'available'
                      ? 'text-ochre-bright'
                      : 'text-cream'
                  }`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {/* COPY SLOT — DENISE TO WRITE. One paragraph per piece. */}
          <p className="mt-8 text-body-leaf text-cream/66">
            {piece.body ??
              'Placeholder paragraph standing in for Denise’s note on this piece — what it came from and what it was after.'}
          </p>

          <div className="mt-auto pt-12">
            <a
              href={`mailto:hello@denisecacanando.com?subject=${encodeURIComponent(`Enquiry — ${piece.title}`)}`}
              className="block w-full border border-ochre text-center font-mono text-label-btn tracking-apparatus-wide text-ochre uppercase transition-colors hover:bg-ochre hover:text-ink"
              style={{ padding: '15px 0' }}
            >
              Enquire about this piece
            </a>

            <div className="mt-5 flex justify-between font-mono text-caption tracking-caption uppercase">
              {prev ? (
                <Link to={`/${cat.path}/${prev.slug}`} className="text-cream/55 hover:text-ochre-bright">
                  ← {prev.title}
                </Link>
              ) : (
                <span className="text-cream/20">← Start of {cat.label}</span>
              )}
              {next ? (
                <Link to={`/${cat.path}/${next.slug}`} className="text-cream/55 hover:text-ochre-bright">
                  {next.title} →
                </Link>
              ) : (
                <span className="text-cream/20">End of {cat.label} →</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
