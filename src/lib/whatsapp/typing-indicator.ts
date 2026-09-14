import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTypingIndicator } from './meta-api'
import { decrypt } from './encryption'

// ------------------------------------------------------------
// Shared "show the customer we're typing" helper — used by both the
// dashboard composer (a human agent typing) and the AI auto-reply
// pipeline (the bot generating a response). Both need the same three
// things: the account's WhatsApp credentials, and the wamid of the
// customer's most recent inbound message (Meta's API has no way to
// start a typing indicator without referencing one).
//
// Best-effort by design, like the rest of this codebase's Meta side-
// calls: a missing config, a contact who's never messaged, or a
// transient Graph API error must never block sending the real reply.
// Callers get a boolean back for logging only — never a throw.
// ------------------------------------------------------------

export interface SendTypingIndicatorForConversationArgs {
  db: SupabaseClient
  accountId: string
  conversationId: string
}

export async function sendTypingIndicatorForConversation(
  args: SendTypingIndicatorForConversationArgs
): Promise<boolean> {
  const { db, accountId, conversationId } = args
  try {
    const { data: config } = await db
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('account_id', accountId)
      .maybeSingle()
    if (!config?.phone_number_id || !config?.access_token) return false

    // Most recent inbound message in this conversation — the one the
    // typing indicator (and its read receipt) attaches to.
    const { data: lastInbound } = await db
      .from('messages')
      .select('message_id')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'customer')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!lastInbound?.message_id) return false

    await sendTypingIndicator({
      phoneNumberId: config.phone_number_id,
      accessToken: decrypt(config.access_token),
      messageId: lastInbound.message_id,
    })
    return true
  } catch (err) {
    console.warn(
      '[typing-indicator] failed (non-fatal):',
      err instanceof Error ? err.message : err,
    )
    return false
  }
}
