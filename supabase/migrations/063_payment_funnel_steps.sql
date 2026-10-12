-- ============================================================
-- 063_payment_funnel_steps.sql — Upsell / Downsell (post-purchase funnel).
--
-- After a buyer pays on a main offer's checkout (`/pay/[slug]`), instead
-- of going straight to the thank-you page they can be shown ONE upsell
-- page; if they decline it, ONE downsell page; then the thank-you page
-- (the main offer's `redirect_url` / inline message, as before).
--
--   checkout ──paid──▶ upsell ──"no"──▶ downsell ──▶ thank-you
--                         └──"yes" + paid──────────▶ thank-you
--
-- `form_id` is the main offer whose checkout starts the funnel; one row
-- per `kind`. Each step sells one OR MORE existing offers
-- (`offer_form_ids`, all `payment_forms` rows of the same account and
-- currency) — e.g. a downsell bundling two books — so price, product
-- name/cover and each item's delivery automation come from the place
-- the merchant already manages them, exactly like order bumps (061).
-- No FK on the array (Postgres can't); the app validates the ids and
-- silently skips ones that were deleted/archived.
--
-- `price`: what the step charges. Null = the sum of the offers' own
-- amounts. `compare_at_price`: struck-through "before" price, display
-- only. `page`: the sales page's copy (headline, bullets, button
-- labels, timer…) — see `FunnelPageContent` in src/types/index.ts.
--
-- Each accepted step is its own PayPal order + `payment_transactions`
-- row, linked to the original purchase via `parent_transaction_id`
-- and tagged with `funnel_step`. The original (parent) row carries the
-- funnel's progress: `funnel_token` is the unguessable id in the
-- upsell/downsell page URL (`/pay/offer/<token>`) — it's only issued
-- once that payment is `completed`, which is what keeps the pages from
-- being reachable without a purchase — and `funnel_stage` is where the
-- buyer currently is ('upsell' | 'downsell' | 'done').
--
-- RLS mirrors `payment_order_bumps` (061). The public pages read
-- through the service-role client.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_funnel_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  form_id           UUID NOT NULL REFERENCES payment_forms(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('upsell', 'downsell')),
  offer_form_ids    UUID[] NOT NULL DEFAULT '{}',
  price             NUMERIC(12, 2) CHECK (price IS NULL OR price > 0),
  compare_at_price  NUMERIC(12, 2) CHECK (compare_at_price IS NULL OR compare_at_price > 0),
  page              JSONB NOT NULL DEFAULT '{}'::jsonb,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_funnel_steps_unique UNIQUE (form_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_payment_funnel_steps_account ON payment_funnel_steps(account_id);

ALTER TABLE payment_funnel_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_funnel_steps_select ON payment_funnel_steps;
CREATE POLICY payment_funnel_steps_select ON payment_funnel_steps
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS payment_funnel_steps_insert ON payment_funnel_steps;
CREATE POLICY payment_funnel_steps_insert ON payment_funnel_steps
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_funnel_steps_update ON payment_funnel_steps;
CREATE POLICY payment_funnel_steps_update ON payment_funnel_steps
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_funnel_steps_delete ON payment_funnel_steps;
CREATE POLICY payment_funnel_steps_delete ON payment_funnel_steps
  FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON payment_funnel_steps;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_funnel_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS parent_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funnel_step TEXT,
  ADD COLUMN IF NOT EXISTS funnel_token TEXT,
  ADD COLUMN IF NOT EXISTS funnel_stage TEXT;

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_funnel_step_check;
ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_funnel_step_check
  CHECK (funnel_step IS NULL OR funnel_step IN ('upsell', 'downsell'));

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_funnel_stage_check;
ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_funnel_stage_check
  CHECK (funnel_stage IS NULL OR funnel_stage IN ('upsell', 'downsell', 'done'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_funnel_token
  ON payment_transactions(funnel_token) WHERE funnel_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_parent
  ON payment_transactions(parent_transaction_id) WHERE parent_transaction_id IS NOT NULL;
