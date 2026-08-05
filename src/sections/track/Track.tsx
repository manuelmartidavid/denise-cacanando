import { useEffect, useRef, type CSSProperties, type FocusEvent } from 'react'
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

  /**
   * Tabbing to an off-screen wall brings it to centre; clicking one must not,
   * or the centring fights the click's own navigation.
   *
   * `:focus-visible` is precisely that distinction — it matches the focus the
   * browser would draw a ring for, which for a link means keyboard traversal
   * and not a mouse click. Asking the element is stateless, which is the point:
   * tracking it with a pointerdown flag means any click that focuses nothing
   * (the row's gutter, the gap between cards, a cancelled drag) leaves the flag
   * set, and the next genuine Tab focus is then mistaken for a click and
   * silently skipped.
   */
  const focusWall = (index: number, event: FocusEvent<HTMLAnchorElement>) => {
    if (!event.target.matches(':focus-visible')) return
    scrollToPiece(scene.label, index, count)
  }

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
              transformStyle: 'preserve-3d',
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
              onFocus={(event) => focusWall(i, event)}
            />
          ))}
        </div>
      </div>

      {/* Why this scene looks different from the other three. */}
      {/* <p
        className="absolute z-10 text-right font-mono text-caption-sm tracking-rail text-cream/42 uppercase"
        style={{ right: 72, top: 250, width: 280 }}
      >
        No full-width photo exists for these walls,
        <br />
        so a wall is presented as context + detail
        <br />
        rather than faked as one panorama
      </p> */}

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
      </div>
    </>
  )
}
