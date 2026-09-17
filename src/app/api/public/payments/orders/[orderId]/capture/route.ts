import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveGateway } from '@/lib/payments/gateway'
import { getAccessToken, captureOrder } from '@/lib/payments/paypal-client'
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
 * POST /api/public/payments/orders/[orderId]/capture
 *
 * Called by the checkout page right after the PayPal JS SDK's
 * `onApprove` fires. This is a server-to-server call WE make to
 * PayPal's capture endpoint — the browser only tells us "the payer
 * approved it", it never gets to claim the payment itself succeeded.
 * `capture.status === 'COMPLETED'` (PayPal's own response, not
 * anything the client sent) is what flips the transaction to
 * 'completed' and fires the automation.
 *
 * Idempotent: a transaction already 'completed' short-circuits
 * before calling PayPal again — covers a double-click or a retried
 * request after a slow response. `POST /api/payments/paypal/webhook`
 * (once the deployment has a public URL registered with PayPal) is a
 * second, independent path to the same idempotent update, for the
 * case where the payer's browser closes before this call completes.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const db = supabaseAdmin()
  const { orderId } = await params

  const { data: txn, error: txnErr } = await db
    .from('payment_transactions')
    .select('*')
    .eq('paypal_order_id', orderId)
    .maybeSingle()
  if (txnErr || !txn) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const { data: form } = await db
    .from('payment_forms')
    .select('redirect_url, inline_success_message, automation_id, created_by, account_id')
    .eq('id', txn.form_id)
    .maybeSingle()

  if (txn.status === 'completed') {
    return NextResponse.json({
      success: true,
      redirect_url: form?.redirect_url ?? null,
      inline_message: form?.inline_success_message ?? null,
    })
  }

  const gateway = await resolveGateway(db, txn.account_id)
  if (!gateway) {
    return NextResponse.json({ error: 'Payment gateway not available' }, { status: 500 })
  }

  let capture
  try {
    const { accessToken } = await getAccessToken(gateway)
    capture = await captureOrder({ accessToken, environment: gateway.environment, orderId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown PayPal error'
    console.error('[public/payments/orders/[orderId]/capture] captureOrder failed:', message)
    await db.from('payment_transactions').update({ status: 'failed' }).eq('id', txn.id)
    return NextResponse.json({ error: 'The payment could not be completed' }, { status: 502 })
  }

  if (capture.status !== 'COMPLETED') {
    await db.from('payment_transactions').update({ status: 'failed' }).eq('id', txn.id)
    return NextResponse.json({ error: 'The payment was not completed' }, { status: 400 })
  }

  await finalizePaymentTransaction(db, {
    transactionId: txn.id,
    accountId: txn.account_id,
    payerName: capture.payerName,
    payerEmail: capture.payerEmail,
    captureId: capture.captureId,
  })

  return NextResponse.json({
    success: true,
    redirect_url: form?.redirect_url ?? null,
    inline_message: form?.inline_success_message ?? null,
  })
}
