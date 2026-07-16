/**
 * env.ts throws at module scope, so each case needs a fresh import with the
 * environment already stubbed — hence resetModules + dynamic import rather
 * than a top-level `import { API_URL }`.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function loadEnv() {
  vi.resetModules()
  return import("./env")
}

describe("API_URL", () => {
  it("is the configured value", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000/api/v1")
    expect((await loadEnv()).API_URL).toBe("http://localhost:8000/api/v1")
  })

  it("strips a trailing slash so callers can join paths safely", async () => {
    // ky's prefixUrl plus a "spaces" path would otherwise produce a double slash.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000/api/v1/")
    expect((await loadEnv()).API_URL).toBe("http://localhost:8000/api/v1")
  })

  it("strips several trailing slashes", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000/api/v1///")
    expect((await loadEnv()).API_URL).toBe("http://localhost:8000/api/v1")
  })

  it("leaves an internal slash alone", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/api/v1")
    expect((await loadEnv()).API_URL).toBe("https://api.example.com/api/v1")
  })

  describe("when unset", () => {
    it("throws rather than letting `undefined/...` reach a request", async () => {
      // The non-null assertion this replaced let a missing var through to
      // runtime as literal "undefined/spaces" URLs.
      vi.stubEnv("NEXT_PUBLIC_API_URL", "")
      await expect(loadEnv()).rejects.toThrow(/NEXT_PUBLIC_API_URL is not set/)
    })

    it("names the file and the fix in the message", async () => {
      vi.stubEnv("NEXT_PUBLIC_API_URL", "")
      await expect(loadEnv()).rejects.toThrow(/frontend\/\.env\.local/)
    })
  })
})
