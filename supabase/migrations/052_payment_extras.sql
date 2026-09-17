-- ============================================================
-- 052_payment_extras.sql — Fase 5 additions to the payments module:
-- product-list pricing display, checkout theming, merchant email
-- routing, and receipt-email idempotency.
--
-- `payment_forms.design` — free-form jsonb rather than separate
-- columns (`{ "accent_color": "#16a34a", "logo_url": "https://..." }`)
-- since it's purely cosmetic, read by the public checkout page only,
-- and never queried/filtered on — a jsonb blob avoids a migration
-- for every future cosmetic knob.
--
-- `payment_gateway_credentials.notification_email` — where the
-- "payment received" merchant alert goes. Separate from any
-- account-member's login email: the merchant may want alerts routed
-- to a shared inbox (billing@, ventas@) instead of whoever's account
-- happens to own the PayPal connection.
--
-- `payment_transactions.receipt_sent_at` — mirrors
-- `automation_dispatched_at`'s idempotency role: both
-- `POST /api/public/payments/orders/[orderId]/capture` and the
-- webhook can reach a completed transaction, and only one of them
-- should ever send the customer's receipt email.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE payment_forms
  ADD COLUMN IF NOT EXISTS design JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE payment_gateway_credentials
  ADD COLUMN IF NOT EXISTS notification_email TEXT;

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;
