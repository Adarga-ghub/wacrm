-- ============================================================
-- 070_ai_autoreply_debounce.sql — group quick customer messages
--
-- The AI auto-reply bot answers every inbound message on its own. When a
-- customer sends two or three messages in a row ("Hola, soy Lea…" then
-- "Gracias"), each one triggered its own reply, so the customer got the
-- same answer twice — and any outbound keyword_match automation watching
-- that reply (e.g. the "send the book videos" automation) ran twice too.
--
-- New per-account settings, surfaced in Settings → AI Agents:
--   - auto_reply_debounce_enabled (default false = previous behavior):
--     when on, the bot waits `auto_reply_debounce_seconds` after an
--     inbound and only the LAST message of the burst gets a reply (the
--     reply sees every message of the burst in its context).
--   - auto_reply_debounce_seconds (default 5, 1–30): how long to wait.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS auto_reply_debounce_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS auto_reply_debounce_seconds integer NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_configs_auto_reply_debounce_seconds_range'
  ) THEN
    ALTER TABLE ai_configs
      ADD CONSTRAINT ai_configs_auto_reply_debounce_seconds_range
      CHECK (auto_reply_debounce_seconds BETWEEN 1 AND 30);
  END IF;
END $$;
