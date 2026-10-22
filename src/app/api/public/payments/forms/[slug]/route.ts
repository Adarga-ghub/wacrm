import { NextResponse } from 'next/server'
import { loadPublicPaymentForm } from '@/lib/payments/public-form'

/**
 * GET /api/public/payments/forms/[slug]
 *
 * The public checkout's form data as JSON — see
 * `loadPublicPaymentForm` for what it returns. `/pay/[slug]` itself
 * now gets this server-side in its first HTML response; this route
 * stays for the page's fallback (a server-side load that failed) and
 * any other caller.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  let form
  try {
    form = await loadPublicPaymentForm(slug)
  } catch (error) {
    console.error('[public/payments/forms/[slug] GET] failed:', error)
    return NextResponse.json({ error: 'Failed to load form' }, { status: 500 })
  }
  if (!form) {
    return NextResponse.json({ error: 'This payment form is not available' }, { status: 404 })
  }
  return NextResponse.json({ form })
}
