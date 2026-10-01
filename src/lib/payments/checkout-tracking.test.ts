import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_ABANDON_AFTER_MS,
  applyContactPlaceholders,
  effectiveCheckoutStatus,
  withContactTrackingParams,
} from './checkout-tracking'

const contact = {
  id: '11111111-2222-3333-4444-555555555555',
  phone: '+1 (809) 555-1234',
  name: 'María Pérez',
}

describe('withContactTrackingParams', () => {
  it('appends only the opaque cid to a checkout link — never the phone', () => {
    const out = withContactTrackingParams('https://crm.example.com/pay/ebook', contact)
    expect(out).toBe(`https://crm.example.com/pay/ebook?cid=${contact.id}`)
    expect(out).not.toContain('8095551234')
  })

  it('keeps existing params and works for any page', () => {
    const out = new URL(withContactTrackingParams('https://landing.lovable.app/?l=abc', contact))
    expect(out.searchParams.get('l')).toBe('abc')
    expect(out.searchParams.get('cid')).toBe(contact.id)
    expect(out.searchParams.get('telefono')).toBeNull()
  })

  it('leaves links that already identify the contact untouched', () => {
    const withCid = 'https://crm.example.com/pay/ebook?cid=other'
    const legacy = 'https://crm.example.com/pay/ebook?contact_id=other'
    expect(withContactTrackingParams(withCid, contact)).toBe(withCid)
    expect(withContactTrackingParams(legacy, contact)).toBe(legacy)
  })

  it('leaves unparseable and non-http links untouched', () => {
    expect(withContactTrackingParams('not a url', contact)).toBe('not a url')
    expect(withContactTrackingParams('mailto:a@b.co', contact)).toBe('mailto:a@b.co')
  })
})

describe('applyContactPlaceholders', () => {
  it('resolves contact variables, URL-encoded', () => {
    const out = applyContactPlaceholders(
      'https://x.co/pay/a?telefono={{contact.phone}}&n={{ contact.name }}&id={{contact.id}}&z={{contact.nope}}',
      contact,
    )
    expect(out).toBe(
      `https://x.co/pay/a?telefono=18095551234&n=Mar%C3%ADa%20P%C3%A9rez&id=${contact.id}&z=`,
    )
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
