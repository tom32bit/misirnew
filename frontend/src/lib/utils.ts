import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strip inline markdown from LLM output. Report fields (labels, points, pros) are
 * already styled by the UI, but the model sometimes wraps them in markdown
 * (**bold**, *italic*, `code`, leading "- "/"#"), which then renders as literal
 * asterisks. Removes the markers and returns plain text.
 */
export function stripInlineMarkdown(s: string | null | undefined): string {
  if (!s) return ""
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/__(.+?)__/g, "$1") // __bold__
    .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, "$1$2") // *italic* (not **)
    .replace(/`(.+?)`/g, "$1") // `code`
    .replace(/^\s*[-*#]+\s+/, "") // leading bullet / heading marker
    .trim()
}
