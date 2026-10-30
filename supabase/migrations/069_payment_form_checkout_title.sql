-- ============================================================
-- 069_payment_form_checkout_title.sql
--
-- Adds `payment_forms.checkout_title` — the per-offer headline shown
-- to buyers on the public checkout page (`/pay/[slug]`), above the
-- price line. Until now that headline was always the linked
-- product's name, so editing an offer's "Nombre del precio" (its
-- internal name, used to tell several offers of one product apart)
-- never reached the checkout. Null = keep showing the product's name
-- (or, for a standalone form, the form's own name) as before.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE payment_forms
  ADD COLUMN IF NOT EXISTS checkout_title TEXT;
