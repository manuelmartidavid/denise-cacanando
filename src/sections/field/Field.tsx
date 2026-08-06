import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import { categoryById } from '~/data'
import { layoutField, metricsFor, panBounds } from '~/lib/field'
import { activePieces, type GalleryScene } from '~/scroll/scenes'
import { onSceneFrame, scrollToPiece } from '~/scroll/timeline'
import { clearAvoidRects, publishAvoidRects } from '~/three/avoid'

type Props = { scene: GalleryScene; activeIndex: number }

/** Viewport, as state, so the layout can be recomputed when it changes. */
const useViewport = () => {
  const [size, setSize] = useState(() => ({
    w: typeof window === 'undefined' ? 1440 : window.innerWidth,
    h: typeof window === 'undefined' ? 900 : window.innerHeight,
  }))
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

/**
 * 03 · Artworks — the floating field.
 *
 * Replaces the rotating dial. The ring was the site's signature and three of the
 * four gallery scenes were running it, which made the gallery read as one idea
 * repeated; this scene is a scatter panned horizontally, and Ovalese keeps the
 * ring as the one place it belongs.
 *
 * Pan arrives as ONE CSS custom property per frame — `--at`, the fractional
 * piece index published by `fractionalIndexAt`. The strip translates off it in
 * CSS, so nothing here runs per frame and React re-renders only when
 * `activeIndex` or the viewport changes.
 *
 * The pan is bounded rather than centred: `panBounds` solves for a start and a
 * step that put the leftmost piece just inside the left edge at the beginning
 * and the rightmost just inside the right edge at the end. Centring the focused
 * piece instead — the obvious mapping — leaves half a frame of empty paper at
 * both ends of the scene.
 */
export const Field = ({ scene, activeIndex }: Props) => {
  const strip = useRef<HTMLDivElement>(null)
  const category = categoryById(scene.category)!
  const pieces = activePieces(scene)
  const { w, h } = useViewport()

  const { laid, pan } = useMemo(() => {
    const items = layoutField(pieces, metricsFor(w, h))
    return { laid: items, pan: panBounds(items, w) }
  }, [pieces, w, h])

  useEffect(() => {
    const off = onSceneFrame(scene.label, (at) => {
      strip.current?.style.setProperty('--at', String(at))
      // Hand the petals the rectangles they have to get out of the way of.
      // Measured from layout rather than recomputed here: the petals need where
      // the pieces ACTUALLY are once the pan has been applied, and only the DOM
      // knows that.
      publishAvoidRects(strip.current)
    })
    // Without this the last frame's rectangles outlive the scene, and petals
    // keep flowing around paintings that are no longer anywhere on screen.
    return () => {
      off()
      clearAvoidRects()
    }
  }, [scene.label])

  return (
    <div
      ref={strip}
      className="absolute inset-0 overflow-hidden"
      // zIndex 0 is load-bearing: it makes the strip its own stacking context,
      // so the per-piece z-indexes below resolve INSIDE it rather than against
      // the section. Without it a near piece at z-index 132 beat the title
      // block's z-10 and the scene title read through a painting.
      style={
        {
          '--at': 0,
          '--start': pan.start,
          '--step': pan.step,
          zIndex: 0,
        } as CSSProperties
      }
    >
      {laid.map((item) => (
        <Link
          key={item.piece.slug}
          to={`/${category.path}/${item.piece.slug}`}
          aria-label={`Open ${item.piece.title}`}
          onFocus={() => scrollToPiece(scene.label, item.index, pieces.length)}
          data-field-piece=""
          className="field-piece absolute top-1/2 left-0 block"
          style={
            {
              width: Math.round(item.width),
              height: Math.round(item.height),
              // The LINK owns the pan and nothing else. One uniform translation
              // for the whole strip, times this piece's own parallax factor —
              // uniform-plus-small-deviation rather than a straight per-piece
              // multiplier, which is what lets `panBounds` close the ends
              // exactly. Rotation lives on the plate inside, so the hover
              // transition is not fighting a transform rewritten every frame.
              transform:
                'translate(-50%, -50%)' +
                ` translateX(calc(${Math.round(item.x)}px + (var(--start) + var(--step) * var(--at)) * 1px * ${item.parallax.toFixed(4)}))` +
                ` translateY(${Math.round(item.y)}px)`,
              // Nearer pieces sit in front of further ones. Scoped to the
              // strip's stacking context, so no value here can reach the
              // furniture — see zIndex 0 on the strip.
              zIndex: Math.round(item.depth * 100),
            } as CSSProperties
          }
        >
          <div
            className="field-plate size-full"
            style={
              {
                '--yaw': `${item.yaw.toFixed(2)}deg`,
                '--roll': `${item.roll.toFixed(2)}deg`,
                // A custom property rather than `opacity` directly: the hover
                // rule has to be able to take it back to 1, and an inline
                // opacity would outrank the stylesheet.
                '--plate-opacity': item.index === activeIndex ? 1 : 0.88,
              } as CSSProperties
            }
          >
            <Placeholder
              label={item.piece.images[0]?.alt ?? item.piece.title}
              tone="cream"
              className="size-full border border-ink/15"
            />
          </div>
        </Link>
      ))}
    </div>
  )
}
