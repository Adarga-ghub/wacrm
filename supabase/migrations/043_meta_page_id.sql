-- ============================================================
-- 043_meta_page_id
--
-- Migration 042's "Send Conversion Event" step used
-- `whatsapp_config.waba_id` as Meta's required `user_data.page_id` on
-- business_messaging Conversions API events. Verified against a live
-- production call: Meta rejects the WABA id there with error_subcode
-- 2804070 ("El parámetro page_id... no es válido") — the field
-- actually wants the Facebook Page ID running the account's Click-to-
-- WhatsApp ads, a distinct entity from both the WABA id and the
-- phone_number_id, confirmed by cross-checking a live ad in Ads
-- Manager (its "identidad del anuncio" Page).
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS meta_page_id TEXT;

COMMENT ON COLUMN whatsapp_config.meta_page_id IS
  'Facebook Page ID running this account''s Click-to-WhatsApp ads. '
  'Required (with meta_ads_data_sharing_enabled + meta_dataset_id) for '
  '"Send Conversion Event" automation steps to actually fire — Meta''s '
  'Conversions API rejects business_messaging events without it. NOT '
  'the same as waba_id or phone_number_id.';
