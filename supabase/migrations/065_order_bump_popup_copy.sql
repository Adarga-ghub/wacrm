-- ============================================================
-- 065_order_bump_popup_copy.sql — order bump copy for the preview
-- pop-up, separate from the checkout box, plus the box's font sizes.
--
-- Until now `payment_order_bumps.title` / `description` were shown
-- both in the bump box on the checkout and in its preview pop-up (the
-- "eye"). These columns let the merchant write the pop-up's own copy
-- and both button labels:
--
-- `popup_title`, `popup_description`: the pop-up's heading and text.
-- `checkbox_label`: the label next to the box's checkbox on the
--   checkout ("Añadir a la compra").
-- `popup_button_label`, `popup_added_label`: the pop-up's green button,
--   before ("Añadir a la compra") and after ("Añadido a tu compra")
--   it is pressed.
--
-- `box_font_sizes`: font sizes (px) of the checkout box's title,
--   description and checkbox label, e.g. {"title": 15, "checkbox": 16}.
--   A missing key = the default size. The box grows with the fonts
--   (validated in the API: see BUMP_BOX_FONT_SIZES).
--
-- Null/empty = the current behaviour: the pop-up reuses the box's
-- title/description and the labels are the checkout's localized
-- defaults, so existing bumps look exactly the same.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE payment_order_bumps
  ADD COLUMN IF NOT EXISTS popup_title TEXT,
  ADD COLUMN IF NOT EXISTS popup_description TEXT,
  ADD COLUMN IF NOT EXISTS checkbox_label TEXT,
  ADD COLUMN IF NOT EXISTS popup_button_label TEXT,
  ADD COLUMN IF NOT EXISTS popup_added_label TEXT,
  ADD COLUMN IF NOT EXISTS box_font_sizes JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE payment_order_bumps DROP CONSTRAINT IF EXISTS payment_order_bumps_box_font_sizes_is_object;
ALTER TABLE payment_order_bumps
  ADD CONSTRAINT payment_order_bumps_box_font_sizes_is_object
  CHECK (jsonb_typeof(box_font_sizes) = 'object');
