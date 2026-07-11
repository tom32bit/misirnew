# Matching eval harness

A regression gate for **match quality**. It runs a set of golden fixtures
(`fixtures.json`) against a representative space corpus (`corpus.json`) through
the **real on-device Nomic model** and the **real matcher** (`findBestMatch` +
wink-nlp), then scores space/subspace accuracy and precision.

This is how we stop hand-tuning matching constants against a single anecdote.
Change `SEMANTIC_FLOOR` / `SUBSPACE_SEMANTIC_WEIGHT` / etc.? Run this and read the
scorecard — did precision hold? did any prior case regress?

## Run it

```bash
npm run eval
```

First run downloads ~140 MB (Nomic q8) and caches it on disk; later runs are
fast. It is deliberately **not** part of `npm test` (that suite stays fast and
offline with mocked cosines — see `src/lib/matching.test.ts`).

## What it checks

- **Precision (hard gate):** a `expect: null` fixture must NOT match anything.
  A leak here fails the run — false positives are the product's worst failure.
- **Space accuracy** and **subspace accuracy** across matchable fixtures must
  each stay at or above the floors in `matching.eval.ts`
  (`SPACE_ACCURACY_MIN`, `SUBSPACE_ACCURACY_MIN`). Raise these as quality
  improves so gains can't silently slip back.

The run prints a scorecard table (per case: expected vs. got vs. verdict).

## Add a case

Whenever you fix or get reported a mis-match, add a fixture — the fix becomes a
permanent guard.

1. In `fixtures.json`, add `{ id, note, expect, text }`.
   - `expect` refers to `corpus.json` entries **by name**:
     `{ "space": "DC Universe", "subspace": "Kryptonian biology" }`, or `null`
     for a page that should match nothing.
   - `text` is the page/chat body a user would have on screen (a paragraph or
     two is plenty; it's truncated to 2000 chars, same as production).
2. If the case needs a space/subspace/marker that isn't in the corpus yet, add
   it to `corpus.json` (mirrors real `space → subspace → markers`; markers are
   plain label strings).
3. `npm run eval`.

## How it mirrors production

`harness.ts` reproduces the exact wiring from `src/background/index.ts`:

| Production (`background/index.ts`) | Harness (`harness.ts`) |
| --- | --- |
| `subspaceDocText` / `spaceDocText`  | copied verbatim |
| `semanticScores` → cosine of query vs. doc vectors | `runCase` |
| `embedQuery` / `embedDocument` (prefix, mean-pool, L2-norm, q8) | `embed.ts` |
| `findBestMatch(text, processText(text), …)` | same call |

`embed.ts` re-implements the embedding calls instead of importing
`src/lib/embedder.ts` only because that module configures onnxruntime via
`chrome.runtime.getURL(...)` at import time, which can't run under Node. The
embedding contract (model, prefix, pooling, normalization, dtype) is identical.
