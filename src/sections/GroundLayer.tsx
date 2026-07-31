import { useEffect, useState } from 'react'
import { LABELS, sceneByLabel, type Label } from '~/scroll/scenes'
import { onTimelineRefresh } from '~/scroll/timeline'

/**
 * Every section's ground colour, painted in document space *behind* the r3f
 * canvas.
 *
 * README §182 wants "one fixed full-viewport canvas behind the DOM", and §183
 * has pollen at "half density over cream grounds" — both of which require the
 * ground to sit under the canvas and the content over it. It did not: each
 * section painted its own opaque `bg-ink` / `bg-cream` inside `<main>` at
 * `z-10`, so the canvas at `z-0` was covered everywhere and nothing on it —
 * pollen included — had ever reached a visitor.
 *
 * The obvious fix, one fixed full-screen ground driven by the active label,
 * is wrong at the ink/cream boundaries: the label flips only once the incoming
 * section reaches the top of the viewport, so Merchandise's cream content would
 * spend a whole viewport of scrolling on Murals' ink. Instead each ground is a
 * block in document space spanning exactly the scroll range its section owns,
 * so the boundary slides past exactly as an opaque section background did.
 *
 * Those ranges are measured, never derived: a pinned scene's range is its
 * pin-spacer, which is the section plus the pin distance, and the blocks tile
 * the document end to end.
 */

/** The one ground that is not a flat token. Hero, README §100. */
const HERO_GROUND = 'radial-gradient(ellipse at 10% 90%, #191411, #0d0c0a 58%)'

const CREAM = 'var(--color-cream)'
const INK = 'var(--color-ink)'

/**
 * Gallery grounds are read from the scene declarations rather than restated —
 * `ground` is already part of how a scene declares itself (invariant 4's rule
 * for counts applies to this just as much). Only the three non-gallery
 * sections declare theirs here.
 */
const groundFor = (label: Label): string => {
  const scene = sceneByLabel(label)
  if (scene) return scene.ground === 'cream' ? CREAM : INK
  if (label === 'hero') return HERO_GROUND
  return label === 'about' ? CREAM : INK
}

type Block = { label: Label; top: number; height: number; ground: string }

/**
 * A section's scroll range. For a pinned scene that is the pin-spacer GSAP
 * wraps it in — the section's own 100vh box stays one viewport tall no matter
 * how long the scene runs, so measuring the section alone would leave the
 * ground short by the whole pin distance.
 */
const measure = (): Block[] => {
  const blocks: Block[] = []
  for (const label of LABELS) {
    const el = document.getElementById(label)
    if (!el) continue
    const box = el.closest('.pin-spacer') ?? el
    const rect = box.getBoundingClientRect()
    blocks.push({
      label,
      top: Math.round(rect.top + window.scrollY),
      height: Math.round(rect.height),
      ground: groundFor(label),
    })
  }
  return blocks
}

export const GroundLayer = () => {
  const [blocks, setBlocks] = useState<Block[]>([])

  useEffect(() => {
    const remeasure = () => setBlocks(measure())

    // Three moments, because the pins do not exist for the first two. Child
    // effects run before the parent's, so this mounts before ScrollPage builds
    // the timeline: the rAF catches the pins once created, and the refresh
    // subscription catches every later change — fonts settling, a resize, a
    // merch chip re-blooming the ring.
    remeasure()
    const raf = requestAnimationFrame(remeasure)
    const off = onTimelineRefresh(remeasure)

    return () => {
      cancelAnimationFrame(raf)
      off()
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-0" aria-hidden="true">
      {blocks.map((b) => (
        <div
          key={b.label}
          className="absolute inset-x-0"
          style={{ top: b.top, height: b.height, background: b.ground }}
        />
      ))}
    </div>
  )
}
