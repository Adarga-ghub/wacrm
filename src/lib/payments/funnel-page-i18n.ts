import type { PayLocale } from './pay-page-i18n'

/**
 * Built-in strings of the upsell/downsell page (`/pay/offer/[token]`,
 * migration 063). The merchant's own copy (headline, bullets, button
 * labels…) comes from `payment_funnel_steps.page`; these are the
 * defaults used when a field is left empty, plus the page's own UI.
 * Language follows the same IP-country rule as the checkout
 * (`localeForCountry`).
 */
export interface FunnelPageStrings {
  loading: string
  notAvailable: string
  stepOrder: string
  stepOffer: string
  stepAccess: string
  orderConfirmed: (name: string | null) => string
  defaultBanner: Record<'upsell' | 'downsell', string>
  defaultHeadline: Record<'upsell' | 'downsell', (product: string) => string>
  defaultAccept: string
  defaultDecline: string
  includes: string
  oneTimePayment: string
  youSave: (percent: number) => string
  before: string
  expiresIn: string
  choosePayment: string
  paymentHint: string
  or: string
  securedByPrefix: string
  loadingGateway: string
  confirmingPayment: string
  paymentSuccessTitle: string
  finishing: string
  thankYou: string
  startError: string
  paymentIncomplete: string
  paypalGenericError: string
  sdkLoadError: string
  previewBadge: string
  previewNote: string
}

export const funnelPageStrings: Record<PayLocale, FunnelPageStrings> = {
  es: {
    loading: 'Cargando tu oferta especial...',
    notAvailable: 'Esta oferta ya no está disponible.',
    stepOrder: 'Pedido',
    stepOffer: 'Oferta especial',
    stepAccess: 'Acceso',
    orderConfirmed: (name) =>
      name ? `¡Gracias, ${name}! Tu pago fue confirmado.` : '¡Gracias! Tu pago fue confirmado.',
    defaultBanner: {
      upsell: '¡Espera! Tu pedido aún no está completo…',
      downsell: '¡Espera! Tenemos una última oferta para ti…',
    },
    defaultHeadline: {
      upsell: (product) => `Agrega "${product}" a tu pedido con un precio exclusivo`,
      downsell: (product) => `Última oportunidad: llévate "${product}" hoy`,
    },
    defaultAccept: 'Sí, quiero agregarlo a mi pedido',
    defaultDecline: 'No, gracias. Prefiero dejar pasar esta oferta.',
    includes: 'Incluye',
    oneTimePayment: 'Pago único · Acceso inmediato',
    youSave: (percent) => `Ahorras ${percent}%`,
    before: 'Antes',
    expiresIn: 'Esta oferta especial expira en',
    choosePayment: 'Elige cómo completar tu pago',
    paymentHint: 'Se cobra solo esta oferta — tu compra anterior ya está confirmada.',
    or: 'o',
    securedByPrefix: 'Protegido por',
    loadingGateway: 'Cargando método de pago...',
    confirmingPayment: 'Confirmando tu pago...',
    paymentSuccessTitle: '¡Pago exitoso!',
    finishing: 'Preparando tu acceso...',
    thankYou: '¡Gracias por tu compra! Revisa tu WhatsApp y tu correo para acceder a tus productos.',
    startError: 'No se pudo iniciar el pago — inténtalo de nuevo',
    paymentIncomplete: 'El pago no pudo completarse',
    paypalGenericError: 'Ocurrió un problema con PayPal — inténtalo de nuevo.',
    sdkLoadError: 'No se pudo cargar el proveedor de pagos.',
    previewBadge: 'Vista previa',
    previewNote: 'Vista previa del panel — los botones no cobran nada.',
  },
  en: {
    loading: 'Loading your special offer...',
    notAvailable: 'This offer is no longer available.',
    stepOrder: 'Order',
    stepOffer: 'Special offer',
    stepAccess: 'Access',
    orderConfirmed: (name) =>
      name ? `Thank you, ${name}! Your payment was confirmed.` : 'Thank you! Your payment was confirmed.',
    defaultBanner: {
      upsell: 'Wait! Your order is not complete yet…',
      downsell: 'Wait! We have one last offer for you…',
    },
    defaultHeadline: {
      upsell: (product) => `Add "${product}" to your order at an exclusive price`,
      downsell: (product) => `Last chance: get "${product}" today`,
    },
    defaultAccept: 'Yes, add this to my order',
    defaultDecline: "No thanks, I'll pass on this offer.",
    includes: 'Includes',
    oneTimePayment: 'One-time payment · Instant access',
    youSave: (percent) => `You save ${percent}%`,
    before: 'Before',
    expiresIn: 'This special offer expires in',
    choosePayment: 'Choose how to complete your payment',
    paymentHint: 'Only this offer is charged — your previous purchase is already confirmed.',
    or: 'or',
    securedByPrefix: 'Secured by',
    loadingGateway: 'Loading payment method...',
    confirmingPayment: 'Confirming your payment...',
    paymentSuccessTitle: 'Payment successful!',
    finishing: 'Preparing your access...',
    thankYou: 'Thank you for your purchase! Check your WhatsApp and email to access your products.',
    startError: 'Could not start the payment — please try again',
    paymentIncomplete: 'The payment could not be completed',
    paypalGenericError: 'There was a problem with PayPal — please try again.',
    sdkLoadError: 'Could not load the payment provider.',
    previewBadge: 'Preview',
    previewNote: 'Dashboard preview — the buttons do not charge anything.',
  },
}
