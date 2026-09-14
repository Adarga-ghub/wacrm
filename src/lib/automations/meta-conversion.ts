import crypto from 'crypto'
import { sendConversionEvent } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'
import { supabaseAdmin } from './admin-client'

// ------------------------------------------------------------
// "Send Conversion Event" automation step — reports a WhatsApp-side
// conversion (a tag like "pedido finalizado") back to Meta via the
// Conversions API, so Ads Manager can optimize campaigns for
// customers who actually convert, not just who clicked.
//
// Gated on TWO account-level settings, both required:
//   - `meta_ads_data_sharing_enabled` — explicit opt-in (default OFF).
//     Sharing a customer's phone number with Meta is a data-sharing
//     decision the account owner must make deliberately.
//   - `meta_dataset_id` — where to send it.
// Missing either is treated as "not configured", not an error — most
// accounts won't have this on, and a tag-triggered automation firing
// for every contact must not spam automation_logs with failures for
// the common case of a customer who didn't come from an ad.
// ------------------------------------------------------------

export interface SendMetaConversionEventArgs {
  accountId: string
  contactId: string
  eventName: string
  value?: number
  currency?: string
}

export interface SendMetaConversionEventResult {
  /** False whenever the event was skipped (not an error) — see the reason string. */
  sent: boolean
  reason: string
}

export async function sendMetaConversionEvent(
  args: SendMetaConversionEventArgs
): Promise<SendMetaConversionEventResult> {
  const db = supabaseAdmin()

  const { data: config, error: configErr } = await db
    .from('whatsapp_config')
    .select('access_token, meta_ads_data_sharing_enabled, meta_dataset_id')
    .eq('account_id', args.accountId)
    .maybeSingle()
  if (configErr || !config) {
    return { sent: false, reason: 'WhatsApp not configured for this account' }
  }
  if (!config.meta_ads_data_sharing_enabled) {
    return {
      sent: false,
      reason: 'Meta Ads data sharing is disabled for this account (Settings → WhatsApp)',
    }
  }
  if (!config.meta_dataset_id) {
    return { sent: false, reason: 'no Meta Dataset ID configured (Settings → WhatsApp)' }
  }

  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('phone')
    .eq('id', args.contactId)
    .eq('account_id', args.accountId)
    .maybeSingle()
  if (contactErr || !contact?.phone) {
    return { sent: false, reason: 'contact not found for this account' }
  }

  // Most recent ad click for this contact, if any — the conversation
  // row mirrors it (migration 042). A contact can have multiple
  // conversations only in edge cases the dedup migration (036)
  // prevents going forward, so this is effectively "the" conversation.
  const { data: conversation } = await db
    .from('conversations')
    .select('ad_referral_ctwa_clid')
    .eq('account_id', args.accountId)
    .eq('contact_id', args.contactId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Meta requires E.164 digits, no leading '+', before hashing.
  const hashedPhone = crypto
    .createHash('sha256')
    .update(normalizePhone(contact.phone))
    .digest('hex')

  const accessToken = decrypt(config.access_token)

  const result = await sendConversionEvent({
    datasetId: config.meta_dataset_id,
    accessToken,
    eventName: args.eventName,
    hashedPhone,
    ctwaClid: conversation?.ad_referral_ctwa_clid ?? undefined,
    value: args.value,
    currency: args.currency,
  })

  return {
    sent: true,
    reason: conversation?.ad_referral_ctwa_clid
      ? `sent '${args.eventName}' (${result.eventsReceived} received, attributed via ctwa_clid)`
      : `sent '${args.eventName}' (${result.eventsReceived} received, no ad click on record — phone match only)`,
  }
}
