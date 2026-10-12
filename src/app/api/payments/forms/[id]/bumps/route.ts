import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

/**
 * GET /api/payments/forms/[id]/bumps
 *
 * The order bumps configured on this offer (migration 061), in
 * checkout display order — including inactive ones, so the admin can
 * re-enable them.
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
    .from('payment_order_bumps')
    .select('*')
    .eq('form_id', id)
    .eq('account_id', ctx.accountId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[payments/forms/[id]/bumps GET] failed:', error)
    return NextResponse.json({ error: 'Failed to load order bumps' }, { status: 500 })
  }
  return NextResponse.json({ bumps: data ?? [] })
}

interface PostBody {
  bump_form_id?: string
  title?: string | null
  description?: string | null
}

/**
 * POST /api/payments/forms/[id]/bumps
 *
 * Attaches another offer of this account as an order bump. Rejects an
 * offer that could never be charged alongside this one — a different
 * currency (one PayPal order = one currency) or a non-fixed price —
 * up front, instead of letting it silently vanish from the checkout
 * (`loadOrderBumps` filters those out at render time too).
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
  if (!body?.bump_form_id) {
    return NextResponse.json({ error: 'bump_form_id is required' }, { status: 400 })
  }
  if (body.bump_form_id === id) {
    return NextResponse.json({ error: 'An offer cannot be an order bump of itself' }, { status: 400 })
  }

  const { data: offers } = await ctx.supabase
    .from('payment_forms')
    .select('id, currency, amount_type, amount, status')
    .eq('account_id', ctx.accountId)
    .in('id', [id, body.bump_form_id])
  const main = offers?.find((o: { id: string }) => o.id === id)
  const bumpOffer = offers?.find((o: { id: string }) => o.id === body.bump_form_id)
  if (!main || !bumpOffer || bumpOffer.status === 'archived') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (bumpOffer.amount_type !== 'fixed' || !(Number(bumpOffer.amount) > 0)) {
    return NextResponse.json({ error: 'The order bump offer must have a fixed price' }, { status: 400 })
  }
  if (bumpOffer.currency !== main.currency) {
    return NextResponse.json(
      { error: `The order bump must be priced in ${main.currency}, the same currency as this offer` },
      { status: 400 },
    )
  }

  const { count } = await ctx.supabase
    .from('payment_order_bumps')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', id)

  const { data, error } = await ctx.supabase
    .from('payment_order_bumps')
    .insert({
      account_id: ctx.accountId,
      form_id: id,
      bump_form_id: body.bump_form_id,
      title: body.title?.trim() || null,
      description: body.description?.trim() || null,
      position: count ?? 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That offer is already an order bump here' }, { status: 409 })
    }
    console.error('[payments/forms/[id]/bumps POST] failed:', error)
    return NextResponse.json({ error: 'Failed to add order bump' }, { status: 500 })
  }
  return NextResponse.json({ bump: data }, { status: 201 })
}
