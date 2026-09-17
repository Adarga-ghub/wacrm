import { normalizePhone } from '@/lib/whatsapp/phone-utils'
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContactRow = any

export interface ContactOutcome {
  contact: ContactRow
  /** True when this call created the row — drives `new_contact_created` dispatch. */
  wasCreated: boolean
}

/**
 * Find-or-create a contact by WhatsApp phone for the payments flow.
 * Mirrors `findOrCreateContact` in
 * `src/app/api/whatsapp/webhook/route.ts` (same dedup helpers, same
 * "update name if changed" / "re-resolve on unique-violation race"
 * shape) — kept as a separate copy rather than importing from that
 * route file so a change to the heavily-tested inbound-message path
 * can't accidentally ripple into the payments path, and vice versa.
 */
export async function findOrCreatePaymentContact(
  db: AnySupabase,
  accountId: string,
  attributedUserId: string,
  phone: string,
  name: string,
): Promise<ContactOutcome | null> {
  const normalized = normalizePhone(phone)
  if (!normalized) {
    console.error('[payments] findOrCreatePaymentContact called with an unnormalizable phone', {
      accountId,
    })
    return null
  }

  const existingContact = await findExistingContact(db, accountId, phone)
  if (existingContact) {
    if (name && name !== existingContact.name) {
      await db
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id)
    }
    return { contact: existingContact, wasCreated: false }
  }

  const { data: newContact, error: createError } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: attributedUserId,
      phone,
      name: name || phone,
    })
    .select()
    .single()

  if (createError) {
    if (isUniqueViolation(createError)) {
      const raced = await findExistingContact(db, accountId, phone)
      if (raced) return { contact: raced, wasCreated: false }
    }
    console.error('[payments] error creating contact:', createError)
    return null
  }

  return { contact: newContact, wasCreated: true }
}

/**
 * Resolves a stable `auth.users` id to attribute a payment-created
 * contact to (the `contacts.user_id` audit column is NOT NULL).
 * Prefers the payment form's own creator; falls back to the
 * account's owner for forms whose creator's membership was removed.
 */
export async function resolveAttributedUserId(
  db: AnySupabase,
  accountId: string,
  formCreatedBy: string | null,
): Promise<string | null> {
  if (formCreatedBy) return formCreatedBy
  const { data } = await db
    .from('profiles')
    .select('user_id')
    .eq('account_id', accountId)
    .eq('account_role', 'owner')
    .limit(1)
    .maybeSingle()
  return data?.user_id ?? null
}
