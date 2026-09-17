-- ============================================================
-- 050_payment_forms.sql — "Facturación y Pagos" payment forms.
--
-- A `payment_form` is the Forminator-style checkout the account
-- builds: a small set of capture fields (name/email/WhatsApp phone —
-- the phone field is always injected by the app layer as required,
-- never stored as optional here) plus an amount and, optionally, the
-- automation to run when a payment against it completes.
--
-- `fields` shape (validated in the app layer, not in Postgres):
--   [{ "id": "email", "type": "email", "label": "Email", "required": true }, ...]
--
-- `currency` is intentionally NOT free per form — the account has a
-- single `default_currency` (migration 021, the same one-currency-
-- per-account rule `create_deal` already follows in
-- src/lib/automations/engine.ts) and forms inherit it at creation
-- time. The format CHECK mirrors `accounts_default_currency_format`.
--
-- `automation_id` is nullable and ON DELETE SET NULL: deleting the
-- linked automation must not break the form, just detach it (the
-- editor's Automatización tab will show "no automation selected").
--
-- `send_automation_default` is the default state of the per-link
-- "send automation on payment" toggle (migration 051) when a new
-- payment link is generated from this form — this is the switch the
-- merchant uses for "ya le envié los archivos a este cliente, no
-- reenviar".
--
-- RLS follows the exact `automations` policy shape (017): any member
-- reads, `agent+` writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_forms (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id               UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name                     TEXT NOT NULL,
  slug                     TEXT NOT NULL UNIQUE,
  status                   TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'published', 'archived')),
  fields                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount_type              TEXT NOT NULL DEFAULT 'fixed'
                              CHECK (amount_type IN ('fixed', 'variable', 'product_list')),
  amount                   NUMERIC(12, 2),
  min_amount               NUMERIC(12, 2),
  products                 JSONB,
  currency                 TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  automation_id            UUID REFERENCES automations(id) ON DELETE SET NULL,
  send_automation_default  BOOLEAN NOT NULL DEFAULT TRUE,
  redirect_url             TEXT,
  inline_success_message   TEXT,
  submission_limit         INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_forms_account ON payment_forms(account_id);
-- Public checkout lookups (`GET /api/public/payments/forms/[slug]`) go
-- straight by slug with no account context, so it needs its own index
-- beyond the account-scoped one above.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_forms_slug ON payment_forms(slug);

ALTER TABLE payment_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_forms_select ON payment_forms;
CREATE POLICY payment_forms_select ON payment_forms
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS payment_forms_insert ON payment_forms;
CREATE POLICY payment_forms_insert ON payment_forms
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_forms_update ON payment_forms;
CREATE POLICY payment_forms_update ON payment_forms
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_forms_delete ON payment_forms;
CREATE POLICY payment_forms_delete ON payment_forms
  FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON payment_forms;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
