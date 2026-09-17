import { findOrCreatePaymentContact, resolveAttributedUserId } from './contact'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { sendEmail } from '@/lib/email/resend-client'
import { customerReceiptEmailHtml, merchantNotificationEmailHtml } from './emails'
import { generateReceiptPdf } from './receipt-pdf'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export interface FinalizePaymentArgs {
  transactionId: string
  accountId: string
  payerName: string | null
  payerEmail: string | null
  captureId: string | null
}

/**
 * The single place a payment transitions from "approved by PayPal"
 * to "done": marks the transaction `completed`, resolves/creates the
 * WhatsApp contact, dispatches the `payment_received` automation
 * (only when `send_automation` is true), and — best-effort, never
 * blocking the response — emails the buyer a receipt and alerts the
 * merchant.
 *
 * Both `POST /api/public/payments/orders/[orderId]/capture` (the
 * primary path) and `POST /api/payments/paypal/webhook` (the
 * backstop) call this after confirming PayPal's own status is
 * `COMPLETED` — this used to be duplicated between the two routes;
 * consolidating here is what keeps the "only email once" /
 * "only dispatch the automation once" guarantees in one place
 * instead of two copies that could drift.
 *
 * Idempotent at two levels: re-entering with an already-`completed`
 * transaction is a no-op, and `receipt_sent_at` gates the email step
 * independently so a retry after an email-send failure doesn't also
 * re-dispatch the automation.
 */
export async function finalizePaymentTransaction(
  db: AnySupabase,
  args: FinalizePaymentArgs,
): Promise<void> {
  const { data: txn } = await db
    .from('payment_transactions')
    .select('*')
    .eq('id', args.transactionId)
    .maybeSingle()
  if (!txn) return
  if (txn.status === 'completed') return

  await db
    .from('payment_transactions')
    .update({
      status: 'completed',
      paypal_capture_id: args.captureId ?? txn.paypal_capture_id,
      payer_name: args.payerName ?? txn.payer_name,
      payer_email: args.payerEmail ?? txn.payer_email,
    })
    .eq('id', txn.id)

  const [{ data: form }, { data: account }, { data: gatewayConfig }] = await Promise.all([
    db
      .from('payment_forms')
      .select('name, automation_id, created_by')
      .eq('id', txn.form_id)
      .maybeSingle(),
    db.from('accounts').select('name').eq('id', args.accountId).maybeSingle(),
    db
      .from('payment_gateway_credentials')
      .select('notification_email')
      .eq('account_id', args.accountId)
      .maybeSingle(),
  ])

  const fieldValues = (txn.form_field_values ?? {}) as Record<string, string>
  const buyerName = fieldValues['name'] ?? args.payerName ?? ''
  const buyerEmail = fieldValues['email'] ?? args.payerEmail ?? null
  // Prefer the chosen product's name (product_list forms) over the
  // form's own name for anything customer-facing — see the
  // `_product_name` field `POST /api/public/payments/orders` stashes
  // in `form_field_values` alongside the real captured fields.
  const itemLabel = fieldValues['_product_name'] || form?.name || 'Payment'

  let contactId: string | null = null
  if (txn.whatsapp_phone && form) {
    const attributedUserId = await resolveAttributedUserId(db, args.accountId, form.created_by)
    if (attributedUserId) {
      const outcome = await findOrCreatePaymentContact(
        db,
        args.accountId,
        attributedUserId,
        txn.whatsapp_phone,
        buyerName,
      )
      contactId = outcome?.contact.id ?? null
    }
  }

  if (txn.send_automation && contactId) {
    await runAutomationsForTrigger({
      accountId: args.accountId,
      triggerType: 'payment_received',
      contactId,
      context: {
        vars: {
          amount: String(txn.amount),
          currency: txn.currency,
          order_id: txn.paypal_order_id,
          payer_name: buyerName,
          payer_email: buyerEmail ?? '',
        },
      },
    })
    await db
      .from('payment_transactions')
      .update({
        automation_dispatched_at: new Date().toISOString(),
        automation_id: form?.automation_id ?? null,
      })
      .eq('id', txn.id)
  }

  if (!txn.receipt_sent_at) {
    try {
      if (buyerEmail) {
        const receiptNumber = args.captureId ?? txn.paypal_order_id
        const pdf = await generateReceiptPdf({
          businessName: account?.name ?? 'Receipt',
          receiptNumber,
          date: new Date(),
          itemDescription: itemLabel,
          amount: Number(txn.amount),
          currency: txn.currency,
          buyerName,
          buyerEmail,
          buyerPhone: txn.whatsapp_phone,
        })
        await sendEmail({
          to: buyerEmail,
          subject: `Payment receipt — ${itemLabel}`,
          html: customerReceiptEmailHtml({
            businessName: account?.name ?? '',
            buyerName,
            formName: itemLabel,
            amount: Number(txn.amount),
            currency: txn.currency,
          }),
          attachments: [{ filename: `receipt-${receiptNumber}.pdf`, content: pdf }],
        })
      }
      if (gatewayConfig?.notification_email) {
        await sendEmail({
          to: gatewayConfig.notification_email,
          subject: `New payment received — ${itemLabel}`,
          html: merchantNotificationEmailHtml({
            formName: itemLabel,
            amount: Number(txn.amount),
            currency: txn.currency,
            buyerName,
            buyerPhone: txn.whatsapp_phone,
          }),
        })
      }
      await db
        .from('payment_transactions')
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq('id', txn.id)
    } catch (err) {
      // Never fail the payment over an email — surfaces in logs only.
      console.error('[payments/finalize] email dispatch failed:', err)
    }
  }
}
