import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { isValidSlug } from '@/lib/payments/slug'
import { enforceLockedFields } from '@/lib/payments/default-fields'
import type { PaymentFormField, PaymentFormProduct } from '@/types'

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
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .maybeSingle()

  if (error) {
    console.error('[payments/forms/[id] GET] failed:', error)
    return NextResponse.json({ error: 'Failed to load payment form' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ form: data })
}

interface PutBody {
  name?: string
  slug?: string
  status?: 'draft' | 'published' | 'archived'
  fields?: PaymentFormField[]
  amount_type?: 'fixed' | 'variable' | 'product_list'
  amount?: number | null
  min_amount?: number | null
  products?: PaymentFormProduct[] | null
  automation_id?: string | null
  send_automation_default?: boolean
  redirect_url?: string | null
  inline_success_message?: string | null
  submission_limit?: number | null
  design?: { accent_color?: string; logo_url?: string }
}

/**
 * PUT /api/payments/forms/[id]
 *
 * Full-object save from the editor (Campos/Pago/Automatización/
 * Comportamiento tabs post one combined payload — no per-tab
 * autosave). `currency` is deliberately not accepted here: it's set
 * once at creation from the account's default and never re-derived
 * from the client (see migration 050's notes on the one-currency-
 * per-account rule).
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
    .from('payment_forms')
    .select('id, slug')
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

  if (body.slug !== undefined && body.slug !== existing.slug) {
    if (!isValidSlug(body.slug)) {
      return NextResponse.json(
        { error: 'Slug must be lowercase letters, numbers and hyphens only' },
        { status: 400 },
      )
    }
    update.slug = body.slug
  }

  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.status = body.status
  }

  if (body.fields !== undefined) {
    update.fields = enforceLockedFields(body.fields)
  }

  if (body.amount_type !== undefined) {
    if (!['fixed', 'variable', 'product_list'].includes(body.amount_type)) {
      return NextResponse.json({ error: 'Invalid amount_type' }, { status: 400 })
    }
    update.amount_type = body.amount_type
  }
  if (body.amount !== undefined) update.amount = body.amount
  if (body.min_amount !== undefined) update.min_amount = body.min_amount
  if (body.products !== undefined) update.products = body.products

  if (body.automation_id !== undefined) {
    if (body.automation_id === null) {
      update.automation_id = null
    } else {
      // Ownership check — the FK alone doesn't stop wiring up another
      // account's automation id (it only checks the row exists).
      const { data: automation } = await ctx.supabase
        .from('automations')
        .select('id')
        .eq('id', body.automation_id)
        .eq('account_id', ctx.accountId)
        .maybeSingle()
      if (!automation) {
        return NextResponse.json({ error: 'automation_id not found for this account' }, { status: 400 })
      }
      update.automation_id = body.automation_id
    }
  }

  if (body.send_automation_default !== undefined) {
    update.send_automation_default = body.send_automation_default
  }
  if (body.redirect_url !== undefined) update.redirect_url = body.redirect_url || null
  if (body.inline_success_message !== undefined) {
    update.inline_success_message = body.inline_success_message || null
  }
  if (body.submission_limit !== undefined) update.submission_limit = body.submission_limit
  if (body.design !== undefined) update.design = body.design

  const { data, error } = await ctx.supabase
    .from('payment_forms')
    .update(update)
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That slug is already taken' }, { status: 409 })
    }
    console.error('[payments/forms/[id] PUT] failed:', error)
    return NextResponse.json({ error: 'Failed to save payment form' }, { status: 500 })
  }

  return NextResponse.json({ form: data })
}

/**
 * DELETE /api/payments/forms/[id]
 *
 * Archives rather than deletes — `payment_transactions.form_id`
 * (migration 051) references this row, so a hard delete would either
 * fail the FK or null out financial history. `GET /api/payments/forms`
 * already filters archived rows out of the list.
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
    .from('payment_forms')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('account_id', ctx.accountId)

  if (error) {
    console.error('[payments/forms/[id] DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to archive payment form' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
