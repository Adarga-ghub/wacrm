import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_ABANDON_AFTER_MS,
  applyContactPlaceholders,
  checkoutSlugFromUrl,
  effectiveCheckoutStatus,
  withContactTrackingParams,
} from './checkout-tracking'

const contact = {
  id: '11111111-2222-3333-4444-555555555555',
  phone: '+1 (809) 555-1234',
  name: 'María Pérez',
}

describe('withContactTrackingParams', () => {
  it('appends telefono (digits only) and contact_id to a checkout link', () => {
    const out = new URL(withContactTrackingParams('https://crm.example.com/pay/ebook?l=abc', contact, true))
    expect(out.searchParams.get('telefono')).toBe('18095551234')
    expect(out.searchParams.get('contact_id')).toBe(contact.id)
    expect(out.searchParams.get('l')).toBe('abc')
    expect(out.searchParams.get('cid')).toBeNull()
  })

  it('keeps params the merchant already set', () => {
    const out = new URL(withContactTrackingParams('https://crm.example.com/pay/ebook?telefono=999999', contact, true))
    expect(out.searchParams.get('telefono')).toBe('999999')
    expect(out.searchParams.get('contact_id')).toBe(contact.id)
  })

  it('tags an external landing page with the opaque cid only — never the phone', () => {
    const out = new URL(withContactTrackingParams('https://landing.lovable.app/', contact, false))
    expect(out.searchParams.get('cid')).toBe(contact.id)
    expect(out.searchParams.get('telefono')).toBeNull()
    expect(out.toString()).not.toContain('8095551234')
  })

  it('leaves unparseable and non-http links untouched', () => {
    expect(withContactTrackingParams('not a url', contact, false)).toBe('not a url')
    expect(withContactTrackingParams('mailto:a@b.co', contact, false)).toBe('mailto:a@b.co')
  })
})

describe('checkoutSlugFromUrl', () => {
  it('extracts the slug of /pay/<slug> links only', () => {
    expect(checkoutSlugFromUrl('https://crm.example.com/pay/pago-al-contado-o0yq7d?x=1')).toBe(
      'pago-al-contado-o0yq7d',
    )
    expect(checkoutSlugFromUrl('https://crm.example.com/pay/preview')).toBeNull()
    expect(checkoutSlugFromUrl('https://landing.lovable.app/')).toBeNull()
    expect(checkoutSlugFromUrl('nope')).toBeNull()
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
