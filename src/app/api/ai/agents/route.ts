import { NextResponse } from 'next/server'
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * GET /api/ai/agents
 *
 * List the account's AI agents (any member) — default agent first, then
 * by creation. Keys are never returned.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { data, error } = await supabase
      .from('ai_configs')
      .select(
        'id, name, is_default, countries, provider, model, is_active, auto_reply_enabled, created_at',
      )
      .eq('account_id', accountId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[ai/agents GET] error:', error)
      return NextResponse.json({ error: 'Failed to load agents' }, { status: 500 })
    }
    return NextResponse.json({ agents: data ?? [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/agents  (admin+)
 *
 * Duplicate an agent. Body: { source_id, name }.
 *
 * The copy keeps the source's connection (provider, model, API key,
 * embeddings key) and settings (switches, reply cap, burst grouping,
 * handoff target, parallel-with-flows) but starts with NO texts: an
 * empty prompt, an empty knowledge base and no countries. The source
 * agent is only read, never modified.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`ai-agents:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    const sourceId = typeof body?.source_id === 'string' ? body.source_id.trim() : ''
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
    if (!sourceId) {
      return NextResponse.json({ error: 'source_id is required' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'Ponle un nombre al agente.' }, { status: 400 })
    }

    const { data: src, error: srcErr } = await supabase
      .from('ai_configs')
      .select(
        'provider, model, api_key, embeddings_api_key, is_active, auto_reply_enabled, auto_reply_max_per_conversation, handoff_agent_id, run_parallel_with_flows, auto_reply_debounce_enabled, auto_reply_debounce_seconds',
      )
      .eq('account_id', accountId)
      .eq('id', sourceId)
      .maybeSingle()
    if (srcErr) {
      console.error('[ai/agents POST] source lookup error:', srcErr)
      return NextResponse.json({ error: 'Failed to load agent' }, { status: 500 })
    }
    if (!src) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const { data: created, error: insErr } = await supabase
      .from('ai_configs')
      .insert({
        ...src,
        account_id: accountId,
        created_by: userId,
        name,
        is_default: false,
        countries: [],
        system_prompt: null,
      })
      .select('id')
      .single()
    if (insErr || !created) {
      console.error('[ai/agents POST] insert error:', insErr)
      return NextResponse.json({ error: 'Failed to duplicate agent' }, { status: 500 })
    }
    return NextResponse.json({ success: true, id: created.id })
  } catch (err) {
    return toErrorResponse(err)
  }
}
