import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

// Standalone config — deliberately does not load next.config.ts. Next's config
// is for building the app; these tests exercise plain modules, so all they need
// is the `@` → src alias that tsconfig declares and JSX support for the
// component/hook tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // .next holds a copy of the source graph; without this, tests get collected
    // twice and fail on generated output.
    exclude: ["node_modules/**", ".next/**"],
    restoreMocks: true,
  },
})
