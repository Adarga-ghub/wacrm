-- ============================================================
-- 041_message_error_detail
--
-- A template send can be ACCEPTED by Meta synchronously (the send API
-- call returns 200 with a wamid, the message is persisted as 'sent')
-- and still fail moments later — Meta reports the real reason on the
-- async status webhook as a `statuses[].errors[]` array. The webhook
-- handler has only ever read `status.status` off that payload
-- (`handleStatusUpdate` in `src/app/api/whatsapp/webhook/route.ts`),
-- so the `errors` array — the ONLY place the actual failure reason
-- (invalid template params, payment/billing hold on the WABA, quality
-- restriction, etc.) exists — was silently discarded. The message row
-- just flips to `status = 'failed'` with no way to ever recover why,
-- and the UI can only render a bare red X.
--
-- `messages.error_message` gives the webhook somewhere to put it.
-- Nullable and additive — existing rows are unaffected, and non-failed
-- statuses never populate it.
-- ============================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN messages.error_message IS
  'Meta''s reported reason a message failed (from the status webhook''s '
  '`errors[]`), e.g. "Payment method error" or a template-mismatch '
  'detail. Only set when status = ''failed''; NULL otherwise, including '
  'for every row written before migration 041.';
