import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findExistingContact } from '@/lib/contacts/dedupe'
import { isUuid, sanitizeTelefono } from '@/lib/payments/checkout-tracking'

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

interface CreateSessionBody {
  slug: string
  link_code?: string
  telefono?: string
  contact_id?: string
}

/**
 * POST /api/public/payments/checkout-sessions
 *
 * "Checkout Page View" — called once per visit by `/pay/[slug]` on
 * load. Creates a `checkout_sessions` row (status 'viewed') and
 * returns its id, which the page then uses for the "Initiate
 * Checkout" event and passes along when it creates the PayPal order.
 *
 * Public route, so nothing in the body is trusted as-is: the form
 * must be published, `contact_id` must belong to the form's account
 * (otherwise it's dropped), and `telefono` is reduced to digits.
 * With no usable contact id, the phone is matched against the
 * account's contacts read-only — tracking never creates contacts.
 */
export async function POST(request: Request) {
  const db = supabaseAdmin()
  const body = (await request.json().catch(() => null)) as CreateSessionBody | null
  if (!body?.slug || typeof body.slug !== 'string') {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  const { data: form } = await db
    .from('payment_forms')
    .select('id, account_id, slug')
    .eq('slug', body.slug)
    .eq('status', 'published')
    .maybeSingle()
  if (!form) {
    return NextResponse.json({ error: 'This payment form is not available' }, { status: 404 })
  }

  let linkId: string | null = null
  let contactId: string | null = null
  if (body.link_code && typeof body.link_code === 'string') {
    const { data: link } = await db
      .from('payment_links')
      .select('id, contact_id')
      .eq('form_id', form.id)
      .eq('code', body.link_code)
      .maybeSingle()
    if (link) {
      linkId = link.id
      contactId = link.contact_id ?? null
    }
  }

  let telefono = sanitizeTelefono(body.telefono)
  const candidateContactId = isUuid(body.contact_id) ? body.contact_id : contactId

  if (candidateContactId) {
    const { data: contact } = await db
      .from('contacts')
      .select('id, phone')
      .eq('id', candidateContactId)
      .eq('account_id', form.account_id)
      .maybeSingle()
    contactId = contact?.id ?? null
    if (contact && !telefono) telefono = sanitizeTelefono(contact.phone)
  }
  if (!contactId && telefono) {
    const existing = await findExistingContact(db, form.account_id, telefono)
    contactId = existing?.id ?? null
  }

  const { data: session, error } = await db
    .from('checkout_sessions')
    .insert({
      account_id: form.account_id,
      form_id: form.id,
      link_id: linkId,
      contact_id: contactId,
      telefono,
      slug_producto: form.slug,
      status: 'viewed',
    })
    .select('id')
    .single()
  if (error || !session) {
    console.error('[public/payments/checkout-sessions POST] insert failed:', error)
    return NextResponse.json({ error: 'Could not record the visit' }, { status: 500 })
  }

  return NextResponse.json({ session_id: session.id })
}
