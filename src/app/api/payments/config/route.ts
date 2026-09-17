import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { getAccessToken, registerWebhook } from '@/lib/payments/paypal-client'
import { resolveBaseUrl } from '@/lib/payments/site-url'
import type { PayPalEnvironment } from '@/lib/payments/paypal-client'

/**
 * GET /api/payments/config
 *
 * Never returns secrets — just whether each environment has
 * credentials saved, which one is active, and the account's
 * (read-only) currency. Any account member may call this (the
 * Payments overview shows connection status to agents too).
 */
export async function GET() {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }

  const [{ data: config }, { data: account }] = await Promise.all([
    ctx.supabase
      .from('payment_gateway_credentials')
      .select(
        'environment, sandbox_client_id, sandbox_webhook_id, live_client_id, live_webhook_id, notification_email',
      )
      .eq('account_id', ctx.accountId)
      .maybeSingle(),
    ctx.supabase
      .from('accounts')
      .select('default_currency')
      .eq('id', ctx.accountId)
      .maybeSingle(),
  ])

  return NextResponse.json({
    connected: !!config,
    environment: config?.environment ?? 'sandbox',
    currency: account?.default_currency ?? 'USD',
    notification_email: config?.notification_email ?? null,
    sandbox: {
      configured: !!config?.sandbox_client_id,
      client_id: config?.sandbox_client_id ?? null,
      webhook_registered: !!config?.sandbox_webhook_id,
    },
    live: {
      configured: !!config?.live_client_id,
      client_id: config?.live_client_id ?? null,
      webhook_registered: !!config?.live_webhook_id,
    },
  })
}

interface PutBody {
  environment: PayPalEnvironment
  sandbox_client_id?: string
  sandbox_client_secret?: string
  live_client_id?: string
  live_client_secret?: string
  /** Where the "new payment received" merchant alert goes. `undefined` leaves it unchanged; `null`/`''` clears it. */
  notification_email?: string | null
}

/**
 * PUT /api/payments/config
 *
 * Admin-only (enforced here AND by the `payment_gateway_credentials`
 * RLS insert/update policies — belt and suspenders, same pattern as
 * every other write route in this codebase).
 *
 * A blank `*_client_secret` field means "keep the one already saved"
 * (mirrors how the merchant shouldn't have to re-paste a secret just
 * to flip Sandbox → Live) — only a non-empty value gets re-encrypted.
 *
 * Verifies the credentials for the environment being activated
 * against PayPal's OAuth endpoint BEFORE persisting anything, and —
 * on first successful save for that environment — registers our
 * webhook URL with PayPal so `POST /api/payments/paypal/webhook`
 * starts receiving events. Mirrors the WhatsApp config route's
 * verify-then-save order.
 */
export async function PUT(request: Request) {
  let ctx
  try {
    ctx = await requireRole('admin')
  } catch (err) {
    return toErrorResponse(err)
  }

  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body?.environment || !['sandbox', 'live'].includes(body.environment)) {
    return NextResponse.json({ error: "environment must be 'sandbox' or 'live'" }, { status: 400 })
  }

  const { data: existing } = await ctx.supabase
    .from('payment_gateway_credentials')
    .select('*')
    .eq('account_id', ctx.accountId)
    .maybeSingle()

  const clientIdField = body.environment === 'sandbox' ? 'sandbox_client_id' : 'live_client_id'
  const clientSecretField =
    body.environment === 'sandbox' ? 'sandbox_client_secret' : 'live_client_secret'
  const webhookIdField =
    body.environment === 'sandbox' ? 'sandbox_webhook_id' : 'live_webhook_id'

  const clientId = body[clientIdField]?.trim() || existing?.[clientIdField] || null
  const newSecret = body[clientSecretField]?.trim()

  if (!clientId) {
    return NextResponse.json(
      { error: `Client ID is required for ${body.environment}` },
      { status: 400 },
    )
  }

  let clientSecret: string
  if (newSecret) {
    clientSecret = newSecret
  } else if (existing?.[clientSecretField]) {
    try {
      clientSecret = decrypt(existing[clientSecretField])
    } catch {
      return NextResponse.json(
        { error: 'Stored Client Secret could not be decrypted — please re-enter it.' },
        { status: 400 },
      )
    }
  } else {
    return NextResponse.json(
      { error: `Client Secret is required for ${body.environment}` },
      { status: 400 },
    )
  }

  // Verify against PayPal before touching the database.
  let accessToken: string
  try {
    const token = await getAccessToken({ clientId, clientSecret, environment: body.environment })
    accessToken = token.accessToken
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown PayPal error'
    return NextResponse.json({ error: `PayPal rejected the credentials: ${message}` }, { status: 400 })
  }

  // Register the webhook once per environment — safe to skip on
  // later saves so we don't accumulate duplicate subscriptions in
  // the PayPal dashboard every time the merchant edits a field.
  let webhookId: string | null = existing?.[webhookIdField] ?? null
  if (!webhookId) {
    try {
      const baseUrl = resolveBaseUrl(request)
      const result = await registerWebhook({
        accessToken,
        environment: body.environment,
        url: `${baseUrl}/api/payments/paypal/webhook`,
      })
      webhookId = result.webhookId
    } catch (err) {
      // Non-fatal: credentials are valid, the merchant can still be
      // taken as far as "connected"; without a webhook_id, though,
      // payments will show as 'created' forever since our webhook
      // never gets verified events. Surface it as a warning rather
      // than blocking the save.
      console.warn('[payments/config PUT] webhook registration failed:', err)
    }
  }

  const row: Record<string, unknown> = {
    account_id: ctx.accountId,
    environment: body.environment,
    [clientIdField]: clientId,
    [clientSecretField]: encrypt(clientSecret),
    [webhookIdField]: webhookId,
  }
  if (body.notification_email !== undefined) {
    row.notification_email = body.notification_email?.trim() || null
  }

  const { error: upsertError } = await ctx.supabase
    .from('payment_gateway_credentials')
    .upsert(row, { onConflict: 'account_id' })

  if (upsertError) {
    console.error('[payments/config PUT] upsert failed:', upsertError)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    environment: body.environment,
    webhook_registered: !!webhookId,
  })
}

/**
 * DELETE /api/payments/config
 *
 * Disconnects PayPal for the account (clears the whole row). Forms
 * stay intact — they just can't accept live payments until
 * reconnected.
 */
export async function DELETE() {
  let ctx
  try {
    ctx = await requireRole('admin')
  } catch (err) {
    return toErrorResponse(err)
  }

  const { error } = await ctx.supabase
    .from('payment_gateway_credentials')
    .delete()
    .eq('account_id', ctx.accountId)

  if (error) {
    console.error('[payments/config DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
