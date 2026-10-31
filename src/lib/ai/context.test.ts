import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({
  transcribeMessageAudio: vi.fn(),
  loadMessageImage: vi.fn(),
}))
vi.mock('./media', () => ({
  transcribeMessageAudio: h.transcribeMessageAudio,
  loadMessageImage: h.loadMessageImage,
}))

import {
  buildConversationContext,
  IMAGE_ATTACHED_LABEL,
  IMAGE_EARLIER_LABEL,
  IMAGE_UNREADABLE,
  VOICE_NOTE_LABEL,
  VOICE_NOTE_UNREADABLE,
} from './context'
import type { AiConfig } from './types'

/** Minimal fake matching the query chain in buildConversationContext:
 *  from().select().eq().in().order().limit() → { data, error }. */
function fakeDb(rows: unknown[]): SupabaseClient {
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error: null }),
  }
  return chain as unknown as SupabaseClient
}

const media = { accountId: 'acct-1', config: { provider: 'openai' } as AiConfig }
const IMG = { mimeType: 'image/jpeg', base64: 'AAAA' }

beforeEach(() => {
  h.transcribeMessageAudio.mockReset()
  h.loadMessageImage.mockReset()
})

describe('buildConversationContext', () => {
  it('maps sender_type to role and returns chronological order', async () => {
    // DB returns newest-first (created_at DESC); the fn reverses it.
    const rows = [
      { sender_type: 'customer', content_text: 'third' },
      { sender_type: 'agent', content_text: 'second' },
      { sender_type: 'customer', content_text: 'first' },
    ]
    const out = await buildConversationContext(fakeDb(rows), 'conv-1')
    expect(out).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
    ])
  })

  it('treats bot messages as assistant', async () => {
    const out = await buildConversationContext(
      fakeDb([{ sender_type: 'bot', content_text: 'auto reply' }]),
      'conv-1',
    )
    expect(out).toEqual([{ role: 'assistant', content: 'auto reply' }])
  })

  it('drops empty / whitespace-only messages', async () => {
    const out = await buildConversationContext(
      fakeDb([
        { sender_type: 'customer', content_text: '   ' },
        { sender_type: 'customer', content_text: null },
        { sender_type: 'customer', content_text: 'real' },
      ]),
      'conv-1',
    )
    expect(out).toEqual([{ role: 'user', content: 'real' }])
  })

  it('uses a cached voice-note transcript without re-transcribing', async () => {
    const out = await buildConversationContext(
      fakeDb([
        {
          id: 'm1',
          sender_type: 'customer',
          content_type: 'audio',
          content_text: null,
          media_transcript: 'hola, ¿tienen envíos?',
        },
      ]),
      'conv-1',
      { media },
    )
    expect(h.transcribeMessageAudio).not.toHaveBeenCalled()
    expect(out).toEqual([
      { role: 'user', content: `${VOICE_NOTE_LABEL} hola, ¿tienen envíos?` },
    ])
  })

  it('transcribes an uncached customer voice note', async () => {
    h.transcribeMessageAudio.mockResolvedValue('quiero el precio')
    const out = await buildConversationContext(
      fakeDb([
        {
          id: 'm1',
          sender_type: 'customer',
          content_type: 'audio',
          content_text: null,
          media_url: 'https://x/a.ogg',
          media_type: 'audio/ogg',
        },
      ]),
      'conv-1',
      { media },
    )
    expect(h.transcribeMessageAudio).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'm1', mediaUrl: 'https://x/a.ogg' }),
    )
    expect(out).toEqual([{ role: 'user', content: `${VOICE_NOTE_LABEL} quiero el precio` }])
  })

  it('marks a voice note that could not be transcribed', async () => {
    h.transcribeMessageAudio.mockResolvedValue(null)
    const out = await buildConversationContext(
      fakeDb([
        { id: 'm1', sender_type: 'customer', content_type: 'audio', content_text: null },
      ]),
      'conv-1',
      { media },
    )
    expect(out).toEqual([{ role: 'user', content: VOICE_NOTE_UNREADABLE }])
  })

  it('attaches a recent customer image with its caption', async () => {
    h.loadMessageImage.mockResolvedValue(IMG)
    const out = await buildConversationContext(
      fakeDb([
        {
          id: 'm1',
          sender_type: 'customer',
          content_type: 'image',
          content_text: 'este modelo',
          media_url: 'https://x/i.jpg',
          media_type: 'image/jpeg',
        },
      ]),
      'conv-1',
      { media },
    )
    expect(out).toEqual([
      { role: 'user', content: `${IMAGE_ATTACHED_LABEL} este modelo`, images: [IMG] },
    ])
  })

  it('only sends pixels for images inside the recent window', async () => {
    h.loadMessageImage.mockResolvedValue(IMG)
    // Newest-first: 6 recent texts, then an older image.
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => ({
        sender_type: i % 2 ? 'agent' : 'customer',
        content_type: 'text',
        content_text: `t${i}`,
      })),
      { id: 'old', sender_type: 'customer', content_type: 'image', content_text: null },
    ]
    const out = await buildConversationContext(fakeDb(rows), 'conv-1', { media })
    expect(h.loadMessageImage).not.toHaveBeenCalled()
    expect(out[0]).toEqual({ role: 'user', content: IMAGE_EARLIER_LABEL })
  })

  it('marks a recent image that failed to load', async () => {
    h.loadMessageImage.mockResolvedValue(null)
    const out = await buildConversationContext(
      fakeDb([{ id: 'm1', sender_type: 'customer', content_type: 'image', content_text: null }]),
      'conv-1',
      { media },
    )
    expect(out).toEqual([{ role: 'user', content: IMAGE_UNREADABLE }])
  })

  it('without media options never downloads or transcribes', async () => {
    const out = await buildConversationContext(
      fakeDb([
        { id: 'a', sender_type: 'customer', content_type: 'audio', content_text: null },
        { id: 'b', sender_type: 'customer', content_type: 'image', content_text: null },
      ]),
      'conv-1',
    )
    expect(h.transcribeMessageAudio).not.toHaveBeenCalled()
    expect(h.loadMessageImage).not.toHaveBeenCalled()
    expect(out).toEqual([
      { role: 'user', content: IMAGE_EARLIER_LABEL },
      { role: 'user', content: VOICE_NOTE_UNREADABLE },
    ])
  })

  it('skips business-sent audio and keeps business image captions', async () => {
    const out = await buildConversationContext(
      fakeDb([
        { sender_type: 'agent', content_type: 'image', content_text: 'catálogo' },
        { sender_type: 'agent', content_type: 'audio', content_text: null },
      ]),
      'conv-1',
      { media },
    )
    expect(out).toEqual([{ role: 'assistant', content: 'catálogo' }])
  })
})
