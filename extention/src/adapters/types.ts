import type { AIChatPlatform, ChatCapture, InjectWebAuthData } from '@/types/chat'

export interface ChatAdapter {
  readonly platform: AIChatPlatform
  /** Returns true when the adapter handles the given URL */
  matches(url: string): boolean
  /** Extracts conversation ID from URL, or null if not determinable */
  getConversationId(url: string): string | null
  /** Fetches and normalises the full conversation */
  fetchConversation(conversationId: string, auth?: InjectWebAuthData): Promise<ChatCapture | null>
  /** CSS selector for the message container — MutationObserver watches this */
  readonly triggerSelector: string
  /** Whether this adapter needs auth data from inject-web.js */
  readonly needsInjectWeb: boolean
}
