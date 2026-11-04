import { describe, expect, it } from 'vitest'
import {
  buildCheckoutConfigurationBody,
  isPaymentForOrder,
  payerFromPayment,
  WHOP_ORDER_METADATA_KEY,
} from './whop-client'

const args = {
  environment: 'sandbox' as const,
  apiKey: 'test',
  companyId: 'biz_1',
  currency: 'DOP',
  amount: 499,
  title: 'x'.repeat(100),
  metadata: { [WHOP_ORDER_METADATA_KEY]: 'whop_1' },
  redirectUrl: 'https://example.com/pay/whop-return?order=whop_1',
}

describe('buildCheckoutConfigurationBody', () => {
  it('charges a hidden, one-time price in the lowercase currency', () => {
    const body = buildCheckoutConfigurationBody(args)
    expect(body.account_id).toBe('biz_1')
    expect(body.variant).toMatchObject({
      billing_type: 'one_time',
      visibility: 'hidden',
      currency: 'dop',
      initial_price: 499,
      adaptive_pricing_enabled: false,
    })
  })

  it('carries the order reference and the return URL', () => {
    const body = buildCheckoutConfigurationBody(args)
    expect(body.metadata[WHOP_ORDER_METADATA_KEY]).toBe('whop_1')
    expect(body.redirect_url).toBe(args.redirectUrl)
  })

  it('shortens a title to the 30 characters Whop accepts', () => {
    expect(buildCheckoutConfigurationBody(args).variant.title).toHaveLength(30)
  })

  it('leaves a short title alone', () => {
    expect(buildCheckoutConfigurationBody({ ...args, title: 'Libro' }).variant.title).toBe('Libro')
  })
})

describe('isPaymentForOrder', () => {
  const paid = { id: 'pay_1', status: 'paid', metadata: { [WHOP_ORDER_METADATA_KEY]: 'whop_1' } }

  it('accepts a paid payment for this exact order', () => {
    expect(isPaymentForOrder(paid, 'whop_1')).toBe(true)
  })

  it('rejects a payment that is not paid yet', () => {
    expect(isPaymentForOrder({ ...paid, status: 'pending' }, 'whop_1')).toBe(false)
  })

  it('rejects a paid payment belonging to a different order', () => {
    expect(isPaymentForOrder(paid, 'whop_2')).toBe(false)
  })

  it('rejects a payment without metadata', () => {
    expect(isPaymentForOrder({ ...paid, metadata: null }, 'whop_1')).toBe(false)
  })
})

describe('payerFromPayment', () => {
  it('falls back to the billing name', () => {
    expect(
      payerFromPayment({ id: 'p', status: 'paid', metadata: null, billing_address: { name: 'Ana' } }),
    ).toEqual({ name: 'Ana', email: null })
  })
})
