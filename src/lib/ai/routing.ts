import type { SupabaseClient } from '@supabase/supabase-js'
import { getPhoneCountry } from '@/lib/whatsapp/phone-country'

// ============================================================
// Multi-agent routing for the AI auto-reply bot.
//
// Each account has one default agent (the fallback) plus any number of
// named agents, each tied to a set of countries. An inbound is routed by
// the customer's country (from the phone's calling code):
//
//   1. If the conversation is already owned by an agent
//      (`conversations.ai_agent_id`), only that agent may answer — a
//      second agent never cuts in. If the owner is paused/off, the bot
//      stays quiet rather than switching agents.
//   2. Otherwise the first live (active + auto-reply on) non-default
//      agent whose countries include the customer's country answers.
//   3. Otherwise the default agent answers.
//
// Test numbers (`ai_test_phones`) override the detected country with a
// simulated one and are never locked, so the owner can switch the
// simulated country and immediately talk to another agent.
// ============================================================

export interface RoutableAgent {
  id: string
  is_default: boolean
  countries: string[] | null
  is_active: boolean
  auto_reply_enabled: boolean
}

export interface AgentRoute {
  /** Agent that should answer (`ai_configs.id`). */
  agentId: string
  /** How to record ownership once the agent has replied:
   *  'lock' — set `ai_agent_id` only if the thread has no owner yet;
   *  'overwrite' — always set it (test numbers, never locked). */
  record: 'lock' | 'overwrite'
}

/** Digits-only form of a phone number. */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

/**
 * True when a contact's phone matches a saved test number. Compared by
 * suffix so "8294759418" (as typed) matches WhatsApp's "18294759418".
 */
export function matchesTestPhone(contactPhone: string, testPhone: string): boolean {
  const a = phoneDigits(contactPhone)
  const b = phoneDigits(testPhone)
  if (b.length < 7 || a.length < 7) return false
  return a.endsWith(b) || b.endsWith(a)
}

const isLive = (a: RoutableAgent) => a.is_active && a.auto_reply_enabled

/**
 * Pure routing decision. Returns null when no agent should answer
 * (the owning agent is off, or the account has no usable agent).
 */
export function pickAgent(input: {
  agents: RoutableAgent[]
  lockedAgentId: string | null
  /** ISO country code of the customer, or null when unknown. */
  country: string | null
  /** True for a saved test number (simulated country, no lock). */
  isTest: boolean
}): AgentRoute | null {
  const { agents, lockedAgentId, country, isTest } = input
  const record = isTest ? 'overwrite' : 'lock'

  if (!isTest && lockedAgentId) {
    const owner = agents.find((a) => a.id === lockedAgentId)
    // The owner was deleted → fall through and route afresh.
    if (owner) return isLive(owner) ? { agentId: owner.id, record } : null
  }

  if (country) {
    const iso = country.toUpperCase()
    const match = agents.find(
      (a) =>
        !a.is_default &&
        isLive(a) &&
        (a.countries ?? []).some((c) => c.toUpperCase() === iso),
    )
    if (match) return { agentId: match.id, record }
  }

  const fallback = agents.find((a) => a.is_default)
  return fallback ? { agentId: fallback.id, record } : null
}

/**
 * Resolve which agent answers this inbound. Never throws: on a read
 * error it returns `{ agentId: null }`, which makes the caller load the
 * default agent — i.e. the pre-multi-agent behavior.
 */
export async function resolveAutoReplyAgent(
  db: SupabaseClient,
  args: { accountId: string; conversationId: string; contactId: string },
): Promise<AgentRoute | { agentId: null; record: 'none' } | null> {
  const fallback = { agentId: null, record: 'none' as const }
  try {
    const [agentsRes, convRes, contactRes, testRes] = await Promise.all([
      db
        .from('ai_configs')
        .select('id, is_default, countries, is_active, auto_reply_enabled')
        .eq('account_id', args.accountId)
        .order('created_at', { ascending: true }),
      db
        .from('conversations')
        .select('ai_agent_id')
        .eq('id', args.conversationId)
        .maybeSingle(),
      db.from('contacts').select('phone').eq('id', args.contactId).maybeSingle(),
      db
        .from('ai_test_phones')
        .select('phone, country_iso')
        .eq('account_id', args.accountId),
    ])
    if (agentsRes.error || !agentsRes.data) return fallback
    const agents = agentsRes.data as RoutableAgent[]
    if (agents.length === 0) return fallback

    const phone = (contactRes.data?.phone as string | undefined) ?? ''
    const test = ((testRes.data ?? []) as { phone: string; country_iso: string }[]).find(
      (t) => matchesTestPhone(phone, t.phone),
    )
    const country = test ? test.country_iso : getPhoneCountry(phone)?.iso ?? null

    return pickAgent({
      agents,
      lockedAgentId: (convRes.data?.ai_agent_id as string | null | undefined) ?? null,
      country,
      isTest: !!test,
    })
  } catch (err) {
    console.error('[ai routing] resolve failed, using default agent:', err)
    return fallback
  }
}

/** Record which agent owns the conversation after it replied. Best-effort. */
export async function recordConversationAgent(
  db: SupabaseClient,
  conversationId: string,
  route: { agentId: string | null; record: AgentRoute['record'] | 'none' },
): Promise<void> {
  if (!route.agentId || route.record === 'none') return
  try {
    let q = db
      .from('conversations')
      .update({ ai_agent_id: route.agentId })
      .eq('id', conversationId)
    if (route.record === 'lock') q = q.is('ai_agent_id', null)
    const { error } = await q
    if (error) console.error('[ai routing] record agent failed:', error)
  } catch (err) {
    console.error('[ai routing] record agent threw:', err)
  }
}
