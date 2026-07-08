/**
 * PII Redaction - on-device before upload
 * Ported from old extension, enhanced
 */

// Email regex
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g

// Phone regex (various formats)
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g

// Credit card regex (basic)
const CREDIT_CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g

// SSN regex
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g

// API key patterns
const API_KEY_REGEX = /\b(sk|pk|rk)_[a-zA-Z0-9]{20,}\b/g

// Bearer token pattern
const BEARER_TOKEN_REGEX = /Bearer\s+[A-Za-z0-9._-]{20,}/gi

// Health-related terms (for special category data detection)
const HEALTH_TERMS = [
  'diagnosis', 'prescription', 'medication', 'treatment', 'therapy',
  'cancer', 'diabetes', 'depression', 'anxiety', 'bipolar', 'schizophrenia',
  'hiv', 'aids', 'std', 'pregnancy', 'abortion', 'fertility',
  'blood pressure', 'heart rate', 'cholesterol', 'glucose',
  'doctor', 'hospital', 'clinic', 'pharmacy', 'insurance claim'
]

// Religion-related terms
const RELIGION_TERMS = [
  'prayer', 'worship', 'mosque', 'church', 'temple', 'synagogue',
  'bible', 'quran', 'torah', 'vedas', 'scripture',
  'halal', 'kosher', 'ramadan', 'eid', 'christmas', 'easter',
  'faith', 'belief', 'religion', 'spiritual', 'divine', 'god', 'allah'
]

// Sexuality-related terms
const SEXUALITY_TERMS = [
  'sexual orientation', 'gender identity', 'lgbtq', 'gay', 'lesbian',
  'bisexual', 'transgender', 'non-binary', 'queer', 'pride',
  'coming out', 'transition', 'hormone therapy'
]

interface RedactionResult {
  text: string
  redacted: boolean
  categories: string[]
}

function redactPatterns(text: string, patterns: RegExp[], replacement: string = '[REDACTED]'): string {
  let result = text
  for (const pattern of patterns) {
    result = result.replace(pattern, replacement)
  }
  return result
}

function detectCategories(text: string): string[] {
  const lower = text.toLowerCase()
  const categories: string[] = []

  if (HEALTH_TERMS.some(t => lower.includes(t.toLowerCase()))) categories.push('health')
  if (RELIGION_TERMS.some(t => lower.includes(t.toLowerCase()))) categories.push('religion')
  if (SEXUALITY_TERMS.some(t => lower.includes(t.toLowerCase()))) categories.push('sexuality')

  return categories
}

export function redactPII(text: string | null | undefined): string {
  if (!text) return text ?? ''

  let result = text

  // Redact PII patterns
  result = redactPatterns(result, [EMAIL_REGEX], '[EMAIL]')
  result = redactPatterns(result, [PHONE_REGEX], '[PHONE]')
  result = redactPatterns(result, [CREDIT_CARD_REGEX], '[CARD]')
  result = redactPatterns(result, [SSN_REGEX], '[SSN]')
  result = redactPatterns(result, [API_KEY_REGEX], '[API_KEY]')
  result = redactPatterns(result, [BEARER_TOKEN_REGEX], '[TOKEN]')

  return result
}

export function redactAndDetect(text: string): RedactionResult {
  if (!text) return { text: '', redacted: false, categories: [] }

  const categories = detectCategories(text)
  const redactedText = redactPII(text)
  const redacted = redactedText !== text

  return {
    text: redactedText,
    redacted,
    categories,
  }
}

/**
 * Redact special category data (GDPR Art 9)
 * More aggressive redaction for health, religion, sexuality
 */
export function redactSpecialCategories(text: string): string {
  if (!text) return text

  let result = redactPII(text)

  // Additional aggressive redaction for special categories
  const specialPatterns = [
    ...HEALTH_TERMS,
    ...RELIGION_TERMS,
    ...SEXUALITY_TERMS,
  ].map(term => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'))

  result = redactPatterns(result, specialPatterns, '[SENSITIVE]')

  return result
}

/**
 * Get redaction statistics for audit logging
 */
export function getRedactionStats(original: string, redacted: string): {
  originalLength: number
  redactedLength: number
  reductionPercent: number
} {
  return {
    originalLength: original.length,
    redactedLength: redacted.length,
    reductionPercent: original.length > 0
      ? Math.round(((original.length - redacted.length) / original.length) * 100)
      : 0,
  }
}