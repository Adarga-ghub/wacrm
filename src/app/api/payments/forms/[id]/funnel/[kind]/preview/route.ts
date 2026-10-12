import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { FUNNEL_STEP_KINDS, loadFunnelStep, toPublicFunnelOffer } from '@/lib/payments/funnel'
import type { PaymentFunnelStepKind } from '@/types'

/**
 * GET /api/payments/forms/[id]/funnel/[kind]/preview
 *
 * What the buyer would see on this offer's upsell/downsell page, as
 * saved — for the admin's "Vista previa" (`/pay/offer/preview`). Same
 * resolver as the public page, but also resolves an inactive step.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id, kind } = await params
  if (!(FUNNEL_STEP_KINDS as string[]).includes(kind)) {
    return NextResponse.json({ error: 'Unknown step' }, { status: 404 })
  }

  const { data: form } = await ctx.supabase
    .from('payment_forms')
    .select('id, account_id, currency')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .maybeSingle()
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const step = await loadFunnelStep(ctx.supabase, form, kind as PaymentFunnelStepKind, { activeOnly: false })
  if (!step) {
    return NextResponse.json({ error: 'This step has no sellable offer yet — save it first' }, { status: 404 })
  }
  return NextResponse.json({ offer: toPublicFunnelOffer(step, form.currency) })
}
