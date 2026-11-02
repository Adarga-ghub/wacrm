import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Read the `agentId` query param of an AI route. Absent/blank → null,
 * meaning "the account's default agent" (pre-multi-agent behavior).
 */
export function agentIdFromRequest(request: Request): string | null {
  try {
    const v = new URL(request.url).searchParams.get('agentId')
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export interface AgentRef {
  id: string
  is_default: boolean
}

/**
 * Resolve an agent of this account: the given id, or the default agent
 * when `agentId` is null. Returns null when it doesn't exist (or belongs
 * to another account).
 */
export async function resolveAgent(
  db: SupabaseClient,
  accountId: string,
  agentId: string | null,
): Promise<AgentRef | null> {
  const base = db
    .from('ai_configs')
    .select('id, is_default')
    .eq('account_id', accountId)
  const { data, error } = await (
    agentId ? base.eq('id', agentId) : base.eq('is_default', true)
  ).maybeSingle()
  if (error || !data) return null
  return data as AgentRef
}
