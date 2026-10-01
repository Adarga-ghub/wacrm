// ============================================================
// Checkout funnel tracking — shared helpers for the
// `checkout_sessions` table (migration 060) and the "Analíticas de
// Checkout" tab.
//
// The public checkout page has no session, so the only way to know
// WHO opened it is the link itself. At send time, `engineSendCtaUrl`
// (shared by Flows and Automations) tags every CTA button link:
//   - a link straight to one of the account's checkouts (`/pay/<slug>`)
//     gets `?telefono=<digits>&contact_id=<uuid>`;
//   - any other page (e.g. an external sales/landing page) gets only
//     `?cid=<uuid>` — an opaque id, so the buyer's phone never lands in
//     a third party's URL logs/analytics. The landing page forwards
//     `cid` onto its own "buy" link to the checkout.
// The checkout page sends whatever it received to
// `POST /api/public/payments/checkout-sessions`, which resolves the
// contact's name and phone server-side.
//
// Merchants can also place `{{contact.phone}}`, `{{contact.name}}` or
// `{{contact.id}}` in a button URL themselves (`applyContactPlaceholders`).
// ============================================================

export type CheckoutSessionStatus = 'viewed' | 'initiated' | 'abandoned' | 'completed'

/** An 'initiated' session with no activity for this long counts as abandoned. */
export const CHECKOUT_ABANDON_AFTER_MS = 30 * 60 * 1000

/** Public checkout path — `/pay/<slug>`, excluding the admin-only `/pay/preview`. */
const CHECKOUT_PATH = /^\/pay\/(?!preview\/?$)[^/]+\/?$/

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

/** Query param carrying the contact id through a non-checkout page. */
export const CONTACT_REF_PARAM = 'cid'

/**
 * The slug of a `/pay/<slug>`-shaped link, or null. Shape only — the
 * caller confirms the slug is one of the account's published forms
 * before treating the link as a checkout, so an unrelated site that
 * happens to use a `/pay/...` path never receives the phone number.
 */
export function checkoutSlugFromUrl(rawUrl: string): string | null {
  try {
    const { pathname } = new URL(rawUrl)
    if (!CHECKOUT_PATH.test(pathname)) return null
    return decodeURIComponent(pathname.split('/')[2])
  } catch {
    return null
  }
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
 * Tags a CTA link with the contact so the checkout can attribute the
 * visit (see the header comment for which params go where). Params
 * already present are left untouched; non-http(s) or unparseable URLs
 * are returned as-is.
 */
export function withContactTrackingParams(
  rawUrl: string,
  contact: TrackedContact,
  isCheckout: boolean,
): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return rawUrl
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return rawUrl

  if (isCheckout) {
    const telefono = sanitizeTelefono(contact.phone)
    if (telefono && !url.searchParams.get('telefono')) url.searchParams.set('telefono', telefono)
    if (!url.searchParams.get('contact_id')) url.searchParams.set('contact_id', contact.id)
  } else if (!url.searchParams.get(CONTACT_REF_PARAM)) {
    url.searchParams.set(CONTACT_REF_PARAM, contact.id)
  }
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
