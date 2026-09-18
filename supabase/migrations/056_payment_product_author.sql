-- ============================================================
-- 056_payment_product_author.sql
--
-- Adds `payment_products.author` — the creator/instructor name shown
-- on the public checkout page as "Por {author}" (Hotmart-style),
-- alongside the product's name/description/image which the checkout
-- page (`/pay/[slug]`) now pulls directly from the linked product
-- instead of from any per-skin copy (see migration 054's comment on
-- `PaymentProduct` and the removal of `payment_forms`/skins'
-- title/subtitle fields in the app layer — no schema change needed
-- for that side since they lived in a free-form `design` jsonb
-- column that simply stops being read).
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE payment_products
  ADD COLUMN IF NOT EXISTS author TEXT;
