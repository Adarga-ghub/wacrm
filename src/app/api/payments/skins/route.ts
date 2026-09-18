import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import type { PaymentFormDesign } from '@/types'

/**
 * GET /api/payments/skins
 *
 * Lists every payment skin for the caller's account, newest first.
 * RLS (`payment_skins_select`) already scopes this to the account —
 * any member (viewer+) may list. Mirrors `GET /api/payments/forms`.
 */
export async function GET() {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }

  const { data, error } = await ctx.supabase
    .from('payment_skins')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[payments/skins GET] failed:', error)
    return NextResponse.json({ error: 'Failed to list payment skins' }, { status: 500 })
  }

  return NextResponse.json({ skins: data ?? [] })
}

interface PostBody {
  name?: string
  design?: PaymentFormDesign
  /** Payment form ids (this account's) that should use this skin from creation. */
  form_ids?: string[]
}

/**
 * POST /api/payments/skins
 *
 * Creates a skin and, in the same call, links it to the given forms
 * (`form_ids`) — the "vincularla a uno o varios formularios" step
 * from the skin editor dialog's form checklist. Every id is verified
 * to belong to this account before being touched; an id for another
 * account (or a typo) is silently dropped rather than erroring the
 * whole request, since it can only reach here by tampering with the
 * request body.
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

  const { data: skin, error } = await ctx.supabase
    .from('payment_skins')
    .insert({
      account_id: ctx.accountId,
      created_by: ctx.userId,
      name,
      design: body?.design ?? {},
    })
    .select()
    .single()

  if (error) {
    console.error('[payments/skins POST] failed:', error)
    return NextResponse.json({ error: 'Failed to create payment skin' }, { status: 500 })
  }

  const formIds = Array.isArray(body?.form_ids) ? body.form_ids : []
  if (formIds.length) {
    const { data: validForms } = await ctx.supabase
      .from('payment_forms')
      .select('id')
      .eq('account_id', ctx.accountId)
      .in('id', formIds)
    const validIds = (validForms ?? []).map((f) => f.id as string)
    if (validIds.length) {
      await ctx.supabase.from('payment_forms').update({ skin_id: skin.id }).in('id', validIds)
    }
  }

  return NextResponse.json({ skin }, { status: 201 })
}
