/**
 * Best-effort on-device PII redaction, applied to captured text BEFORE it
 * leaves the browser (and before it is queued locally).
 *
 * This is a data-minimisation mitigation, NOT a guarantee: it strips obvious
 * direct identifiers (emails, card / SSN / IBAN numbers, clearly-formatted
 * phone numbers). It does not detect special-category data by meaning — the
 * real fix is to capture only user-selected content. Conservative patterns are
 * used to avoid mangling ordinary text (e.g. ISO dates are not treated as
 * phone numbers).
 */
const PATTERNS: Array<[RegExp, string]> = [
  // Email addresses
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]'],
  // Payment-card-like 13–19 digit runs (optionally space/dash grouped)
  [/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED_CARD]'],
  // US SSN
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]'],
  // IBAN
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, '[REDACTED_IBAN]'],
  // Phone with international prefix (e.g. +44 20 1234 5678)
  [/\+\d{1,3}[ .-]?(?:\(?\d{1,4}\)?[ .-]?){2,4}\d{2,4}/g, '[REDACTED_PHONE]'],
  // Phone with parenthesised area code (e.g. (212) 555-1234)
  [/\(\d{2,4}\)[ .-]?\d{2,4}[ .-]?\d{2,4}/g, '[REDACTED_PHONE]'],
]

export function redactPII(text: string | null | undefined): string {
  if (!text) return text ?? ''
  let out = text
  for (const [re, repl] of PATTERNS) out = out.replace(re, repl)
  return out
}
