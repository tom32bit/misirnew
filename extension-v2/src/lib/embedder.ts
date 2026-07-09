/**
 * On-device embedder — Nomic (nomic-embed-text-v1.5) via transformers.js.
 *
 * Mirrors the backend embedding contract so client and server vectors are
 * comparable (see backend/infrastructure/services/embedding_service.py):
 *   - model:   nomic-ai/nomic-embed-text-v1.5, 768 dims
 *   - prefix:  "search_query: " for the page/chat, "search_document: " for spaces
 *   - output:  mean-pooled, L2-normalized → cosine == dot product
 *
 * Runs in the offscreen document (not the service worker) because it loads a
 * ~140 MB model and does WASM inference. Model files are fetched from the
 * Hugging Face hub on first use and cached by the browser.
 */
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

export const NOMIC_MODEL = 'nomic-ai/nomic-embed-text-v1.5'
export const EMBED_DIM = 768

// Fetch weights from the HF hub (not bundled); cache in the browser.
env.allowLocalModels = false
env.useBrowserCache = true
// Load the onnxruntime-web WASM from a CDN so we don't have to bundle/serve it.
const onnxWasm = env.backends?.onnx?.wasm
if (onnxWasm) onnxWasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/'

export type ProgressFn = (p: { status: string; progress?: number; file?: string }) => void

let pipePromise: Promise<FeatureExtractionPipeline> | null = null

export function loadEmbedder(onProgress?: ProgressFn): Promise<FeatureExtractionPipeline> {
  if (!pipePromise) {
    pipePromise = pipeline('feature-extraction', NOMIC_MODEL, {
      dtype: 'q8', // int8 quantized (~140 MB) — keeps the download manageable
      progress_callback: onProgress as unknown as undefined,
    }).catch((err) => {
      pipePromise = null // allow retry on failure
      throw err
    })
  }
  return pipePromise
}

async function embed(text: string, kind: 'query' | 'document'): Promise<number[]> {
  const extractor = await loadEmbedder()
  const prefix = kind === 'query' ? 'search_query: ' : 'search_document: '
  const out = await extractor(prefix + text, { pooling: 'mean', normalize: true })
  return Array.from(out.data as Float32Array)
}

export function embedQuery(text: string): Promise<number[]> {
  return embed(text, 'query')
}

export function embedDocument(text: string): Promise<number[]> {
  return embed(text, 'document')
}

/** Cosine similarity for L2-normalized vectors (== dot product). */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}
