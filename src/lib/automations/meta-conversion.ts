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
// Gated on account-level settings:
//   - `meta_ads_data_sharing_enabled` — explicit opt-in (default OFF).
//     Sharing a customer's phone number with Meta is a data-sharing
//     decision the account owner must make deliberately.
//   - `meta_dataset_id` — where to send it.
//   - `meta_page_id` — the Facebook Page ID running the account's
//     Click-to-WhatsApp ads, required by Meta as `user_data.page_id`
//     (see meta-api.ts's SendConversionEventArgs). NOT the same as
//     `waba_id` or `phone_number_id` — confirmed empirically against
//     a live ad in Ads Manager.
// Missing any of those is treated as "not configured", not an error.
//
// ALSO gated on the contact having a `ctwa_clid` on record (migration
// 042's `conversations.ad_referral_ctwa_clid`) — confirmed empirically
// against Meta's API (error_subcode 2804071) that `action_source:
// business_messaging` REJECTS the event outright without one. This
// action_source exists specifically to attribute ad-driven
// conversions; a contact who never clicked a Click-to-WhatsApp ad has
// nothing for Meta to attribute, so there is no legitimate event to
// send for them. That is the overwhelmingly common case for most
// businesses (most customers message organically, not via an ad), so
// this is treated the same as "not configured" — a skipped step
// logged with a clear reason, never a thrown failure.
// ------------------------------------------------------------

export interface SendMetaConversionEventArgs {
  accountId: string
  contactId: string
  eventName: string
  value?: number
  currency?: string
  /**
   * Manual-verification-only escape hatch — routes the event to Events
   * Manager's Test Events tab instead of production reporting. The
   * automation engine's real dispatch path must never set this.
   */
  testEventCode?: string
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
    .select('access_token, meta_ads_data_sharing_enabled, meta_dataset_id, meta_page_id')
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
  if (!config.meta_page_id) {
    return { sent: false, reason: 'no Meta Page ID configured (Settings → WhatsApp)' }
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

  // REQUIRED by Meta for action_source: business_messaging — see the
  // module comment above. No ad click on record means there is
  // nothing to legitimately report for this contact; skip rather than
  // let the API call fail (or, worse, fabricate a click id).
  const ctwaClid = conversation?.ad_referral_ctwa_clid
  if (!ctwaClid) {
    return {
      sent: false,
      reason:
        'contact has no Click-to-WhatsApp ad click on record — Meta requires a ctwa_clid ' +
        'for business_messaging conversion events, so this conversation cannot be attributed',
    }
  }

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
    pageId: config.meta_page_id,
    ctwaClid,
    value: args.value,
    currency: args.currency,
    testEventCode: args.testEventCode,
  })

  return {
    sent: true,
    reason: `sent '${args.eventName}' (${result.eventsReceived} received, attributed via ctwa_clid)`,
  }
}
