-- ============================================================
-- 064_checkout_bump_heading_and_gallery.sql — checkout redesign:
-- order-bump section heading + order-bump preview gallery.
--
-- `payment_forms.bump_heading`: the headline shown above a main
-- offer's order bumps on its checkout ("¡No te pierdas estas
-- increíbles ofertas!"). Per main offer, not per bump — it heads the
-- whole section. Null/empty = the checkout's own localized default.
--
-- `payment_order_bumps.gallery_images`: image URLs (`payment-media`
-- bucket, migration 055) for the bump's preview pop-up — the "eye"
-- under the bump's cover on the checkout. The first one is the main
-- image (usually a 3D/perspective mockup), the rest are inner pages
-- shown as thumbnails. Empty = the pop-up falls back to the bump
-- offer's product cover.
--
-- The rest of the redesign (logo on/off, urgency timer text and
-- duration) is cosmetic and lives in the existing `design` jsonb of
-- `payment_skins` / `payment_forms` (migrations 052/053) — no column
-- needed for it.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE payment_forms
  ADD COLUMN IF NOT EXISTS bump_heading TEXT;

ALTER TABLE payment_order_bumps
  ADD COLUMN IF NOT EXISTS gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE payment_order_bumps DROP CONSTRAINT IF EXISTS payment_order_bumps_gallery_is_array;
ALTER TABLE payment_order_bumps
  ADD CONSTRAINT payment_order_bumps_gallery_is_array
  CHECK (jsonb_typeof(gallery_images) = 'array');
