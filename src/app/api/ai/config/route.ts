import { NextResponse } from 'next/server'
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { validateAiCredentials } from '@/lib/ai/validate'
import { embedTexts } from '@/lib/ai/embeddings'
import { AiError, type AiProvider } from '@/lib/ai/types'
import { clampAutoReplyDebounceSeconds } from '@/lib/ai/defaults'
import { agentIdFromRequest } from '@/lib/ai/agents'

/** Name given to an account's first (default) agent. */
const DEFAULT_AGENT_NAME = 'Agente principal'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * GET /api/ai/config
 *
 * Any member may read the config so the inbox/settings can reflect
 * whether AI is set up. The encrypted key is NEVER returned — only a
 * `has_key` flag; the settings form shows a masked placeholder.
 *
 * `?agentId=` selects one agent; without it the default agent is
 * returned, plus `any_auto_reply_on` (is ANY agent auto-replying — the
 * inbox banner uses it).
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const agentId = agentIdFromRequest(request)

    const base = supabase
      .from('ai_configs')
      // `api_key` is selected only to derive `has_key` — it is stripped
      // out below and never returned to the client.
      .select(
        'id, name, is_default, countries, provider, model, system_prompt, is_active, auto_reply_enabled, auto_reply_max_per_conversation, handoff_agent_id, run_parallel_with_flows, auto_reply_debounce_enabled, auto_reply_debounce_seconds, api_key, embeddings_api_key',
      )
      .eq('account_id', accountId)
    const { data, error } = await (
      agentId ? base.eq('id', agentId) : base.eq('is_default', true)
    ).maybeSingle()

    if (error) {
      console.error('[ai/config GET] fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to load AI configuration' },
        { status: 500 },
      )
    }

    if (!data) return NextResponse.json({ configured: false })
    // The keys are selected only to derive the has_* flags; neither is
    // returned to the client.
    const { api_key, embeddings_api_key, ...safe } = data

    let anyAutoReplyOn = !!(data.is_active && data.auto_reply_enabled)
    if (!agentId && !anyAutoReplyOn) {
      const { data: live } = await supabase
        .from('ai_configs')
        .select('id')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .eq('auto_reply_enabled', true)
        .limit(1)
      anyAutoReplyOn = !!live && live.length > 0
    }

    return NextResponse.json({
      configured: true,
      has_key: !!api_key,
      has_embeddings_key: !!embeddings_api_key,
      any_auto_reply_on: anyAutoReplyOn,
      ...safe,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/config  (admin+)
 *
 * Upsert the account's AI config. Validates the key with the provider
 * before persisting (mirrors the WhatsApp config verifying with Meta
 * first), then stores the key AES-256-GCM-encrypted. When `api_key` is
 * omitted the existing stored key is reused (the form sends it only
 * when the user re-enters it).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const limit = checkRateLimit(`ai-config:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const provider = body.provider as AiProvider
    if (provider !== 'openai' && provider !== 'anthropic') {
      return bad('provider must be "openai" or "anthropic"')
    }
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    if (!model) return bad('model is required')

    const systemPrompt =
      typeof body.system_prompt === 'string' && body.system_prompt.trim()
        ? body.system_prompt.trim()
        : null
    const isActive = body.is_active === true
    const autoReplyEnabled = body.auto_reply_enabled === true
    // Defaults to true (parallel execution with Flows/Automations) when
    // the field is omitted — e.g. an older client that predates this
    // switch — so the decoupled behavior stays the default everywhere.
    const runParallelWithFlows = body.run_parallel_with_flows !== false
    // Burst-grouping wait. Only written when the client sends the field,
    // so an older client that predates the setting can't reset it.
    const debounceEnabledProvided = typeof body.auto_reply_debounce_enabled === 'boolean'
    const debounceSecondsProvided = 'auto_reply_debounce_seconds' in body
    const debounceSeconds = clampAutoReplyDebounceSeconds(
      body.auto_reply_debounce_seconds,
    )

    let maxPer = Number(body.auto_reply_max_per_conversation)
    if (!Number.isFinite(maxPer)) maxPer = 3
    maxPer = Math.min(20, Math.max(1, Math.floor(maxPer)))

    // Handoff routing target for auto-reply. A non-empty string must be a
    // member of this account (else the conversation would be assigned to a
    // stranger); an empty string / null means "leave unassigned" (the
    // shared queue). Absent → left unchanged on update below.
    const rawHandoff =
      typeof body.handoff_agent_id === 'string' ? body.handoff_agent_id.trim() : ''
    const handoffProvided = 'handoff_agent_id' in body
    let handoffAgentId: string | null = null
    if (rawHandoff) {
      const { data: member } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('account_id', accountId)
        .eq('user_id', rawHandoff)
        .maybeSingle()
      if (!member) return bad('handoff_agent_id must be a member of this account')
      handoffAgentId = rawHandoff
    }

    const rawKey = typeof body.api_key === 'string' ? body.api_key.trim() : ''

    // Embeddings key (optional, for semantic KB search): a non-empty
    // string sets/replaces it; an explicit null clears it; absent leaves
    // it unchanged. The form only sends it when the admin edits it.
    const rawEmbeddingsKey =
      typeof body.embeddings_api_key === 'string'
        ? body.embeddings_api_key.trim()
        : ''
    const clearEmbeddingsKey = body.embeddings_api_key === null

    // Which agent: `?agentId=` or the default one. Reuse the stored key
    // when the form didn't send a fresh one.
    const agentId = agentIdFromRequest(request)
    const existingBase = supabase
      .from('ai_configs')
      .select('id, provider, model, api_key')
      .eq('account_id', accountId)
    const { data: existing } = await (
      agentId ? existingBase.eq('id', agentId) : existingBase.eq('is_default', true)
    ).maybeSingle()
    if (agentId && !existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    let apiKeyPlain: string
    if (rawKey) {
      apiKeyPlain = rawKey
    } else if (existing?.api_key) {
      try {
        apiKeyPlain = decrypt(existing.api_key)
      } catch {
        return bad('Stored API key could not be decrypted — re-enter your key.')
      }
    } else {
      return bad('api_key is required')
    }

    // Only spend a provider round-trip when the credentials that affect
    // reachability actually changed. A save that just flips a toggle or
    // edits the system prompt on an existing, already-validated config
    // skips the call — no wasted token/latency on the account's key.
    const credentialsChanged =
      !existing ||
      rawKey !== '' ||
      provider !== existing.provider ||
      model !== existing.model

    if (credentialsChanged) {
      try {
        await validateAiCredentials({
          provider,
          model,
          apiKey: apiKeyPlain,
          systemPrompt,
          isActive,
          autoReplyEnabled,
          autoReplyMaxPerConversation: maxPer,
          handoffAgentId: null,
          embeddingsApiKey: null,
          runParallelWithFlows,
          autoReplyDebounceEnabled: false,
          autoReplyDebounceSeconds: debounceSeconds,
        })
      } catch (err) {
        if (err instanceof AiError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: 400 },
          )
        }
        console.error('[ai/config POST] validation error:', err)
        return bad('Could not validate the API key with the provider.')
      }
    }

    // Validate a new embeddings key before storing (a cheap 1-input
    // embed), same "verify before save" discipline as the chat key.
    if (rawEmbeddingsKey) {
      try {
        await embedTexts(rawEmbeddingsKey, ['ping'])
      } catch (err) {
        if (err instanceof AiError) {
          return NextResponse.json(
            { error: `Embeddings key: ${err.message}`, code: err.code },
            { status: 400 },
          )
        }
        console.error('[ai/config POST] embeddings validation error:', err)
        return bad('Could not validate the embeddings key.')
      }
    }

    const encryptedKey = rawKey ? encrypt(rawKey) : null
    const shared: Record<string, unknown> = {
      provider,
      model,
      system_prompt: systemPrompt,
      is_active: isActive,
      auto_reply_enabled: autoReplyEnabled,
      auto_reply_max_per_conversation: maxPer,
      run_parallel_with_flows: runParallelWithFlows,
    }
    // Only touch the handoff target when the form actually sent the field,
    // so a partial save (e.g. flipping a toggle) doesn't wipe it.
    if (handoffProvided) shared.handoff_agent_id = handoffAgentId
    if (debounceEnabledProvided) {
      shared.auto_reply_debounce_enabled = body.auto_reply_debounce_enabled
    }
    if (debounceSecondsProvided) shared.auto_reply_debounce_seconds = debounceSeconds
    if (rawEmbeddingsKey) {
      shared.embeddings_api_key = encrypt(rawEmbeddingsKey)
    } else if (clearEmbeddingsKey) {
      shared.embeddings_api_key = null
    }

    if (existing) {
      const { error: upErr } = await supabase
        .from('ai_configs')
        .update(encryptedKey ? { ...shared, api_key: encryptedKey } : shared)
        .eq('account_id', accountId)
        .eq('id', existing.id)
      if (upErr) {
        console.error('[ai/config POST] update error:', upErr)
        return NextResponse.json(
          { error: 'Failed to save AI configuration' },
          { status: 500 },
        )
      }
    } else {
      const { error: insErr } = await supabase.from('ai_configs').insert({
        account_id: accountId,
        created_by: userId,
        name: DEFAULT_AGENT_NAME,
        is_default: true,
        api_key: encryptedKey, // guaranteed non-null: rawKey required when no existing row
        ...shared,
      })
      if (insErr) {
        console.error('[ai/config POST] insert error:', insErr)
        return NextResponse.json(
          { error: 'Failed to save AI configuration' },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/ai/config  (admin+)
 *
 * Removes the account's AI config (turns everything off and forgets the
 * key). Also used to recover from a corrupted encrypted key.
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const agentId = agentIdFromRequest(request)

    // `?agentId=` deletes that agent (its knowledge base cascades; its
    // conversations fall back to routing). Without it, the default agent
    // is removed — only allowed when it is the last agent, since the
    // others rely on it as the fallback.
    const targetBase = supabase
      .from('ai_configs')
      .select('id, is_default')
      .eq('account_id', accountId)
    const { data: target } = await (
      agentId ? targetBase.eq('id', agentId) : targetBase.eq('is_default', true)
    ).maybeSingle()
    if (!target) return NextResponse.json({ success: true })

    if (target.is_default) {
      const { count } = await supabase
        .from('ai_configs')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
      if ((count ?? 0) > 1) {
        return NextResponse.json(
          {
            error:
              'El agente principal no se puede eliminar mientras existan otros agentes. Elimina primero los demás.',
          },
          { status: 409 },
        )
      }
    }

    const { error } = await supabase
      .from('ai_configs')
      .delete()
      .eq('account_id', accountId)
      .eq('id', target.id)
    if (error) {
      console.error('[ai/config DELETE] error:', error)
      return NextResponse.json(
        { error: 'Failed to delete AI configuration' },
        { status: 500 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
