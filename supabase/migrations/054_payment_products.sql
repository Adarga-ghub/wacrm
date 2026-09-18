-- ============================================================
-- 054_payment_products.sql — "Productos" (Hotmart-style product
-- wrapper) for the "Facturación y Pagos" module.
--
-- Hotmart's own product-creation flow bundles a lot that doesn't
-- apply here (Club/membership hosting, an affiliate marketplace,
-- email marketing, an external review/approval queue) — this table
-- deliberately only carries what maps onto this CRM: a name,
-- description and image for the product itself, plus an optional
-- default checkout appearance. Everything else it needs already
-- exists: a "price" is just a `payment_form` (migration 050) pointed
-- at the product via the new `product_id` column below, so pricing,
-- checkout fields, PayPal processing, and the public `/pay/[slug]`
-- URL are all the exact same code path a standalone form already
-- uses — a product just groups one or more of them under one name.
--
-- NOT a `PaymentFormProduct` (the `payment_forms.products` jsonb
-- line-items used by a single form's `amount_type = 'product_list'`
-- catalog picker, migration 050) — that's an unrelated, older concept
-- naming coincidence. This is the new top-level "Producto" a
-- merchant creates first, before any price/checkout exists for it.
--
-- `default_skin_id` is only a CONVENIENCE default applied to a price
-- at the moment it's created (`POST /api/payments/products/[id]/prices`
-- copies it onto the new form's own `skin_id`) — it's not enforced
-- afterwards, so a merchant can still give one price a different
-- appearance later without touching the product.
--
-- `payment_forms.product_id` is nullable and ON DELETE SET NULL: a
-- form created directly (not through a product) keeps working
-- exactly as it does today, and archiving/deleting a product must
-- never break the forms (and their transaction history) it grouped —
-- just detach them back to standalone forms.
--
-- RLS mirrors `payment_forms` (050) and `payment_skins` (053)
-- exactly: any member reads, agent+ writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  image_url        TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'archived')),
  default_skin_id  UUID REFERENCES payment_skins(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_products_account ON payment_products(account_id);

ALTER TABLE payment_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_products_select ON payment_products;
CREATE POLICY payment_products_select ON payment_products
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS payment_products_insert ON payment_products;
CREATE POLICY payment_products_insert ON payment_products
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_products_update ON payment_products;
CREATE POLICY payment_products_update ON payment_products
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS payment_products_delete ON payment_products;
CREATE POLICY payment_products_delete ON payment_products
  FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON payment_products;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payment_forms
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES payment_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_forms_product ON payment_forms(product_id);
