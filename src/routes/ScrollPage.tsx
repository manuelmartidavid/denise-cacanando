import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import { Hero } from '~/sections/Hero'
import { About } from '~/sections/About'
import { GalleryScene } from '~/sections/GalleryScene'
import { Contact } from '~/sections/Contact'
import { GroundLayer } from '~/sections/GroundLayer'
import { SeedLayer } from '~/sections/SeedLayer'
import { SideRail } from '~/components/SideRail'
import { BottomTicker } from '~/components/BottomTicker'
import { Loader } from '~/components/Loader'
import { getPhase, useLoadPhase } from '~/scroll/loading'
/**
 * three.js is most of the bundle and the stage is decorative — fixed behind the
 * page, `pointer-events-none`, `aria-hidden`. Splitting it out lets the scroll
 * page paint without waiting on it, and the fallback is legitimately nothing:
 * there is no content here to stand in for.
 */
const Stage = lazy(() => import('~/three/Stage').then((m) => ({ default: m.Stage })))
const NearStage = lazy(() => import('~/three/Stage').then((m) => ({ default: m.NearStage })))
import { GALLERY_SCENES, sceneByLabel, type GalleryLabel } from '~/scroll/scenes'
import { resolvePresentation, type Rendered } from '~/scroll/presentation'
import { useCompactLayout, useReducedMotion } from '~/scroll/useReducedMotion'
import { useLenis, getLenis } from '~/scroll/useLenis'
import { buildTimeline, killTimeline, refreshAfterFonts } from '~/scroll/timeline'
import { useScrollState } from '~/scroll/store'
import { SEED_SEAM } from '~/scroll/seed'

const KEY = 'ovalese:scroll'

/**
 * The single-page scroll site. Detail pages are separate routes, so this
 * unmounts when one opens — including the r3f canvas and every ScrollTrigger.
 */
export const ScrollPage = () => {
  const { label } = useScrollState()
  const reduced = useReducedMotion()
  const compact = useCompactLayout()
  const phase = useLoadPhase()
  useLenis()

  const resolved = useMemo(
    () =>
      Object.fromEntries(
        GALLERY_SCENES.map((s) => [s.label, resolvePresentation(s.presentation, reduced, compact)]),
      ) as Record<GalleryLabel, Rendered>,
    [reduced, compact],
  )

  /**
   * The scroll lock — and deliberately HERE, not inside <Loader>.
   *
   * React commits passive effects child-first, so when a child's mount effect
   * runs, `useLenis`'s effect — which lives on THIS component — has not
   * created the instance yet and `getLenis()` is still null. Stopping Lenis
   * from the Loader was therefore a no-op on every path, and the page scrolled
   * freely behind an overlay the visitor could not see past. Declared after
   * `useLenis()` in the same component, hooks run in declaration order and the
   * instance is there.
   *
   * Gated on the phase rather than on mount: a returning visitor is 'done'
   * from the first render and must never have Lenis stopped at all.
   *
   * `reduced` is a dependency because a mid-load reduced-motion flip tears
   * down and rebuilds the Lenis instance underneath us; without it the fresh
   * instance would come up unstopped. React runs every cleanup before every
   * effect in a commit, so `useLenis` has already destroyed the old one by the
   * time this cleanup runs.
   *
   * The cleanup re-reads `getLenis()` instead of closing over the instance:
   * on an unmount mid-loader (a visitor opening a detail route) `useLenis`'s
   * cleanup has already run and nulled it, and calling `start()` on a
   * destroyed Lenis re-stamps the `lenis` classes onto <html> that destroy
   * just cleaned off. The optional chain stays for reduced motion, where
   * `useLenis` returns early and there is no instance at all — the Loader's
   * own preventDefault listeners are the whole lock there.
   */
  const locked = phase !== 'done'
  useEffect(() => {
    if (!locked) return
    getLenis()?.stop()
    return () => {
      getLenis()?.start()
    }
  }, [locked, reduced])

  // Rebuilds every ScrollTrigger whenever the presentation resolution changes
  // (a breakpoint or reduced-motion flip). Deliberately just this: no restore,
  // no listener, so a resize never touches sessionStorage — only the pins and
  // scrub get torn down and rebuilt.
  useEffect(() => {
    buildTimeline(resolved)
    return () => killTimeline()
  }, [resolved])

  // Mount-only. The ref keeps the restore once-only across StrictMode's
  // mount → cleanup → mount, so the replayed effect cannot re-trigger a scroll
  // the visitor did not ask for.
  const restored = useRef(false)
  useEffect(() => {
    let cancelled = false

    // Read now, apply later. On a reload the browser runs its own scroll
    // restoration against a document that is still one viewport tall; those
    // attempts fire scroll events, and the listener below would write their
    // clamped positions over the offset we are about to use. Sampling before
    // the listener exists is what makes a hard refresh land where it should.
    const saved = sessionStorage.getItem(KEY)

    // The loader locks the page at the top and is about to write the name
    // across it; a restore would yank the document out from under it. Gated
    // on the live phase rather than on shouldPlayLoader(): this effect runs
    // again when the visitor comes back off a detail route, and by then the
    // phase is 'done' and the restore must happen normally.
    const loading = getPhase() !== 'done'

    // Restore the position the visitor left from when they come back off a
    // detail route. Immediate, so they land where they were rather than
    // watching the page scroll itself there.
    //
    // Deliberately inside refreshAfterFonts' callback rather than a bare rAF.
    // Creating the pinned triggers does not lay out their pin spacers; only the
    // refresh does. Restoring before it addressed a document still at its
    // unpinned seven viewports, so any offset past 5400px was clamped —
    // returning from a Murals wall at 9180 landed at 5400. Shallower offsets
    // survived, which is why this looked like it worked.
    refreshAfterFonts(() => {
      if (cancelled || restored.current) return
      if (loading) {
        restored.current = true
        window.scrollTo(0, 0)
        return
      }
      restored.current = true
      if (!saved) return
      const top = Number(saved)
      const lenis = getLenis()
      if (lenis) {
        // The refresh above just grew the document by ten viewports. Lenis
        // caches its scroll limit and only recomputes it from an async
        // ResizeObserver, so without this it clamps the target against the
        // pre-pin height it still believes in.
        lenis.resize()
        lenis.scrollTo(top, { immediate: true })
      } else {
        window.scrollTo(0, top)
      }
    })

    // Written on every scroll, and deliberately NOT again on the way out.
    //
    // Teardown is too late to read window.scrollY. The timeline effect above is
    // declared first, so React runs killTimeline() before this cleanup; that
    // unpins four sections and collapses the document from ~17 viewports to
    // seven, and the browser clamps scrollY to the new maximum. A save() here
    // therefore overwrote a correct offset with the clamped one — 3428 became
    // 388 — and the visitor came back off a detail route near the top of the
    // page. Writing through on each scroll means the stored value is already
    // correct before any of that happens.
    //
    // It also means a hard refresh keeps its position, which a teardown-only
    // write would lose: no React cleanup runs on page unload.
    const save = () => sessionStorage.setItem(KEY, String(window.scrollY))
    window.addEventListener('scroll', save, { passive: true })

    return () => {
      cancelled = true
      window.removeEventListener('scroll', save)
    }
  }, [])

  // The rail flips to ink on cream grounds. Gallery grounds are READ from the
  // scene declarations rather than restated here — `GroundLayer` already does
  // it that way, and this line did not: it named g4 and would have kept the
  // rail cream-on-cream over the Artworks field the moment that scene flipped.
  const scene = sceneByLabel(label)
  const ground = (scene ? scene.ground : label === 'about' ? 'cream' : 'dark') satisfies
    | 'cream'
    | 'dark'

  // Both neighbours must actually be rings. Below 939px, or under reduced
  // motion, `resolvePresentation` returns 'list' — there is no ring to contract
  // and no gap to cross, so the seed must not exist at all.
  const seeded = resolved[SEED_SEAM.out] === 'dial' && resolved[SEED_SEAM.in] === 'dial'

  return (
    <>
      {/* Ground (z-0) → canvas (z-1) → content (z-10). The sections themselves
          are transparent; GroundLayer paints each one's ground across its real
          document range so the canvas shows through. */}
      <GroundLayer />
      <Suspense fallback={null}>
        <Stage />
      </Suspense>
      {seeded && <SeedLayer />}
      <SideRail ground={ground} />
      <BottomTicker ground={ground} />
      <main className="relative z-10">
        <Hero />
        <About />
        {GALLERY_SCENES.map((scene) => (
          <GalleryScene key={scene.label} scene={scene} rendered={resolved[scene.label]} />
        ))}
        <Contact />
      </main>
      {/* After <main>, so the foreground petals paint over the sections. */}
      <Suspense fallback={null}>
        <NearStage />
      </Suspense>
      {phase !== 'done' && <Loader />}
    </>
  )
}
