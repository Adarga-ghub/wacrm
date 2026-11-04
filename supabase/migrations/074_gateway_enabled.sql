-- ============================================================
-- 074_gateway_enabled.sql — turn a payment gateway off without
-- losing its credentials.
--
-- `enabled` only decides whether NEW payments are offered: orders
-- already started on a gateway still get captured and confirmed.
-- Defaults to TRUE so nothing changes for accounts already connected.
--
-- Idempotent and additive. Must run BEFORE the code that uses it is
-- deployed: the gateway settings read this column.
-- ============================================================

ALTER TABLE payment_gateway_credentials
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE whop_gateway_credentials
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
