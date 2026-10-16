import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_TEXT_LIMITS,
  isValidBumpGalleryImageSize,
  parseBumpBoxFontSizes,
  parseBumpPopupCopy,
} from './checkout-limits'

describe('parseBumpBoxFontSizes', () => {
  it('keeps in-range sizes and drops defaults', () => {
    expect(parseBumpBoxFontSizes({ title: 16, description: 11.5, checkbox: 18.5 })).toEqual({ title: 16, checkbox: 18.5 })
    expect(parseBumpBoxFontSizes(null)).toEqual({})
    expect(parseBumpBoxFontSizes(undefined)).toBeUndefined()
  })

  it('rejects unknown keys, out-of-range sizes and odd steps', () => {
    expect(parseBumpBoxFontSizes({ price: 14 })).toBe('invalid')
    expect(parseBumpBoxFontSizes({ title: 40 })).toBe('invalid')
    expect(parseBumpBoxFontSizes({ description: 12.3 })).toBe('invalid')
    expect(parseBumpBoxFontSizes([14])).toBe('invalid')
  })
})

describe('parseBumpPopupCopy', () => {
  it('returns only the fields that were sent, trimmed, with empty = null', () => {
    expect(parseBumpPopupCopy({ popup_title: '  Hola  ', checkbox_label: '' })).toEqual({
      copy: { popup_title: 'Hola', checkbox_label: null },
    })
    expect(parseBumpPopupCopy({})).toEqual({ copy: {} })
  })

  it('rejects a field over its limit', () => {
    const long = 'x'.repeat(CHECKOUT_TEXT_LIMITS.bumpButtonLabel + 1)
    expect(parseBumpPopupCopy({ popup_added_label: long })).toEqual({
      tooLong: 'popup_added_label',
      max: CHECKOUT_TEXT_LIMITS.bumpButtonLabel,
    })
  })
})

describe('isValidBumpGalleryImageSize', () => {
  it('accepts exactly 1100×1500 and larger images of the same shape', () => {
    expect(isValidBumpGalleryImageSize(1100, 1500)).toBe(true)
    expect(isValidBumpGalleryImageSize(2200, 3000)).toBe(true)
    // within the 2% shape tolerance
    expect(isValidBumpGalleryImageSize(1120, 1500)).toBe(true)
  })

  it('rejects images that are too small, even with the right shape', () => {
    expect(isValidBumpGalleryImageSize(385, 525)).toBe(false)
    expect(isValidBumpGalleryImageSize(130, 164)).toBe(false)
    expect(isValidBumpGalleryImageSize(1099, 1499)).toBe(false)
  })

  it('rejects big images with the wrong shape', () => {
    expect(isValidBumpGalleryImageSize(1250, 1500)).toBe(false) // 4:5-ish, too wide
    expect(isValidBumpGalleryImageSize(1500, 1500)).toBe(false)
    expect(isValidBumpGalleryImageSize(1100, 2000)).toBe(false)
  })

  it('rejects unreadable sizes', () => {
    expect(isValidBumpGalleryImageSize(0, 0)).toBe(false)
    expect(isValidBumpGalleryImageSize(NaN, 1500)).toBe(false)
  })
})
