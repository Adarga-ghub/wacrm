import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { generateSlug } from '@/lib/payments/slug'
import { defaultPaymentFormFields } from '@/lib/payments/default-fields'
import { PAYMENT_CURRENCY_CODES, isPaypalSupportedCurrency } from '@/lib/currency'

/**
 * GET /api/payments/products/[id]/prices
 *
 * Convenience alias for the prices already returned inline by `GET
 * /api/payments/products/[id]` — kept as its own endpoint so the
 * product detail page can re-fetch just the price list (e.g. after
 * adding one) without re-fetching the product itself.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id } = await params

  const { data, error } = await ctx.supabase
    .from('payment_forms')
    .select('*')
    .eq('product_id', id)
    .eq('account_id', ctx.accountId)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[payments/products/[id]/prices GET] failed:', error)
    return NextResponse.json({ error: 'Failed to list prices' }, { status: 500 })
  }

  return NextResponse.json({ prices: data ?? [] })
}

interface PostBody {
  name?: string
  amount?: number
  /** One of `PAYMENT_CURRENCY_CODES` (src/lib/currency.ts) — defaults to the account's default_currency when omitted, falling back to USD. */
  currency?: string
  /** Publish immediately so `/pay/[slug]` is live right away — the "genera el enlace automáticamente" step of the product wizard. */
  publish?: boolean
}

/**
 * POST /api/payments/products/[id]/prices
 *
 * Creates a "precio" — a `payment_form` scoped to this product via
 * `product_id`, seeded with the product's `default_skin_id` (a
 * one-time convenience copy, not an enforced link — see migration
 * 054) and the standard WhatsApp-required fields (`defaultPaymentFormFields`,
 * same as `POST /api/payments/forms`). `currency` is caller-chosen
 * (one of the 5 the Payments module offers) rather than always
 * inherited from the account default, so a merchant can price this
 * one product/offer differently — DOP/COP/ARS are allowed here too,
 * but `publish: true` is rejected for them (see the currency check
 * below) since PayPal can't actually settle a checkout in those.
 *
 * `publish: true` skips the separate "now go publish it" step and
 * flips the product itself to `published` the first time this
 * happens, so the product list's status reflects "has a live price"
 * rather than just "the product record was created."
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id } = await params
  const body = (await request.json().catch(() => null)) as PostBody | null

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const amount = Number(body?.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'A valid amount is required' }, { status: 400 })
  }
  if (body?.currency !== undefined && !PAYMENT_CURRENCY_CODES.includes(body.currency)) {
    return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })
  }

  const { data: product } = await ctx.supabase
    .from('payment_products')
    .select('id, status, default_skin_id')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .maybeSingle()
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: account } = await ctx.supabase
    .from('accounts')
    .select('default_currency')
    .eq('id', ctx.accountId)
    .maybeSingle()

  const currency = body?.currency ?? account?.default_currency ?? 'USD'

  if (body?.publish && !isPaypalSupportedCurrency(currency)) {
    return NextResponse.json(
      { error: `PayPal cannot process payments in ${currency}. Change the currency to USD or MXN before publishing.` },
      { status: 400 },
    )
  }

  const status = body?.publish ? 'published' : 'draft'

  let created: { id: string; slug: string } | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await ctx.supabase
      .from('payment_forms')
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        product_id: product.id,
        skin_id: product.default_skin_id,
        name,
        slug: generateSlug(name),
        status,
        fields: defaultPaymentFormFields(),
        amount_type: 'fixed',
        amount,
        currency,
        send_automation_default: true,
      })
      .select()
      .single()

    if (!error) {
      created = data
      break
    }
    if (error.code !== '23505' /* unique_violation on slug */) {
      console.error('[payments/products/[id]/prices POST] failed:', error)
      return NextResponse.json({ error: 'Failed to create price' }, { status: 500 })
    }
  }

  if (!created) {
    return NextResponse.json({ error: 'Could not generate a unique link — try again' }, { status: 500 })
  }

  if (body?.publish && product.status === 'draft') {
    await ctx.supabase.from('payment_products').update({ status: 'published' }).eq('id', product.id)
  }

  return NextResponse.json(
    {
      form: created,
      url: body?.publish ? `/pay/${created.slug}` : null,
    },
    { status: 201 },
  )
}
