-- ============================================================
-- 066_order_bump_drafts.sql — order bumps can be saved as drafts.
--
-- `payment_order_bumps.is_draft`: a bump saved half-done from the
-- admin ("Guardar borrador"). A draft is never shown on the checkout
-- nor charged (`loadOrderBumps` skips it); publishing it runs the
-- usual offer checks (fixed price, same currency).
--
-- `bump_form_id` becomes nullable so a draft can be saved before its
-- offer is chosen. A published bump must still have one (CHECK below).
-- The UNIQUE (form_id, bump_form_id) constraint is unaffected: NULLs
-- never collide, so several offer-less drafts can coexist.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE payment_order_bumps
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE payment_order_bumps
  ALTER COLUMN bump_form_id DROP NOT NULL;

ALTER TABLE payment_order_bumps DROP CONSTRAINT IF EXISTS payment_order_bumps_published_has_offer;
ALTER TABLE payment_order_bumps
  ADD CONSTRAINT payment_order_bumps_published_has_offer
  CHECK (is_draft OR bump_form_id IS NOT NULL);
