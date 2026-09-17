/**
 * Resolves the public base URL this deployment is reachable at —
 * needed to register the PayPal webhook target
 * (`${baseUrl}/api/payments/paypal/webhook`) and to build the public
 * checkout link shown in a form's "Compartir" tab.
 *
 * Deliberately simpler than the invite-link resolver in
 * `src/app/api/account/invitations/route.ts`: that one defends an
 * account-takeover-sensitive flow with a host allow-list, which is
 * overkill here — a wrong webhook URL only means "PayPal can't reach
 * us until the config is resaved", not a security issue.
 */
export function resolveBaseUrl(request?: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  if (request) {
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`

    const host = request.headers.get('host')?.trim()
    if (host) {
      const proto = new URL(request.url).protocol.replace(':', '')
      return `${proto}://${host}`
    }
  }

  return 'https://crm.example.com'
}
