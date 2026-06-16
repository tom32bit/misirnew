import winkNLP from 'wink-nlp'
// @ts-expect-error — no bundled types for this model
import model from 'wink-eng-lite-web-model'

const nlp = winkNLP(model)
const its = nlp.its

export interface NLPResult {
  keywords: string[]
  entities: string[]
}

export function processText(text: string): NLPResult {
  const doc = nlp.readDoc(text)

  // Lemmatized content words only (no stop words, no punctuation)
  const keywords = (
    doc
      .tokens()
      .filter(
        (t: ReturnType<typeof doc.tokens>[number]) =>
          t.out(its.type) === 'word' && !t.out(its.stopWordFlag),
      )
      .out(its.lemma) as string[]
  ).map((k: string) => k.toLowerCase())

  const entities = (doc.entities().out(its.value) as string[]).map((e: string) =>
    e.toLowerCase(),
  )

  return {
    keywords: [...new Set(keywords)],
    entities: [...new Set(entities)],
  }
}
