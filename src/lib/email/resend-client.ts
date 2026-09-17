import { Resend } from 'resend'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function client() {
  if (!_client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set')
    }
    _client = new Resend(process.env.RESEND_API_KEY)
  }
  return _client
}

export interface SendEmailArgs {
  to: string
  subject: string
  html: string
  replyTo?: string
  attachments?: { filename: string; content: Buffer }[]
}

/**
 * Thin wrapper over the Resend SDK — the payments module's only
 * caller of an outbound-email provider. `RESEND_API_KEY` /
 * `RESEND_FROM_EMAIL` are instance-level env vars (like
 * `SUPABASE_SERVICE_ROLE_KEY`), not a per-account setting: email
 * deliverability (SPF/DKIM/domain reputation) is the operator's
 * concern, not something each account should self-serve with just
 * an API key the way PayPal credentials are (PayPal payouts land in
 * THEIR merchant account; email just needs to reliably send).
 *
 * Every call site treats a failure here as non-fatal — a payment
 * that succeeds but whose receipt email fails to send is a bug
 * report, not a reason to have failed the payment itself.
 */
export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    console.error('[email] RESEND_FROM_EMAIL is not set — skipping send')
    return { ok: false, error: 'RESEND_FROM_EMAIL not configured' }
  }
  try {
    const { error } = await client().emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo,
      attachments: args.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    })
    if (error) {
      console.error('[email] Resend send failed:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error'
    console.error('[email] send threw:', message)
    return { ok: false, error: message }
  }
}
