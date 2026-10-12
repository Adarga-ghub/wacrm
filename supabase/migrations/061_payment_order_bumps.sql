-- ============================================================
-- 061_payment_order_bumps.sql — Order Bumps for the public checkout.
--
-- An order bump is a secondary offer shown as a checkbox on a main
-- offer's checkout page (`/pay/[slug]`), between the buyer's details
-- and the payment buttons. Ticking it adds that offer's price to the
-- single PayPal order.
--
-- Both ends are `payment_forms` rows (an "offer"/price — see
-- migration 054): `form_id` is the main offer whose checkout shows
-- the bump, `bump_form_id` is the offer being bumped. Reusing an
-- existing offer — rather than a free-form name/price here — means the
-- bump's price, currency, product name/cover image, and its own
-- delivery automation all come from the place the merchant already
-- manages them. The bump offer does NOT need to be published: a
-- merchant can keep a bump-only offer as a draft so it's never sold
-- standalone.
--
-- `title`/`description` are the bump box's own sales copy ("¡Sí!
-- Agrega …"); `title` falls back to the bump offer's product/offer
-- name in the app when empty.
--
-- `payment_transactions.line_items` records what was actually bought:
-- `[{ kind: 'main' | 'bump', form_id, name, amount }]`, written by
-- `POST /api/public/payments/orders` — the amount column alone can't
-- tell "main offer only" apart from "main + bump".
--
-- RLS mirrors `payment_forms` (050): any member reads, agent+ writes.
-- The public checkout reads through the service-role client.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_order_bumps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  form_id       UUID NOT NULL REFERENCES payment_forms(id) ON DELETE CASCADE,
  bump_form_id  UUID NOT NULL REFERENCES payment_forms(id) ON DELETE CASCADE,
  title         TEXT,
  description   TEXT,
  position      INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_order_bumps_not_self CHECK (form_id <> bump_form_id),
  CONSTRAINT payment_order_bumps_unique UNIQUE (form_id, bump_form_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_order_bumps_form ON payment_order_bumps(form_id);
CREATE INDEX IF NOT EXISTS idx_payment_order_bumps_account ON payment_order_bumps(account_id);

ALTER TABLE payment_order_bumps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_order_bumps_select ON payment_order_bumps;
CREATE POLICY payment_order_bumps_select ON payment_order_bumps
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS payment_order_bumps_insert ON payment_order_bumps;
CREATE POLICY payment_order_bumps_insert ON payment_order_bumps
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_order_bumps_update ON payment_order_bumps;
CREATE POLICY payment_order_bumps_update ON payment_order_bumps
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_order_bumps_delete ON payment_order_bumps;
CREATE POLICY payment_order_bumps_delete ON payment_order_bumps
  FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON payment_order_bumps;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_order_bumps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb;
