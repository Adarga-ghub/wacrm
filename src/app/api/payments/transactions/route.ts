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
 *
 * Each row also carries `conversation_id` — the contact's most recent
 * inbox conversation — so the table can deep-link to `/inbox?c=<id>`
 * and the merchant can read the chat of a buyer who didn't finish
 * paying. Rows without a linked contact fall back to matching the
 * payer's WhatsApp phone against the account's contacts.
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

  const rows = data ?? []

  // Phone → contact id, for rows whose contact link was never set.
  const orphanPhones = [
    ...new Set(
      rows
        .filter((r) => !r.contact_id && r.whatsapp_phone)
        .map((r) => r.whatsapp_phone as string),
    ),
  ]
  const contactIdByPhone = new Map<string, string>()
  if (orphanPhones.length > 0) {
    const { data: contacts } = await ctx.supabase
      .from('contacts')
      .select('id, phone')
      .eq('account_id', ctx.accountId)
      .in('phone', orphanPhones)
    for (const c of contacts ?? []) contactIdByPhone.set(c.phone, c.id)
  }

  const contactIdOf = (r: (typeof rows)[number]): string | null =>
    r.contact_id ?? (r.whatsapp_phone ? contactIdByPhone.get(r.whatsapp_phone) ?? null : null)

  // Contact id → latest conversation id. Ordered newest-first, so the
  // first hit per contact wins.
  const contactIds = [...new Set(rows.map(contactIdOf).filter((id): id is string => !!id))]
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
      console.error('[payments/transactions GET] conversation lookup failed:', convErr)
    }
    for (const c of convs ?? []) {
      if (!conversationByContact.has(c.contact_id)) conversationByContact.set(c.contact_id, c.id)
    }
  }

  const transactions = rows.map((r) => {
    const contactId = contactIdOf(r)
    return {
      ...r,
      conversation_id: contactId ? conversationByContact.get(contactId) ?? null : null,
    }
  })

  return NextResponse.json({ transactions })
}
