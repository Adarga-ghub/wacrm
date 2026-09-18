import type { PaymentFormDesign } from '@/types'
import type { PayLocale } from '@/lib/payments/pay-page-i18n'

/**
 * Builds the URL for `/pay/preview` — a standalone rendering of a
 * checkout page's cosmetics (background, top section, accent color,
 * logo) with no real form/PayPal account behind it. Takes the design
 * object DIRECTLY rather than a skin id so the Skins editor dialog
 * can preview in-progress, unsaved edits ("ir evaluando cómo va
 * quedando el diseño") by opening this in a new tab — no save round
 * trip needed first.
 */
export function buildSkinPreviewUrl(design: PaymentFormDesign, locale: PayLocale = 'es'): string {
  const params = new URLSearchParams()
  params.set('design', JSON.stringify(design))
  params.set('locale', locale)
  return `/pay/preview?${params.toString()}`
}
