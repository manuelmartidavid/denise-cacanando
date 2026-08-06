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

  it('renders the field when motion is allowed and there is room', () => {
    expect(resolvePresentation('field', false, false)).toBe('field')
  })

  it('falls a field scene back to the pin-free list under reduced motion', () => {
    expect(resolvePresentation('field', true, false)).toBe('list')
  })

  it('falls a field scene back to the pin-free list below 900px', () => {
    expect(resolvePresentation('field', false, true)).toBe('list')
  })
})
