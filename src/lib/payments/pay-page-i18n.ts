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

interface PayPageStrings {
  notAvailable: string
  chooseProduct: string
  fromAmount: (amount: number, currency: string) => string
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
}

export const payPageStrings: Record<PayLocale, PayPageStrings> = {
  es: {
    notAvailable: "Este formulario de pago no está disponible.",
    chooseProduct: 'Elige un producto a continuación',
    fromAmount: (amount, currency) => `Desde ${amount} ${currency}`,
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
    cardCvv: 'CVV/CSC',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    pay: 'Pagar',
    previewBadge: 'Vista previa',
    sampleProductName: 'Producto de ejemplo',
    previewPayNote: 'Esto es una vista previa — no se realizará ningún cobro real.',
  },
  en: {
    notAvailable: "This payment form isn't available.",
    chooseProduct: 'Choose a product below',
    fromAmount: (amount, currency) => `From ${amount} ${currency}`,
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
    cardCvv: 'CVV/CSC',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    pay: 'Pay',
    previewBadge: 'Preview',
    sampleProductName: 'Sample product',
    previewPayNote: "This is a preview — no real charge will happen.",
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
