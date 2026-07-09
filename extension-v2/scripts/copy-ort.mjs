// Copies the onnxruntime-web artifacts that transformers.js needs into
// public/ort/ so they're served from the extension itself (MV3 forbids loading
// the ORT glue as remote code). Kept out of git; regenerated on install/build.
import { mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', '@huggingface', 'transformers', 'dist')
const dest = join(root, 'public', 'ort')
const files = ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']

mkdirSync(dest, { recursive: true })
for (const f of files) {
  try {
    copyFileSync(join(src, f), join(dest, f))
  } catch (err) {
    console.warn(`[copy-ort] could not copy ${f}:`, err.message)
  }
}
console.log('[copy-ort] onnxruntime artifacts ready in public/ort/')
