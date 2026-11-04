import { isPaypalSupportedCurrency } from '@/lib/currency'
import { resolveWhopGateway } from './whop-gateway'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

/**
 * Whether an offer in this currency can go live: PayPal takes the
 * currencies it supports, and Whop takes every currency the Payments
 * module offers, so the others need Whop connected. A Whop that's
 * connected but switched off still counts: that's a choice the merchant
 * can flip at any time, and the settings page already shows it.
 */
export async function canPublishInCurrency(
  db: AnySupabase,
  accountId: string,
  currency: string,
): Promise<boolean> {
  if (isPaypalSupportedCurrency(currency)) return true
  return !!(await resolveWhopGateway(db, accountId))
}

export function publishCurrencyError(currency: string): string {
  return `PayPal cannot process payments in ${currency}. Connect Whop, or change the currency to USD, EUR or MXN, before publishing.`
}
