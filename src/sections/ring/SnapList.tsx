import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import { categoryById } from '~/data'
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

  useEffect(() => {
    const el = list.current
    if (!el) return
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0
      let bestDistance = Infinity
      items.current.forEach((item, i) => {
        if (!item) return
        const centre = item.offsetLeft + item.clientWidth / 2
        const d = Math.abs(centre - mid)
        if (d < bestDistance) {
          bestDistance = d
          best = i
        }
      })
      setActiveIndex(scene.category, best)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scene.category])

  return (
    <div
      ref={list}
      className="absolute right-0 left-0 flex snap-x snap-mandatory gap-[18px] overflow-x-auto pl-6"
      style={{ top: '50%', transform: 'translateY(-50%)', scrollbarWidth: 'none' }}
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
          style={{ width: 250, height: 330 }}
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
