import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHECKOUT_ABANDON_AFTER_MS,
  effectiveCheckoutStatus,
  withCheckoutContactParams,
} from './checkout-tracking'

const contact = { id: '11111111-2222-3333-4444-555555555555', phone: '+1 (809) 555-1234' }

describe('withCheckoutContactParams', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('appends telefono (digits only) and contact_id to a checkout link', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    const out = new URL(withCheckoutContactParams('https://crm.example.com/pay/ebook?l=abc', contact))
    expect(out.searchParams.get('telefono')).toBe('18095551234')
    expect(out.searchParams.get('contact_id')).toBe(contact.id)
    expect(out.searchParams.get('l')).toBe('abc')
  })

  it('keeps params the merchant already set', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    const out = new URL(withCheckoutContactParams('https://crm.example.com/pay/ebook?telefono=999999', contact))
    expect(out.searchParams.get('telefono')).toBe('999999')
    expect(out.searchParams.get('contact_id')).toBe(contact.id)
  })

  it('leaves non-checkout and preview links untouched', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(withCheckoutContactParams('https://shop.example.com/product/1', contact)).toBe(
      'https://shop.example.com/product/1',
    )
    expect(withCheckoutContactParams('https://crm.example.com/pay/preview', contact)).toBe(
      'https://crm.example.com/pay/preview',
    )
    expect(withCheckoutContactParams('not a url', contact)).toBe('not a url')
  })

  it('only tags links on this deployment when NEXT_PUBLIC_SITE_URL is set', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://crm.example.com')
    expect(withCheckoutContactParams('https://other.example.com/pay/x', contact)).toBe(
      'https://other.example.com/pay/x',
    )
    expect(withCheckoutContactParams('https://crm.example.com/pay/x', contact)).toContain('contact_id=')
  })
})

describe('effectiveCheckoutStatus', () => {
  it('reads a stale initiated session as abandoned', () => {
    const now = Date.now()
    const stale = new Date(now - CHECKOUT_ABANDON_AFTER_MS - 1000).toISOString()
    const fresh = new Date(now - 1000).toISOString()
    expect(effectiveCheckoutStatus('initiated', stale, now)).toBe('abandoned')
    expect(effectiveCheckoutStatus('initiated', fresh, now)).toBe('initiated')
    expect(effectiveCheckoutStatus('viewed', stale, now)).toBe('viewed')
  })
})
