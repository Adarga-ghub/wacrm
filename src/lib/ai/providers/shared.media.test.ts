import { describe, it, expect } from 'vitest'
import { mergeConsecutive, toAnthropicContent, toOpenAiContent } from './shared'

const IMG = { mimeType: 'image/png', base64: 'QUJD' }

describe('multimodal content', () => {
  it('merges images across consecutive same-role turns', () => {
    const out = mergeConsecutive([
      { role: 'user', content: 'a', images: [IMG] },
      { role: 'user', content: 'b' },
      { role: 'user', content: 'c', images: [IMG] },
    ])
    expect(out).toEqual([{ role: 'user', content: 'a\n\nb\n\nc', images: [IMG, IMG] }])
  })

  it('keeps plain string content when there are no images', () => {
    expect(toOpenAiContent({ role: 'user', content: 'hi' })).toBe('hi')
    expect(toAnthropicContent({ role: 'user', content: 'hi' })).toBe('hi')
  })

  it('builds OpenAI image_url data URLs', () => {
    expect(toOpenAiContent({ role: 'user', content: 'see', images: [IMG] })).toEqual([
      { type: 'text', text: 'see' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } },
    ])
  })

  it('builds Anthropic base64 image blocks before the text', () => {
    expect(toAnthropicContent({ role: 'user', content: 'see', images: [IMG] })).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
      { type: 'text', text: 'see' },
    ])
  })
})
