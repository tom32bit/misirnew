import { defineConfig } from 'vitest/config'
import path from 'path'

// Separate project for the matching EVAL (eval/*.eval.ts). Kept out of the
// default `npm test` run because it loads the real ~140 MB Nomic model and does
// WASM inference — too slow/heavy for the unit loop. Run with `npm run eval`.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['eval/**/*.eval.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    // The model + WASM state is shared; run the single eval file in one worker.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
})
