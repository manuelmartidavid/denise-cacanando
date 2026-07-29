import { useEffect, useRef, type CSSProperties } from 'react'
import { Placeholder } from '~/components/Placeholder'
import { categoryById } from '~/data'
import { seatContent, seatStep } from '~/lib/ring'
import { activePieces, type GalleryScene } from '~/scroll/scenes'
import { onSceneRotation, scrollToPiece } from '~/scroll/timeline'
import { CentreSlot } from './CentreSlot'
import { RING_LOOK, SHAPE_CLASS } from './look'

type Props = {
  scene: GalleryScene
  activeIndex: number
}

/**
 * The pinned rotating presentation.
 *
 * Rotation arrives as ONE CSS custom property per frame: the ring turns on --r
 * and every seat counter-rotates off its own placement angle plus that same
 * value, so crops stay upright while the compositor does the work. React
 * re-renders only when activeIndex changes — roughly 24 times across a 320vh
 * pin, never 60 times a second.
 */
export const Dial = ({ scene, activeIndex }: Props) => {
  const ring = useRef<HTMLDivElement>(null)
  const category = categoryById(scene.category)!
  const look = RING_LOOK[scene.category]
  // Indices address THIS list — a filtered merch ring is five jackets, not the
  // first five products in the category.
  const pieces = activePieces(scene)
  const count = pieces.length
  const onCream = scene.ground === 'cream'
  const shape = SHAPE_CLASS[look.slot]

  // The single DOM write this component owns. GSAP stays inside timeline.ts.
  useEffect(
    () =>
      onSceneRotation(scene.label, (rotation) => {
        ring.current?.style.setProperty('--r', `${rotation}deg`)
      }),
    [scene.label],
  )

  const seats = seatContent(activeIndex, scene.seats, count)

  return (
    <div className="absolute" style={{ left: '62%', top: '52%' }}>
      {/* Guide circles — presentation chrome, not interactive. Cream ground
          (Merchandise) needs ink, not cream-at-low-alpha, to read at all —
          border-ink/25 is the same cream-ground hairline weight the section
          furniture (progress track, About/Contact dividers) already uses. */}
      <div
        className={`absolute rounded-full border ${onCream ? 'border-ink/25' : 'border-cream/10'}`}
        style={{ width: scene.guide, height: scene.guide, transform: 'translate(-50%, -50%)' }}
      />
      <div
        className={`absolute rounded-full border border-dashed ${onCream ? 'border-ink/25' : 'border-cream/12'}`}
        style={{ width: 460, height: 460, transform: 'translate(-50%, -50%)' }}
      />

      <div
        ref={ring}
        className="absolute"
        style={
          {
            '--r': '0deg',
            '--step': `${seatStep(scene.seats)}deg`,
            '--orbit': `${scene.orbit}px`,
            transform: 'rotate(var(--r))',
          } as CSSProperties
        }
      >
        {seats.map((pieceIndex, i) => {
          const piece = pieces[pieceIndex]
          if (!piece) return null
          return (
            <button
              key={i}
              type="button"
              onClick={() => scrollToPiece(scene.label, pieceIndex, count)}
              aria-label={`Bring ${piece.title} to centre`}
              className={`absolute overflow-hidden border ${onCream ? 'border-ink/25' : 'border-cream/14'} ${shape}`}
              style={
                {
                  '--i': i,
                  width: look.thumbW,
                  height: look.thumbH,
                  transform:
                    'translate(-50%, -50%) rotate(calc(var(--i) * var(--step)))' +
                    ' translate(0, calc(-1 * var(--orbit)))' +
                    ' rotate(calc(-1 * var(--i) * var(--step) - var(--r)))',
                } as CSSProperties
              }
            >
              <Placeholder
                label={piece.images[0]?.alt ?? piece.title}
                tone={onCream ? 'cream' : 'dim'}
                className={`size-full ${shape}`}
              />
            </button>
          )
        })}
      </div>

      <CentreSlot category={category} piece={pieces[activeIndex]} onCream={onCream} />
    </div>
  )
}
