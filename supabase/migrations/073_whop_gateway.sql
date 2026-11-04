-- ============================================================
-- 073_whop_gateway.sql — Whop as a SECOND payment gateway, next to
-- PayPal (which stays exactly as it is).
--
-- Credentials live in their own table on purpose, instead of more
-- columns on `payment_gateway_credentials`: PayPal's "disconnect"
-- deletes that whole row and its "connected" flag is "a row exists",
-- so sharing it would let one gateway break the other.
--
-- Same conventions as 049: one row per account, sandbox and live side
-- by side, secrets AES-256-GCM encrypted with the existing
-- encrypt()/decrypt() helpers, any member reads, admin+ writes.
--
-- `payment_transactions.gateway` records who processed each payment.
-- A Whop transaction reuses `paypal_order_id` for our own order
-- reference (`whop_<uuid>`) and `paypal_capture_id` for the `pay_...`
-- id: those columns are what receipts, automations and the funnel
-- already key on, so Whop payments flow through them unchanged.
--
-- Idempotent and additive — safe to run multiple times. Must run
-- BEFORE the code that uses it is deployed: the PayPal settings and
-- payment finalization read `extra_notification_emails`.
-- ============================================================

CREATE TABLE IF NOT EXISTS whop_gateway_credentials (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  environment             TEXT NOT NULL DEFAULT 'sandbox'
                             CHECK (environment IN ('sandbox', 'live')),
  sandbox_company_id      TEXT,
  sandbox_api_key         TEXT,   -- AES-256-GCM encrypted
  sandbox_webhook_id      TEXT,
  sandbox_webhook_secret  TEXT,   -- AES-256-GCM encrypted
  live_company_id         TEXT,
  live_api_key            TEXT,   -- AES-256-GCM encrypted
  live_webhook_id         TEXT,
  live_webhook_secret     TEXT,   -- AES-256-GCM encrypted
  -- Who gets the "new payment received" alert for Whop payments.
  notification_emails     TEXT[] NOT NULL DEFAULT '{}'
                             CHECK (cardinality(notification_emails) <= 3),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE whop_gateway_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whop_gateway_credentials_select ON whop_gateway_credentials;
CREATE POLICY whop_gateway_credentials_select ON whop_gateway_credentials
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS whop_gateway_credentials_insert ON whop_gateway_credentials;
CREATE POLICY whop_gateway_credentials_insert ON whop_gateway_credentials
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whop_gateway_credentials_update ON whop_gateway_credentials;
CREATE POLICY whop_gateway_credentials_update ON whop_gateway_credentials
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whop_gateway_credentials_delete ON whop_gateway_credentials;
CREATE POLICY whop_gateway_credentials_delete ON whop_gateway_credentials
  FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON whop_gateway_credentials;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whop_gateway_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS gateway TEXT NOT NULL DEFAULT 'paypal'
    CHECK (gateway IN ('paypal', 'whop'));

-- PayPal's card also takes up to three alert addresses: the existing
-- `notification_email` stays the first one, these are the other two.
ALTER TABLE payment_gateway_credentials
  ADD COLUMN IF NOT EXISTS extra_notification_emails TEXT[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(extra_notification_emails) <= 2);
