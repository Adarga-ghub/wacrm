import { describe, expect, it } from 'vitest'
import { funnelOrderItems, loadFunnelStep, sanitizeFunnelPage } from './funnel'

/** Minimal stand-in for the supabase-js query builder: every chain resolves to the table's canned result. */
function fakeDb(tables: Record<string, unknown>) {
  return {
    from(table: string) {
      const result = tables[table]
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'is']) chain[m] = () => chain
      chain.maybeSingle = async () => ({ data: result, error: null })
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: result, error: null })
      return chain
    },
  }
}

const MAIN = { id: 'main', account_id: 'acc', currency: 'USD' }
const offer = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  account_id: 'acc',
  name: `Offer ${id}`,
  status: 'draft',
  amount_type: 'fixed',
  amount,
  currency: 'USD',
  product_id: null,
  ...extra,
})

describe('loadFunnelStep', () => {
  it('splits a bundle price across its offers so the lines sum to it exactly', async () => {
    const db = fakeDb({
      payment_funnel_steps: {
        id: 's1',
        kind: 'downsell',
        offer_form_ids: ['a', 'b'],
        price: 4.99,
        compare_at_price: 10.98,
        page: {},
        active: true,
      },
      payment_forms: [offer('a', 5.99), offer('b', 4.99)],
    })
    const step = await loadFunnelStep(db, MAIN, 'downsell')
    expect(step?.price).toBe(4.99)
    expect(step?.compareAtPrice).toBe(10.98)
    const cents = step!.lines.map((l) => Math.round(l.amount * 100))
    expect(cents.reduce((a, b) => a + b, 0)).toBe(499)
    const items = funnelOrderItems(step!)
    expect(items.amount).toBe('4.99')
    expect(items.extraItems).toHaveLength(1)
  })

  it('drops offers in another currency or archived, and the whole step when none is left', async () => {
    const db = fakeDb({
      payment_funnel_steps: { id: 's1', kind: 'upsell', offer_form_ids: ['a', 'b'], price: null, page: {}, active: true },
      payment_forms: [offer('a', 5, { currency: 'MXN' }), offer('b', 5, { status: 'archived' })],
    })
    expect(await loadFunnelStep(db, MAIN, 'upsell')).toBeNull()
  })

  it('ignores an inactive step unless asked for previews, and hides a compare-at price that is not higher', async () => {
    const db = fakeDb({
      payment_funnel_steps: {
        id: 's1',
        kind: 'upsell',
        offer_form_ids: ['a'],
        price: null,
        compare_at_price: 3,
        page: {},
        active: false,
      },
      payment_forms: [offer('a', 5.99)],
    })
    expect(await loadFunnelStep(db, MAIN, 'upsell')).toBeNull()
    const preview = await loadFunnelStep(db, MAIN, 'upsell', { activeOnly: false })
    expect(preview?.price).toBe(5.99)
    expect(preview?.compareAtPrice).toBeNull()
  })
})

describe('sanitizeFunnelPage', () => {
  it('keeps known fields only, trimmed, with clean bullets and a bounded timer', () => {
    const page = sanitizeFunnelPage({
      headline: '  Hola  ',
      banner: '',
      bullets: ['uno', '  ', 'dos', 3],
      timer_minutes: 999,
      evil: '<script>',
    })
    expect(page).toEqual({ headline: 'Hola', bullets: ['uno', 'dos'], timer_minutes: 120 })
  })
})
