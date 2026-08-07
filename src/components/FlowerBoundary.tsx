import { Component, type ErrorInfo, type ReactNode } from 'react'
import { forceComplete } from '~/scroll/loading'

/**
 * The one failure the loader must not be able to cause is a permanent black
 * screen — and without this, a 404 on the GLB caused a WHITE one.
 *
 * useGLTF does not hang on a failed fetch, it throws on the next render:
 * suspend-react stores the rejection and re-throws it in the render phase to
 * bubble into an error boundary. r3f's <Canvas> forwards it out of its own
 * reconciler into the DOM tree (`if (error) throw error`), so it surfaces
 * here. With no boundary anywhere in src/, React unmounted the whole root and
 * took the loader down with the site.
 *
 * Wrapped OUTSIDE the lazy <Suspense> in Hero, so a chunk that fails to
 * download lands here too — the same white screen by a different route.
 *
 * A class component because React still has no hook equivalent; kept as small
 * as one can be.
 */

type Props = { children: ReactNode }
type State = { failed: boolean }

export class FlowerBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The loader is waiting on milestones a flower that will never mount
    // cannot report. Released here rather than left to the 10s safety
    // timeout: ten seconds of black IS the failure, not the recovery.
    forceComplete()
    if (import.meta.env.DEV) {
      console.error('[HeroFlower] failed to load — hero rendering without it', error, info.componentStack)
    }
  }

  render() {
    // null, not a fallback: the hero is complete without the flower, and an
    // apology in its place would be louder than the absence.
    return this.state.failed ? null : this.props.children
  }
}
