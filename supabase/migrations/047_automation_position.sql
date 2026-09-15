-- ============================================================
-- 047_automation_position.sql
--
-- Adds a `position` column to `automations` so the list on
-- /automations can be manually reordered by drag-and-drop instead of
-- always sorting by created_at. Mirrors the existing `position`
-- column convention already used by `automation_steps` (006) and
-- `pipeline_stages` (001) in this codebase.
--
-- Backfill assigns positions PER ACCOUNT (account-scoped, matching
-- the automations_select/update RLS policies from 017, which are
-- account-wide — any agent+ member can reorder the shared list) in
-- the same newest-first order the list page's pre-migration
-- `.order('created_at', { ascending: false })` produced, so this
-- migration is a visual no-op for every account until someone drags
-- a card for the first time.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE automations ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY account_id ORDER BY created_at DESC
  ) - 1 AS rn
  FROM automations
)
UPDATE automations a
SET position = ranked.rn
FROM ranked
WHERE a.id = ranked.id;

-- Composite index tuned for the list page's read pattern
-- (WHERE account_id = ... ORDER BY position).
CREATE INDEX IF NOT EXISTS idx_automations_account_position
  ON automations(account_id, position);
