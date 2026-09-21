-- ============================================================
-- 057_payment_form_checkout_description.sql
--
-- Adds `payment_forms.checkout_description` — a per-offer/price
-- description shown to buyers on the public checkout page
-- (`/pay/[slug]`), under the price line (Hotmart's "Descripción de
-- la Página de Pago"). Deliberately on `payment_forms`, NOT
-- `payment_products`: a product can have several prices/offers (see
-- migration 054), each wanting its own checkout copy (e.g. "+ REGALO"
-- bundling text that only applies to one specific offer), distinct
-- from `payment_products.description`, which stays product-page-only
-- and is never sent to the public checkout (see the comment on
-- `PublicPaymentProduct` in src/types/index.ts).
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE payment_forms
  ADD COLUMN IF NOT EXISTS checkout_description TEXT;
