-- ============================================================
-- 049_payment_gateway.sql — PayPal credentials for the new
-- "Facturación y Pagos" module.
--
-- One row per account (singleton, like `whatsapp_config`). Both
-- sandbox and live credentials are stored side by side so switching
-- `environment` doesn't require re-entering keys — mirrors how the
-- WhatsApp config panel keeps a single row per account.
--
-- Secrets (`*_client_secret`) are AES-256-GCM encrypted at rest with
-- the SAME `encrypt()`/`decrypt()` helpers already used for the
-- WhatsApp access token and the outbound-webhook HMAC secret
-- (`src/lib/whatsapp/encryption.ts`, see migration 028's notes) — no
-- new crypto is introduced here.
--
-- `*_webhook_id` is the id PayPal assigns when we register our
-- webhook URL with them; it's required to verify the signature on
-- every inbound `POST /api/payments/paypal/webhook` call via PayPal's
-- `verify-webhook-signature` API. Not a secret, so stored in plain
-- text like `whatsapp_config.phone_number_id`.
--
-- RLS mirrors `webhook_endpoints` (028): any account member may read
-- (the dashboard needs to show connection status to agents/viewers),
-- only admin+ may write (settings-class credential).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_gateway_credentials (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id             UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  environment            TEXT NOT NULL DEFAULT 'sandbox'
                            CHECK (environment IN ('sandbox', 'live')),
  sandbox_client_id      TEXT,
  sandbox_client_secret  TEXT,   -- AES-256-GCM encrypted
  sandbox_webhook_id     TEXT,
  live_client_id         TEXT,
  live_client_secret     TEXT,   -- AES-256-GCM encrypted
  live_webhook_id        TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_gateway_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_gateway_credentials_select ON payment_gateway_credentials;
CREATE POLICY payment_gateway_credentials_select ON payment_gateway_credentials
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS payment_gateway_credentials_insert ON payment_gateway_credentials;
CREATE POLICY payment_gateway_credentials_insert ON payment_gateway_credentials
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS payment_gateway_credentials_update ON payment_gateway_credentials;
CREATE POLICY payment_gateway_credentials_update ON payment_gateway_credentials
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS payment_gateway_credentials_delete ON payment_gateway_credentials;
CREATE POLICY payment_gateway_credentials_delete ON payment_gateway_credentials
  FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON payment_gateway_credentials;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_gateway_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
