import { useEffect, useRef, type CSSProperties } from 'react'
import { activePieces, type GalleryScene } from '~/scroll/scenes'
import { chaptersOf, trackGutter, TRACK_GAP, TRACK_PITCH } from '~/lib/track'
import { onSceneFrame, scrollToPiece } from '~/scroll/timeline'
import { Dossier } from './Dossier'

type Props = {
  scene: GalleryScene
  activeIndex: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The Murals presentation — the deliberate pattern break.
 *
 * The ring unrolls: vertical scroll becomes an x-translate. Rotation arrives as
 * ONE CSS custom property per frame, --at, the fractional wall index. That
 * single value positions the row AND bends every plane (see Dossier), so there
 * is no per-dossier JavaScript and no second channel. React re-renders only when
 * activeIndex changes.
 */
export const Track = ({ scene, activeIndex }: Props) => {
  const row = useRef<HTMLDivElement>(null)
  const pieces = activePieces(scene)
  const count = pieces.length
  const chapters = chaptersOf(pieces)

  // The single DOM write this component owns. GSAP stays inside timeline.ts.
  useEffect(
    () =>
      onSceneFrame(scene.label, (at) => {
        row.current?.style.setProperty('--at', String(at))
      }),
    [scene.label],
  )

  if (count === 0) return null

  return (
    <>
      {/* The track. One transform on the row; the bends are CSS off --at. */}
      <div
        className="absolute right-0 left-0 flex items-center"
        style={{ top: 308, height: 430, perspective: '1600px' }}
      >
        <div
          ref={row}
          className="flex items-center"
          style={
            {
              '--at': 0,
              gap: TRACK_GAP,
              paddingInline: trackGutter(),
              transform: `translateX(calc(var(--at) * -${TRACK_PITCH}px))`,
            } as CSSProperties
          }
        >
          {pieces.map((piece, i) => (
            <Dossier
              key={piece.slug}
              piece={piece}
              index={i}
              count={count}
              active={i === activeIndex}
            />
          ))}
        </div>
      </div>

      {/* Why this scene looks different from the other three. */}
      <p
        className="absolute z-10 text-right font-mono text-caption-sm tracking-rail text-cream/42"
        style={{ right: 72, top: 250, width: 280 }}
      >
        No full-width photo exists for these walls,
        <br />
        so a wall is presented as context + detail
        <br />
        rather than faked as one panorama
      </p>

      {/* Chapters. The active one is derived from the active wall, never stored. */}
      <div
        className="absolute z-10 flex gap-[30px] font-mono text-caption tracking-caption-wide uppercase"
        style={{ left: 118, top: 770 }}
      >
        {chapters.map((chapter) => {
          const on =
            activeIndex >= chapter.firstIndex && activeIndex < chapter.firstIndex + chapter.count
          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => scrollToPiece(scene.label, chapter.firstIndex, count)}
              aria-label={`Jump to ${chapter.label}`}
              className={`uppercase ${on ? 'text-ochre' : 'text-cream/35'}`}
            >
              {chapter.label} — {pad(chapter.count)} walls {on ? '●' : ''}
            </button>
          )
        })}
        <span className="text-cream/25">Two chapters, scrubbed in sequence</span>
      </div>
    </>
  )
}
