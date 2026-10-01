import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isUuid } from '@/lib/payments/checkout-tracking'

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
 * PATCH /api/public/payments/checkout-sessions/[id]
 *
 * "Initiate Checkout" — the buyer's first focus/input in any checkout
 * field. Moves the session to 'initiated' and stamps
 * `initiate_checkout_at` (only the first time). A session that had
 * already gone 'abandoned' is revived to 'initiated', since the buyer
 * is clearly back. A 'completed' session is never touched.
 *
 * The session id (an unguessable UUID handed out by the POST) is the
 * only credential — same trust level as the PayPal order id the page
 * already holds.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
  }
  const body = (await request.json().catch(() => null)) as { event?: string } | null
  if (body?.event !== 'initiate') {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data: session } = await db
    .from('checkout_sessions')
    .select('id, status, initiate_checkout_at')
    .eq('id', id)
    .maybeSingle()
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  if (session.status === 'completed') {
    return NextResponse.json({ ok: true })
  }

  const now = new Date().toISOString()
  const { error } = await db
    .from('checkout_sessions')
    .update({
      status: 'initiated',
      initiate_checkout_at: session.initiate_checkout_at ?? now,
      last_activity_at: now,
    })
    .eq('id', id)
    .neq('status', 'completed')
  if (error) {
    console.error('[public/payments/checkout-sessions PATCH] update failed:', error)
    return NextResponse.json({ error: 'Could not record the event' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
