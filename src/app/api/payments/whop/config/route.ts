import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { decrypt, encrypt } from '@/lib/whatsapp/encryption'
import { registerWebhook, verifyCredentials } from '@/lib/payments/whop-client'
import { MAX_NOTIFICATION_EMAILS, normalizeNotificationEmails } from '@/lib/payments/notification-emails'
import type { WhopEnvironment } from '@/lib/payments/whop-client'
import { resolveBaseUrl } from '@/lib/payments/site-url'

/**
 * GET /api/payments/whop/config
 *
 * Connection status only — never returns an API key or signing secret.
 */
export async function GET() {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }

  const { data: config } = await ctx.supabase
    .from('whop_gateway_credentials')
    .select(
      'environment, sandbox_company_id, sandbox_api_key, sandbox_webhook_id, live_company_id, live_api_key, live_webhook_id, notification_emails, enabled',
    )
    .eq('account_id', ctx.accountId)
    .maybeSingle()

  return NextResponse.json({
    connected: !!config,
    enabled: config?.enabled ?? true,
    environment: config?.environment ?? 'sandbox',
    notification_emails: config?.notification_emails ?? [],
    sandbox: {
      configured: !!config?.sandbox_api_key,
      company_id: config?.sandbox_company_id ?? null,
      webhook_registered: !!config?.sandbox_webhook_id,
    },
    live: {
      configured: !!config?.live_api_key,
      company_id: config?.live_company_id ?? null,
      webhook_registered: !!config?.live_webhook_id,
    },
  })
}

interface PutBody {
  environment: WhopEnvironment
  company_id?: string
  /** Blank keeps the saved key, so switching environment doesn't require pasting it again. */
  api_key?: string
  /** Up to three "new payment received" addresses. `undefined` leaves them unchanged. */
  notification_emails?: string[]
}

/**
 * PUT /api/payments/whop/config
 *
 * Admin-only. Verifies the key against Whop before saving, and registers
 * our webhook the first time an environment is saved. A failed webhook
 * registration doesn't block saving: Whop refuses localhost URLs, and the
 * buyer's return page confirms payments on its own.
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
  const env = body.environment

  const notificationEmails =
    body.notification_emails === undefined ? undefined : normalizeNotificationEmails(body.notification_emails)
  if (notificationEmails === null) {
    return NextResponse.json(
      { error: `Enter valid notification emails, up to ${MAX_NOTIFICATION_EMAILS}.` },
      { status: 400 },
    )
  }

  const { data: existing } = await ctx.supabase
    .from('whop_gateway_credentials')
    .select('*')
    .eq('account_id', ctx.accountId)
    .maybeSingle()

  const companyId = body.company_id?.trim() || existing?.[`${env}_company_id`] || null
  if (!companyId) {
    return NextResponse.json({ error: 'The Whop business ID is required' }, { status: 400 })
  }

  let apiKey = body.api_key?.trim() || null
  if (!apiKey && existing?.[`${env}_api_key`]) {
    try {
      apiKey = decrypt(existing[`${env}_api_key`])
    } catch {
      return NextResponse.json(
        { error: 'The stored API key could not be decrypted — please enter it again.' },
        { status: 400 },
      )
    }
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'The Whop API key is required' }, { status: 400 })
  }

  try {
    await verifyCredentials({ environment: env, apiKey, companyId })
  } catch (err) {
    console.warn('[payments/whop/config PUT] credentials rejected:', err)
    return NextResponse.json(
      { error: 'Whop rejected these credentials — check the API key, its permissions and the business ID.' },
      { status: 400 },
    )
  }

  let webhookId: string | null = existing?.[`${env}_webhook_id`] ?? null
  let encryptedWebhookSecret: string | null = existing?.[`${env}_webhook_secret`] ?? null
  if (!webhookId) {
    try {
      const webhook = await registerWebhook({
        environment: env,
        apiKey,
        companyId,
        url: `${resolveBaseUrl(request)}/api/payments/whop/webhook`,
      })
      webhookId = webhook.id
      encryptedWebhookSecret = encrypt(webhook.webhook_secret)
    } catch (err) {
      console.warn('[payments/whop/config PUT] webhook registration failed:', err)
    }
  }

  const { error } = await ctx.supabase.from('whop_gateway_credentials').upsert(
    {
      account_id: ctx.accountId,
      environment: env,
      [`${env}_company_id`]: companyId,
      [`${env}_api_key`]: encrypt(apiKey),
      [`${env}_webhook_id`]: webhookId,
      [`${env}_webhook_secret`]: encryptedWebhookSecret,
      ...(notificationEmails ? { notification_emails: notificationEmails } : {}),
    },
    { onConflict: 'account_id' },
  )
  if (error) {
    console.error('[payments/whop/config PUT] upsert failed:', error)
    return NextResponse.json({ error: 'Failed to save the configuration' }, { status: 500 })
  }

  return NextResponse.json({ success: true, environment: env, webhook_registered: !!webhookId })
}

/**
 * PATCH — turns Whop on or off for new payments. Its credentials stay saved.
 */
export async function PATCH(request: Request) {
  let ctx
  try {
    ctx = await requireRole('admin')
  } catch (err) {
    return toErrorResponse(err)
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be true or false' }, { status: 400 })
  }

  const { data, error } = await ctx.supabase
    .from('whop_gateway_credentials')
    .update({ enabled: body.enabled })
    .eq('account_id', ctx.accountId)
    .select('enabled')
    .maybeSingle()
  if (error) {
    console.error('[payments config PATCH] failed:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Connect Whop first' }, { status: 400 })
  }
  return NextResponse.json({ success: true, enabled: data.enabled })
}

/** DELETE /api/payments/whop/config — disconnects Whop only; PayPal's credentials are a separate table. */
export async function DELETE() {
  let ctx
  try {
    ctx = await requireRole('admin')
  } catch (err) {
    return toErrorResponse(err)
  }

  const { error } = await ctx.supabase
    .from('whop_gateway_credentials')
    .delete()
    .eq('account_id', ctx.accountId)
  if (error) {
    console.error('[payments/whop/config DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
