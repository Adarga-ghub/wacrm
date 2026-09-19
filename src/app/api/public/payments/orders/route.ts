import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveGateway } from '@/lib/payments/gateway'
import { getAccessToken, createOrder } from '@/lib/payments/paypal-client'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'
import type { PaymentFormField } from '@/types'

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

interface OrderBody {
  slug: string
  link_code?: string
  field_values: Record<string, string>
  /** Payer-entered amount — only honoured when `amount_type === 'variable'` and no link override applies. */
  amount?: number
  /** Chosen product's id — required when `amount_type === 'product_list'`. */
  product_id?: string
}

/**
 * POST /api/public/payments/orders
 *
 * Creates the PayPal order server-side (public route — no session).
 * The amount is ALWAYS resolved here from the form/link, never
 * trusted from the request body except for the one case where the
 * form explicitly allows a payer-chosen amount (`amount_type ===
 * 'variable'`), and even then it's floored at `min_amount`. Records
 * a `payment_transactions` row in `status: 'created'` before
 * returning, carrying the `send_automation` flag the merchant fixed
 * when the form/link was set up — the capture step and the webhook
 * both read it from there rather than re-deriving it.
 */
export async function POST(request: Request) {
  const db = supabaseAdmin()
  const body = (await request.json().catch(() => null)) as OrderBody | null
  if (!body?.slug || !body.field_values) {
    return NextResponse.json({ error: 'slug and field_values are required' }, { status: 400 })
  }

  const { data: form, error: formErr } = await db
    .from('payment_forms')
    .select('*')
    .eq('slug', body.slug)
    .eq('status', 'published')
    .maybeSingle()
  if (formErr || !form) {
    return NextResponse.json({ error: 'This payment form is not available' }, { status: 404 })
  }

  let link: { id: string; send_automation: boolean; amount_override: number | null } | null = null
  if (body.link_code) {
    const { data: linkRow } = await db
      .from('payment_links')
      .select('id, send_automation, amount_override, status, expires_at')
      .eq('form_id', form.id)
      .eq('code', body.link_code)
      .maybeSingle()
    if (
      linkRow &&
      linkRow.status === 'active' &&
      (!linkRow.expires_at || new Date(linkRow.expires_at) > new Date())
    ) {
      link = linkRow
    }
  }

  // Required-field validation, server-side — the public checkout
  // page also enforces this, but it's a public POST body so nothing
  // client-side is trustworthy.
  const fields = form.fields as PaymentFormField[]
  for (const field of fields) {
    if (field.required && !body.field_values[field.id]?.trim()) {
      return NextResponse.json({ error: `${field.label} is required` }, { status: 400 })
    }
  }

  const rawPhone = body.field_values['whatsapp_phone'] ?? ''
  const normalizedPhone = normalizePhone(rawPhone)
  if (!normalizedPhone) {
    return NextResponse.json({ error: 'A valid WhatsApp number is required' }, { status: 400 })
  }

  // Resolve the amount — this is the one place a tampered request
  // body could try to under-pay, so every branch is server-computed.
  let amount: number
  let productName: string | null = null
  if (link?.amount_override != null) {
    amount = link.amount_override
  } else if (form.amount_type === 'fixed') {
    if (form.amount == null) {
      return NextResponse.json({ error: 'This form has no amount configured' }, { status: 400 })
    }
    amount = form.amount
  } else if (form.amount_type === 'variable') {
    const payerAmount = Number(body.amount)
    const floor = form.min_amount ?? 0
    if (!Number.isFinite(payerAmount) || payerAmount < floor) {
      return NextResponse.json({ error: `Amount must be at least ${floor} ${form.currency}` }, { status: 400 })
    }
    amount = payerAmount
  } else if (form.amount_type === 'product_list') {
    const products = (form.products ?? []) as { id: string; name: string; price: number }[]
    const product = products.find((p) => p.id === body.product_id)
    if (!product) {
      return NextResponse.json({ error: 'Please choose a product' }, { status: 400 })
    }
    amount = product.price
    productName = product.name
  } else {
    return NextResponse.json({ error: 'This form type is not supported yet' }, { status: 400 })
  }

  const gateway = await resolveGateway(db, form.account_id)
  if (!gateway) {
    return NextResponse.json({ error: 'This merchant has not connected PayPal yet' }, { status: 400 })
  }

  // Resolve the exact item name/description PayPal will show on its
  // notification email and the payer's receipt — the actual
  // book/resource being sold, never a generic "Payment" line. A
  // `product_list` pick wins (it's the most specific), then a linked
  // Producto (migration 054), falling back to the bare form name for
  // a standalone form with neither.
  let itemName = form.name
  let itemDescription: string | undefined
  if (productName) {
    itemName = productName
  } else if (form.product_id) {
    const { data: productRow } = await db
      .from('payment_products')
      .select('name, description')
      .eq('id', form.product_id)
      .maybeSingle()
    if (productRow) {
      itemName = productRow.name
      itemDescription = productRow.description ?? undefined
    }
  }

  let orderId: string
  try {
    const { accessToken } = await getAccessToken(gateway)
    const order = await createOrder({
      accessToken,
      environment: gateway.environment,
      currency: form.currency,
      amount: amount.toFixed(2),
      referenceId: crypto.randomUUID(),
      description: productName ? `${form.name} — ${productName}` : form.name,
      itemName,
      itemDescription,
    })
    orderId = order.id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown PayPal error'
    console.error('[public/payments/orders POST] createOrder failed:', message)
    return NextResponse.json({ error: 'Could not start the payment — please try again' }, { status: 502 })
  }

  const { error: insertErr } = await db.from('payment_transactions').insert({
    account_id: form.account_id,
    form_id: form.id,
    link_id: link?.id ?? null,
    paypal_order_id: orderId,
    status: 'created',
    amount,
    currency: form.currency,
    whatsapp_phone: rawPhone,
    form_field_values: productName
      ? { ...body.field_values, _product_name: productName }
      : body.field_values,
    send_automation: link ? link.send_automation : form.send_automation_default,
  })
  if (insertErr) {
    console.error('[public/payments/orders POST] failed to record transaction:', insertErr)
    return NextResponse.json({ error: 'Could not start the payment — please try again' }, { status: 500 })
  }

  return NextResponse.json({ order_id: orderId })
}
