import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { parseBumpPrice } from '@/lib/payments/order-bumps'

interface PutBody {
  title?: string | null
  description?: string | null
  active?: boolean
  position?: number
  price?: number | string | null
  compare_at_price?: number | string | null
}

/** PUT /api/payments/forms/[id]/bumps/[bumpId] — edit an order bump's copy, toggle it, or reorder it. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; bumpId: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id, bumpId } = await params
  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title?.trim() || null
  if (body.description !== undefined) update.description = body.description?.trim() || null
  if (body.active !== undefined) update.active = Boolean(body.active)
  if (body.position !== undefined && Number.isInteger(body.position)) update.position = body.position
  const price = parseBumpPrice(body.price)
  const compareAtPrice = parseBumpPrice(body.compare_at_price)
  if (price === 'invalid' || compareAtPrice === 'invalid') {
    return NextResponse.json({ error: 'Prices must be numbers greater than 0' }, { status: 400 })
  }
  if (price !== undefined) update.price = price
  if (compareAtPrice !== undefined) update.compare_at_price = compareAtPrice

  const { data, error } = await ctx.supabase
    .from('payment_order_bumps')
    .update(update)
    .eq('id', bumpId)
    .eq('form_id', id)
    .eq('account_id', ctx.accountId)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[payments/forms/[id]/bumps/[bumpId] PUT] failed:', error)
    return NextResponse.json({ error: 'Failed to save order bump' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ bump: data })
}

/**
 * DELETE /api/payments/forms/[id]/bumps/[bumpId]
 *
 * A hard delete is safe here (unlike archiving a form): past purchases
 * keep their own copy of what was bought in
 * `payment_transactions.line_items`, nothing references this row.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; bumpId: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id, bumpId } = await params

  const { error } = await ctx.supabase
    .from('payment_order_bumps')
    .delete()
    .eq('id', bumpId)
    .eq('form_id', id)
    .eq('account_id', ctx.accountId)

  if (error) {
    console.error('[payments/forms/[id]/bumps/[bumpId] DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to remove order bump' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
