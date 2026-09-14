-- ============================================================
-- 042_ad_referral_and_meta_capi
--
-- Two independent features, bundled in one migration because both are
-- part of the same Meta Ads attribution story:
--
--   1. Click-to-WhatsApp ad origin capture. When a customer messages
--      us via a "Click to WhatsApp" Facebook/Instagram ad, Meta rides
--      a `referral` object inside the FIRST inbound message of that
--      click (source_url, headline, body, media_type, ad id,
--      `ctwa_clid`). It is NOT a separate webhook field/subscription —
--      it's already inside the `messages` field we already receive —
--      the app has just never read it. `messages.referral` stores the
--      raw object on the exact message that carried it (so the inbox
--      can render the "came from this ad" card inline, in-place, like
--      the WhatsApp Business mobile app does); `conversations.ad_*`
--      mirrors the MOST RECENT one seen for quick reads without a
--      join (a contact can click a different ad later — history lives
--      on the messages themselves, "most recent" lives here).
--
--   2. Meta Conversions API opt-in + destination. Sending a customer's
--      phone number and ad-click id back to Meta for campaign
--      optimization requires the account to explicitly opt in
--      (`meta_ads_data_sharing_enabled`, default FALSE — this shares
--      customer data with a third party, so it must be an explicit
--      choice, never a silent default-on) and a Dataset ID to send
--      events to. Reuses the existing `access_token` for the CAPI call
--      (the same WABA system-user token, when granted `ads_management`
--      on that dataset in Meta Business Settings) rather than adding a
--      second credential — see `src/lib/whatsapp/meta-api.ts`'s
--      `sendConversionEvent`.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. messages.referral — raw referral object, only on the message
--    that actually carried one.
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS referral JSONB;

COMMENT ON COLUMN messages.referral IS
  'Meta''s `referral` object off a Click-to-WhatsApp ad click, verbatim, '
  'when this inbound message carried one: source_url, source_id, '
  'source_type, headline, body, media_type, image_url/video_url, '
  'thumbnail_url, ctwa_clid. NULL for every other message. The inbox '
  'renders a "from this ad" card inline above the message that has it.';

-- ============================================================
-- 2. conversations.ad_* — mirror of the MOST RECENT referral seen on
--    this conversation, kept in sync by the webhook every time a new
--    one arrives. Denormalized so the automation engine / CAPI sender
--    and any list-view badge can read it without joining messages.
-- ============================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ad_referral JSONB,
  ADD COLUMN IF NOT EXISTS ad_referral_ctwa_clid TEXT,
  ADD COLUMN IF NOT EXISTS ad_referral_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN conversations.ad_referral IS
  'Mirror of the most recent messages.referral seen for this '
  'conversation. Overwritten (not merged) on every new ad click so it '
  'always reflects the latest campaign that brought this contact in; '
  'the full history is on the individual messages.referral rows.';

COMMENT ON COLUMN conversations.ad_referral_ctwa_clid IS
  'Promoted out of ad_referral for indexed lookups — the Click-to-'
  'WhatsApp click id Meta''s Conversions API needs to attribute a '
  'conversion event back to the ad that started this conversation.';

CREATE INDEX IF NOT EXISTS idx_conversations_ad_referral_ctwa_clid
  ON conversations(ad_referral_ctwa_clid)
  WHERE ad_referral_ctwa_clid IS NOT NULL;

-- ============================================================
-- 3. whatsapp_config — Meta Ads customer-data-sharing opt-in + the
--    Dataset ID conversion events get sent to.
-- ============================================================
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS meta_ads_data_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meta_dataset_id TEXT;

COMMENT ON COLUMN whatsapp_config.meta_ads_data_sharing_enabled IS
  'Opt-in for sharing customer conversation activity (hashed phone + '
  'ctwa_clid) with Meta via the Conversions API, for ad campaign '
  'optimization. Defaults OFF — this leaves the account''s tenant, so '
  'it must be an explicit choice, never silently on.';

COMMENT ON COLUMN whatsapp_config.meta_dataset_id IS
  'Meta Dataset ID (Events Manager) that "Send Conversion Event" '
  'automation steps post to via POST /{dataset_id}/events. Not a '
  'secret — the access_token authenticating the call is already '
  'encrypted at rest on this row.';
