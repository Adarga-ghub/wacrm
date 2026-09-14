-- ============================================================
-- 044_message_edits
--
-- WhatsApp's Cloud API (unlike the consumer app) has no endpoint to
-- edit or recall a message a business already sent — Meta confirmed
-- this is a consumer-app-only feature, never exposed on the Business
-- Platform. A customer's phone will always keep showing the original
-- text.
--
-- So "editing" a sent message here means: send a NEW message that
-- corrects the old one, and link the two so the inbox can show both
-- ends of that relationship — the original gets an "edited → view
-- correction" badge, the correction renders as a swipe-reply quoting
-- the original (reusing `reply_to_message_id`, unchanged by this
-- migration).
--
-- `edits_message_id` lives on the CORRECTION row and points at the
-- ORIGINAL — the same direction as `reply_to_message_id`, so the two
-- columns compose without special-casing.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edits_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

COMMENT ON COLUMN messages.edits_message_id IS
  'Set on a correction message to the internal id of the earlier message '
  'it corrects. NULL for every message that is not a correction. The '
  'original is never modified — WhatsApp''s Cloud API has no edit/recall '
  'endpoint, so this is purely a CRM-side link between two real, '
  'separately-sent messages.';

-- Reverse lookup: "does this message have a correction?" — one query
-- per thread load rather than N. Partial since edits_message_id is
-- NULL on the overwhelming majority of rows.
CREATE INDEX IF NOT EXISTS idx_messages_edits_message_id
  ON messages(edits_message_id)
  WHERE edits_message_id IS NOT NULL;
