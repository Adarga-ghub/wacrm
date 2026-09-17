import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

/**
 * GET /api/payments/transactions
 *
 * The "Submissions"-style payments log — every row this account has
 * ever created via `POST /api/public/payments/orders`, with the
 * owning form's name and the resolved contact embedded for display.
 * Optional `?form_id=` scopes to a single form's transactions (used
 * from the form editor, once that view exists).
 */
export async function GET(request: Request) {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }

  const { searchParams } = new URL(request.url)
  const formId = searchParams.get('form_id')

  let query = ctx.supabase
    .from('payment_transactions')
    .select('*, form:payment_forms(name), contact:contacts(name, phone)')
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (formId) query = query.eq('form_id', formId)

  const { data, error } = await query
  if (error) {
    console.error('[payments/transactions GET] failed:', error)
    return NextResponse.json({ error: 'Failed to list transactions' }, { status: 500 })
  }

  return NextResponse.json({ transactions: data ?? [] })
}
