import { describe, expect, it } from 'vitest'
import { checkoutFonts } from './checkout-font'

describe('checkoutFonts', () => {
  it('keeps the original look for skins saved before the choice existed', () => {
    expect(checkoutFonts(undefined).title.fontFamily).toContain('Times New Roman')
    expect(checkoutFonts(undefined).details.fontFamily).toBe('var(--font-open-sans)')
  })

  it('uses the original look for paypal', () => {
    expect(checkoutFonts('paypal')).toEqual(checkoutFonts(undefined))
  })

  it("uses Inter everywhere for whop, like Whop's form", () => {
    const fonts = checkoutFonts('whop')
    expect(fonts.title.fontFamily).toBe('var(--font-sans)')
    expect(fonts.details.fontFamily).toBe('var(--font-sans)')
  })
})
