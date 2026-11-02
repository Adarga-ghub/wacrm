-- ============================================================
-- 072_ai_multi_agents.sql — several named AI agents per account,
-- routed by the customer's country.
--
--   1. ai_configs: drop UNIQUE(account_id) and add
--        name        — label shown in AI Agents ("Agente Dominicano")
--        is_default  — the fallback agent (exactly one per account).
--                      The pre-existing row becomes the default; its
--                      prompt / key / settings are NOT touched.
--        countries   — ISO 3166-1 alpha-2 codes this agent answers.
--   2. Knowledge base is per agent: ai_knowledge_documents/chunks get
--      ai_config_id (backfilled to the default agent), and the two
--      retrieval RPCs take an optional p_ai_config_id filter.
--   3. conversations.ai_agent_id — the agent that owns the thread.
--      Set on the first AI reply; afterwards no other agent answers it.
--      Threads the bot already answered are pinned to the default agent
--      so ongoing conversations keep their current agent.
--   4. ai_test_phones — test numbers with a simulated country, so the
--      owner can exercise each country agent from their own phone.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ai_configs → many agents per account
-- ------------------------------------------------------------
ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_account_id_key;

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Agente principal';
ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS countries text[] NOT NULL DEFAULT '{}';

-- The existing (single) agent of every account becomes its default.
UPDATE ai_configs c
SET is_default = true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_configs d
  WHERE d.account_id = c.account_id AND d.is_default
)
AND c.id = (
  SELECT e.id FROM ai_configs e
  WHERE e.account_id = c.account_id
  ORDER BY e.created_at ASC
  LIMIT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_configs_one_default_per_account
  ON ai_configs (account_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS ai_configs_account_id_idx
  ON ai_configs (account_id);

-- ------------------------------------------------------------
-- 2. Per-agent knowledge base
-- ------------------------------------------------------------
ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS ai_config_id uuid REFERENCES ai_configs(id) ON DELETE CASCADE;
ALTER TABLE ai_knowledge_chunks
  ADD COLUMN IF NOT EXISTS ai_config_id uuid REFERENCES ai_configs(id) ON DELETE CASCADE;

UPDATE ai_knowledge_documents d
SET ai_config_id = c.id
FROM ai_configs c
WHERE d.ai_config_id IS NULL
  AND c.account_id = d.account_id
  AND c.is_default;

UPDATE ai_knowledge_chunks k
SET ai_config_id = d.ai_config_id
FROM ai_knowledge_documents d
WHERE k.ai_config_id IS NULL
  AND k.document_id = d.id
  AND d.ai_config_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_knowledge_documents_ai_config_id_idx
  ON ai_knowledge_documents (ai_config_id);
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_ai_config_id_idx
  ON ai_knowledge_chunks (ai_config_id);

-- Replace the 3-arg RPCs with 4-arg versions (optional agent filter).
-- A NULL p_ai_config_id keeps the old account-wide behavior, so code
-- deployed before this migration keeps working.
DROP FUNCTION IF EXISTS public.match_ai_knowledge_fts(uuid, text, integer);
DROP FUNCTION IF EXISTS public.match_ai_knowledge_semantic(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.match_ai_knowledge_fts(
  p_account_id   uuid,
  p_query        text,
  p_match_count  integer,
  p_ai_config_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
  SELECT c.id,
         c.content,
         ts_rank(c.fts, plainto_tsquery('simple', p_query)) AS rank
  FROM ai_knowledge_chunks c
  WHERE c.account_id = p_account_id
    AND (p_ai_config_id IS NULL OR c.ai_config_id = p_ai_config_id)
    AND c.fts @@ plainto_tsquery('simple', p_query)
  ORDER BY rank DESC
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

CREATE OR REPLACE FUNCTION public.match_ai_knowledge_semantic(
  p_account_id      uuid,
  p_query_embedding text,
  p_match_count     integer,
  p_ai_config_id    uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, content text, distance real) AS $$
  SELECT c.id,
         c.content,
         (c.embedding <=> p_query_embedding::vector(1536)) AS distance
  FROM ai_knowledge_chunks c
  WHERE c.account_id = p_account_id
    AND (p_ai_config_id IS NULL OR c.ai_config_id = p_ai_config_id)
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query_embedding::vector(1536)
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Conversation → owning agent
-- ------------------------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_agent_id uuid REFERENCES ai_configs(id) ON DELETE SET NULL;

-- Threads the bot has already answered stay with the current agent.
UPDATE conversations v
SET ai_agent_id = c.id
FROM ai_configs c
WHERE v.ai_agent_id IS NULL
  AND v.ai_reply_count > 0
  AND c.account_id = v.account_id
  AND c.is_default;

-- ------------------------------------------------------------
-- 4. Test numbers with a simulated country
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_test_phones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  phone       text NOT NULL,          -- digits only
  country_iso text NOT NULL,          -- ISO 3166-1 alpha-2, uppercase
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, phone)
);

ALTER TABLE ai_test_phones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_test_phones_select ON ai_test_phones;
CREATE POLICY ai_test_phones_select ON ai_test_phones FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS ai_test_phones_insert ON ai_test_phones;
CREATE POLICY ai_test_phones_insert ON ai_test_phones FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS ai_test_phones_update ON ai_test_phones;
CREATE POLICY ai_test_phones_update ON ai_test_phones FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS ai_test_phones_delete ON ai_test_phones;
CREATE POLICY ai_test_phones_delete ON ai_test_phones FOR DELETE
  USING (is_account_member(account_id, 'admin'));
