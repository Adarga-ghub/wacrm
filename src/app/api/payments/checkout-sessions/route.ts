import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { CHECKOUT_ABANDON_AFTER_MS } from '@/lib/payments/checkout-tracking'

// Service-role client — only for the lazy "mark abandoned" sweep
// below; `checkout_sessions` has no UPDATE policy for authenticated
// users (see migration 060). The read itself goes through the
// caller's RLS-scoped client.
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
 * GET /api/payments/checkout-sessions
 *
 * Backs the "Analíticas de Checkout" tab — one row per checkout visit,
 * newest activity first, with the form/product name and the resolved
 * contact embedded for display, plus `conversation_id` (the contact's
 * latest inbox conversation) for the row's "open chat" link.
 *
 * Before reading, 'initiated' sessions idle for longer than
 * `CHECKOUT_ABANDON_AFTER_MS` are persisted as 'abandoned' for this
 * account. There's no cron for it — the tab is the only consumer, so
 * sweeping on read keeps the stored status honest whenever it matters.
 */
export async function GET() {
  let ctx
  try {
    ctx = await requireRole('viewer')
  } catch (err) {
    return toErrorResponse(err)
  }

  const cutoff = new Date(Date.now() - CHECKOUT_ABANDON_AFTER_MS).toISOString()
  const { error: sweepErr } = await supabaseAdmin()
    .from('checkout_sessions')
    .update({ status: 'abandoned' })
    .eq('account_id', ctx.accountId)
    .eq('status', 'initiated')
    .lt('last_activity_at', cutoff)
  if (sweepErr) {
    // Non-fatal: the UI also derives 'abandoned' from last_activity_at.
    console.error('[payments/checkout-sessions GET] abandon sweep failed:', sweepErr)
  }

  const { data, error } = await ctx.supabase
    .from('checkout_sessions')
    .select(
      '*, form:payment_forms(name, product:payment_products(name)), contact:contacts(name, phone)',
    )
    .eq('account_id', ctx.accountId)
    .order('last_activity_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('[payments/checkout-sessions GET] failed:', error)
    return NextResponse.json({ error: 'Failed to list checkout sessions' }, { status: 500 })
  }

  const rows = data ?? []

  // Contact id → latest conversation id, so each row can deep-link to
  // `/inbox?c=<id>` (same approach as the Transactions log). Ordered
  // newest-first, so the first hit per contact wins.
  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter((id): id is string => !!id))]
  const conversationByContact = new Map<string, string>()
  if (contactIds.length > 0) {
    const { data: convs, error: convErr } = await ctx.supabase
      .from('conversations')
      .select('id, contact_id')
      .eq('account_id', ctx.accountId)
      .in('contact_id', contactIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })
    if (convErr) {
      // Non-fatal: the table still renders, just without inbox links.
      console.error('[payments/checkout-sessions GET] conversation lookup failed:', convErr)
    }
    for (const c of convs ?? []) {
      if (!conversationByContact.has(c.contact_id)) conversationByContact.set(c.contact_id, c.id)
    }
  }

  const sessions = rows.map((r) => ({
    ...r,
    conversation_id: r.contact_id ? conversationByContact.get(r.contact_id) ?? null : null,
  }))

  return NextResponse.json({ sessions })
}
