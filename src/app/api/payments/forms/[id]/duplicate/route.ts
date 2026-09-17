import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { generateSlug } from '@/lib/payments/slug'

/**
 * POST /api/payments/forms/[id]/duplicate
 *
 * Mirrors `POST /api/automations/[id]/duplicate`: clone into a fresh
 * draft (never inherits `published` status — a duplicated live
 * checkout shouldn't silently go live with a second URL). Gets a new
 * slug since slugs are globally unique.
 */
export async function POST(
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

  const { data: original, error: origErr } = await ctx.supabase
    .from('payment_forms')
    .select('*')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .maybeSingle()
  if (origErr) return NextResponse.json({ error: origErr.message }, { status: 500 })
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const name = `${original.name} (Copy)`
  const { data: copy, error: copyErr } = await ctx.supabase
    .from('payment_forms')
    .insert({
      account_id: original.account_id,
      created_by: ctx.userId,
      name,
      slug: generateSlug(name),
      status: 'draft',
      fields: original.fields,
      amount_type: original.amount_type,
      amount: original.amount,
      min_amount: original.min_amount,
      products: original.products,
      currency: original.currency,
      automation_id: original.automation_id,
      send_automation_default: original.send_automation_default,
      redirect_url: original.redirect_url,
      inline_success_message: original.inline_success_message,
      submission_limit: original.submission_limit,
    })
    .select()
    .single()

  if (copyErr) {
    console.error('[payments/forms/[id]/duplicate] failed:', copyErr)
    return NextResponse.json({ error: 'Failed to duplicate payment form' }, { status: 500 })
  }

  return NextResponse.json({ form: copy }, { status: 201 })
}
