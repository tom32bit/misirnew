import { describe, it, expect } from 'vitest'
import { chatCaptureToText } from './chat'
import type { ChatCapture } from './chat'

function makeCapture(overrides: Partial<ChatCapture> = {}): ChatCapture {
  return {
    platform: 'claude',
    conversationId: 'conv-1',
    title: 'Test Conversation',
    url: 'https://claude.ai/chat/conv-1',
    messages: [],
    capturedAt: new Date(),
    ...overrides,
  }
}

describe('chatCaptureToText', () => {
  it('produces a header with the platform uppercased and the title', () => {
    const text = chatCaptureToText(makeCapture({ platform: 'claude', title: 'My Chat' }))
    expect(text).toMatch(/\[CLAUDE — My Chat\]/)
  })

  it('labels user messages with "User:"', () => {
    const text = chatCaptureToText(
      makeCapture({ messages: [{ role: 'user', content: 'Hello there' }] }),
    )
    expect(text).toContain('User: Hello there')
  })

  it('labels assistant messages with "Assistant:"', () => {
    const text = chatCaptureToText(
      makeCapture({ messages: [{ role: 'assistant', content: 'Hi!' }] }),
    )
    expect(text).toContain('Assistant: Hi!')
  })

  it('formats a full conversation in order', () => {
    const capture = makeCapture({
      platform: 'chatgpt',
      title: 'AI basics',
      messages: [
        { role: 'user', content: 'What is a transformer?' },
        { role: 'assistant', content: 'A transformer is a neural network architecture.' },
        { role: 'user', content: 'Tell me more.' },
      ],
    })
    const text = chatCaptureToText(capture)
    const lines = text.split('\n').filter(Boolean)

    expect(lines[0]).toBe('[CHATGPT — AI basics]')
    expect(lines[1]).toBe('User: What is a transformer?')
    expect(lines[2]).toBe('Assistant: A transformer is a neural network architecture.')
    expect(lines[3]).toBe('User: Tell me more.')
  })

  it('returns only the header when there are no messages', () => {
    const text = chatCaptureToText(makeCapture({ title: 'Empty Chat', messages: [] }))
    expect(text.trim()).toBe('[CLAUDE — Empty Chat]')
  })

  it('trims leading and trailing whitespace', () => {
    const text = chatCaptureToText(makeCapture({ messages: [] }))
    expect(text).toBe(text.trim())
  })
})
