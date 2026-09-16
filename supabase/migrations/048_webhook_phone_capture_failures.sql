-- ============================================================
-- 048_webhook_phone_capture_failures
--
-- Click-to-WhatsApp ad contacts keep arriving with an empty phone
-- number even after the message.from -> contacts[].wa_id fallback
-- added in the previous fix (see webhook/route.ts). Investigating a
-- real occurrence ("Zenovia", 2026-09-16) confirmed via the stored
-- `messages.referral` payload that this is a genuine Meta-side gap:
-- the delivery carried an ad referral (including the newer
-- `referral.welcome_message` icebreaker field) and real message text,
-- but the webhook body itself never included a usable value in EITHER
-- `messages[].from` OR `contacts[].wa_id` — there is no phone number
-- anywhere in what Meta sent us. No client-side extraction fix can
-- recover a value that was never delivered.
--
-- Since the number cannot be recovered after the fact, the only
-- durable fix is turning the previous console.error (ephemeral,
-- gone once the hosting platform's log retention rolls over) into a
-- permanent, queryable record — so every occurrence leaves real
-- forensic evidence (the exact raw message/contact JSON, which phone
-- number ID and WABA received it) instead of relying on catching it
-- live in hosting logs. Also drives an in-app notification so the
-- account finds out the moment it happens instead of discovering it
-- days later while browsing the inbox.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_phone_capture_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  -- Which WhatsApp Business Account / phone number received this
  -- delivery — needed when filing a Meta support ticket about the
  -- missing field, since Meta support asks for both.
  waba_id TEXT,
  phone_number_id TEXT,
  -- Meta's own message id (wamid...) for cross-referencing against
  -- Meta's own delivery logs / support tickets.
  meta_message_id TEXT,
  -- Verbatim `messages[N]` and `contacts[N]` (or the best-guess
  -- `contacts[0]` fallback) objects exactly as received, before any
  -- normalization — the full forensic record.
  raw_message JSONB NOT NULL,
  raw_contact JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_phone_capture_failures_account_created
  ON webhook_phone_capture_failures(account_id, created_at DESC);

ALTER TABLE webhook_phone_capture_failures ENABLE ROW LEVEL SECURITY;

-- Read-only for account members (same membership helper every other
-- account-scoped table uses). Rows are written exclusively by the
-- webhook route via the service-role client — no client INSERT policy.
DROP POLICY IF EXISTS webhook_phone_capture_failures_select ON webhook_phone_capture_failures;
CREATE POLICY webhook_phone_capture_failures_select ON webhook_phone_capture_failures
  FOR SELECT USING (is_account_member(account_id));

-- ============================================================
-- Widen the notifications type CHECK (added in migration 027) so the
-- webhook can alert the account's config owner in real time via the
-- existing notification bell / realtime channel, instead of this
-- failure mode surfacing only when someone happens to open the chat.
-- ============================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('conversation_assigned', 'contact_phone_missing'));
