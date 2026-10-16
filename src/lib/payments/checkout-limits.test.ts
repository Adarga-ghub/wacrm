import { describe, expect, it } from 'vitest'
import { isValidBumpGalleryImageSize } from './checkout-limits'

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
