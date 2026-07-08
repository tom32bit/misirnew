/**
 * Platform detector - identifies AI chat platforms from URL
 */

import type { PlatformType } from '@/lib/types'

export interface PlatformInfo {
  platform: PlatformType
  displayName: string
  icon: string
  color: string
}

export const PLATFORM_CONFIG: Record<PlatformType, PlatformInfo> = {
  chatgpt: {
    platform: 'chatgpt',
    displayName: 'ChatGPT',
    icon: '💬',
    color: '#10a37f',
  },
  claude: {
    platform: 'claude',
    displayName: 'Claude',
    icon: '✨',
    color: '#d97757',
  },
  gemini: {
    platform: 'gemini',
    displayName: 'Gemini',
    icon: '✦',
    color: '#4285f4',
  },
  perplexity: {
    platform: 'perplexity',
    displayName: 'Perplexity',
    icon: '🔍',
    color: '#20c997',
  },
  deepseek: {
    platform: 'deepseek',
    displayName: 'DeepSeek',
    icon: '🐋',
    color: '#00d4aa',
  },
  grok: {
    platform: 'grok',
    displayName: 'Grok',
    icon: '⚡',
    color: '#000000',
  },
  copilot: {
    platform: 'copilot',
    displayName: 'Copilot',
    icon: '🤖',
    color: '#0078d4',
  },
  notebooklm: {
    platform: 'notebooklm',
    displayName: 'NotebookLM',
    icon: '📓',
    color: '#4285f4',
  },
  kimi: {
    platform: 'kimi',
    displayName: 'Kimi',
    icon: '🌙',
    color: '#6c5ce7',
  },
  web: {
    platform: 'web',
    displayName: 'Web Page',
    icon: '🌐',
    color: '#64748b',
  },
}

export const PLATFORM_PATTERNS: Array<{ pattern: RegExp; platform: PlatformType }> = [
  { pattern: /^https:\/\/chatgpt\.com\//i, platform: 'chatgpt' },
  { pattern: /^https:\/\/chat\.openai\.com\//i, platform: 'chatgpt' },
  { pattern: /^https:\/\/claude\.ai\//i, platform: 'claude' },
  { pattern: /^https:\/\/gemini\.google\.com\//i, platform: 'gemini' },
  { pattern: /^https:\/\/bard\.google\.com\//i, platform: 'gemini' },
  { pattern: /^https:\/\/www\.perplexity\.ai\//i, platform: 'perplexity' },
  { pattern: /^https:\/\/chat\.deepseek\.com\//i, platform: 'deepseek' },
  { pattern: /^https:\/\/grok\.com\//i, platform: 'grok' },
  { pattern: /^https:\/\/copilot\.microsoft\.com\//i, platform: 'copilot' },
  { pattern: /^https:\/\/notebooklm\.google\.com\//i, platform: 'notebooklm' },
  { pattern: /^https:\/\/www\.kimi\.com\//i, platform: 'kimi' },
]

export function detectPlatform(url: string): PlatformInfo | null {
  for (const { pattern, platform } of PLATFORM_PATTERNS) {
    if (pattern.test(url)) {
      return PLATFORM_CONFIG[platform]
    }
  }
  return null
}

export function isAIChatPlatform(url: string): boolean {
  return detectPlatform(url) !== null
}

export function getConversationId(url: string, platform: PlatformType): string | null {
  const patterns: Record<PlatformType, RegExp[]> = {
    chatgpt: [/\/c\/([a-f0-9-]{36})/i],
    claude: [/\/chat\/([a-f0-9-]{36})/i, /\/project\/[^/]+\/chat\/([a-f0-9-]{36})/i],
    gemini: [/\/app\/([a-f0-9]+)/i],
    perplexity: [/\/thread\/([a-zA-Z0-9_-]+)/i],
    deepseek: [/\/chat\/([a-zA-Z0-9_-]+)/i],
    grok: [/\/conversation\/([a-zA-Z0-9_-]+)/i],
    copilot: [/\/chat\/([a-zA-Z0-9_-]+)/i],
    notebooklm: [/\/notebook\/([a-zA-Z0-9_-]+)/i],
    kimi: [/\/chat\/([a-zA-Z0-9_-]+)/i],
    web: [],
  }

  for (const pattern of patterns[platform] || []) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}