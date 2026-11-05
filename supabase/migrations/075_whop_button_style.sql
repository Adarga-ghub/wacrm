-- ============================================================
-- 075_whop_button_style.sql — the merchant's design for the Whop pay
-- button on the checkout (sizes, colors, font), edited from the Whop
-- card in the gateway settings.
--
-- Empty means the default design; see
-- src/lib/payments/whop-button-style.ts, which also validates it.
--
-- Idempotent and additive. Must run BEFORE the code that uses it is
-- deployed: the Whop settings read this column.
-- ============================================================

ALTER TABLE whop_gateway_credentials
  ADD COLUMN IF NOT EXISTS button_style JSONB NOT NULL DEFAULT '{}'::jsonb;
