import type { PaymentFormField } from '@/types'

/**
 * Seed fields for a brand-new payment form. `whatsapp_phone` is
 * `locked` — the editor's Campos tab renders it without a delete
 * button and forces `required: true`, and every write path
 * (`PUT /api/payments/forms/[id]`) re-asserts that server-side so a
 * crafted request can't strip it either. Every checkout needs a
 * WhatsApp number to resolve/create the contact the `payment_received`
 * automation sends files to.
 */
export function defaultPaymentFormFields(): PaymentFormField[] {
  return [
    { id: 'name', type: 'text', label: 'Nombre', required: true },
    { id: 'email', type: 'email', label: 'Correo electrónico', required: false },
    {
      id: 'whatsapp_phone',
      type: 'phone',
      label: 'Número de WhatsApp',
      required: true,
      locked: true,
    },
  ]
}

/** Re-asserts the WhatsApp field's invariants on every save, regardless of what the client sent. */
export function enforceLockedFields(fields: PaymentFormField[]): PaymentFormField[] {
  const hasPhone = fields.some((f) => f.id === 'whatsapp_phone')
  const normalized = fields.map((f) =>
    f.id === 'whatsapp_phone'
      ? { ...f, type: 'phone' as const, required: true, locked: true }
      : f,
  )
  if (!hasPhone) {
    normalized.push({
      id: 'whatsapp_phone',
      type: 'phone',
      label: 'Número de WhatsApp',
      required: true,
      locked: true,
    })
  }
  return normalized
}
