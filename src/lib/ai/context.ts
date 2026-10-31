import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiConfig, ChatImage, ChatMessage } from './types'
import { aiContextMessageLimit } from './defaults'
import { loadMessageImage, transcribeMessageAudio } from './media'

interface DbMessage {
  id?: string
  sender_type: 'customer' | 'agent' | 'bot'
  content_type?: string | null
  content_text: string | null
  media_url?: string | null
  media_type?: string | null
  media_transcript?: string | null
}

/** Content types the agent can read: text, voice notes (via their
 *  transcript) and images. */
export const AI_CONTEXT_CONTENT_TYPES = ['text', 'audio', 'image'] as const

/** Only customer images among the last N context messages are sent to
 *  the model as pixels — older ones become a text marker, so the same
 *  photo isn't re-billed on every later reply. */
export const RECENT_IMAGE_WINDOW = 6
/** Hard cap on images attached to one generation. */
export const MAX_IMAGES_PER_REPLY = 3
/** Cap on fresh transcriptions per generation (the rest are cached on
 *  later turns), bounding latency inside the webhook's time budget. */
export const MAX_TRANSCRIPTIONS_PER_REPLY = 3

/** Markers the system prompt explains to the model (see
 *  `buildSystemPrompt`). Kept in English like the rest of the scaffold. */
export const VOICE_NOTE_LABEL = '[Voice note transcript]'
export const VOICE_NOTE_UNREADABLE = '[The customer sent a voice note that could not be transcribed]'
export const IMAGE_ATTACHED_LABEL = '[Image attached]'
export const IMAGE_EARLIER_LABEL = '[The customer sent an image earlier — it is no longer visible to you]'
export const IMAGE_UNREADABLE = '[The customer sent an image that could not be loaded]'

export interface ContextMediaOptions {
  accountId: string
  config: AiConfig
}

/**
 * Fetch the last N text / audio / image messages of a conversation and
 * map them to the provider-neutral chat shape. Customer messages become
 * `user`; agent and bot messages become `assistant`.
 *
 * With `media` set (auto-reply + inbox draft), customer voice notes are
 * transcribed (and the transcript cached on the row) and the most
 * recent customer images are downloaded and attached inline. Without
 * it, only cached transcripts and text markers are used.
 *
 * Ordered oldest-first (chronological) so the transcript reads
 * naturally and the most recent customer message lands last.
 */
export async function buildConversationContext(
  db: SupabaseClient,
  conversationId: string,
  options: { limit?: number; media?: ContextMediaOptions } = {},
): Promise<ChatMessage[]> {
  const limit = options.limit ?? aiContextMessageLimit()
  const { data, error } = await db
    .from('messages')
    .select('id, sender_type, content_type, content_text, media_url, media_type, media_transcript')
    .eq('conversation_id', conversationId)
    .in('content_type', [...AI_CONTEXT_CONTENT_TYPES])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = ((data ?? []) as DbMessage[]).reverse()
  const media = options.media

  // Fresh transcriptions for the newest customer voice notes that don't
  // have one cached yet.
  const transcripts = new Map<DbMessage, string | null>()
  if (media) {
    const pending = rows
      .filter(
        (r) =>
          r.content_type === 'audio' &&
          r.sender_type === 'customer' &&
          r.id &&
          !r.media_transcript?.trim(),
      )
      .slice(-MAX_TRANSCRIPTIONS_PER_REPLY)
    await Promise.all(
      pending.map(async (r) => {
        transcripts.set(
          r,
          await transcribeMessageAudio({
            accountId: media.accountId,
            config: media.config,
            messageId: r.id!,
            mediaUrl: r.media_url ?? null,
            mediaType: r.media_type ?? null,
          }),
        )
      }),
    )
  }

  // Inline pixels for the newest customer images inside the window.
  const images = new Map<DbMessage, ChatImage | null>()
  if (media) {
    const recent = rows
      .slice(-RECENT_IMAGE_WINDOW)
      .filter((r) => r.content_type === 'image' && r.sender_type === 'customer')
      .slice(-MAX_IMAGES_PER_REPLY)
    await Promise.all(
      recent.map(async (r) => {
        images.set(
          r,
          await loadMessageImage({
            accountId: media.accountId,
            mediaUrl: r.media_url ?? null,
            mediaType: r.media_type ?? null,
          }),
        )
      }),
    )
  }

  const out: ChatMessage[] = []
  for (const m of rows) {
    const role: ChatMessage['role'] = m.sender_type === 'customer' ? 'user' : 'assistant'
    const text = m.content_text?.trim() ?? ''
    const type = m.content_type ?? 'text'

    if (type === 'audio') {
      if (role !== 'user') continue // business audio carries no text to model
      const transcript = (m.media_transcript ?? transcripts.get(m) ?? '').trim()
      out.push({
        role,
        content: transcript ? `${VOICE_NOTE_LABEL} ${transcript}` : VOICE_NOTE_UNREADABLE,
      })
      continue
    }

    if (type === 'image') {
      if (role !== 'user') {
        // Business-sent image: keep its caption, if any, as context.
        if (text) out.push({ role, content: text })
        continue
      }
      const image = images.get(m)
      if (image) {
        out.push({
          role,
          content: text ? `${IMAGE_ATTACHED_LABEL} ${text}` : IMAGE_ATTACHED_LABEL,
          images: [image],
        })
      } else {
        // Attempted (recent) but failed vs. outside the recent window.
        const label = images.has(m) ? IMAGE_UNREADABLE : IMAGE_EARLIER_LABEL
        out.push({ role, content: text ? `${label} ${text}` : label })
      }
      continue
    }

    if (text) out.push({ role, content: text })
  }
  return out
}
