import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { finalizePaymentTransaction } from '@/lib/payments/finalize'
import { resolvePostPurchaseRedirect } from '@/lib/payments/funnel'
import { resolveWhopGateway } from '@/lib/payments/whop-gateway'
import { isPaymentForOrder, payerFromPayment, retrievePayment } from '@/lib/payments/whop-client'

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
 * POST /api/public/payments/whop/confirm
 *
 * Called by the return page. The browser only names a payment id; the
 * payment counts only after WE ask Whop about it and it comes back paid
 * and carrying this order's reference — so typing `status=succeeded` into
 * the URL gets nobody anything. Answers `{ pending: true }` while there's
 * nothing to confirm yet, and the page asks again; the webhook completes
 * the order independently.
 */
export async function POST(request: Request) {
  const db = supabaseAdmin()
  const body = (await request.json().catch(() => null)) as {
    order_id?: string
    payment_id?: string
  } | null
  if (!body?.order_id) {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
  }

  const { data: txn } = await db
    .from('payment_transactions')
    .select('*')
    .eq('paypal_order_id', body.order_id)
    .eq('gateway', 'whop')
    .maybeSingle()
  if (!txn) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (txn.status === 'completed') {
    return NextResponse.json({ success: true, ...(await resolvePostPurchaseRedirect(db, txn)) })
  }
  if (!body.payment_id) {
    return NextResponse.json({ pending: true })
  }

  const gateway = await resolveWhopGateway(db, txn.account_id)
  if (!gateway) {
    return NextResponse.json({ error: 'Payment gateway not available' }, { status: 500 })
  }

  let payment
  try {
    payment = await retrievePayment({
      environment: gateway.environment,
      apiKey: gateway.apiKey,
      paymentId: body.payment_id,
    })
  } catch (err) {
    // Whop may not have the payment readable the instant the buyer
    // returns — not a failure, the page asks again.
    console.warn('[public/payments/whop/confirm] retrievePayment failed:', err)
    return NextResponse.json({ pending: true })
  }

  if (!isPaymentForOrder(payment, body.order_id)) {
    return NextResponse.json({ pending: true })
  }

  const payer = payerFromPayment(payment)
  await finalizePaymentTransaction(db, {
    transactionId: txn.id,
    accountId: txn.account_id,
    payerName: payer.name,
    payerEmail: payer.email,
    captureId: payment.id,
  })

  return NextResponse.json({ success: true, ...(await resolvePostPurchaseRedirect(db, txn)) })
}
