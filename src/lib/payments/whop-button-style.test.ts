import { describe, expect, it } from 'vitest'
import { DEFAULT_WHOP_BUTTON_STYLE, normalizeWhopButtonStyle } from './whop-button-style'

describe('normalizeWhopButtonStyle', () => {
  it('uses the default design when nothing is saved', () => {
    expect(normalizeWhopButtonStyle({})).toEqual(DEFAULT_WHOP_BUTTON_STYLE)
    expect(normalizeWhopButtonStyle(null)).toEqual(DEFAULT_WHOP_BUTTON_STYLE)
  })

  it('keeps valid values', () => {
    const style = { ...DEFAULT_WHOP_BUTTON_STYLE, iconSize: 50, fontFamily: 'inter', textColor: '#112233' }
    expect(normalizeWhopButtonStyle(style)).toEqual(style)
  })

  it('keeps sizes inside their range', () => {
    expect(normalizeWhopButtonStyle({ fontSize: 500 }).fontSize).toBe(22)
    expect(normalizeWhopButtonStyle({ iconSize: 1 }).iconSize).toBe(20)
  })

  it('lets the outline go down to zero', () => {
    expect(normalizeWhopButtonStyle({ borderWidth: 0 }).borderWidth).toBe(0)
  })

  it('refuses a color that could inject styles', () => {
    expect(normalizeWhopButtonStyle({ backgroundColor: 'red;position:fixed' }).backgroundColor).toBe('#ffffff')
  })

  it('refuses a font outside the list', () => {
    expect(normalizeWhopButtonStyle({ fontFamily: 'constructor' }).fontFamily).toBe('paypal')
  })

  it('falls back on a size that is not a number', () => {
    expect(normalizeWhopButtonStyle({ menuSize: 'big' }).menuSize).toBe(26)
    expect(normalizeWhopButtonStyle({ menuSize: null }).menuSize).toBe(26)
  })
})
