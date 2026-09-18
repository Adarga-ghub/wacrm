-- ============================================================
-- 053_payment_skins.sql — "Apariencias de pago" (Payment Skins):
-- reusable, Hotmart-style checkout design templates that can be
-- applied to any number of payment forms at once, instead of setting
-- `accent_color`/`logo_url` per form (migration 052's
-- `payment_forms.design`).
--
-- `design` reuses the exact same free-form jsonb shape as
-- `payment_forms.design` (`{ "accent_color": "#16a34a", "logo_url":
-- "https://..." }`) for the same reason migration 052 chose it:
-- purely cosmetic, read only by the public checkout page, never
-- queried/filtered on.
--
-- `payment_forms.skin_id` is nullable — a form with no skin keeps
-- rendering its own `design` column untouched (every existing form
-- keeps working as-is). When set, `GET
-- /api/public/payments/forms/[slug]` reads the SKIN's design instead
-- of the form's own, so every form pointed at the same skin renders
-- identically and updates together when the skin is edited.
--
-- ON DELETE SET NULL: deleting a skin must not break the forms using
-- it, just detach them back to their own (usually blank) design.
--
-- RLS mirrors `payment_forms` (050) exactly: any member reads, agent+
-- writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_skins (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  design      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_skins_account ON payment_skins(account_id);

ALTER TABLE payment_skins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_skins_select ON payment_skins;
CREATE POLICY payment_skins_select ON payment_skins
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS payment_skins_insert ON payment_skins;
CREATE POLICY payment_skins_insert ON payment_skins
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_skins_update ON payment_skins;
CREATE POLICY payment_skins_update ON payment_skins
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_skins_delete ON payment_skins;
CREATE POLICY payment_skins_delete ON payment_skins
  FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON payment_skins;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_skins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payment_forms
  ADD COLUMN IF NOT EXISTS skin_id UUID REFERENCES payment_skins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_forms_skin ON payment_forms(skin_id);
