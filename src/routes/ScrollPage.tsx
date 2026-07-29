import { useEffect } from 'react'
import { Hero } from '~/sections/Hero'
import { About } from '~/sections/About'
import { GalleryScene } from '~/sections/GalleryScene'
import { Contact } from '~/sections/Contact'
import { SideRail } from '~/components/SideRail'
import { Stage } from '~/three/Stage'
import { GALLERY_SCENES } from '~/scroll/scenes'
import { useLenis, getLenis } from '~/scroll/useLenis'
import { clearLabels, refreshAfterFonts } from '~/scroll/timeline'
import { useScrollState } from '~/scroll/store'

const KEY = 'ovalese:scroll'

/**
 * The single-page scroll site. Detail pages are separate routes, so this
 * unmounts when one opens — including the r3f canvas.
 */
export const ScrollPage = () => {
  const { label } = useScrollState()
  useLenis()

  useEffect(() => {
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
      clearLabels()
    }
  }, [])

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
          <GalleryScene key={scene.label} scene={scene} />
        ))}
        <Contact />
      </main>
    </>
  )
}
