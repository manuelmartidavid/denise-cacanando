import { useEffect, useMemo } from 'react'
import { Hero } from '~/sections/Hero'
import { About } from '~/sections/About'
import { GalleryScene } from '~/sections/GalleryScene'
import { Contact } from '~/sections/Contact'
import { SideRail } from '~/components/SideRail'
import { Stage } from '~/three/Stage'
import { GALLERY_SCENES, type GalleryLabel } from '~/scroll/scenes'
import { resolvePresentation, type Rendered } from '~/scroll/presentation'
import { useCompactLayout, useReducedMotion } from '~/scroll/useReducedMotion'
import { useLenis, getLenis } from '~/scroll/useLenis'
import { buildTimeline, killTimeline, refreshAfterFonts } from '~/scroll/timeline'
import { useScrollState } from '~/scroll/store'

const KEY = 'ovalese:scroll'

/**
 * The single-page scroll site. Detail pages are separate routes, so this
 * unmounts when one opens — including the r3f canvas and every ScrollTrigger.
 */
export const ScrollPage = () => {
  const { label } = useScrollState()
  const reduced = useReducedMotion()
  const compact = useCompactLayout()
  useLenis()

  const resolved = useMemo(
    () =>
      Object.fromEntries(
        GALLERY_SCENES.map((s) => [s.label, resolvePresentation(s.presentation, reduced, compact)]),
      ) as Record<GalleryLabel, Rendered>,
    [reduced, compact],
  )

  useEffect(() => {
    buildTimeline(resolved)
    refreshAfterFonts()

    // Restore the position the visitor left from when they come back off a
    // detail route. Immediate, so they land where they were rather than
    // watching the page scroll itself there.
    const saved = sessionStorage.getItem(KEY)
    if (saved) {
      const top = Number(saved)
      requestAnimationFrame(() => {
        const lenis = getLenis()
        if (lenis) lenis.scrollTo(top, { immediate: true })
        else window.scrollTo(0, top)
      })
    }

    const save = () => sessionStorage.setItem(KEY, String(window.scrollY))
    window.addEventListener('scroll', save, { passive: true })

    return () => {
      window.removeEventListener('scroll', save)
      save()
      killTimeline()
    }
  }, [resolved])

  // The rail flips to ink on cream grounds (About, Merchandise).
  const ground = label === 'about' || label === 'g4' ? 'cream' : 'dark'

  return (
    <>
      <Stage />
      <SideRail ground={ground} />
      <main className="relative z-10">
        <Hero />
        <About />
        {GALLERY_SCENES.map((scene) => (
          <GalleryScene key={scene.label} scene={scene} rendered={resolved[scene.label]} />
        ))}
        <Contact />
      </main>
    </>
  )
}
