-- ============================================================
-- 067_order_bump_checkbox_added_label.sql — the checkout box's
-- checkbox label once the bump is added.
--
-- `checkbox_label` (migration 065) is the label next to the box's
-- checkbox before the buyer ticks it ("Añadir a la compra").
-- `checkbox_added_label` replaces it while the bump is in the order
-- ("Añadido a tu compra"), so the buyer sees it was added — the same
-- as the pop-up's button does with `popup_added_label`.
--
-- Null/empty = the checkout's localized default.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE payment_order_bumps
  ADD COLUMN IF NOT EXISTS checkbox_added_label TEXT;
