import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { randomSlugSuffix } from '@/lib/payments/slug'

/**
 * GET /api/payments/forms/[id]/links
 *
 * Active payment links for a form, newest first, with the prefilled
 * contact's name/phone embedded for display.
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
    .from('payment_links')
    .select('*, contact:contacts(name, phone)')
    .eq('form_id', id)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[payments/forms/[id]/links GET] failed:', error)
    return NextResponse.json({ error: 'Failed to list payment links' }, { status: 500 })
  }

  return NextResponse.json({ links: data ?? [] })
}

interface PostBody {
  contact_id?: string | null
  send_automation: boolean
  amount_override?: number | null
  expires_in_days?: number | null
}

/**
 * POST /api/payments/forms/[id]/links
 *
 * Generates a payment link — this is where the merchant fixes the
 * "cobrar sin disparar automatización" choice server-side (see
 * migration 051's notes on `payment_links.send_automation`). The
 * resulting URL is `/pay/[slug]?l=[code]`; the checkout page passes
 * `code` through to `POST /api/public/payments/orders`, which copies
 * `send_automation` onto the transaction at creation time.
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
  if (!body || typeof body.send_automation !== 'boolean') {
    return NextResponse.json({ error: 'send_automation is required' }, { status: 400 })
  }

  const { data: form } = await ctx.supabase
    .from('payment_forms')
    .select('id, slug')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .maybeSingle()
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.contact_id) {
    const { data: contact } = await ctx.supabase
      .from('contacts')
      .select('id')
      .eq('id', body.contact_id)
      .eq('account_id', ctx.accountId)
      .maybeSingle()
    if (!contact) {
      return NextResponse.json({ error: 'contact_id not found for this account' }, { status: 400 })
    }
  }

  const expiresAt = body.expires_in_days
    ? new Date(Date.now() + body.expires_in_days * 86_400_000).toISOString()
    : null

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await ctx.supabase
      .from('payment_links')
      .insert({
        account_id: ctx.accountId,
        form_id: id,
        code: randomSlugSuffix() + randomSlugSuffix(),
        contact_id: body.contact_id ?? null,
        send_automation: body.send_automation,
        amount_override: body.amount_override ?? null,
        expires_at: expiresAt,
        created_by: ctx.userId,
      })
      .select('*, contact:contacts(name, phone)')
      .single()

    if (!data && !error) continue
    if (!error) {
      return NextResponse.json(
        { link: data, url: `/pay/${form.slug}?l=${data.code}` },
        { status: 201 },
      )
    }
    if (error.code !== '23505') {
      console.error('[payments/forms/[id]/links POST] failed:', error)
      return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Could not generate a unique link — try again' }, { status: 500 })
}
