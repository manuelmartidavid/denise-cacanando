import { describe, expect, it } from 'vitest'
import { resolvePresentation } from './presentation'

describe('resolvePresentation', () => {
  it('renders the dial when motion is allowed and there is room', () => {
    expect(resolvePresentation('dial', false, false)).toBe('dial')
  })

  it('falls back to the pin-free list under reduced motion', () => {
    expect(resolvePresentation('dial', true, false)).toBe('list')
  })

  it('falls back to the pin-free list below 900px', () => {
    expect(resolvePresentation('dial', false, true)).toBe('list')
  })

  it('falls back once, not twice, when both apply', () => {
    expect(resolvePresentation('dial', true, true)).toBe('list')
  })

  it('leaves a track scene alone — its fallback belongs to the Murals spec', () => {
    expect(resolvePresentation('track', true, true)).toBe('track')
  })
})
