import { useEffect, useRef, type CSSProperties } from 'react'
import { Placeholder } from '~/components/Placeholder'
import { categoryById } from '~/data'
import { orbitSeats, seatContent, seatStep } from '~/lib/ring'
import type { SeamRole } from '~/scroll/seed'
import { activePieces, type GalleryScene } from '~/scroll/scenes'
import { useScrollState } from '~/scroll/store'
import { onSceneFrame, scrollToPiece } from '~/scroll/timeline'
import { CentreSlot } from './CentreSlot'
import { RING_LOOK, SHAPE_CLASS } from './look'

type Props = {
  scene: GalleryScene
  activeIndex: number
  /**
   * Which side of the collapse-to-seed seam this ring is on, if any.
   * Undefined — the default, and what `g4` gets — means the ring behaves
   * exactly as it did before the transition existed.
   */
  seam?: SeamRole
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
export const Dial = ({ scene, activeIndex, seam }: Props) => {
  const ring = useRef<HTMLDivElement>(null)
  const category = categoryById(scene.category)!
  const look = RING_LOOK[scene.category]
  // Indices address THIS list — a filtered merch ring is five jackets, not the
  // first five products in the category.
  const pieces = activePieces(scene)
  const count = pieces.length
  const onCream = scene.ground === 'cream'
  const shape = SHAPE_CLASS[look.slot]

  // Discrete channel, same one `ScrollPage` reads for `ground`: publishes only
  // when the rounded active label changes, never per frame — this must NOT be
  // driven from --seam or any other per-frame value (invariant 1).
  const { label: activeLabel } = useScrollState()
  // Once collapsed, this ring is only reachable by keyboard until something
  // takes it out of tab order — opacity alone does not do that. True once this
  // Dial has let go of the seam (its own label is no longer the active one) and
  // is on the outgoing side, so it never applies to `g4` or to `g2` while it is
  // still opening.
  //
  // Residual window, not fully closed: the ring visually finishes collapsing
  // (--seam reaches +1) at the band's exit edge, which sits before g2's pin
  // actually starts — so there is a real stretch of scroll where `activeLabel`
  // is still this scene's own label but the ring is already a point. The ring
  // stays tabbable for that stretch. Closing it needs its own signal (e.g. the
  // seam's own edge) and is left for a follow-up rather than smuggled in here.
  const collapsedAway = seam === 'out' && activeLabel !== scene.label

  // The single DOM write this component owns. GSAP stays inside timeline.ts.
  useEffect(
    () =>
      onSceneFrame(scene.label, (degrees) => {
        ring.current?.style.setProperty('--r', `${degrees}deg`)
      }),
    [scene.label],
  )

  const seats = seatContent(activeIndex, scene.seats, count)

  /**
   * How contracted this ring is, 0..1, derived from the one signed scalar.
   *
   * `out` opens at seam -1 and is a point from 0 onward; `in` is a point until
   * 0 and opens by +1. Deriving both from the sign is what stops the outgoing
   * ring blooming open again as it scrolls off the top.
   *
   * The fallbacks matter: with no --seam written yet, `out` reads -1 (open) and
   * `in` reads +1 (open), so a ring is never stuck collapsed.
   */
  const collapse =
    seam === 'out'
      ? 'clamp(0, calc(1 + var(--seam, -1)), 1)'
      : seam === 'in'
        ? 'clamp(0, calc(1 - var(--seam, 1)), 1)'
        : '0'

  /**
   * Radius, in this wrapper's own untransformed px, that comfortably contains
   * everything drawn inside it at rest: the guide circle and the thumbs at the
   * far edge of the orbit, whichever reaches further. The wrapper itself has no
   * intrinsic size — every child is absolutely positioned and centred on it via
   * its own `translate(-50%, -50%)` — so a percentage-based clip radius would
   * resolve against a 0×0 box and clip everything away immediately. A pixel
   * radius sidesteps that, and sizing it off the actual furniture (rather than
   * a guessed constant) is what keeps `circle(...)` from cropping the thumbs at
   * `--collapse: 0` on every ring shape this component renders, not just the
   * seam ones.
   */
  const ringExtent = Math.max(scene.guide / 2, scene.orbit + Math.max(look.thumbW, look.thumbH) / 2)

  return (
    <div
      className="absolute"
      inert={collapsedAway}
      style={
        {
          left: '62%',
          top: '52%',
          '--collapse': collapse,
          // Contracts toward the seed's own size. Everything inside — guides,
          // thumbs, centre slot — rides this one transform.
          transform: 'scale(calc(1 - 0.96 * var(--collapse)))',
          opacity: 'calc(1 - var(--collapse))',
          // Pointer events, per-frame and CSS-only: the transform above already
          // shrinks the ring toward a point, but at `--collapse: 1` it lands on
          // `scale(0.04)`, not `scale(0)` — a tiny but genuinely hit-testable
          // disc, and CSS opacity never disables pointer-events on its own. This
          // shrinks the clip region in lockstep and reaches exactly 0 at full
          // collapse, so the collapsed-away area stops hit-testing rather than
          // merely becoming very small. See `ringExtent` above for why this is a
          // px radius, not a percentage.
          clipPath: `circle(calc(${ringExtent}px * (1 - var(--collapse))))`,
        } as CSSProperties
      }
    >
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
            // The seats actually on the orbit, not the declared count — a
            // filtered ring is a ring, not a 240° arc. Must match the step the
            // timeline rotates by.
            '--step': `${seatStep(orbitSeats(scene.seats, count))}deg`,
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
