import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { isValidSlug } from '@/lib/payments/slug'
import { isSlugAvailable } from '@/lib/payments/slug-history'

/**
 * GET /api/payments/forms/slug-available?slug=…&form_id=…
 *
 * Live check for the "Editar enlace" dialog: whether `slug` is a valid
 * checkout link and free for offer `form_id` (see `isSlugAvailable`).
 * The PUT route re-checks on save — this is only for the hint.
 */
export async function GET(request: Request) {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug') ?? ''
  const formId = url.searchParams.get('form_id') ?? ''
  if (!isValidSlug(slug)) return NextResponse.json({ valid: false, available: false })

  const { data: form } = await ctx.supabase
    .from('payment_forms')
    .select('id')
    .eq('id', formId)
    .eq('account_id', ctx.accountId)
    .maybeSingle()
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    return NextResponse.json({ valid: true, available: await isSlugAvailable(slug, formId) })
  } catch (err) {
    console.error('[payments/forms/slug-available] failed:', err)
    return NextResponse.json({ error: 'Could not check the link' }, { status: 500 })
  }
}
