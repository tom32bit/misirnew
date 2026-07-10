/**
 * NLP for the matching pre-gate — real tokenization, lemmatization, and named
 * entities via wink-nlp (English "lite web" model). Runs in the background
 * service worker only (matching.ts takes the result; content scripts never load
 * this, so the model isn't injected into every page).
 *
 * This is the FIRST gate in the pipeline: Readability extracts the page text,
 * wink lemmatizes it and pulls entities, and the matcher checks whether the page
 * hits any space's markers — BEFORE the (expensive) semantic embedding stage.
 */
import winkNLP, { type ItemToken } from 'wink-nlp'
import model from 'wink-eng-lite-web-model'

export interface NLPResult {
  /** Distinct content-word lemmas, lowercased (stopwords/punctuation removed). */
  tokens: string[]
  /** Named entities (value strings). */
  entities: string[]
  /** Most frequent content lemmas, for coarse keyword signals. */
  keywords: string[]
}

// Init lazily AND defensively: if winkNLP(model) ever throws (e.g. the model
// can't initialise in this context), it must NOT take down the whole service
// worker — matching degrades to the regex fallback instead.
let _nlp: ReturnType<typeof winkNLP> | null = null
let _nlpFailed = false
function getNlp(): ReturnType<typeof winkNLP> | null {
  if (_nlp || _nlpFailed) return _nlp
  try {
    _nlp = winkNLP(model)
  } catch {
    _nlpFailed = true
  }
  return _nlp
}

// Cap NLP input so a very long page can't stall the worker. Markers that matter
// almost always appear early, and whole-word marker matching scans the full text
// separately (see scoreMarker in matching.ts), so this only bounds the lemma set.
const MAX_NLP_CHARS = 100_000

export function processText(text: string): NLPResult {
  if (!text) return { tokens: [], entities: [], keywords: [] }

  const nlp = getNlp()
  if (!nlp) return fallbackProcess(text.slice(0, MAX_NLP_CHARS))

  try {
    const its = nlp.its
    const doc = nlp.readDoc(text.slice(0, MAX_NLP_CHARS))

    // Content lemmas: real words only, no stopwords, lemmatized + lowercased.
    const lemmas: string[] = []
    doc.tokens().each((t: ItemToken) => {
      if (t.out(its.type) !== 'word') return
      if (t.out(its.stopWordFlag)) return
      // its.lemma needs model addons; wink's `out` typing doesn't model that, so cast.
      const lemma = String(t.out(its.lemma as never) || t.out(its.normal) || '').toLowerCase()
      if (lemma.length > 2) lemmas.push(lemma)
    })

    const tokens = Array.from(new Set(lemmas))
    const entities = Array.from(new Set(doc.entities().out(its.value) as string[]))

    const freq = new Map<string, number>()
    for (const l of lemmas) freq.set(l, (freq.get(l) || 0) + 1)
    const keywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([word]) => word)

    return { tokens, entities, keywords }
  } catch {
    // Defensive: if the model ever fails to init, degrade to a plain tokenizer
    // rather than break matching entirely.
    return fallbackProcess(text.slice(0, MAX_NLP_CHARS))
  }
}

function fallbackProcess(text: string): NLPResult {
  const tokens = Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2 && !FALLBACK_STOP.has(t)),
    ),
  )
  return { tokens, entities: [], keywords: tokens.slice(0, 25) }
}

const FALLBACK_STOP = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'you', 'are', 'was', 'not',
  'have', 'from', 'they', 'but', 'his', 'her', 'she', 'him', 'our', 'their',
])
