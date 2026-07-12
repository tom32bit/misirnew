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
import winkNLP, { type ItemToken, type ItemEntity } from 'wink-nlp'
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

// ── Learned-marker extraction ────────────────────────────────────────────────
// When a user corrects a page onto a subspace, we mine the page for "learnable"
// terms to persist as low-weight markers. This is where junk crept in before:
// dates ("december 1949"), ordinals ("first"), colours ("green"), and generic
// nouns ("minutes", "decades") got saved and then falsely matched other pages.
// A good marker is a topical NOUN/PROPN or a meaningful named entity — NOT a
// date, number, ordinal, or vague common word. wink's POS tags + entity types
// give us exactly that signal, so we gate on them rather than a brittle stoplist.

// Entity types that are never useful as topic markers.
const LEARN_DROP_ENTITY = new Set([
  'DATE', 'TIME', 'DURATION', 'CARDINAL', 'ORDINAL', 'MONEY', 'PERCENT',
  'HASHTAG', 'MENTION', 'EMAIL', 'URL', 'EMOJI', 'EMOTICON',
])

// Generic single words that are grammatically NOUN/PROPN but carry no topic —
// mostly temporal and quantity words. Multi-word phrases are exempt (a phrase
// like "release date" is fine); this only screens lone common words.
const LEARN_GENERIC = new Set([
  'second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'decade', 'century',
  'time', 'today', 'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening', 'night',
  'week', 'weekend', 'season', 'spring', 'summer', 'autumn', 'fall', 'winter',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september',
  'october', 'november', 'december',
  'number', 'amount', 'part', 'thing', 'stuff', 'way', 'lot', 'bit', 'kind', 'type',
  'example', 'people', 'person', 'someone', 'something', 'today', 'name', 'case',
  'page', 'site', 'website', 'article', 'post', 'user', 'assistant', 'reader',
  // bare colours read as topic-less (often POS-tagged NOUN/PROPN when capitalised)
  'green', 'blue', 'red', 'black', 'white', 'yellow', 'orange', 'purple', 'pink',
  'brown', 'grey', 'gray',
])

/**
 * Salient, TOPIC-worthy terms from a corrected page → learned markers.
 *
 * Keeps: meaningful named entities (people/orgs/places/products) and frequent
 * NOUN/PROPN lemmas. Drops: date/time/number entities, non-noun words (colours,
 * ordinals, verbs), anything containing a digit, and generic temporal/vague
 * words. Returns at most `limit` terms, strongest first. Needs the wink model
 * (POS/NER); without it we return nothing rather than persist unfiltered noise.
 */
export function extractLearnableTerms(text: string, limit = 8): string[] {
  if (!text) return []
  const nlp = getNlp()
  if (!nlp) return [] // no POS/NER available → don't learn junk

  try {
    const its = nlp.its
    const doc = nlp.readDoc(text.slice(0, MAX_NLP_CHARS))
    const seen = new Set<string>()
    const out: string[] = []

    const accept = (raw: string): boolean => {
      const w = raw.trim().toLowerCase()
      if (w.length < 4 || w.length > 40) return false
      // Letters, spaces and internal hyphens only — kills years, "1950s", codes.
      if (!/^[a-z]+(?:[ -][a-z]+)*$/.test(w)) return false
      if (seen.has(w)) return false
      // Screen lone generic words; allow multi-word phrases through.
      if (!w.includes(' ') && LEARN_GENERIC.has(w)) return false
      seen.add(w)
      out.push(w)
      return true
    }

    // 1) Meaningful named entities first (usually the most distinctive markers).
    doc.entities().each((e: ItemEntity) => {
      if (out.length >= limit) return
      const type = String(e.out(its.type as never) || '').toUpperCase()
      if (LEARN_DROP_ENTITY.has(type)) return
      accept(String(e.out(its.value) || ''))
    })

    // 2) Frequent NOUN / PROPN lemmas — real topic words, not adjectives,
    //    ordinals, or verbs (which is what let "green"/"first"/"fall" through).
    const freq = new Map<string, number>()
    doc.tokens().each((t: ItemToken) => {
      if (t.out(its.type) !== 'word') return
      if (t.out(its.stopWordFlag)) return
      const pos = String(t.out(its.pos as never) || '')
      if (pos !== 'NOUN' && pos !== 'PROPN') return
      const lemma = String(t.out(its.lemma as never) || t.out(its.normal) || '').toLowerCase()
      if (lemma.length < 4) return
      freq.set(lemma, (freq.get(lemma) || 0) + 1)
    })
    for (const [lemma] of [...freq.entries()].sort((a, b) => b[1] - a[1])) {
      if (out.length >= limit) break
      accept(lemma)
    }

    return out.slice(0, limit)
  } catch {
    return []
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
