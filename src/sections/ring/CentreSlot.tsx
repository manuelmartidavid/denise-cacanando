import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '~/components/Placeholder'
import type { Category, Piece } from '~/data'
import { RING_LOOK, SHAPE_CLASS } from './look'

const CROSSFADE_MS = 380

type Props = {
  category: Category
  piece: Piece | undefined
  onCream: boolean
}

/**
 * RIPPLE SEAM — the whole of the piece-arrival transition lives in this one
 * component. Today it is a DOM cross-fade; when real textures land, the r3f
 * displacement shader replaces the two stacked layers and nothing else in the
 * ring moves. Do not spread transition logic outward from here.
 */
export const CentreSlot = ({ category, piece, onCream }: Props) => {
  const look = RING_LOOK[category.id]
  const [outgoing, setOutgoing] = useState<Piece | null>(null)
  const last = useRef<Piece | undefined>(piece)

  useEffect(() => {
    if (!piece || last.current?.slug === piece.slug) return
    setOutgoing(last.current ?? null)
    last.current = piece
    const t = setTimeout(() => setOutgoing(null), CROSSFADE_MS)
    return () => clearTimeout(t)
  }, [piece])

  if (!piece) return null

  const shape = SHAPE_CLASS[look.slot]
  const box = { width: look.slotW, height: look.slotH }

  return (
    <>
      <Link
        to={`/${category.path}/${piece.slug}`}
        aria-label={`Open ${piece.title}`}
        className={`absolute block overflow-hidden border border-ochre/45 shadow-glow-strong ${shape}`}
        style={{ ...box, transform: 'translate(-50%, -50%)' }}
      >
        <Placeholder
          label={piece.images[0]?.alt ?? piece.title}
          tone={onCream ? 'cream' : 'focus'}
          className={`size-full ${shape}`}
        />
        {outgoing && (
          <Placeholder
            key={outgoing.slug}
            label={outgoing.images[0]?.alt ?? outgoing.title}
            tone={onCream ? 'cream' : 'focus'}
            className={`fade-out absolute inset-0 ${shape}`}
          />
        )}
      </Link>

      <div
        className={`absolute w-[320px] text-center font-mono text-caption tracking-caption uppercase ${
          onCream ? 'text-ink/62' : 'text-cream/55'
        }`}
        style={{ transform: 'translate(-50%, -50%) translate(0, 196px)' }}
      >
        <p>
          “{piece.title}” · {piece.medium}
        </p>
        <p>
          {piece.size} · {piece.year} — Enquire
        </p>
      </div>
    </>
  )
}
