import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { parseBumpPrice } from '@/lib/payments/order-bumps'
import { FUNNEL_STEP_KINDS, sanitizeFunnelPage } from '@/lib/payments/funnel'
import type { PaymentFunnelStepKind } from '@/types'

interface PutBody {
  offer_form_ids?: string[]
  price?: number | string | null
  compare_at_price?: number | string | null
  page?: unknown
  active?: boolean
}

function parseKind(kind: string): PaymentFunnelStepKind | null {
  return (FUNNEL_STEP_KINDS as string[]).includes(kind) ? (kind as PaymentFunnelStepKind) : null
}

/**
 * PUT /api/payments/forms/[id]/funnel/[kind]  (kind = upsell | downsell)
 *
 * Creates or replaces this offer's upsell/downsell (migration 063).
 * Rejects offers that could never be charged as one PayPal order with
 * this checkout's currency — another account's, archived, not a fixed
 * price, or a different currency — up front, instead of letting them
 * silently vanish from the public page (`loadFunnelStep` filters them
 * at render time too).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id, kind: rawKind } = await params
  const kind = parseKind(rawKind)
  if (!kind) return NextResponse.json({ error: 'Unknown step' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const offerIds = [...new Set((body.offer_form_ids ?? []).filter((v) => typeof v === 'string'))]
  if (offerIds.length === 0) {
    return NextResponse.json({ error: 'Choose at least one offer to sell' }, { status: 400 })
  }
  if (offerIds.length > 5) {
    return NextResponse.json({ error: 'A step can sell at most 5 offers' }, { status: 400 })
  }
  if (offerIds.includes(id)) {
    return NextResponse.json({ error: 'The upsell/downsell cannot sell the same offer that was just bought' }, { status: 400 })
  }

  const price = parseBumpPrice(body.price)
  const compareAtPrice = parseBumpPrice(body.compare_at_price)
  if (price === 'invalid' || compareAtPrice === 'invalid') {
    return NextResponse.json({ error: 'Prices must be numbers greater than 0' }, { status: 400 })
  }

  const { data: offers } = await ctx.supabase
    .from('payment_forms')
    .select('id, currency, amount_type, amount, status')
    .eq('account_id', ctx.accountId)
    .in('id', [id, ...offerIds])
  const main = offers?.find((o: { id: string }) => o.id === id)
  if (!main) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  for (const offerId of offerIds) {
    const offer = offers?.find((o: { id: string }) => o.id === offerId)
    if (!offer || offer.status === 'archived') {
      return NextResponse.json({ error: 'One of the chosen offers is no longer available' }, { status: 404 })
    }
    if (offer.amount_type !== 'fixed' || !(Number(offer.amount) > 0)) {
      return NextResponse.json({ error: 'Every offer sold here must have a fixed price' }, { status: 400 })
    }
    if (offer.currency !== main.currency) {
      return NextResponse.json(
        { error: `Every offer sold here must be priced in ${main.currency}, the same currency as this offer` },
        { status: 400 },
      )
    }
  }

  const { data, error } = await ctx.supabase
    .from('payment_funnel_steps')
    .upsert(
      {
        account_id: ctx.accountId,
        form_id: id,
        kind,
        offer_form_ids: offerIds,
        price: price ?? null,
        compare_at_price: compareAtPrice ?? null,
        page: sanitizeFunnelPage(body.page),
        active: body.active === undefined ? true : Boolean(body.active),
      },
      { onConflict: 'form_id,kind' },
    )
    .select()
    .single()

  if (error) {
    console.error('[payments/forms/[id]/funnel/[kind] PUT] failed:', error)
    return NextResponse.json({ error: 'Failed to save the upsell/downsell' }, { status: 500 })
  }
  return NextResponse.json({ step: data })
}

/**
 * PATCH /api/payments/forms/[id]/funnel/[kind]  { active }
 *
 * Turns a step on/off without touching its configuration.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id, kind: rawKind } = await params
  const kind = parseKind(rawKind)
  if (!kind) return NextResponse.json({ error: 'Unknown step' }, { status: 404 })
  const body = (await request.json().catch(() => null)) as { active?: boolean } | null
  if (typeof body?.active !== 'boolean') {
    return NextResponse.json({ error: 'active is required' }, { status: 400 })
  }

  const { data, error } = await ctx.supabase
    .from('payment_funnel_steps')
    .update({ active: body.active })
    .eq('form_id', id)
    .eq('kind', kind)
    .eq('account_id', ctx.accountId)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[payments/forms/[id]/funnel/[kind] PATCH] failed:', error)
    return NextResponse.json({ error: 'Failed to save the upsell/downsell' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ step: data })
}

/**
 * DELETE /api/payments/forms/[id]/funnel/[kind]
 *
 * Safe as a hard delete: past purchases keep their own copy of what was
 * bought in `payment_transactions.line_items`.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id, kind: rawKind } = await params
  const kind = parseKind(rawKind)
  if (!kind) return NextResponse.json({ error: 'Unknown step' }, { status: 404 })

  const { error } = await ctx.supabase
    .from('payment_funnel_steps')
    .delete()
    .eq('form_id', id)
    .eq('kind', kind)
    .eq('account_id', ctx.accountId)

  if (error) {
    console.error('[payments/forms/[id]/funnel/[kind] DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to remove the upsell/downsell' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
