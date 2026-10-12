import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/payments/admin-db'
import { resolveGateway } from '@/lib/payments/gateway'
import {
  funnelMainForm,
  loadFunnelParent,
  loadFunnelStep,
  loadThankYou,
  nextFunnelStage,
  toPublicFunnelOffer,
} from '@/lib/payments/funnel'
import type { PaymentFunnelStage } from '@/types'

/**
 * GET /api/public/payments/funnel/[token]
 *
 * Backs the upsell/downsell page (`/pay/offer/[token]`, migration 063).
 * Returns the step the buyer is currently on, already priced, plus the
 * main offer's thank-you target so the page can finish the funnel on
 * its own. A step that stopped being sellable since the token was
 * issued (offer archived, step disabled) is skipped forward here, so
 * the buyer is never shown an offer that would fail at payment time.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const db = supabaseAdmin()
  const { token } = await params
  const parent = await loadFunnelParent(db, token)
  if (!parent) {
    return NextResponse.json({ error: 'This offer is not available' }, { status: 404 })
  }

  const form = funnelMainForm(parent)
  const thankYou = await loadThankYou(db, parent.form_id)
  let stage: PaymentFunnelStage = parent.funnel_stage ?? 'done'
  let step = stage === 'done' ? null : await loadFunnelStep(db, form, stage)
  if (stage !== 'done' && !step) {
    stage = await nextFunnelStage(db, form, stage)
    step = stage === 'done' ? null : await loadFunnelStep(db, form, stage)
    await db.from('payment_transactions').update({ funnel_stage: stage }).eq('id', parent.id)
  }
  if (!step || stage === 'done') {
    return NextResponse.json({ stage: 'done', thank_you: thankYou })
  }

  const gateway = await resolveGateway(db, parent.account_id)
  const fields = parent.form_field_values ?? {}
  return NextResponse.json({
    stage,
    offer: toPublicFunnelOffer(step, parent.currency),
    paypal_client_id: gateway?.clientId ?? null,
    buyer_name: fields['name'] || parent.payer_name || null,
    thank_you: thankYou,
  })
}
