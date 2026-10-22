-- ============================================================
-- 068_payment_form_slug_history.sql — old checkout links keep working
-- after an offer's link is edited.
--
-- An offer's public URL is `/pay/[slug]` (`payment_forms.slug`). The
-- admin can now edit that slug from the product page; every slug the
-- offer leaves behind is recorded here, and `/pay/[old-slug]`
-- redirects to the offer's current slug (query string kept, so
-- `?l=<code>` tracking links still attribute the sale).
--
-- `old_slug` is the primary key: like `payment_forms.slug` it's
-- globally unique, and the API never lets a new slug take one that
-- still redirects to ANOTHER offer. An offer taking back one of its
-- own old slugs deletes that row.
--
-- RLS: members can read their account's rows; writes go through the
-- API's service-role client only. The public redirect reads with the
-- service role too.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_form_slug_history (
  old_slug    TEXT PRIMARY KEY,
  form_id     UUID NOT NULL REFERENCES payment_forms(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_form_slug_history_form ON payment_form_slug_history(form_id);

ALTER TABLE payment_form_slug_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_form_slug_history_select ON payment_form_slug_history;
CREATE POLICY payment_form_slug_history_select ON payment_form_slug_history
  FOR SELECT USING (is_account_member(account_id));
