/**
 * Minimal inline-styled HTML email bodies for the payments module.
 * No template engine — two short, mostly-static emails don't
 * justify one, and inline styles are what survive real inboxes.
 */

export function customerReceiptEmailHtml(args: {
  businessName: string
  buyerName: string
  formName: string
  amount: number
  currency: string
}): string {
  const { businessName, buyerName, formName, amount, currency } = args
  return `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
    <h2 style="margin:0 0 8px">Thanks for your payment${buyerName ? `, ${escapeHtml(buyerName)}` : ''}!</h2>
    <p style="color:#555;line-height:1.5">
      We've received your payment of <strong>${amount.toFixed(2)} ${escapeHtml(currency)}</strong>
      for <strong>${escapeHtml(formName)}</strong> from ${escapeHtml(businessName)}.
    </p>
    <p style="color:#555;line-height:1.5">
      Your receipt is attached to this email. If you have any questions, just reply to this message.
    </p>
  </div>`
}

export function merchantNotificationEmailHtml(args: {
  formName: string
  amount: number
  currency: string
  buyerName: string
  buyerPhone: string | null
}): string {
  const { formName, amount, currency, buyerName, buyerPhone } = args
  return `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
    <h2 style="margin:0 0 8px">New payment received</h2>
    <table style="width:100%;border-collapse:collapse;color:#333">
      <tr><td style="padding:4px 0;color:#777">Form</td><td style="padding:4px 0">${escapeHtml(formName)}</td></tr>
      <tr><td style="padding:4px 0;color:#777">Amount</td><td style="padding:4px 0">${amount.toFixed(2)} ${escapeHtml(currency)}</td></tr>
      <tr><td style="padding:4px 0;color:#777">Payer</td><td style="padding:4px 0">${escapeHtml(buyerName || '—')}</td></tr>
      ${buyerPhone ? `<tr><td style="padding:4px 0;color:#777">WhatsApp</td><td style="padding:4px 0">${escapeHtml(buyerPhone)}</td></tr>` : ''}
    </table>
  </div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
