// ============================================================
// Checkout funnel tracking — shared helpers for the
// `checkout_sessions` table (migration 060) and the "Analíticas de
// Checkout" tab.
//
// The public checkout page has no session, so the only way to know
// WHO opened it is the link itself: automation/flow CTA buttons that
// point at `/pay/<slug>` get `?telefono=<digits>&contact_id=<uuid>`
// appended at send time (`withCheckoutContactParams`, called from
// `engineSendCtaUrl`), and the page forwards both to
// `POST /api/public/payments/checkout-sessions`.
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

/**
 * True when `url` is one of this deployment's public checkout pages.
 * With `NEXT_PUBLIC_SITE_URL` set, the host must match it, so the
 * contact's phone is never appended to a third-party link that just
 * happens to have a `/pay/...` path.
 */
export function isCheckoutUrl(url: URL): boolean {
  if (!CHECKOUT_PATH.test(url.pathname)) return false
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!site) return true
  try {
    return new URL(site).host === url.host
  } catch {
    return true
  }
}

/**
 * Adds `telefono` / `contact_id` to a checkout link so the page can
 * attribute the visit. Params already present (e.g. a merchant who
 * typed `?telefono={{contact.phone}}` by hand) are left untouched;
 * any non-checkout or unparseable URL is returned as-is.
 */
export function withCheckoutContactParams(
  rawUrl: string,
  contact: { id: string; phone: string | null },
): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return rawUrl
  }
  if (!isCheckoutUrl(url)) return rawUrl

  const telefono = sanitizeTelefono(contact.phone)
  if (telefono && !url.searchParams.get('telefono')) url.searchParams.set('telefono', telefono)
  if (!url.searchParams.get('contact_id')) url.searchParams.set('contact_id', contact.id)
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
