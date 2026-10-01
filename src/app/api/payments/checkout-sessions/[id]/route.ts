import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

/**
 * DELETE /api/payments/checkout-sessions/[id]
 *
 * Hard-deletes one checkout session from "Analíticas de Checkout" (test
 * visits, duplicates…). Only the session row is removed — the contact,
 * their conversation and any linked payment transaction are untouched.
 * Admin+ only, same as deleting a transaction. Goes through the
 * caller's RLS-scoped client (`checkout_sessions_delete`, migration 060)
 * and is additionally scoped to their account.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx
  try {
    ctx = await requireRole('admin')
  } catch (err) {
    return toErrorResponse(err)
  }
  const { id } = await params

  const { data, error } = await ctx.supabase
    .from('checkout_sessions')
    .delete()
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .select('id')

  if (error) {
    console.error('[payments/checkout-sessions/[id] DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to delete checkout session' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
