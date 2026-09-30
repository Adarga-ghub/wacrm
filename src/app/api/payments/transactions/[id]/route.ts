import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

// `payment_transactions` only has a SELECT RLS policy — rows are written
// by the public checkout / PayPal webhook through the service role — so
// the delete goes through the same privileged client, scoped by hand to
// the caller's account below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

/**
 * DELETE /api/payments/transactions/[id]
 *
 * Hard-deletes one transaction row so abandoned / test checkouts stop
 * skewing the payments log. Only the transaction is removed — the
 * contact and their conversation are untouched. Admin+ only, since
 * this rewrites the account's payment history.
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

  const { data, error } = await supabaseAdmin()
    .from('payment_transactions')
    .delete()
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .select('id')

  if (error) {
    console.error('[payments/transactions/[id] DELETE] failed:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
