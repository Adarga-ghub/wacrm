import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { AI_CONTEXT_CONTENT_TYPES, buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt } from './defaults'
import { buildHandoffSummary } from './handoff'
import { logAiUsage } from './usage'
import { latestUserMessage } from './query'
import { engineSendText } from '@/lib/flows/meta-send'
import { dispatchOutboundMessage } from '@/lib/automations/engine'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { sendTypingIndicatorForConversation } from '@/lib/whatsapp/typing-indicator'

interface DispatchArgs {
  /** Tenancy key — drives config, contact, and whatsapp_config lookups. */
  accountId: string
  conversationId: string
  contactId: string
  /** The account's WhatsApp config owner, used for the outbound send's
   *  audit columns (mirrors how the flow runner passes it through). */
  configOwnerUserId: string
  /** Whether the deterministic Flow runner consumed this same inbound
   *  (advanced/started a bot-menu run). Only consulted when the account
   *  has opted out of parallel execution (`runParallelWithFlows: false`)
   *  — see the eligibility gates below. */
  flowConsumed?: boolean
  /** `messages.id` of the inbound that triggered this dispatch. Needed
   *  by the burst-grouping wait (Settings → AI Agents): after waiting,
   *  only the newest inbound of the burst replies. Without it the wait
   *  is skipped and the bot answers immediately, as before. */
  inboundMessageId?: string
}

interface InboundRow {
  id: string
  created_at: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * True when `inboundMessageId` is still the newest plain-text customer
 * message of the conversation — i.e. no other message arrived during
 * the grouping wait. Ties on `created_at` (Meta timestamps have 1 s
 * resolution) are broken by id so concurrent dispatches for the same
 * burst all agree on a single winner. Fails open (returns true) on a
 * read error, so a DB hiccup degrades to the old reply-every-message
 * behavior rather than silence.
 */
async function isNewestInboundOfBurst(
  db: ReturnType<typeof supabaseAdmin>,
  conversationId: string,
  inboundMessageId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('messages')
    .select('id, created_at')
    .eq('conversation_id', conversationId)
    .eq('sender_type', 'customer')
    .in('content_type', [...AI_CONTEXT_CONTENT_TYPES])
    .order('created_at', { ascending: false })
    .limit(10)
  if (error || !data || data.length === 0) return true
  const rows = data as InboundRow[]
  const newestAt = rows[0].created_at
  const winner = rows
    .filter((r) => r.created_at === newestAt)
    .map((r) => r.id)
    .sort()
    .pop()
  return winner === inboundMessageId
}

/**
 * AI auto-reply for a freshly-arrived inbound message.
 *
 * Invoked from the WhatsApp webhook's `after()` block. By default the AI
 * agent and the Flows/Automations engines are fully decoupled: both act
 * on the same inbound independently — Flows/Automations own the
 * pipeline (stage, tags, timers, list membership) and the AI owns the
 * conversation. Mirrors the flow runner's contract: it owns its try/
 * catch and NEVER throws — a failing or slow LLM call must not affect
 * the webhook's 200 to Meta.
 *
 * Eligibility gates (any → silent no-op):
 *   - AI off / auto-reply disabled for the account
 *   - a human agent is assigned (they own the thread)
 *   - auto-reply was disabled for this conversation (prior handoff)
 *   - the per-conversation reply cap is reached
 *   - there's nothing to reply to
 *   - only when `runParallelWithFlows` is turned OFF (legacy mode):
 *     a Flow consumed this inbound, or the account has an active
 *     message-triggered Automation (`new_message_received` /
 *     `keyword_match`)
 *
 * The 24h WhatsApp session window is inherently open here — we're
 * reacting to a customer message that just landed — so no separate
 * window check is needed.
 */
export async function dispatchInboundToAiReply(
  args: DispatchArgs,
): Promise<void> {
  const { accountId, conversationId, contactId, configOwnerUserId } = args

  try {
    const db = supabaseAdmin()

    const config = await loadAiConfig(db, accountId)
    if (!config || !config.autoReplyEnabled) return

    // Legacy single-responder mode, opt-in via the "Run in parallel with
    // Flows & Automations" switch in Settings → AI Agents. Default is
    // parallel (both subsystems run independently), so this whole block
    // is skipped unless the account explicitly asked for the old
    // exclusive behavior.
    if (!config.runParallelWithFlows) {
      // Flows win: a bot-menu run already owns this turn of the
      // conversation.
      if (args.flowConsumed) return

      // Deterministic, user-configured responders win over the LLM.
      // Message-level automations (`new_message_received` /
      // `keyword_match`) are dispatched independently for this same
      // inbound and may send their own reply, so if the account has any
      // active one we stand down to avoid double-texting the customer.
      // (Relationship triggers like `first_inbound_message` don't count
      // — they're not per-message auto-responders.)
      const { data: autoResponders } = await db
        .from('automations')
        .select('id')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .in('trigger_type', ['new_message_received', 'keyword_match'])
        .limit(1)
      if (autoResponders && autoResponders.length > 0) return
    }

    const { data: conv, error: convErr } = await db
      .from('conversations')
      .select('assigned_agent_id, ai_autoreply_disabled, ai_reply_count')
      .eq('id', conversationId)
      .maybeSingle()
    if (convErr || !conv) return
    if (conv.assigned_agent_id) return // a human owns this thread
    if (conv.ai_autoreply_disabled) return // handed off / turned off here
    // Cheap early-out; the authoritative cap check is the atomic claim
    // below (this read can race a concurrent inbound).
    if (conv.ai_reply_count >= config.autoReplyMaxPerConversation) return

    // Burst grouping (Settings → AI Agents, off by default). Wait a few
    // seconds; if the customer sent another message meanwhile, stand
    // down — that newer inbound's own dispatch replies once, with the
    // whole burst in its context. Prevents duplicate replies (and
    // duplicate outbound keyword automations) when a customer sends two
    // messages in a row.
    if (config.autoReplyDebounceEnabled && args.inboundMessageId) {
      await sleep(config.autoReplyDebounceSeconds * 1000)
      const newest = await isNewestInboundOfBurst(
        db,
        conversationId,
        args.inboundMessageId,
      )
      if (!newest) return
    }

    // Voice notes are transcribed and recent images attached here, so
    // the bot can answer audio and photos (see `./media`).
    const messages = await buildConversationContext(db, conversationId, {
      media: { accountId, config },
    })
    if (messages.length === 0) return

    // Account-wide throttle on the shared BYO key. The per-conversation
    // cap bounds one thread; this bounds a burst across many threads (a
    // marketing blast landing 200 replies at once) so we never run the
    // owner's key past the provider's rate limit. Over the limit → skip
    // the auto-reply; the inbound still sits in the inbox for a human.
    const acctLimit = checkRateLimit(
      `ai-autoreply:${accountId}`,
      RATE_LIMITS.aiAutoReplyAccount,
    )
    if (!acctLimit.success) {
      console.warn(
        `[ai auto-reply] account ${accountId} hit the per-account rate limit — skipping this inbound.`,
      )
      return
    }

    // Ground the reply in the account's knowledge base (best-effort).
    const knowledge = await retrieveKnowledge(
      db,
      accountId,
      config,
      latestUserMessage(messages),
    )

    const systemPrompt = buildSystemPrompt({
      userPrompt: config.systemPrompt,
      mode: 'auto_reply',
      knowledge,
    })

    // Show WhatsApp's "typing…" bubble while the LLM generates — on
    // the CUSTOMER's own phone only; the CRM's own UI deliberately
    // shows nothing about typing state. Best-effort:
    // `sendTypingIndicatorForConversation` never throws.
    void sendTypingIndicatorForConversation({ db, accountId, conversationId })

    const { text, handoff, usage } = await generateReply({
      config,
      systemPrompt,
      messages,
    })

    // Record token spend on the account's BYO key. Fire-and-forget so it
    // never adds latency to the customer-facing send: `logAiUsage`
    // swallows its own errors, so the floating promise can't reject.
    // Logged regardless of handoff — the provider call happened either
    // way.
    void logAiUsage(db, {
      accountId,
      conversationId,
      mode: 'auto_reply',
      provider: config.provider,
      model: config.model,
      usage,
    })

    if (handoff || !text) {
      // The model can't (or shouldn't) answer — stop auto-replying on
      // this thread and hand it to a human. We (a) pause the bot here
      // (sticky until re-enabled), (b) route the conversation to the
      // configured handoff agent — null leaves it in the shared queue —
      // and (c) leave a short internal note so whoever picks it up has
      // context. Assigning fires the `on_conversation_assigned` trigger,
      // which notifies the agent.
      const summary = buildHandoffSummary({
        messages,
        replyCount: conv.ai_reply_count ?? 0,
      })
      const update: Record<string, unknown> = {
        ai_autoreply_disabled: true,
        ai_handoff_summary: summary,
      }
      // Only set the assignee when a target is configured AND the thread
      // isn't already owned — never stomp an existing human assignment.
      if (config.handoffAgentId && !conv.assigned_agent_id) {
        update.assigned_agent_id = config.handoffAgentId
      }
      await db.from('conversations').update(update).eq('id', conversationId)
      return
    }

    // Atomically claim a reply slot: the cap check + increment happen in
    // one UPDATE, so concurrent inbounds can never overshoot the cap. If
    // another inbound just took the last slot, `claimed` is false and we
    // skip the send. (We consume a slot slightly before the send lands —
    // fail-safe: under-reply rather than over-reply.)
    const { data: claimed, error: claimErr } = await db.rpc(
      'claim_ai_reply_slot',
      {
        conversation_id: conversationId,
        max_replies: config.autoReplyMaxPerConversation,
      },
    )
    if (claimErr) {
      // A real error here (vs. losing the cap race) is almost always a
      // deploy issue — e.g. `claim_ai_reply_slot` not EXECUTE-able by the
      // service role, or the migration not applied. Log it loudly: a
      // silent return makes "auto-reply never fires" undiagnosable.
      console.error('[ai auto-reply] claim_ai_reply_slot failed:', claimErr)
      return
    }
    if (claimed !== true) return // lost the per-conversation cap race

    await engineSendText({
      accountId,
      userId: configOwnerUserId,
      conversationId,
      contactId,
      text,
      aiGenerated: true,
    })

    // Fire any `keyword_match` (direction: outbound) automations
    // watching for this reply. An AI reply is always a fresh chain
    // root, so no depth to pass.
    await dispatchOutboundMessage({
      accountId,
      contactId,
      conversationId,
      text,
    })
  } catch (err) {
    console.error('[ai auto-reply] dispatch failed:', err)
  }
}
