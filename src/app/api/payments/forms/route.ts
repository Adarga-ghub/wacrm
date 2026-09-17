import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { generateSlug } from '@/lib/payments/slug'
import { defaultPaymentFormFields } from '@/lib/payments/default-fields'

/**
 * GET /api/payments/forms
 *
 * Lists every payment form for the caller's account, newest first.
 * RLS (`payment_forms_select`) already scopes this to the account —
 * any member (viewer+) may list.
 */
export async function GET() {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }

  const { data, error } = await ctx.supabase
    .from('payment_forms')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[payments/forms GET] failed:', error)
    return NextResponse.json({ error: 'Failed to list payment forms' }, { status: 500 })
  }

  return NextResponse.json({ forms: data ?? [] })
}

/**
 * POST /api/payments/forms
 *
 * Creates a draft form with the WhatsApp-required seed fields and the
 * account's currency, then hands back the id so the caller can push
 * straight into the editor. Mirrors `POST /api/automations`'s
 * agent+-gated create.
 */
export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data: account } = await ctx.supabase
    .from('accounts')
    .select('default_currency')
    .eq('id', ctx.accountId)
    .maybeSingle()

  // Slugs are globally unique — collisions are astronomically
  // unlikely with the random suffix, but retry once on the off
  // chance two forms are created in the same instant with names that
  // slugify identically.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await ctx.supabase
      .from('payment_forms')
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        name,
        slug: generateSlug(name),
        status: 'draft',
        fields: defaultPaymentFormFields(),
        amount_type: 'fixed',
        currency: account?.default_currency ?? 'USD',
        send_automation_default: true,
      })
      .select()
      .single()

    if (!error) {
      return NextResponse.json({ form: data }, { status: 201 })
    }
    if (error.code !== '23505' /* unique_violation */) {
      console.error('[payments/forms POST] failed:', error)
      return NextResponse.json({ error: 'Failed to create payment form' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Could not generate a unique slug — try again' }, { status: 500 })
}
