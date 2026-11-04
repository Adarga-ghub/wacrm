import { after, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { unwrapWebhook } from '@whop/sdk/helpers'
import { finalizePaymentTransaction } from '@/lib/payments/finalize'
import { loadWhopWebhookSecrets } from '@/lib/payments/whop-gateway'
import {
  isPaymentForOrder,
  payerFromPayment,
  WHOP_ORDER_METADATA_KEY,
  type WhopPayment,
} from '@/lib/payments/whop-client'

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
 * POST /api/payments/whop/webhook
 *
 * `payment.succeeded` from Whop: completes the order even if the buyer
 * closed the browser before reaching the return page. Reaches the same
 * idempotent `finalizePaymentTransaction` as the return page, so whichever
 * arrives first does the work.
 *
 * As in the PayPal webhook, the account's secret can only be picked after
 * reading which order the event names, so that lookup happens first —
 * but nothing from the event is acted on until its signature verifies.
 */
export async function POST(request: Request) {
  const db = supabaseAdmin()
  const rawBody = await request.text()

  let parsed: { type?: string; data?: WhopPayment }
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Whop's own "send test event" and any event for a payment that isn't
  // ours land here: acknowledge them so Whop doesn't retry or disable the
  // endpoint over something there's nothing to do about.
  const orderId = parsed.data?.metadata?.[WHOP_ORDER_METADATA_KEY]
  if (parsed.type !== 'payment.succeeded' || typeof orderId !== 'string') {
    return NextResponse.json({ ok: true })
  }

  const { data: txn } = await db
    .from('payment_transactions')
    .select('id, account_id, status')
    .eq('paypal_order_id', orderId)
    .eq('gateway', 'whop')
    .maybeSingle()
  if (!txn) return NextResponse.json({ ok: true })

  const headers = Object.fromEntries(request.headers)
  const secrets = await loadWhopWebhookSecrets(db, txn.account_id)
  const verified = secrets.some((key) => {
    try {
      unwrapWebhook(rawBody, { headers, key })
      return true
    } catch {
      return false
    }
  })
  if (!verified) {
    console.warn('[payments/whop/webhook] signature verification failed', { txnId: txn.id })
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
  }

  const payment = parsed.data as WhopPayment
  if (txn.status === 'completed' || !isPaymentForOrder(payment, orderId)) {
    return NextResponse.json({ ok: true })
  }

  // Whop needs an answer within 5 seconds; receipts and automations can
  // take longer, so they run after the response.
  const payer = payerFromPayment(payment)
  after(async () => {
    try {
      await finalizePaymentTransaction(db, {
        transactionId: txn.id,
        accountId: txn.account_id,
        payerName: payer.name,
        payerEmail: payer.email,
        captureId: payment.id,
      })
    } catch (err) {
      console.error('[payments/whop/webhook] finalize failed:', err)
    }
  })

  return NextResponse.json({ ok: true })
}
