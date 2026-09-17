import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

/**
 * DELETE /api/payments/links/[id]
 *
 * Revokes a payment link (soft — flips `status`, never deletes; a
 * transaction already made through the link keeps its `link_id`
 * reference either way).
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
    .from('payment_links')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('account_id', ctx.accountId)

  if (error) {
    console.error('[payments/links/[id] DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to revoke payment link' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
