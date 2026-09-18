import type { PaymentFormField } from '@/types'

/**
 * Client-side language toggle for the public `/pay/[slug]` checkout
 * page. Deliberately separate from `next-intl` (`src/i18n/request.ts`)
 * — that system picks ONE locale for the whole self-hosted deployment
 * from an env var; this page needs the anonymous payer to flip
 * between Spanish and English at will, per visit, with no server
 * round-trip.
 */
export type PayLocale = 'es' | 'en'

export const PAYPAL_SDK_LOCALE: Record<PayLocale, string> = {
  es: 'es_ES',
  en: 'en_US',
}

/**
 * Countries PayPal's JS SDK loader (`https://www.paypal.com/sdk/js`)
 * actually accepts as `es_<COUNTRY>`. This is NOT the same as
 * PayPal's general REST API locale-codes reference — that reference
 * lists a catch-all `es_XC` "Latin America" code and includes
 * `es_PR`, but the SDK *loader* 400s on both. Every code below was
 * verified directly against the loader (`curl -o /dev/null -w
 * '%{http_code}' ".../sdk/js?...&locale=es_XX"` → 200) — don't add
 * one without checking it the same way, a bad value here breaks the
 * SDK script load entirely (it 400s/503s and the button never
 * renders, not a silent fallback).
 */
const PAYPAL_SDK_ES_COUNTRIES = new Set([
  'AR', 'BO', 'CL', 'CO', 'CR', 'DO', 'EC', 'SV', 'GT', 'HN',
  'MX', 'NI', 'PA', 'PY', 'PE', 'UY', 'VE', 'US',
])

/**
 * This CRM's actual buyers are overwhelmingly Latin American (the
 * account's payment currencies are DOP/COP/MXN/ARS, not EUR), so
 * `es_ES` — Spain — is the wrong default for nearly every Spanish
 * visitor. `countryCode` comes from `GET /api/public/payments/geo`
 * (IP-based, best-effort) and is `null` whenever detection fails.
 * Falls back to `es_DO` (this merchant's own market, and a code
 * confirmed to work) whenever the country is undetected or isn't in
 * the confirmed-working set above — never to an unverified code.
 */
export function resolvePaypalSdkLocale(locale: PayLocale, countryCode: string | null): string {
  if (locale === 'en') return PAYPAL_SDK_LOCALE.en
  if (countryCode === 'ES') return 'es_ES'
  if (countryCode && PAYPAL_SDK_ES_COUNTRIES.has(countryCode)) return `es_${countryCode}`
  return 'es_DO'
}

interface PayPageStrings {
  notAvailable: string
  chooseProduct: string
  /** Takes an already-formatted amount (e.g. from `formatPaymentAmount`), not a raw number — keeps this module free of currency-formatting logic of its own. */
  fromAmount: (formattedAmount: string) => string
  amountLabel: (currency: string) => string
  productLabel: string
  fieldRequired: (label: string) => string
  chooseProductError: string
  sdkLoadError: string
  paypalGenericError: string
  paymentIncomplete: string
  startError: string
  thankYou: string
  noGateway: string
  or: string
  cardSectionTitle: string
  cardNumber: string
  cardExpiry: string
  cardCvv: string
  firstName: string
  lastName: string
  email: string
  pay: string
  previewBadge: string
  sampleProductName: string
  previewPayNote: string
  /** "Autor: {name}" — exact label/format from the Hotmart checkout this mirrors, not a free paraphrase. */
  authorLabel: (author: string) => string
}

export const payPageStrings: Record<PayLocale, PayPageStrings> = {
  es: {
    notAvailable: "Este formulario de pago no está disponible.",
    chooseProduct: 'Elige un producto a continuación',
    fromAmount: (formattedAmount) => `Desde ${formattedAmount}`,
    amountLabel: (currency) => `Monto (${currency})`,
    productLabel: 'Producto',
    fieldRequired: (label) => `${label} es obligatorio`,
    chooseProductError: 'Por favor elige un producto',
    sdkLoadError: 'No se pudo cargar el proveedor de pagos.',
    paypalGenericError: 'Ocurrió un problema con PayPal — inténtalo de nuevo.',
    paymentIncomplete: 'El pago no pudo completarse',
    startError: 'No se pudo iniciar el pago — inténtalo de nuevo',
    thankYou: 'Gracias — tu pago fue recibido.',
    noGateway: 'Este comercio todavía no ha conectado PayPal.',
    or: 'o',
    cardSectionTitle: 'Tarjeta de débito o crédito',
    cardNumber: 'Número de tarjeta',
    cardExpiry: 'Fecha de expiración',
    cardCvv: 'CVC',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    pay: 'Pagar',
    previewBadge: 'Vista previa',
    sampleProductName: 'Producto de ejemplo',
    previewPayNote: 'Esto es una vista previa — no se realizará ningún cobro real.',
    authorLabel: (author) => `Autor: ${author}`,
  },
  en: {
    notAvailable: "This payment form isn't available.",
    chooseProduct: 'Choose a product below',
    fromAmount: (formattedAmount) => `From ${formattedAmount}`,
    amountLabel: (currency) => `Amount (${currency})`,
    productLabel: 'Product',
    fieldRequired: (label) => `${label} is required`,
    chooseProductError: 'Please choose a product',
    sdkLoadError: 'Could not load the payment provider.',
    paypalGenericError: 'Something went wrong with PayPal — please try again.',
    paymentIncomplete: 'The payment could not be completed',
    startError: 'Could not start the payment — please try again',
    thankYou: 'Thank you — your payment was received.',
    noGateway: "This merchant hasn't connected PayPal yet.",
    or: 'or',
    cardSectionTitle: 'Debit or Credit Card',
    cardNumber: 'Card number',
    cardExpiry: 'Expires',
    cardCvv: 'CVC',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    pay: 'Pay',
    previewBadge: 'Preview',
    sampleProductName: 'Sample product',
    previewPayNote: "This is a preview — no real charge will happen.",
    authorLabel: (author) => `Author: ${author}`,
  },
}

/**
 * Labels for the three built-in field ids (see
 * `src/lib/payments/default-fields.ts`) — translated by `id`, not by
 * matching the stored label text, since a merchant may have edited
 * it. Custom fields (`custom_*`) keep whatever label the merchant
 * typed; there's no way to machine-translate free text they wrote.
 */
const KNOWN_FIELD_LABELS: Record<string, Record<PayLocale, string>> = {
  name: { es: 'Nombre', en: 'Name' },
  email: { es: 'Correo electrónico', en: 'Email' },
  whatsapp_phone: { es: 'Número de WhatsApp', en: 'WhatsApp number' },
}

export function translateFieldLabel(field: PaymentFormField, locale: PayLocale): string {
  return KNOWN_FIELD_LABELS[field.id]?.[locale] ?? field.label
}
