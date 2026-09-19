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

/**
 * Countries offered by the checkout page's "Cambiar país" picker
 * (Hotmart-style — a country selector replaces a bare ES/EN toggle,
 * and the page's language follows the chosen country). Deliberately
 * a curated list, not every ISO country: this merchant's buyers are
 * Latin America + the US Hispanic/English market, not a global
 * audience, so the picker stays short enough to scan.
 */
export const CHECKOUT_COUNTRIES: { code: string; es: string; en: string }[] = [
  { code: 'DO', es: 'República Dominicana', en: 'Dominican Republic' },
  { code: 'US', es: 'Estados Unidos', en: 'United States' },
  { code: 'MX', es: 'México', en: 'Mexico' },
  { code: 'CO', es: 'Colombia', en: 'Colombia' },
  { code: 'AR', es: 'Argentina', en: 'Argentina' },
  { code: 'CL', es: 'Chile', en: 'Chile' },
  { code: 'PE', es: 'Perú', en: 'Peru' },
  { code: 'EC', es: 'Ecuador', en: 'Ecuador' },
  { code: 'VE', es: 'Venezuela', en: 'Venezuela' },
  { code: 'GT', es: 'Guatemala', en: 'Guatemala' },
  { code: 'HN', es: 'Honduras', en: 'Honduras' },
  { code: 'SV', es: 'El Salvador', en: 'El Salvador' },
  { code: 'NI', es: 'Nicaragua', en: 'Nicaragua' },
  { code: 'CR', es: 'Costa Rica', en: 'Costa Rica' },
  { code: 'PA', es: 'Panamá', en: 'Panama' },
  { code: 'BO', es: 'Bolivia', en: 'Bolivia' },
  { code: 'PY', es: 'Paraguay', en: 'Paraguay' },
  { code: 'UY', es: 'Uruguay', en: 'Uruguay' },
  { code: 'PR', es: 'Puerto Rico', en: 'Puerto Rico' },
  { code: 'ES', es: 'España', en: 'Spain' },
  { code: 'CA', es: 'Canadá', en: 'Canada' },
  { code: 'GB', es: 'Reino Unido', en: 'United Kingdom' },
]

const SPANISH_SPEAKING_COUNTRIES = new Set([
  'AR', 'BO', 'CL', 'CO', 'CR', 'DO', 'EC', 'SV', 'GT', 'HN',
  'MX', 'NI', 'PA', 'PY', 'PE', 'UY', 'VE', 'ES', 'PR',
])

/**
 * Derives the checkout page's own UI language (not the PayPal SDK's
 * locale — see `resolvePaypalSdkLocale`) from the selected/detected
 * country, the same way Hotmart's "Cambiar país" picker drives its
 * checkout language. Every country in `CHECKOUT_COUNTRIES` NOT in
 * the Spanish-speaking set falls back to English, since those are
 * the only two languages this page has copy for.
 */
export function localeForCountry(countryCode: string): PayLocale {
  return SPANISH_SPEAKING_COUNTRIES.has(countryCode) ? 'es' : 'en'
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
  /** "Cambiar país" — label next to the current country code in the checkout header's country picker (replaces a bare ES/EN toggle). */
  changeCountry: string
  or: string
  cardSectionTitle: string
  cardNumber: string
  cardExpiry: string
  cardCvv: string
  firstName: string
  lastName: string
  email: string
  /** "Nombre del titular" — the single cardholder-name field on the Advanced Card Fields form (no first/last split, unlike the top-of-form contact name). */
  cardholderName: string
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
    changeCountry: 'Cambiar país',
    or: 'o',
    cardSectionTitle: 'Tarjeta de débito o crédito',
    cardNumber: 'Número de tarjeta',
    cardExpiry: 'Fecha de expiración',
    cardCvv: 'CVC',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    cardholderName: 'Nombre del titular',
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
    changeCountry: 'Change country',
    or: 'or',
    cardSectionTitle: 'Debit or Credit Card',
    cardNumber: 'Card number',
    cardExpiry: 'Expires',
    cardCvv: 'CVC',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    cardholderName: 'Cardholder name',
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
