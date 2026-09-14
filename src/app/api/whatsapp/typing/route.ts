import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { sendTypingIndicatorForConversation } from '@/lib/whatsapp/typing-indicator'

// Dashboard-only: shows WhatsApp's "typing…" bubble to the customer
// while a human agent composes a reply. The composer calls this
// (throttled client-side to ~1 per 15s) as the agent types; there is
// nothing to persist here — the indicator lives entirely on Meta's
// side and clears itself after 25s or the next real send.
//
// Same 'agent' role gate as /api/whatsapp/send: this makes a real
// Meta API call on the account's behalf, so a read-only viewer must
// not be able to trigger it.
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    const limit = checkRateLimit(`typing:${userId}`, RATE_LIMITS.typingIndicator)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json().catch(() => ({}))
    const conversationId = body?.conversation_id
    if (!conversationId || typeof conversationId !== 'string') {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 }
      )
    }

    // Tenancy check — mirrors the ownership guard other account-scoped
    // endpoints use, since the helper below queries with the caller's
    // own RLS-scoped client but takes conversationId as a bare id.
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .maybeSingle()
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const sent = await sendTypingIndicatorForConversation({
      db: supabase,
      accountId,
      conversationId,
    })

    return NextResponse.json({ sent })
  } catch (error) {
    return toErrorResponse(error)
  }
}
