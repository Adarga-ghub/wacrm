-- ============================================================
-- 046_drop_conversation_typing.sql
--
-- Reverts 045_conversation_typing.sql. The CRM-side "En línea" →
-- "Escribiendo…" header label this table backed was removed per
-- feedback — the team doesn't need it, and the customer-facing
-- signal that matters (WhatsApp's real typing_indicator, sent
-- straight to Meta) never depended on this table at all. Left in
-- place, it would just be a dead table + RPC with zero readers and
-- zero writers, so it's dropped rather than orphaned.
--
-- Idempotent — safe to re-run.
-- ============================================================

DROP FUNCTION IF EXISTS public.touch_conversation_typing(UUID);
DROP TABLE IF EXISTS conversation_typing;
