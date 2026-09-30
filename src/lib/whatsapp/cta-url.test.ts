import { describe, expect, it } from 'vitest'
import {
  blankCtaUrlConfig,
  ctaHeaderImageUrl,
  isValidCtaUrl,
  validateCtaUrlConfig,
} from './cta-url'

const valid = {
  ...blankCtaUrlConfig(),
  body: 'Complete your payment here:',
  button_text: 'Pay now',
  url: 'https://shop.example.com/checkout?id=1',
}

describe('isValidCtaUrl', () => {
  it('accepts http(s) links, including {{ }} placeholders', () => {
    expect(isValidCtaUrl('https://example.com')).toBe(true)
    expect(isValidCtaUrl('http://example.com/pay')).toBe(true)
    expect(isValidCtaUrl('https://example.com/pay?n={{vars.name}}')).toBe(true)
  })

  it('rejects relative, non-http and empty values', () => {
    expect(isValidCtaUrl('')).toBe(false)
    expect(isValidCtaUrl('example.com')).toBe(false)
    expect(isValidCtaUrl('javascript:alert(1)')).toBe(false)
    expect(isValidCtaUrl('ftp://example.com')).toBe(false)
    expect(isValidCtaUrl(undefined)).toBe(false)
  })
})

describe('validateCtaUrlConfig', () => {
  it('accepts a minimal text-only config', () => {
    expect(validateCtaUrlConfig(valid)).toEqual({ ok: true })
  })

  it('requires body, button text and a valid url', () => {
    expect(validateCtaUrlConfig({ ...valid, body: ' ' })).toMatchObject({ ok: false, field: 'body' })
    expect(validateCtaUrlConfig({ ...valid, button_text: '' })).toMatchObject({ ok: false, field: 'button_text' })
    expect(validateCtaUrlConfig({ ...valid, url: 'shop.com' })).toMatchObject({ ok: false, field: 'url' })
  })

  it("enforces Meta's 20-char button limit", () => {
    expect(validateCtaUrlConfig({ ...valid, button_text: 'x'.repeat(21) })).toMatchObject({
      ok: false,
      field: 'button_text',
    })
  })

  it('requires an uploaded image in image mode', () => {
    expect(validateCtaUrlConfig({ ...valid, header_mode: 'image' })).toMatchObject({
      ok: false,
      field: 'header_image_url',
    })
    expect(
      validateCtaUrlConfig({ ...valid, header_mode: 'image', header_image_url: 'https://x/img.png' }),
    ).toEqual({ ok: true })
  })

  it('requires a hex color and its generated banner in color mode', () => {
    expect(
      validateCtaUrlConfig({ ...valid, header_mode: 'color', header_color: 'red', header_image_url: 'https://x/c.png' }),
    ).toMatchObject({ ok: false, field: 'header_color' })
    expect(
      validateCtaUrlConfig({ ...valid, header_mode: 'color', header_color: '#25D366', header_image_url: '' }),
    ).toMatchObject({ ok: false, field: 'header_color' })
    expect(
      validateCtaUrlConfig({ ...valid, header_mode: 'color', header_color: '#25D366', header_image_url: 'https://x/c.png' }),
    ).toEqual({ ok: true })
  })
})

describe('ctaHeaderImageUrl', () => {
  it('ignores a leftover image url when the header is text-only', () => {
    expect(ctaHeaderImageUrl({ header_mode: 'none', header_image_url: 'https://x/a.png' })).toBeUndefined()
    expect(ctaHeaderImageUrl({ header_mode: 'color', header_image_url: 'https://x/a.png' })).toBe('https://x/a.png')
  })
})
