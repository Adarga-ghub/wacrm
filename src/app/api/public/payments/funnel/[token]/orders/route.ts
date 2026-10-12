import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/payments/admin-db'
import { resolveGateway } from '@/lib/payments/gateway'
import { createOrder, getAccessToken } from '@/lib/payments/paypal-client'
import {
  funnelLineItems,
  funnelMainForm,
  funnelOrderItems,
  loadFunnelParent,
  loadFunnelStep,
} from '@/lib/payments/funnel'
import type { PaymentFunnelStepKind } from '@/types'

/**
 * POST /api/public/payments/funnel/[token]/orders  { stage }
 *
 * "Sí, lo quiero" on an upsell/downsell page: creates the PayPal order
 * for the step the buyer is on. Like the checkout's order route, the
 * request only says WHICH step — the price comes from `loadFunnelStep`,
 * the same resolver the page was rendered from. The buyer's details are
 * copied from the original purchase (they never re-type them), and the
 * new `payment_transactions` row is linked to it via
 * `parent_transaction_id`; capturing it reuses
 * `POST /api/public/payments/orders/[orderId]/capture`, which delivers
 * every offer of the step and then closes the funnel.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const db = supabaseAdmin()
  const { token } = await params
  const body = (await request.json().catch(() => null)) as { stage?: PaymentFunnelStepKind } | null
  const parent = await loadFunnelParent(db, token)
  if (!parent) {
    return NextResponse.json({ error: 'This offer is not available' }, { status: 404 })
  }
  const stage = parent.funnel_stage
  if (stage !== 'upsell' && stage !== 'downsell') {
    return NextResponse.json({ error: 'This offer has already ended' }, { status: 409 })
  }
  if (body?.stage && body.stage !== stage) {
    return NextResponse.json({ error: 'This offer changed — please reload the page' }, { status: 409 })
  }

  const step = await loadFunnelStep(db, funnelMainForm(parent), stage)
  if (!step) {
    return NextResponse.json({ error: 'This offer is no longer available — please reload the page' }, { status: 400 })
  }

  const gateway = await resolveGateway(db, parent.account_id)
  if (!gateway) {
    return NextResponse.json({ error: 'This merchant has not connected PayPal yet' }, { status: 400 })
  }

  const items = funnelOrderItems(step)
  let orderId: string
  try {
    const { accessToken } = await getAccessToken(gateway)
    const order = await createOrder({
      accessToken,
      environment: gateway.environment,
      currency: parent.currency,
      amount: items.amount,
      referenceId: crypto.randomUUID(),
      description: step.lines.map((l) => l.name).join(' + '),
      itemName: items.itemName,
      extraItems: items.extraItems,
    })
    orderId = order.id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown PayPal error'
    console.error('[public/payments/funnel/[token]/orders POST] createOrder failed:', message)
    return NextResponse.json({ error: 'Could not start the payment — please try again' }, { status: 502 })
  }

  // `_product_name` labels the ORIGINAL purchase's product_list pick —
  // carrying it over would mislabel this one on receipts.
  const { _product_name: _ignored, ...fieldValues } = parent.form_field_values ?? {}
  void _ignored

  const { error: insertErr } = await db.from('payment_transactions').insert({
    account_id: parent.account_id,
    form_id: step.lines[0].formId,
    parent_transaction_id: parent.id,
    funnel_step: stage,
    paypal_order_id: orderId,
    status: 'created',
    amount: step.price,
    line_items: funnelLineItems(step),
    currency: parent.currency,
    whatsapp_phone: parent.whatsapp_phone,
    form_field_values: fieldValues,
    payer_name: parent.payer_name,
    payer_email: parent.payer_email,
    send_automation: parent.send_automation,
  })
  if (insertErr) {
    console.error('[public/payments/funnel/[token]/orders POST] failed to record transaction:', insertErr)
    return NextResponse.json({ error: 'Could not start the payment — please try again' }, { status: 500 })
  }

  return NextResponse.json({ order_id: orderId })
}
