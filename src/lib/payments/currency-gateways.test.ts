import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PAYMENT_CURRENCY_CODES, isPaypalSupportedCurrency } from '@/lib/currency'
import { resolveWhopGateway } from './whop-gateway'
import { canPublishInCurrency } from './currency-gateways'

vi.mock('./whop-gateway', () => ({ resolveWhopGateway: vi.fn() }))
const whop = vi.mocked(resolveWhopGateway)

const CONNECTED = { environment: 'live' as const, companyId: 'biz_1', apiKey: 'k', enabled: true }

beforeEach(() => whop.mockReset())

describe('canPublishInCurrency', () => {
  it('lets PayPal currencies go live without looking at Whop', async () => {
    expect(await canPublishInCurrency({}, 'a', 'USD')).toBe(true)
    expect(whop).not.toHaveBeenCalled()
  })

  it('refuses a currency PayPal rejects when Whop is not connected', async () => {
    whop.mockResolvedValue(null)
    expect(await canPublishInCurrency({}, 'a', 'DOP')).toBe(false)
  })

  it('allows it once Whop is connected, even if switched off', async () => {
    whop.mockResolvedValue({ ...CONNECTED, enabled: false })
    expect(await canPublishInCurrency({}, 'a', 'DOP')).toBe(true)
  })
})

describe('payment currencies', () => {
  it('offers USD, EUR and the Latin American currencies', () => {
    for (const code of ['USD', 'EUR', 'DOP', 'COP', 'MXN', 'ARS', 'BRL', 'CLP', 'PEN', 'UYU', 'BOB', 'CRC', 'GTQ', 'PYG']) {
      expect(PAYMENT_CURRENCY_CODES).toContain(code)
    }
  })

  it('marks only USD, EUR and MXN as PayPal currencies', () => {
    expect(PAYMENT_CURRENCY_CODES.filter(isPaypalSupportedCurrency).sort()).toEqual(['EUR', 'MXN', 'USD'])
  })
})
