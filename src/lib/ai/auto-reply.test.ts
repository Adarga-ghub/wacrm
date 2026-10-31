import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiConfig } from './types'

// Shared, hoisted mock state so the module mocks can close over it.
const h = vi.hoisted(() => ({
  loadAiConfig: vi.fn(),
  buildConversationContext: vi.fn(),
  retrieveKnowledge: vi.fn(),
  generateReply: vi.fn(),
  engineSendText: vi.fn(),
  dispatchOutboundMessage: vi.fn(),
  state: {
    conv: null as Record<string, unknown> | null,
    autoResponders: [] as { id: string }[],
    claim: true as boolean,
    updatePayload: null as Record<string, unknown> | null,
    rpcCalls: [] as { name: string; args: unknown }[],
    inbounds: [] as { id: string; created_at: string }[],
  },
}))

vi.mock('./config', () => ({ loadAiConfig: h.loadAiConfig }))
vi.mock('./context', () => ({
  buildConversationContext: h.buildConversationContext,
  AI_CONTEXT_CONTENT_TYPES: ['text', 'audio', 'image'],
}))
vi.mock('./knowledge', () => ({ retrieveKnowledge: h.retrieveKnowledge }))
vi.mock('./generate', () => ({ generateReply: h.generateReply }))
vi.mock('@/lib/flows/meta-send', () => ({ engineSendText: h.engineSendText }))
vi.mock('@/lib/automations/engine', () => ({
  dispatchOutboundMessage: h.dispatchOutboundMessage,
}))
vi.mock('./admin-client', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'automations') {
        // .select().eq().eq().in().limit() → active auto-responders
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          limit: () =>
            Promise.resolve({ data: h.state.autoResponders, error: null }),
        }
        return chain
      }
      if (table === 'whatsapp_config' || table === 'messages') {
        // Backs sendTypingIndicatorForConversation's own lookups — no
        // config/inbound row in this suite, so it no-ops (its own
        // try/catch swallows the rest); covered directly in
        // typing-indicator.test.ts.
        // Awaiting the chain itself (no maybeSingle) is the burst-grouping
        // "newest customer inbound" read → `state.inbounds`.
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          then: (resolve: (v: unknown) => unknown) =>
            resolve({ data: h.state.inbounds, error: null }),
        }
        return chain
      }
      // conversations
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: h.state.conv, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          h.state.updatePayload = payload
          return { eq: () => Promise.resolve({ error: null }) }
        },
      }
    },
    rpc: (name: string, args: unknown) => {
      h.state.rpcCalls.push({ name, args })
      return Promise.resolve({ data: h.state.claim, error: null })
    },
  }),
}))

import { dispatchInboundToAiReply } from './auto-reply'

const ARGS = {
  accountId: 'acct-1',
  conversationId: 'conv-1',
  contactId: 'contact-1',
  configOwnerUserId: 'user-1',
}

function aiConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    provider: 'openai',
    model: 'gpt-test',
    apiKey: 'sk-test',
    systemPrompt: null,
    isActive: true,
    autoReplyEnabled: true,
    autoReplyMaxPerConversation: 3,
    handoffAgentId: null,
    embeddingsApiKey: null,
    runParallelWithFlows: true,
    autoReplyDebounceEnabled: false,
    autoReplyDebounceSeconds: 5,
    ...overrides,
  }
}

beforeEach(() => {
  h.state.conv = {
    assigned_agent_id: null,
    ai_autoreply_disabled: false,
    ai_reply_count: 0,
  }
  h.state.autoResponders = []
  h.state.claim = true
  h.state.updatePayload = null
  h.state.rpcCalls = []
  h.state.inbounds = []
  h.loadAiConfig.mockResolvedValue(aiConfig())
  h.buildConversationContext.mockResolvedValue([{ role: 'user', content: 'hi' }])
  h.retrieveKnowledge.mockResolvedValue([])
  h.generateReply.mockResolvedValue({ text: 'Hello!', handoff: false })
  h.engineSendText.mockResolvedValue({ whatsapp_message_id: 'm1' })
  h.dispatchOutboundMessage.mockReset().mockResolvedValue(undefined)
})

describe('dispatchInboundToAiReply — eligibility gates', () => {
  it('claims a slot and sends on the happy path', async () => {
    await dispatchInboundToAiReply(ARGS)
    expect(h.state.rpcCalls).toEqual([
      {
        name: 'claim_ai_reply_slot',
        args: { conversation_id: 'conv-1', max_replies: 3 },
      },
    ])
    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', text: 'Hello!' }),
    )
    // A fresh, depth-0 outbound dispatch so `keyword_match` (outbound)
    // automations can react to what the bot just told the customer.
    expect(h.dispatchOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-1',
        contactId: 'contact-1',
        conversationId: 'conv-1',
        text: 'Hello!',
      }),
    )
  })

  it('does not fire the outbound dispatch on handoff (nothing was sent)', async () => {
    h.generateReply.mockResolvedValue({ text: '', handoff: true })
    await dispatchInboundToAiReply(ARGS)
    expect(h.dispatchOutboundMessage).not.toHaveBeenCalled()
  })

  it('grounds the reply in retrieved knowledge', async () => {
    h.retrieveKnowledge.mockResolvedValue(['Returns accepted within 30 days.'])
    await dispatchInboundToAiReply(ARGS)
    expect(h.retrieveKnowledge).toHaveBeenCalled()
    const systemPrompt = h.generateReply.mock.calls[0][0].systemPrompt as string
    expect(systemPrompt).toContain('Returns accepted within 30 days.')
  })

  it('still replies alongside an active message-level automation by default (parallel mode)', async () => {
    h.state.autoResponders = [{ id: 'auto-1' }]
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).toHaveBeenCalled()
    expect(h.engineSendText).toHaveBeenCalled()
  })

  it('still replies when a Flow consumed the inbound by default (parallel mode)', async () => {
    await dispatchInboundToAiReply({ ...ARGS, flowConsumed: true })
    expect(h.generateReply).toHaveBeenCalled()
    expect(h.engineSendText).toHaveBeenCalled()
  })

  it('legacy mode: stands down when an active message-level automation exists', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ runParallelWithFlows: false }))
    h.state.autoResponders = [{ id: 'auto-1' }]
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('legacy mode: stands down when a Flow consumed the inbound', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ runParallelWithFlows: false }))
    await dispatchInboundToAiReply({ ...ARGS, flowConsumed: true })
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('does not send when the atomic slot claim loses the race', async () => {
    h.state.claim = false
    await dispatchInboundToAiReply(ARGS)
    // It still attempts the claim, but the send is skipped.
    expect(h.state.rpcCalls).toHaveLength(1)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when AI is off / not configured', async () => {
    h.loadAiConfig.mockResolvedValue(null)
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when auto-reply is disabled for the account', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ autoReplyEnabled: false }))
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when a human agent is assigned', async () => {
    h.state.conv = {
      assigned_agent_id: 'agent-9',
      ai_autoreply_disabled: false,
      ai_reply_count: 0,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when auto-reply was disabled on this conversation', async () => {
    h.state.conv = {
      assigned_agent_id: null,
      ai_autoreply_disabled: true,
      ai_reply_count: 0,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when the per-conversation cap is reached', async () => {
    h.state.conv = {
      assigned_agent_id: null,
      ai_autoreply_disabled: false,
      ai_reply_count: 3,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when there is nothing to reply to', async () => {
    h.buildConversationContext.mockResolvedValue([])
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })
})

describe('dispatchInboundToAiReply — handoff', () => {
  it('disables auto-reply, writes a summary, and does not send on handoff', async () => {
    h.generateReply.mockResolvedValue({ text: '', handoff: true })
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.state.rpcCalls).toHaveLength(0)
    expect(h.state.updatePayload).toMatchObject({ ai_autoreply_disabled: true })
    expect(h.state.updatePayload?.ai_handoff_summary).toContain(
      'AI agent handed off',
    )
    // No handoff target configured → conversation left unassigned.
    expect(h.state.updatePayload).not.toHaveProperty('assigned_agent_id')
  })

  it('routes to the configured handoff agent on handoff', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ handoffAgentId: 'agent-7' }))
    h.generateReply.mockResolvedValue({ text: '', handoff: true })
    await dispatchInboundToAiReply(ARGS)
    expect(h.state.updatePayload).toMatchObject({
      ai_autoreply_disabled: true,
      assigned_agent_id: 'agent-7',
    })
  })
})

describe('dispatchInboundToAiReply — burst grouping', () => {
  const T = '2026-10-31T12:03:00.000Z'

  async function runWithTimers(args: Parameters<typeof dispatchInboundToAiReply>[0]) {
    vi.useFakeTimers()
    try {
      const p = dispatchInboundToAiReply(args)
      await vi.advanceTimersByTimeAsync(30_000)
      await p
    } finally {
      vi.useRealTimers()
    }
  }

  it('replies to the newest message of the burst after waiting', async () => {
    h.loadAiConfig.mockResolvedValue(
      aiConfig({ autoReplyDebounceEnabled: true, autoReplyDebounceSeconds: 5 }),
    )
    h.state.inbounds = [{ id: 'msg-2', created_at: T }]
    await runWithTimers({ ...ARGS, inboundMessageId: 'msg-2' })
    expect(h.engineSendText).toHaveBeenCalledTimes(1)
  })

  it('stands down when a newer customer message arrived during the wait', async () => {
    h.loadAiConfig.mockResolvedValue(
      aiConfig({ autoReplyDebounceEnabled: true, autoReplyDebounceSeconds: 5 }),
    )
    h.state.inbounds = [
      { id: 'msg-2', created_at: '2026-10-31T12:03:02.000Z' },
      { id: 'msg-1', created_at: T },
    ]
    await runWithTimers({ ...ARGS, inboundMessageId: 'msg-1' })
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.dispatchOutboundMessage).not.toHaveBeenCalled()
  })

  it('picks exactly one winner when two messages share the same second', async () => {
    h.loadAiConfig.mockResolvedValue(
      aiConfig({ autoReplyDebounceEnabled: true, autoReplyDebounceSeconds: 5 }),
    )
    h.state.inbounds = [
      { id: 'aaa', created_at: T },
      { id: 'bbb', created_at: T },
    ]
    await runWithTimers({ ...ARGS, inboundMessageId: 'aaa' })
    expect(h.engineSendText).not.toHaveBeenCalled()
    await runWithTimers({ ...ARGS, inboundMessageId: 'bbb' })
    expect(h.engineSendText).toHaveBeenCalledTimes(1)
  })

  it('answers immediately (no wait, no newest check) when the setting is off', async () => {
    h.state.inbounds = [
      { id: 'msg-2', created_at: '2026-10-31T12:03:02.000Z' },
      { id: 'msg-1', created_at: T },
    ]
    await dispatchInboundToAiReply({ ...ARGS, inboundMessageId: 'msg-1' })
    expect(h.engineSendText).toHaveBeenCalledTimes(1)
  })
})
