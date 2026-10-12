import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/payments/admin-db'
import { funnelMainForm, loadFunnelParent, loadThankYou, nextFunnelStage } from '@/lib/payments/funnel'
import type { PaymentFunnelStepKind } from '@/types'

/**
 * POST /api/public/payments/funnel/[token]/decline  { stage }
 *
 * "No, gracias" on an upsell/downsell page: moves the funnel to the
 * next step (upsell → downsell when one is set up, otherwise done).
 * `stage` is the step the buyer was LOOKING at — a stale tab declining
 * a step that's already behind it is a no-op, so a double click can't
 * skip the downsell.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const db = supabaseAdmin()
  const { token } = await params
  const body = (await request.json().catch(() => null)) as { stage?: PaymentFunnelStepKind } | null
  const parent = await loadFunnelParent(db, token)
  if (!parent) {
    return NextResponse.json({ error: 'This offer is not available' }, { status: 404 })
  }

  let stage = parent.funnel_stage ?? 'done'
  if (body?.stage && stage === body.stage) {
    stage = await nextFunnelStage(db, funnelMainForm(parent), body.stage)
    await db
      .from('payment_transactions')
      .update({ funnel_stage: stage })
      .eq('id', parent.id)
      .eq('funnel_stage', body.stage)
  }

  return NextResponse.json({ stage, thank_you: await loadThankYou(db, parent.form_id) })
}
