import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

/**
 * GET /api/payments/products
 *
 * Lists every product for the caller's account, newest first.
 * Mirrors `GET /api/payments/forms` / `GET /api/payments/skins`.
 */
export async function GET() {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }

  const { data, error } = await ctx.supabase
    .from('payment_products')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[payments/products GET] failed:', error)
    return NextResponse.json({ error: 'Failed to list products' }, { status: 500 })
  }

  return NextResponse.json({ products: data ?? [] })
}

interface PostBody {
  name?: string
  description?: string | null
  image_url?: string | null
  author?: string | null
  default_skin_id?: string | null
}

/**
 * POST /api/payments/products
 *
 * Creates a draft product — the first step of the "Crear producto"
 * wizard. No price/checkout exists yet; the wizard's next step calls
 * `POST /api/payments/products/[id]/prices` to add one.
 */
export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }

  const body = (await request.json().catch(() => null)) as PostBody | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (body?.default_skin_id) {
    const { data: skin } = await ctx.supabase
      .from('payment_skins')
      .select('id')
      .eq('id', body.default_skin_id)
      .eq('account_id', ctx.accountId)
      .maybeSingle()
    if (!skin) {
      return NextResponse.json({ error: 'default_skin_id not found for this account' }, { status: 400 })
    }
  }

  const { data, error } = await ctx.supabase
    .from('payment_products')
    .insert({
      account_id: ctx.accountId,
      created_by: ctx.userId,
      name,
      description: body?.description || null,
      image_url: body?.image_url || null,
      author: body?.author || null,
      default_skin_id: body?.default_skin_id || null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('[payments/products POST] failed:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }

  return NextResponse.json({ product: data }, { status: 201 })
}
