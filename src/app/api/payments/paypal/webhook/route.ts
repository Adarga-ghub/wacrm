import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveGateway } from '@/lib/payments/gateway'
import { getAccessToken, verifyWebhookSignature } from '@/lib/payments/paypal-client'
import { finalizePaymentTransaction } from '@/lib/payments/finalize'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

/**
 * POST /api/payments/paypal/webhook
 *
 * Server-to-server backstop for `PAYMENT.CAPTURE.COMPLETED`, for the
 * case a payer's browser closes right after approving but before the
 * checkout page's own capture call
 * (`POST /api/public/payments/orders/[orderId]/capture`) returns —
 * that call is the PRIMARY path (it's what makes the payment happen
 * at all); this webhook independently reaches the exact same
 * idempotent update, so whichever fires first does the work and the
 * other is a no-op.
 *
 * Requires the deployment to have a real public URL registered with
 * PayPal for the `webhook_id` we stored (see
 * `POST /api/payments/config`'s auto-registration) — see
 * `src/lib/payments/site-url.ts`'s notes on `NEXT_PUBLIC_SITE_URL`.
 *
 * Signature verification order matters: we can't verify without
 * knowing WHICH account's credentials + webhook_id to check against,
 * so we first resolve the transaction row (by the ids PayPal's event
 * carries, not account-scoped — `payment_transactions.paypal_order_id`
 * is globally unique) purely to learn `account_id`, THEN load that
 * account's gateway config and verify. Nothing from the event is
 * trusted or acted on before verification succeeds.
 */
export async function POST(request: Request) {
  const db = supabaseAdmin()
  const rawBody = await request.text()
  let event: {
    event_type?: string
    resource?: {
      id?: string
      status?: string
      supplementary_data?: { related_ids?: { order_id?: string } }
      payer?: { name?: { given_name?: string; surname?: string }; email_address?: string }
    }
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    // Every other subscribed event type is informational only for
    // now (approvals, denials, refunds) — ack so PayPal doesn't
    // retry, nothing to reconcile against yet.
    return NextResponse.json({ ok: true })
  }

  const captureId = event.resource?.id
  const orderId = event.resource?.supplementary_data?.related_ids?.order_id
  if (!captureId && !orderId) {
    return NextResponse.json({ error: 'Missing resource id' }, { status: 400 })
  }

  const { data: txn } = await db
    .from('payment_transactions')
    .select('*')
    .or(
      [captureId ? `paypal_capture_id.eq.${captureId}` : null, orderId ? `paypal_order_id.eq.${orderId}` : null]
        .filter(Boolean)
        .join(','),
    )
    .maybeSingle()
  if (!txn) {
    // Nothing recorded for this order yet — the checkout page's own
    // create-order call may not have landed, or this is an event for
    // a different integration entirely. Ack without erroring; PayPal
    // doesn't need a retry for a row we'll never have.
    return NextResponse.json({ ok: true })
  }

  const gateway = await resolveGateway(db, txn.account_id)
  if (!gateway || !gateway.webhookId) {
    console.warn('[payments/paypal/webhook] no gateway/webhook_id for account', txn.account_id)
    return NextResponse.json({ ok: true })
  }

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })

  try {
    const { accessToken } = await getAccessToken(gateway)
    const { verified } = await verifyWebhookSignature({
      accessToken,
      environment: gateway.environment,
      webhookId: gateway.webhookId,
      headers,
      webhookEvent: JSON.parse(rawBody),
    })
    if (!verified) {
      console.warn('[payments/paypal/webhook] signature verification failed', { txnId: txn.id })
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
    }
  } catch (err) {
    console.error('[payments/paypal/webhook] verification error:', err)
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
  }

  // Idempotent — the checkout page's own capture call is the primary
  // path and usually wins the race.
  if (txn.status === 'completed') {
    return NextResponse.json({ ok: true, already_processed: true })
  }

  // Webhook-specific forensic field — kept separate from
  // `finalizePaymentTransaction` since the capture-route path (the
  // primary one) has no raw event payload to store.
  await db.from('payment_transactions').update({ raw_webhook_payload: event }).eq('id', txn.id)

  const payerName = event.resource?.payer?.name
    ? [event.resource.payer.name.given_name, event.resource.payer.name.surname]
        .filter(Boolean)
        .join(' ')
    : null

  await finalizePaymentTransaction(db, {
    transactionId: txn.id,
    accountId: txn.account_id,
    payerName,
    payerEmail: event.resource?.payer?.email_address ?? null,
    captureId: captureId ?? null,
  })

  return NextResponse.json({ ok: true })
}
