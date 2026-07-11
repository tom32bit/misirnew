import { defineConfig } from 'vitest/config'
import path from 'path'

// Standalone config for unit tests — deliberately does NOT load the crx/react
// plugins from vite.config.ts (they pull in the manifest + browser globals the
// matcher tests don't need). Just the `@` → src alias so imports resolve.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
