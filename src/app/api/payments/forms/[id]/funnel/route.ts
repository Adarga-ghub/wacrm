import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

/**
 * GET /api/payments/forms/[id]/funnel
 *
 * This offer's post-purchase funnel steps (migration 063) — at most one
 * upsell and one downsell, including inactive ones so the admin can
 * re-enable them.
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
    .from('payment_funnel_steps')
    .select('*')
    .eq('form_id', id)
    .eq('account_id', ctx.accountId)

  if (error) {
    console.error('[payments/forms/[id]/funnel GET] failed:', error)
    return NextResponse.json({ error: 'Failed to load the upsell/downsell' }, { status: 500 })
  }
  return NextResponse.json({ steps: data ?? [] })
}
