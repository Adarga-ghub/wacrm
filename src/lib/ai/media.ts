import { supabaseAdmin } from './admin-client'
import { aiRequestTimeoutMs } from './defaults'
import { providerHttpError, toNetworkError } from './providers/shared'
import { AiError, type AiConfig, type ChatImage } from './types'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { normalizeMimeType } from '@/lib/whatsapp/mirror-inbound-media'

// ============================================================
// Media understanding for the AI agent: voice-note transcription and
// image loading. Everything here is BEST EFFORT — a failure returns
// null and the agent falls back to a "[voice note / image]" marker,
// never an exception that would cost the customer their reply.
// ============================================================

const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'
const DEFAULT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe'
const MEDIA_FETCH_TIMEOUT_MS = 15_000

/** OpenAI's transcription upload cap. */
export const AUDIO_MAX_BYTES = 25 * 1024 * 1024
/** Anthropic caps an inline image at 5 MB of base64 (≈3.75 MB raw);
 *  applied to both providers so behavior doesn't depend on the key. */
export const IMAGE_MAX_BYTES = Math.floor(3.75 * 1024 * 1024)

/** Image types both OpenAI and Anthropic accept inline. */
const SUPPORTED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

/** File extension OpenAI uses to detect the audio container. Meta voice
 *  notes are `audio/ogg; codecs=opus`. */
const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
}

export function transcribeModel(): string {
  return process.env.AI_TRANSCRIBE_MODEL?.trim() || DEFAULT_TRANSCRIBE_MODEL
}

/**
 * OpenAI key used for speech-to-text. Anthropic has no audio input, so
 * an Anthropic account needs the optional OpenAI key from Settings → AI
 * Agents (the same one that powers knowledge-base embeddings). Null →
 * voice notes can't be transcribed.
 */
export function transcriptionApiKey(config: AiConfig): string | null {
  if (config.provider === 'openai') return config.apiKey
  return config.embeddingsApiKey || null
}

/** Normalized image MIME if both providers accept it inline, else null. */
export function supportedImageMime(value?: string | null): string | null {
  const mime = normalizeMimeType(value)
  if (mime === 'image/jpg') return 'image/jpeg'
  return mime && SUPPORTED_IMAGE_MIME.has(mime) ? mime : null
}

const PROXY_RE = /^\/api\/whatsapp\/media\/([A-Za-z0-9_-]+)$/

/**
 * Download a message's media bytes. Handles both shapes `media_url`
 * takes for inbound media:
 *  - a mirrored public URL in our own Supabase Storage (issue #466) —
 *    only that origin is fetched, so a stray URL can't turn this into
 *    an SSRF primitive;
 *  - the legacy `/api/whatsapp/media/<mediaId>` proxy path — resolved
 *    directly against Meta with the account's access token.
 * Returns null on any failure or when the file exceeds `maxBytes`.
 */
export async function fetchMessageMedia(args: {
  accountId: string
  mediaUrl: string | null
  maxBytes: number
}): Promise<{ bytes: Buffer; mimeType: string | null } | null> {
  const { accountId, mediaUrl, maxBytes } = args
  if (!mediaUrl) return null
  try {
    const proxy = PROXY_RE.exec(mediaUrl)
    if (proxy) {
      const { data: cfg } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('access_token')
        .eq('account_id', accountId)
        .maybeSingle()
      if (!cfg?.access_token) return null
      const accessToken = decrypt(cfg.access_token as string)
      const info = await getMediaUrl({ mediaId: proxy[1], accessToken })
      if (info.fileSize !== null && info.fileSize > maxBytes) return null
      const { buffer, contentType } = await downloadMedia({
        downloadUrl: info.url,
        accessToken,
      })
      if (buffer.length > maxBytes) return null
      return { bytes: buffer, mimeType: normalizeMimeType(info.mimeType || contentType) }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return null
    const url = new URL(mediaUrl)
    if (url.origin !== new URL(supabaseUrl).origin) return null

    const res = await fetch(url, { signal: AbortSignal.timeout(MEDIA_FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const declared = Number(res.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > maxBytes) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > maxBytes) return null
    return { bytes, mimeType: normalizeMimeType(res.headers.get('content-type')) }
  } catch (err) {
    console.error(
      '[ai media] could not load media:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/** Speech-to-text via OpenAI. Throws `AiError` on provider failure. */
export async function transcribeAudio(args: {
  apiKey: string
  bytes: Buffer
  mimeType: string | null
  timeoutMs?: number
}): Promise<string> {
  const { apiKey, bytes, mimeType } = args
  const ext = AUDIO_EXTENSIONS[mimeType ?? ''] ?? 'ogg'
  const form = new FormData()
  form.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: mimeType ?? 'audio/ogg' }),
    `voice-note.${ext}`,
  )
  form.append('model', transcribeModel())

  let res: Response
  try {
    res = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(args.timeoutMs ?? aiRequestTimeoutMs()),
    })
  } catch (err) {
    throw toNetworkError(err)
  }
  if (!res.ok) throw await providerHttpError('OpenAI transcription', res)

  const data = (await res.json().catch(() => null)) as { text?: unknown } | null
  if (typeof data?.text !== 'string') {
    throw new AiError('OpenAI returned no transcript.', { code: 'empty_response' })
  }
  return data.text.trim()
}

/**
 * Transcribe one stored audio message and cache the result on
 * `messages.media_transcript`. Returns the transcript, or null when it
 * couldn't be produced (no OpenAI key, download/provider failure).
 */
export async function transcribeMessageAudio(args: {
  accountId: string
  config: AiConfig
  messageId: string
  mediaUrl: string | null
  mediaType: string | null
}): Promise<string | null> {
  const apiKey = transcriptionApiKey(args.config)
  if (!apiKey) return null
  const media = await fetchMessageMedia({
    accountId: args.accountId,
    mediaUrl: args.mediaUrl,
    maxBytes: AUDIO_MAX_BYTES,
  })
  if (!media) return null
  try {
    const text = await transcribeAudio({
      apiKey,
      bytes: media.bytes,
      mimeType: normalizeMimeType(args.mediaType) ?? media.mimeType,
    })
    if (!text) return null
    const { error } = await supabaseAdmin()
      .from('messages')
      .update({ media_transcript: text })
      .eq('id', args.messageId)
    if (error) console.error('[ai media] transcript not saved:', error.message)
    return text
  } catch (err) {
    console.error(
      '[ai media] transcription failed:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/** Load one stored image as an inline `ChatImage`, or null. */
export async function loadMessageImage(args: {
  accountId: string
  mediaUrl: string | null
  mediaType: string | null
}): Promise<ChatImage | null> {
  const media = await fetchMessageMedia({
    accountId: args.accountId,
    mediaUrl: args.mediaUrl,
    maxBytes: IMAGE_MAX_BYTES,
  })
  if (!media) return null
  const mimeType = supportedImageMime(args.mediaType) ?? supportedImageMime(media.mimeType)
  if (!mimeType) return null
  return { mimeType, base64: media.bytes.toString('base64') }
}
