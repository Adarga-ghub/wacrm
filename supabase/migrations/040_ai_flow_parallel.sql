-- ============================================================
-- 040_ai_flow_parallel.sql — decouple AI Agent from Flows/Automations
--
-- Historically the inbound webhook treated Flows and message-triggered
-- Automations as mutually exclusive with the AI auto-reply bot: if a
-- Flow consumed the inbound (bot menu) or an active
-- new_message_received/keyword_match automation existed, the AI stood
-- down entirely for that account/thread (see src/lib/ai/auto-reply.ts
-- and the webhook route). Flows/Automations never had a symmetric
-- check — only the AI side was ever gated.
--
-- Automations/Flows should own the pipeline (stage, tags, timers, list
-- membership) while the AI Agent owns the conversation, independently.
-- `run_parallel_with_flows` is the per-account switch surfaced in
-- Settings → AI Agents, next to "Hand off to":
--   - true  (default) — the AI keeps answering inbound messages even
--     while a Flow or Automation is also acting on the same lead. This
--     is now the default for every account, existing and new.
--   - false — restores the previous exclusive behavior (Flows win;
--     message-triggered Automations suppress the bot) for accounts
--     that want the old single-responder behavior back.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS run_parallel_with_flows boolean NOT NULL DEFAULT true;
