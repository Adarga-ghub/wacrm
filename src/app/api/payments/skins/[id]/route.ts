import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import type { PaymentFormDesign } from '@/types'

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
    .from('payment_skins')
    .select('*')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .maybeSingle()

  if (error) {
    console.error('[payments/skins/[id] GET] failed:', error)
    return NextResponse.json({ error: 'Failed to load payment skin' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ skin: data })
}

interface PutBody {
  name?: string
  design?: PaymentFormDesign
  /** When present, replaces the full set of forms linked to this skin. */
  form_ids?: string[]
}

/**
 * PUT /api/payments/skins/[id]
 *
 * `form_ids`, when present, is the FULL desired set of linked forms
 * (not a delta) — the dialog always sends every checked form id. Any
 * currently-linked form not in the new set is detached
 * (`skin_id = NULL`) first, then every valid id in the new set is
 * attached, so a form can only ever point at one skin at a time.
 */
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
    .from('payment_skins')
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
  if (body.design !== undefined) update.design = body.design

  if (Object.keys(update).length) {
    const { error: updateErr } = await ctx.supabase
      .from('payment_skins')
      .update(update)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
    if (updateErr) {
      console.error('[payments/skins/[id] PUT] failed:', updateErr)
      return NextResponse.json({ error: 'Failed to save payment skin' }, { status: 500 })
    }
  }

  if (body.form_ids !== undefined) {
    const nextIds = new Set(body.form_ids)

    const { data: currentlyLinked } = await ctx.supabase
      .from('payment_forms')
      .select('id')
      .eq('account_id', ctx.accountId)
      .eq('skin_id', id)
    const toDetach = (currentlyLinked ?? [])
      .map((f) => f.id as string)
      .filter((formId) => !nextIds.has(formId))
    if (toDetach.length) {
      await ctx.supabase.from('payment_forms').update({ skin_id: null }).in('id', toDetach)
    }

    if (nextIds.size) {
      const { data: validForms } = await ctx.supabase
        .from('payment_forms')
        .select('id')
        .eq('account_id', ctx.accountId)
        .in('id', [...nextIds])
      const validIds = (validForms ?? []).map((f) => f.id as string)
      if (validIds.length) {
        await ctx.supabase.from('payment_forms').update({ skin_id: id }).in('id', validIds)
      }
    }
  }

  const { data, error } = await ctx.supabase
    .from('payment_skins')
    .select('*')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .single()
  if (error) {
    console.error('[payments/skins/[id] PUT] reload failed:', error)
    return NextResponse.json({ error: 'Failed to save payment skin' }, { status: 500 })
  }

  return NextResponse.json({ skin: data })
}

/**
 * DELETE /api/payments/skins/[id]
 *
 * Hard delete — unlike `payment_forms` (archived, never deleted:
 * transactions reference them), nothing references a skin except the
 * forms using it, and `skin_id`'s `ON DELETE SET NULL` (migration
 * 053) detaches them automatically.
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
    .from('payment_skins')
    .delete()
    .eq('id', id)
    .eq('account_id', ctx.accountId)

  if (error) {
    console.error('[payments/skins/[id] DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to delete payment skin' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
