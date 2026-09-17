-- ============================================================
-- 051_payment_links_and_transactions.sql
--
-- payment_links
--   A single shareable checkout instance generated from a
--   `payment_form` (the "Compartir → Generar enlace de cobro" dialog).
--   Reusable form has one canonical public URL by slug already
--   (`payment_forms.slug`); a *link* exists on top of that for the
--   cases the plain slug URL doesn't cover:
--     - pre-filling a known contact (generated from an existing
--       WhatsApp conversation)
--     - a one-off custom amount
--     - most importantly: **pinning the automation on/off decision
--       server-side**, per use, instead of per form. This is the
--       "cobrar sin disparar automatización" button — the merchant
--       sets `send_automation` here when THEY create the link (e.g.
--       because the files were already sent by hand), and nothing
--       the payer does in the browser can change it.
--
-- payment_transactions
--   The Forminator "Submissions" equivalent, scoped to payments. One
--   row per PayPal order, created the moment we ask PayPal to create
--   the order (status 'created') and driven to 'completed' /
--   'failed' by the webhook (`POST /api/payments/paypal/webhook`).
--   `send_automation` is COPIED from the link/form at order-creation
--   time — the webhook reads it from here, never re-derives it — so
--   the merchant's choice is immutable once the checkout started.
--   `paypal_order_id` / `paypal_capture_id` are UNIQUE, which is what
--   makes the webhook idempotent against PayPal's own retries: a
--   duplicate delivery finds the row already 'completed' and no-ops
--   instead of re-dispatching the automation or re-tagging the
--   contact.
--
-- Both tables: SELECT for account members; NO insert/update/delete
-- policy for authenticated users — every write goes through the
-- service-role client from server routes (checkout creation, the
-- PayPal webhook), same as `automation_pending_executions` (006) and
-- `webhook_phone_capture_failures` (048).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_links (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  form_id          UUID NOT NULL REFERENCES payment_forms(id) ON DELETE CASCADE,
  code             TEXT NOT NULL UNIQUE,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  send_automation  BOOLEAN NOT NULL DEFAULT TRUE,
  amount_override  NUMERIC(12, 2),
  status           TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'revoked')),
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_links_account ON payment_links(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_form ON payment_links(form_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_links_code ON payment_links(code);

ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_links_select ON payment_links;
CREATE POLICY payment_links_select ON payment_links
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS payment_links_insert ON payment_links;
CREATE POLICY payment_links_insert ON payment_links
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_links_update ON payment_links;
CREATE POLICY payment_links_update ON payment_links
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_links_delete ON payment_links;
CREATE POLICY payment_links_delete ON payment_links
  FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ============================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  form_id                 UUID REFERENCES payment_forms(id) ON DELETE SET NULL,
  link_id                 UUID REFERENCES payment_links(id) ON DELETE SET NULL,
  contact_id              UUID REFERENCES contacts(id) ON DELETE SET NULL,
  paypal_order_id         TEXT NOT NULL UNIQUE,
  paypal_capture_id       TEXT UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'created'
                             CHECK (status IN ('created', 'approved', 'completed', 'failed', 'refunded')),
  amount                  NUMERIC(12, 2) NOT NULL,
  currency                TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payer_name              TEXT,
  payer_email             TEXT,
  whatsapp_phone          TEXT,
  form_field_values       JSONB NOT NULL DEFAULT '{}'::jsonb,
  send_automation         BOOLEAN NOT NULL DEFAULT TRUE,
  automation_id           UUID REFERENCES automations(id) ON DELETE SET NULL,
  automation_dispatched_at TIMESTAMPTZ,
  raw_webhook_payload     JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_account
  ON payment_transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_form ON payment_transactions(form_id);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_transactions_select ON payment_transactions;
CREATE POLICY payment_transactions_select ON payment_transactions
  FOR SELECT USING (is_account_member(account_id));

DROP TRIGGER IF EXISTS set_updated_at ON payment_transactions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
