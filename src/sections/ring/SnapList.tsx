import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import { categoryById } from '~/data'
import { nearestIndex, SNAP_ITEM_WIDTH, snapListGutter } from '~/lib/snapList'
import { activePieces, type GalleryScene } from '~/scroll/scenes'
import { setActiveIndex } from '~/scroll/store'

type Props = {
  scene: GalleryScene
  activeIndex: number
}

/**
 * The pin-free presentation: reduced motion, and anything under 900px.
 *
 * No rotation, no pin, no GSAP. Native scroll-snap does the settling, and the
 * nearest item publishes the same activeIndex the dial would — the caption,
 * progress row and routes are identical either way.
 */
export const SnapList = ({ scene, activeIndex }: Props) => {
  const list = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLAnchorElement | null)[]>([])
  const category = categoryById(scene.category)!
  const onCream = scene.ground === 'cream'
  // The filtered list, not a slice of the full category — see activePieces.
  const pieces = activePieces(scene)

  // True while a programmatic scrollIntoView (below) is settling, so its own
  // scroll events don't race the geometry back into setActiveIndex before it
  // lands — an instant jump still dispatches asynchronously, and fighting it
  // mid-flight would publish a transient, wrong index.
  const suppressScroll = useRef(false)

  useEffect(() => {
    const el = list.current
    if (!el) return
    const onScroll = () => {
      if (suppressScroll.current) return
      const mid = el.scrollLeft + el.clientWidth / 2
      const centres = items.current.map((item) =>
        item ? item.offsetLeft + item.clientWidth / 2 : Infinity,
      )
      setActiveIndex(scene.category, nearestIndex(mid, centres))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scene.category])

  // The store is module-level and outlives this mount: on first mount, a
  // route return, or a breakpoint flip into this presentation, activeIndex
  // may already be non-zero while scrollLeft is still 0. Bring the stored
  // index into view once so the caption, progress row and highlighted card
  // agree with what's on screen. Guarded so StrictMode's double-invoke can't
  // re-fire it, and it captures the index at mount rather than depending on
  // the prop, since it must run exactly once regardless of later scrolling.
  const restored = useRef(false)
  const initialIndex = useRef(activeIndex)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const el = items.current[initialIndex.current]
    if (!el) return
    suppressScroll.current = true
    el.scrollIntoView({ block: 'nearest', inline: 'center' })
    const id = requestAnimationFrame(() => {
      suppressScroll.current = false
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      ref={list}
      className="absolute right-0 left-0 flex snap-x snap-mandatory gap-[18px] overflow-x-auto"
      style={{
        top: '50%',
        transform: 'translateY(-50%)',
        paddingInline: snapListGutter(),
      }}
    >
      {pieces.map((piece, i) => (
        <Link
          key={piece.slug}
          ref={(el) => {
            items.current[i] = el
          }}
          to={`/${category.path}/${piece.slug}`}
          className={`shrink-0 snap-center overflow-hidden border transition-opacity ${
            i === activeIndex
              ? 'border-ochre/55 opacity-100 shadow-glow'
              : `opacity-55 ${onCream ? 'border-ink/25' : 'border-cream/14'}`
          }`}
          style={{ width: SNAP_ITEM_WIDTH, height: 330 }}
        >
          <Placeholder
            label={piece.images[0]?.alt ?? piece.title}
            tone={onCream ? 'cream' : i === activeIndex ? 'focus' : 'dim'}
            className="size-full"
          />
        </Link>
      ))}
    </div>
  )
}
