// ============================================================
// Checkout funnel tracking — shared helpers for the
// `checkout_sessions` table (migration 060) and the "Analíticas de
// Checkout" tab.
//
// The public checkout page has no session, so the only way to know
// WHO opened it is the link itself. At send time, `engineSendCtaUrl`
// (shared by Flows and Automations) tags every CTA button link with
// `?cid=<contact uuid>` — an opaque id only, so the buyer's phone never
// travels in plain text in a link that can be forwarded, screenshotted
// or logged by a third party. The checkout page (`/pay/[slug]`) sends
// it to `POST /api/public/payments/checkout-sessions`, which resolves
// the contact's name and phone server-side. An external landing page
// in between just has to forward `cid` onto its "buy" link.
//
// Links sent before this used `?telefono=…&contact_id=…`; the checkout
// still accepts both. Merchants can also place `{{contact.phone}}`,
// `{{contact.name}}` or `{{contact.id}}` in a button URL themselves
// (`applyContactPlaceholders`).
// ============================================================

export type CheckoutSessionStatus = 'viewed' | 'initiated' | 'abandoned' | 'completed'

/** An 'initiated' session with no activity for this long counts as abandoned. */
export const CHECKOUT_ABANDON_AFTER_MS = 30 * 60 * 1000

/** Query param carrying the contact id on CTA links. */
export const CONTACT_REF_PARAM = 'cid'

/** Digits only, capped — the same shape whether it came from a contact row or a URL. */
export function sanitizeTelefono(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '').slice(0, 20)
  return digits.length >= 6 ? digits : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(raw: unknown): raw is string {
  return typeof raw === 'string' && UUID_RE.test(raw)
}

export interface TrackedContact {
  id: string
  phone: string | null
  name?: string | null
}

/**
 * Replaces `{{contact.phone}}` (digits only), `{{contact.name}}` and
 * `{{contact.id}}` in a URL, URL-encoded. Unknown `contact.*` keys
 * become empty, like any other unknown variable.
 */
export function applyContactPlaceholders(rawUrl: string, contact: TrackedContact): string {
  return rawUrl.replace(/\{\{\s*contact\.(\w+)\s*\}\}/g, (_, key: string) => {
    let value = ''
    if (key === 'phone') value = sanitizeTelefono(contact.phone) ?? ''
    else if (key === 'name') value = contact.name ?? ''
    else if (key === 'id') value = contact.id
    return encodeURIComponent(value)
  })
}

/**
 * Tags a CTA link with `?cid=<contact id>` so the checkout can attribute
 * the visit. Left untouched when the link already identifies the
 * contact (`cid` or a legacy `contact_id`), or is non-http(s) or
 * unparseable.
 */
export function withContactTrackingParams(rawUrl: string, contact: TrackedContact): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return rawUrl
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return rawUrl
  if (url.searchParams.get(CONTACT_REF_PARAM) || url.searchParams.get('contact_id')) return rawUrl

  url.searchParams.set(CONTACT_REF_PARAM, contact.id)
  return url.toString()
}

/** Effective status: a stale 'initiated' session reads as 'abandoned' even before it's persisted. */
export function effectiveCheckoutStatus(
  status: CheckoutSessionStatus,
  lastActivityAt: string,
  now = Date.now(),
): CheckoutSessionStatus {
  if (status === 'initiated' && now - new Date(lastActivityAt).getTime() > CHECKOUT_ABANDON_AFTER_MS) {
    return 'abandoned'
  }
  return status
}
