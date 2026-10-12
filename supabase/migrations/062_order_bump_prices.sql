-- ============================================================
-- 062_order_bump_prices.sql — per-bump pricing for order bumps (061).
--
-- `price`: what the bump is charged at on THIS checkout. Null = the
-- bump offer's own `payment_forms.amount`, as before. Stored on the
-- bump (not written back to the offer) so a bump price never changes
-- the standalone checkout of an offer that's also sold on its own.
--
-- `compare_at_price`: the "before" price shown struck through next to
-- the bump price on the checkout (display only, never charged). Only
-- shown when it's higher than the effective price.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE payment_order_bumps
  ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(12, 2);

ALTER TABLE payment_order_bumps DROP CONSTRAINT IF EXISTS payment_order_bumps_price_positive;
ALTER TABLE payment_order_bumps
  ADD CONSTRAINT payment_order_bumps_price_positive
  CHECK (price IS NULL OR price > 0);

ALTER TABLE payment_order_bumps DROP CONSTRAINT IF EXISTS payment_order_bumps_compare_at_positive;
ALTER TABLE payment_order_bumps
  ADD CONSTRAINT payment_order_bumps_compare_at_positive
  CHECK (compare_at_price IS NULL OR compare_at_price > 0);
