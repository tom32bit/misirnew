import type { ChatAdapter } from './types'
import { claudeAdapter } from './claude'
import { chatgptAdapter } from './chatgpt'
import { perplexityAdapter } from './perplexity'
import { deepseekAdapter } from './deepseek'
import { grokAdapter } from './grok'
import { geminiAdapter } from './gemini'
import { copilotAdapter } from './copilot'
import { notebooklmAdapter } from './notebooklm'
import { kimiAdapter } from './kimi'

export const adapters: ChatAdapter[] = [
  claudeAdapter,
  chatgptAdapter,
  perplexityAdapter,
  deepseekAdapter,
  grokAdapter,
  geminiAdapter,
  copilotAdapter,
  notebooklmAdapter,
  kimiAdapter,
]

export function getAdapter(url: string): ChatAdapter | undefined {
  return adapters.find((a) => a.matches(url))
}

// Hosts that need inject-web.js for auth header interception
export const INJECT_WEB_HOSTS = new Set(['chatgpt.com'])

// All AI chat hosts — used by web capture to skip Readability on these pages
export const AI_CHAT_HOSTS = new Set([
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'www.perplexity.ai',
  'chat.deepseek.com',
  'grok.com',
  'copilot.microsoft.com',
  'notebooklm.google.com',
  'www.kimi.com',
])
