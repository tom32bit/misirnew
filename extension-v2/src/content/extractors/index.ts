/**
 * Extractor registry - exports all platform extractors
 */

import { chatgptExtractor } from './chatgpt'
import { claudeExtractor } from './claude'
import { geminiExtractor } from './gemini'
import { perplexityExtractor } from './perplexity'
import { kimiExtractor } from './kimi'
import { copilotExtractor } from './copilot'
import { notebooklmExtractor } from './notebooklm'
import { deepseekExtractor } from './deepseek'
import { grokExtractor } from './grok'
import type { ConversationExtractor, ConversationData, PlatformType } from '@/lib/types'

export const extractors: ConversationExtractor[] = [
  chatgptExtractor,
  claudeExtractor,
  geminiExtractor,
  perplexityExtractor,
  kimiExtractor,
  copilotExtractor,
  notebooklmExtractor,
  deepseekExtractor,
  grokExtractor,
]

export function getExtractor(url: string): ConversationExtractor | undefined {
  return extractors.find(e => e.matches(url))
}

export function getExtractorByPlatform(platform: PlatformType): ConversationExtractor | undefined {
  return extractors.find(e => e.platform === platform)
}

export async function extractConversation(url: string): Promise<ConversationData | null> {
  const extractor = getExtractor(url)
  if (!extractor) return null

  const conversationId = extractor.getConversationId(url)
  if (!conversationId) return null

  const messages = extractor.extractFromDOM()
  if (messages.length === 0) return null

  return extractor.buildConversationData(messages, conversationId, url)
}