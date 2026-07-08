/**
 * Chat-related types and utilities
 */

import type { ChatCapture, PlatformType } from '@/lib/types'

/**
 * Convert a ChatCapture to plain text for hashing/word counting
 */
export function chatCaptureToText(capture: ChatCapture): string {
  return capture.messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')
}

/**
 * Estimate token count for a chat capture (rough approximation)
 */
export function estimateChatTokens(capture: ChatCapture): number {
  const text = chatCaptureToText(capture)
  return Math.ceil(text.length / 4) // Rough approximation: 1 token ≈ 4 chars
}

/**
 * Validate a chat capture has minimum viable content
 */
export function validateChatCapture(capture: ChatCapture): { valid: boolean; reason?: string } {
  if (!capture.messages || capture.messages.length === 0) {
    return { valid: false, reason: 'No messages' }
  }

  if (capture.messages.length === 1 && capture.messages[0].role === 'user') {
    return { valid: false, reason: 'Only user message, no assistant response' }
  }

  const totalChars = capture.messages.reduce((sum, m) => sum + m.content.length, 0)
  if (totalChars < 50) {
    return { valid: false, reason: 'Content too short' }
  }

  return { valid: true }
}

/**
 * Get platform display name
 */
export function getPlatformDisplayName(platform: PlatformType): string {
  const names: Record<PlatformType, string> = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
    deepseek: 'DeepSeek',
    grok: 'Grok',
    copilot: 'Copilot',
    notebooklm: 'NotebookLM',
    kimi: 'Kimi',
    web: 'Web',
  }
  return names[platform] || platform
}

/**
 * Get platform icon (emoji)
 */
export function getPlatformIcon(platform: PlatformType): string {
  const icons: Record<PlatformType, string> = {
    chatgpt: '💬',
    claude: '✨',
    gemini: '✦',
    perplexity: '🔍',
    deepseek: '🐋',
    grok: '⚡',
    copilot: '🤖',
    notebooklm: '📓',
    kimi: '🌙',
    web: '🌐',
  }
  return icons[platform] || '💬'
}