/**
 * Node-side embedder for the matching eval harness.
 *
 * This deliberately RE-IMPLEMENTS the embedding calls from src/lib/embedder.ts
 * rather than importing it: the production module configures onnxruntime with
 * `chrome.runtime.getURL(...)` at import time, which throws outside a browser.
 * The *contract* below is kept byte-for-byte identical to production so the eval
 * measures the real matcher, not an approximation:
 *
 *   - model:   nomic-ai/nomic-embed-text-v1.5, 768 dims, q8 (int8) quantized
 *   - prefix:  "search_query: " for the page, "search_document: " for spaces
 *   - output:  mean-pooled, L2-normalized  → cosine == dot product
 *
 * First run downloads ~140 MB from the HF hub and caches it on disk
 * (env.cacheDir); later runs are offline-fast.
 */
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

export const NOMIC_MODEL = 'nomic-ai/nomic-embed-text-v1.5'

// Node has no browser cache; transformers.js falls back to a filesystem cache.
env.allowLocalModels = false
env.useBrowserCache = false

// Mirror the production char cap so query/doc truncation matches the extension.
export const MAX_EMBED_CHARS = 2000

let pipePromise: Promise<FeatureExtractionPipeline> | null = null

function loadEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!pipePromise) {
    // device: 'cpu' — transformers.js in Node runs onnxruntime-node, which only
    // supports cpu/dml (no wasm like the extension's offscreen doc). The
    // execution provider doesn't change the output: same q8 weights, same math,
    // so the cosines here match what the extension computes.
    pipePromise = pipeline('feature-extraction', NOMIC_MODEL, { dtype: 'q8', device: 'cpu' })
  }
  return pipePromise
}

async function embed(text: string, kind: 'query' | 'document'): Promise<number[]> {
  const extractor = await loadEmbedder()
  const prefix = kind === 'query' ? 'search_query: ' : 'search_document: '
  const out = await extractor(prefix + text.slice(0, MAX_EMBED_CHARS), {
    pooling: 'mean',
    normalize: true,
  })
  return Array.from(out.data as Float32Array)
}

export const embedQuery = (text: string) => embed(text, 'query')
export const embedDocument = (text: string) => embed(text, 'document')

/** Cosine similarity for L2-normalized vectors (== dot product). */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}
