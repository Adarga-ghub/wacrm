-- ============================================================
-- 060_checkout_sessions.sql
--
-- checkout_sessions
--   Funnel tracking for the public checkout page (`/pay/[slug]`),
--   backing the "Analíticas de Checkout" tab under Billing &
--   Payments. One row per checkout visit:
--     - created on page load        → status 'viewed',    page_view_at
--     - first focus/input in a field → status 'initiated', initiate_checkout_at
--     - payment finalized            → status 'completed', completed_at
--     - 'initiated' and idle for 30+ minutes → 'abandoned' (marked
--       lazily by `GET /api/payments/checkout-sessions`, no cron).
--   The visitor is identified by the `telefono` / `contact_id` query
--   params that automation CTA buttons append to checkout links (see
--   `withCheckoutContactParams` in src/lib/payments/checkout-tracking.ts),
--   or by the contact pinned on a `payment_links` code.
--
-- SELECT/DELETE for account members; NO insert/update policy for
-- authenticated users — every write goes through the service-role
-- client from the public tracking route and payment finalization,
-- same as `payment_transactions` (051).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  form_id               UUID REFERENCES payment_forms(id) ON DELETE SET NULL,
  link_id               UUID REFERENCES payment_links(id) ON DELETE SET NULL,
  contact_id            UUID REFERENCES contacts(id) ON DELETE SET NULL,
  transaction_id        UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  telefono              TEXT,
  slug_producto         TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'viewed'
                          CHECK (status IN ('viewed', 'initiated', 'abandoned', 'completed')),
  page_view_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  initiate_checkout_at  TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_account
  ON checkout_sessions(account_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_transaction
  ON checkout_sessions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_open
  ON checkout_sessions(account_id, status) WHERE status = 'initiated';

ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_sessions_select ON checkout_sessions;
CREATE POLICY checkout_sessions_select ON checkout_sessions
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS checkout_sessions_delete ON checkout_sessions;
CREATE POLICY checkout_sessions_delete ON checkout_sessions
  FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON checkout_sessions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
