/**
 * PayPal REST API (Orders v2 + Webhooks v1) helpers.
 *
 * Mirrors the shape of `src/lib/whatsapp/meta-api.ts`: every function
 * takes a single named-params object (never positional args — that
 * file's header explains why: swapped-argument bugs are invisible
 * until runtime with positional params, a compile error with named
 * ones), and every environment-dependent call takes `environment`
 * explicitly rather than reading a module-level default, so a caller
 * can never accidentally hit Live with credentials it verified
 * against Sandbox.
 */

export type PayPalEnvironment = 'sandbox' | 'live'

const PAYPAL_API_BASE: Record<PayPalEnvironment, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
}

interface PayPalErrorResponse {
  message?: string
  error_description?: string
  name?: string
  details?: { issue?: string; description?: string }[]
}

async function throwPayPalError(response: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const data = (await response.json()) as PayPalErrorResponse
    message =
      data.details?.map((d) => d.description).filter(Boolean).join('; ') ||
      data.message ||
      data.error_description ||
      data.name ||
      fallback
  } catch {
    // response body wasn't JSON — keep the fallback
  }
  throw new Error(message)
}

// ============================================================
// OAuth2 (client_credentials)
// ============================================================

export interface GetAccessTokenArgs {
  clientId: string
  clientSecret: string
  environment: PayPalEnvironment
}

/**
 * Exchanges Client ID + Secret for a short-lived OAuth token. Used
 * both as the "Verificar credenciales" check when the merchant saves
 * the pasarela config (a bad Client Secret fails here, before
 * anything is persisted) and internally before every other call.
 */
export async function getAccessToken(
  args: GetAccessTokenArgs,
): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret, environment } = args
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(`${PAYPAL_API_BASE[environment]}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) {
    await throwPayPalError(response, `PayPal auth error: ${response.status}`)
  }
  const data = await response.json()
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}

// ============================================================
// Orders (Checkout)
// ============================================================

export interface CreateOrderArgs {
  accessToken: string
  environment: PayPalEnvironment
  /** ISO 4217, e.g. "USD" — resolved server-side, never from the payer's browser. */
  currency: string
  /** Decimal string, e.g. "49.00" — PayPal rejects floats with >2 dp. */
  amount: string
  /** Our `payment_transactions.id` (or a temp id) — round-trips back on the webhook event. */
  referenceId: string
  description?: string
  /**
   * The real product/offer name (e.g. the actual book/course title) —
   * sent as `purchase_units[].items[0].name` so it appears in PayPal's
   * notification email and the payer's receipt instead of a generic
   * concept. Always priced at `amount` with quantity 1: this CRM never
   * sells more than one line item per order.
   */
  itemName: string
  /** Commercial description of the item — same 127-char PayPal limit as `description`. */
  itemDescription?: string
}

export interface PayPalOrder {
  id: string
  status: string
}

export async function createOrder(args: CreateOrderArgs): Promise<PayPalOrder> {
  const { accessToken, environment, currency, amount, referenceId, description, itemName, itemDescription } = args
  const response = await fetch(`${PAYPAL_API_BASE[environment]}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: referenceId,
          description: description?.slice(0, 127),
          amount: {
            currency_code: currency,
            value: amount,
            // Required by PayPal whenever `items` is present — with a
            // single quantity-1 line item, the breakdown's item_total
            // always equals the purchase unit's own total.
            breakdown: { item_total: { currency_code: currency, value: amount } },
          },
          items: [
            {
              name: itemName.slice(0, 127),
              description: itemDescription?.slice(0, 127),
              unit_amount: { currency_code: currency, value: amount },
              quantity: '1',
              category: 'DIGITAL_GOODS',
            },
          ],
        },
      ],
      // Every product sold through this CRM is a digital download —
      // without this, PayPal defaults to GET_FROM_FILE and can prompt
      // the payer for a shipping address that's never used.
      application_context: { shipping_preference: 'NO_SHIPPING' },
    }),
  })
  if (!response.ok) {
    await throwPayPalError(response, `PayPal create-order error: ${response.status}`)
  }
  return response.json()
}

export interface CaptureOrderArgs {
  accessToken: string
  environment: PayPalEnvironment
  orderId: string
}

export interface PayPalCaptureResult {
  id: string
  status: string
  captureId: string | null
  payerName: string | null
  payerEmail: string | null
}

/**
 * Captures a payer-approved order. Called as a fast client-perceived
 * confirmation right after the PayPal JS SDK's `onApprove`, but the
 * WEBHOOK (`payment.capture.completed`) — not this call's response —
 * is what's treated as authoritative for dispatching the automation.
 * A capture can succeed here and the browser tab can still close
 * before the redirect fires; the webhook is what can't be missed.
 */
export async function captureOrder(args: CaptureOrderArgs): Promise<PayPalCaptureResult> {
  const { accessToken, environment, orderId } = args
  const response = await fetch(
    `${PAYPAL_API_BASE[environment]}/v2/checkout/orders/${orderId}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )
  if (!response.ok) {
    await throwPayPalError(response, `PayPal capture error: ${response.status}`)
  }
  const data = await response.json()
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0]
  return {
    id: data.id,
    status: data.status,
    captureId: capture?.id ?? null,
    payerName: data.payer?.name
      ? [data.payer.name.given_name, data.payer.name.surname].filter(Boolean).join(' ')
      : null,
    payerEmail: data.payer?.email_address ?? null,
  }
}

// ============================================================
// Webhooks
// ============================================================

export interface RegisterWebhookArgs {
  accessToken: string
  environment: PayPalEnvironment
  url: string
  eventTypes?: string[]
}

const DEFAULT_WEBHOOK_EVENTS = [
  'CHECKOUT.ORDER.APPROVED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED',
]

/**
 * Registers our webhook URL with PayPal for this environment and
 * returns the `webhook_id` we must store — `verify-webhook-signature`
 * requires it on every inbound event. Called once when the merchant
 * saves valid credentials (see `POST /api/payments/config`); safe to
 * call again on a later save (PayPal allows multiple webhook
 * subscriptions per app — the route only calls this when no
 * `*_webhook_id` is stored yet for that environment).
 */
export async function registerWebhook(
  args: RegisterWebhookArgs,
): Promise<{ webhookId: string }> {
  const { accessToken, environment, url, eventTypes = DEFAULT_WEBHOOK_EVENTS } = args
  const response = await fetch(`${PAYPAL_API_BASE[environment]}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      event_types: eventTypes.map((name) => ({ name })),
    }),
  })
  if (!response.ok) {
    await throwPayPalError(response, `PayPal webhook registration error: ${response.status}`)
  }
  const data = await response.json()
  return { webhookId: data.id }
}

export interface VerifyWebhookSignatureArgs {
  accessToken: string
  environment: PayPalEnvironment
  webhookId: string
  /** Raw inbound request headers — PayPal's own casing is inconsistent across gateways, so callers pass a lower-cased map. */
  headers: Record<string, string>
  /** Parsed JSON body of the inbound webhook POST. */
  webhookEvent: unknown
}

/**
 * Server-to-server signature check — this is what makes the webhook
 * trustworthy. Never process a webhook event before this returns
 * `verified: true`; a `false` here means the POST did not
 * demonstrably come from PayPal.
 */
export async function verifyWebhookSignature(
  args: VerifyWebhookSignatureArgs,
): Promise<{ verified: boolean }> {
  const { accessToken, environment, webhookId, headers, webhookEvent } = args
  const response = await fetch(
    `${PAYPAL_API_BASE[environment]}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    },
  )
  if (!response.ok) {
    await throwPayPalError(response, `PayPal signature verification error: ${response.status}`)
  }
  const data = await response.json()
  return { verified: data.verification_status === 'SUCCESS' }
}
