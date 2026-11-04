/**
 * Thin REST client for the parts of Whop's API the checkout needs —
 * the Whop counterpart of `paypal-client.ts`. Server-only: every call
 * carries the merchant's API key.
 *
 * Whop sets the price on a checkout configuration created here, so the
 * browser never asserts an amount: it only receives the configuration
 * id / hosted URL.
 */

export type WhopEnvironment = 'sandbox' | 'live'

const API_BASE: Record<WhopEnvironment, string> = {
  sandbox: 'https://sandbox-api.whop.com/api/v1',
  live: 'https://api.whop.com/api/v1',
}

const FRONTEND_BASE: Record<WhopEnvironment, string> = {
  sandbox: 'https://sandbox.whop.com',
  live: 'https://whop.com',
}

const MAX_TITLE_LENGTH = 30

export class WhopApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'WhopApiError'
  }
}

async function whopFetch<T>(
  environment: WhopEnvironment,
  apiKey: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_BASE[environment]}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) {
    // Never includes the API key: only Whop's own response is echoed.
    throw new WhopApiError(`Whop API ${res.status}: ${text.slice(0, 500)}`, res.status)
  }
  return (text ? JSON.parse(text) : {}) as T
}

export interface CreateWhopCheckoutArgs {
  environment: WhopEnvironment
  apiKey: string
  companyId: string
  /** ISO code in any case — Whop's API takes it in lowercase. */
  currency: string
  amount: number
  /** What the buyer sees as the product being paid for. */
  title: string
  /** Copied by Whop onto the payment and every webhook about it — how a payment maps back to our transaction. */
  metadata: Record<string, string>
  redirectUrl: string
}

/** The fields of the request body, separate from the HTTP call so they can be tested. */
export function buildCheckoutConfigurationBody(args: CreateWhopCheckoutArgs) {
  return {
    mode: 'payment',
    account_id: args.companyId,
    variant: {
      account_id: args.companyId,
      billing_type: 'one_time',
      release_method: 'buy_now',
      // Hidden: it exists for checkouts like this one and must not appear
      // as a purchasable option on the merchant's public Whop page.
      visibility: 'hidden',
      currency: args.currency.toLowerCase(),
      initial_price: args.amount,
      // The price the merchant set is the price charged: without this,
      // Whop re-converts it to the buyer's currency at its own rate.
      adaptive_pricing_enabled: false,
      // Whop rejects longer titles outright.
      title: args.title.length > MAX_TITLE_LENGTH ? `${args.title.slice(0, MAX_TITLE_LENGTH - 1)}…` : args.title,
    },
    metadata: args.metadata,
    redirect_url: args.redirectUrl,
  }
}

export interface WhopCheckoutConfiguration {
  id: string
  purchase_url: string
}

export async function createCheckoutConfiguration(
  args: CreateWhopCheckoutArgs,
): Promise<WhopCheckoutConfiguration> {
  const config = await whopFetch<WhopCheckoutConfiguration>(
    args.environment,
    args.apiKey,
    '/checkout_configurations',
    { method: 'POST', body: buildCheckoutConfigurationBody(args) },
  )
  // Whop documents `purchase_url` as a path; `new URL` leaves a full URL as is.
  return { ...config, purchase_url: new URL(config.purchase_url, FRONTEND_BASE[args.environment]).toString() }
}

export interface WhopPayment {
  id: string
  status: string | null
  metadata: Record<string, unknown> | null
  user?: { name?: string | null; email?: string | null } | null
  billing_address?: { name?: string | null } | null
}

export function retrievePayment(args: {
  environment: WhopEnvironment
  apiKey: string
  paymentId: string
}): Promise<WhopPayment> {
  return whopFetch<WhopPayment>(
    args.environment,
    args.apiKey,
    `/payments/${encodeURIComponent(args.paymentId)}`,
  )
}

/** Metadata key linking a Whop payment to `payment_transactions.paypal_order_id`. */
export const WHOP_ORDER_METADATA_KEY = 'crm_order_id'

/** A payment counts only when Whop itself says it's paid AND it carries this exact order's reference. */
export function isPaymentForOrder(payment: WhopPayment, orderId: string): boolean {
  return payment.status === 'paid' && payment.metadata?.[WHOP_ORDER_METADATA_KEY] === orderId
}

export function payerFromPayment(payment: WhopPayment): { name: string | null; email: string | null } {
  return {
    name: payment.user?.name ?? payment.billing_address?.name ?? null,
    email: payment.user?.email ?? null,
  }
}

/** Confirms the API key works for this company before anything is saved. */
export async function verifyCredentials(args: {
  environment: WhopEnvironment
  apiKey: string
  companyId: string
}): Promise<void> {
  const query = new URLSearchParams({ account_id: args.companyId, first: '1' })
  await whopFetch(args.environment, args.apiKey, `/checkout_configurations?${query}`)
}

/** Registers our webhook. Whop returns the signing secret only in this response. */
export async function registerWebhook(args: {
  environment: WhopEnvironment
  apiKey: string
  companyId: string
  url: string
}): Promise<{ id: string; webhook_secret: string }> {
  return whopFetch(args.environment, args.apiKey, '/webhooks', {
    method: 'POST',
    body: {
      url: args.url,
      events: ['payment.succeeded'],
      resource_id: args.companyId,
    },
  })
}
