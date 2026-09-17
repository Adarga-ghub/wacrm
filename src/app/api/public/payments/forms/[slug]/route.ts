import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveGateway } from '@/lib/payments/gateway'
import type { PublicPaymentForm } from '@/types'

// Lazy-initialised service-role client — this route has no session
// (it's the public checkout page's data source), so RLS can't scope
// it; we filter to `status = 'published'` explicitly instead. Same
// pattern as `src/app/api/whatsapp/webhook/route.ts`.
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
 * GET /api/public/payments/forms/[slug]
 *
 * Backs the public checkout page (`/pay/[slug]`). Returns only the
 * fields a payer's browser needs to render the form — never
 * `account_id`, `automation_id`, `created_by`, or anything else that
 * would leak internal state.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const { data, error } = await supabaseAdmin()
    .from('payment_forms')
    .select(
      'account_id, name, status, fields, amount_type, amount, min_amount, products, currency, design',
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('[public/payments/forms/[slug] GET] failed:', error)
    return NextResponse.json({ error: 'Failed to load form' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'This payment form is not available' }, { status: 404 })
  }

  const gateway = await resolveGateway(supabaseAdmin(), data.account_id)

  const form: PublicPaymentForm = {
    name: data.name,
    status: data.status,
    fields: data.fields,
    amount_type: data.amount_type,
    amount: data.amount,
    min_amount: data.min_amount,
    products: data.products,
    currency: data.currency,
    design: data.design ?? {},
    paypal_client_id: gateway?.clientId ?? null,
  }
  return NextResponse.json({ form })
}
