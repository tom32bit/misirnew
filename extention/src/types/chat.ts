export type AIChatPlatform =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'perplexity'
  | 'deepseek'
  | 'grok'
  | 'copilot'
  | 'notebooklm'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  model?: string
  createdAt?: Date
}

export interface ChatCapture {
  platform: AIChatPlatform
  conversationId: string
  title: string
  url: string
  messages: ChatMessage[]
  capturedAt: Date
}

// Serialised plain text for NLP matching and artifact.extracted_text
export function chatCaptureToText(capture: ChatCapture): string {
  const lines: string[] = [`[${capture.platform.toUpperCase()} — ${capture.title}]`, '']
  for (const msg of capture.messages) {
    lines.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`, '')
  }
  return lines.join('\n').trim()
}

// ── Auth data from inject-web ──────────────────────────────────────────────

export interface InjectWebAuthData {
  authorization?: string
  extraHeaders?: Record<string, string>
}

// ── Extension messages ─────────────────────────────────────────────────────

export interface CaptureAIChatMessage {
  type: 'CAPTURE_AI_CHAT'
  capture: ChatCapture
  normalizedUrl: string
  domain: string
  contentHash: string
  wordCount: number
}
