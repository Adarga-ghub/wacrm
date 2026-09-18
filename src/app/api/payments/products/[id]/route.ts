import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

/**
 * GET /api/payments/products/[id]
 *
 * Product detail plus its prices (`payment_forms` where
 * `product_id = id`) — the product page renders both in one round
 * trip rather than a second client-side fetch.
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

  const { data: product, error } = await ctx.supabase
    .from('payment_products')
    .select('*')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .maybeSingle()

  if (error) {
    console.error('[payments/products/[id] GET] failed:', error)
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 })
  }
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: prices, error: pricesErr } = await ctx.supabase
    .from('payment_forms')
    .select('*')
    .eq('product_id', id)
    .eq('account_id', ctx.accountId)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })

  if (pricesErr) {
    console.error('[payments/products/[id] GET] prices failed:', pricesErr)
    return NextResponse.json({ error: 'Failed to load product prices' }, { status: 500 })
  }

  return NextResponse.json({ product, prices: prices ?? [] })
}

interface PutBody {
  name?: string
  description?: string | null
  image_url?: string | null
  status?: 'draft' | 'published' | 'archived'
  default_skin_id?: string | null
}

export async function PUT(
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
  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { data: existing } = await ctx.supabase
    .from('payment_products')
    .select('id')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    update.name = name
  }
  if (body.description !== undefined) update.description = body.description || null
  if (body.image_url !== undefined) update.image_url = body.image_url || null

  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.status = body.status
  }

  if (body.default_skin_id !== undefined) {
    if (body.default_skin_id === null) {
      update.default_skin_id = null
    } else {
      const { data: skin } = await ctx.supabase
        .from('payment_skins')
        .select('id')
        .eq('id', body.default_skin_id)
        .eq('account_id', ctx.accountId)
        .maybeSingle()
      if (!skin) {
        return NextResponse.json({ error: 'default_skin_id not found for this account' }, { status: 400 })
      }
      update.default_skin_id = body.default_skin_id
    }
  }

  const { data, error } = await ctx.supabase
    .from('payment_products')
    .update(update)
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .select()
    .single()

  if (error) {
    console.error('[payments/products/[id] PUT] failed:', error)
    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 })
  }

  return NextResponse.json({ product: data })
}

/**
 * DELETE /api/payments/products/[id]
 *
 * Archives rather than deletes — mirrors `DELETE
 * /api/payments/forms/[id]`. Its prices are untouched (still
 * individually archivable) and keep their own transaction history;
 * they just stop being listed under this product once it's archived
 * (the product itself is filtered out of `GET /api/payments/products`).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id } = await params

  const { error } = await ctx.supabase
    .from('payment_products')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('account_id', ctx.accountId)

  if (error) {
    console.error('[payments/products/[id] DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to archive product' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
