-- ============================================================
-- 045_conversation_typing.sql — live "typing…" status per conversation
--
-- Mirrors 024_member_presence.sql's design almost exactly, scoped to
-- a conversation instead of a whole account: one row per
-- conversation, overwritten on every ping, with "not typing"
-- DERIVED from staleness on the reading side rather than written
-- explicitly — so a closed tab / a finished LLM call doesn't need a
-- reliable "stopped" write, same reasoning as presence's offline
-- derivation.
--
-- Two writers:
--   - A human agent composing a reply: the RLS-safe `touch_conversation_
--     typing` RPC below (mirrors `touch_presence`), called from the
--     composer.
--   - The AI auto-reply pipeline generating a response: written
--     directly by the service-role client (no RPC — that path never
--     has an `auth.uid()`), right alongside the real WhatsApp
--     typing_indicator call added in migration/PR before this one.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- table -------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_typing (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('agent', 'bot')),
  -- The agent's user_id; NULL for the bot.
  actor_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_typing_account_idx
  ON conversation_typing(account_id);

-- ---- RLS ---------------------------------------------------
ALTER TABLE conversation_typing ENABLE ROW LEVEL SECURITY;

-- Account members may read every typing row for their account (the
-- dashboard subscribes filtered to the one open conversation, but the
-- policy itself is account-scoped like every other table here).
DROP POLICY IF EXISTS conversation_typing_select ON conversation_typing;
CREATE POLICY conversation_typing_select ON conversation_typing FOR SELECT
  USING (is_account_member(account_id));

-- No client INSERT/UPDATE/DELETE policy — human-agent writes flow
-- through the SECURITY DEFINER RPC below; bot writes use the
-- service-role client, which bypasses RLS entirely.

-- ---- agent heartbeat RPC ------------------------------------
-- Upserts the CALLER as the current typist on one conversation.
-- SECURITY DEFINER so it can write despite no client write policy;
-- both the account and the conversation's ownership of it are
-- resolved server-side, so a client can never spoof either.
CREATE OR REPLACE FUNCTION public.touch_conversation_typing(
  p_conversation_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id      UUID;
  v_conv_account_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT account_id INTO v_account_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No account for caller' USING ERRCODE = '22023';
  END IF;

  SELECT account_id INTO v_conv_account_id
  FROM conversations
  WHERE id = p_conversation_id;

  IF v_conv_account_id IS NULL OR v_conv_account_id != v_account_id THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO conversation_typing (conversation_id, account_id, actor_type, actor_id, updated_at)
  VALUES (p_conversation_id, v_account_id, 'agent', auth.uid(), now())
  ON CONFLICT (conversation_id) DO UPDATE
    SET actor_type = 'agent',
        actor_id   = auth.uid(),
        account_id = excluded.account_id,
        updated_at = now();
END;
$$;

-- ---- realtime ------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_typing'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_typing;
  END IF;
END $$;
