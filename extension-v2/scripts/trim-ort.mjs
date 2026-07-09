// Post-build: drop the duplicate onnxruntime .wasm that Vite emits into
// dist/assets/. transformers.js references the wasm by `import.meta.url`, so
// Vite bundles a hashed copy — but at runtime embedder.ts overrides
// `env.backends.onnx.wasm.wasmPaths` to the extension's own `ort/` directory
// (copy-ort.mjs), so the assets copy is never fetched. It's ~21 MB of dead
// weight in the packaged extension; remove it.
import { readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const assets = join(root, 'dist', 'assets')

let removed = 0
try {
  for (const f of readdirSync(assets)) {
    if (/^ort-wasm.*\.wasm$/.test(f)) {
      const p = join(assets, f)
      const mb = (statSync(p).size / 1024 / 1024).toFixed(1)
      rmSync(p)
      removed++
      console.log(`[trim-ort] removed dead dist/assets/${f} (${mb} MB) — served from dist/ort/ instead`)
    }
  }
} catch {
  /* no dist/assets yet — nothing to trim */
}
if (removed === 0) console.log('[trim-ort] no duplicate assets wasm to remove')
