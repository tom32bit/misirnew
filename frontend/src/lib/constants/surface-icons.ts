/**
 * Map an artifact's platform/domain to a lucide icon name.
 * Ported from `design_handoff_misir/dashboard/data.js#surfaceIcon`.
 */

import type { Artifact, PlatformType } from "@/lib/api/types"

const AI_PLATFORMS: PlatformType[] = [
  "claude",
  "chatgpt",
  "gemini",
  "perplexity",
  "deepseek",
  "grok",
  "copilot",
  "notebooklm",
  "kimi",
]

/**
 * Canonical display names for platform keys. The backend emits raw keys
 * (`chatgpt`) or `str.capitalize()` labels (`Chatgpt`) depending on the field
 * and cache age — every surface must render through this map instead so the
 * same platform never shows up spelled three ways.
 */
const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  deepseek: "DeepSeek",
  grok: "Grok",
  copilot: "Copilot",
  notebooklm: "NotebookLM",
  kimi: "Kimi",
  youtube: "YouTube",
}

export function platformLabel(key?: string | null): string {
  const k = (key ?? "").trim().replace(/:$/, "").toLowerCase()
  if (!k) return "—"
  return PLATFORM_LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1)
}

export function surfaceIcon(a: Artifact | { platform?: string; domain?: string | null; url?: string }): string {
  const platform = (a.platform ?? "").toLowerCase()
  const domain = (a.domain ?? "").toLowerCase()
  const url = (a.url ?? "").toLowerCase()

  if (AI_PLATFORMS.includes(platform as PlatformType)) return "messages-square"
  if (platform === "youtube" || domain.includes("youtube")) return "play"
  if (domain.includes("x.com") || domain.includes("twitter") || domain.includes("linkedin")) return "at-sign"
  if (
    url.endsWith(".pdf") ||
    domain.endsWith(".gov") ||
    domain.includes("bessemer") ||
    domain.includes("firstround") ||
    domain.includes("levels.fyi")
  ) {
    return "file-text"
  }
  return "globe"
}

/** Map platform → the capture "type" label the design uses. */
export function captureType(a: Artifact | { platform?: string; domain?: string | null; url?: string }): "Article" | "AI chat" | "PDF" | "Video" | "Post" {
  const platform = (a.platform ?? "").toLowerCase()
  const domain = (a.domain ?? "").toLowerCase()
  const url = (a.url ?? "").toLowerCase()

  if (AI_PLATFORMS.includes(platform as PlatformType)) return "AI chat"
  if (platform === "youtube" || domain.includes("youtube")) return "Video"
  if (domain.includes("x.com") || domain.includes("twitter") || domain.includes("linkedin")) return "Post"
  if (url.endsWith(".pdf") || domain.endsWith(".gov")) return "PDF"
  return "Article"
}

/**
 * Render the "surface" string (e.g. "claude.ai", "bloomberg.com") shown in
 * capture rows. Prefer domain; fall back to a tidy host extraction from URL.
 */
export function surfaceLabel(a: Artifact | { platform?: string; domain?: string | null; url?: string }): string {
  if (a.domain) return a.domain
  if (!a.url) return "—"
  try {
    return new URL(a.url).host.replace(/^www\./, "")
  } catch {
    return "—"
  }
}
