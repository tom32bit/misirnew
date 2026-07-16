/**
 * The middleware matcher decides which URLs reach clerkMiddleware — and
 * therefore auth.protect(). Anything NOT exempt is treated as a page, so a
 * static asset that slips through gets a 307 to /sign-in instead of its bytes.
 * The browser reports no error: an <img> or <video> simply never renders.
 *
 * That is a real bug this repo shipped — /landing/end_hero.webm was auth-gated
 * because "webm" was missing from the extension list while images were present,
 * so the landing's closing video was invisible to exactly the signed-out
 * visitors the landing exists for.
 *
 * These tests walk the REAL public/ directory, so adding an asset with a new
 * extension fails here rather than silently 307ing in production.
 */
import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"

import { config } from "./proxy"

const PUBLIC_DIR = path.resolve(__dirname, "../public")

/**
 * Next compiles each matcher string with path-to-regexp. These patterns carry
 * no params (no `:id`), just a literal path plus an inline regex group, so
 * anchoring the string is a faithful stand-in and keeps the test free of Next
 * internals. assertPatternShape below fails if that assumption ever stops
 * holding.
 */
function toRegExp(matcher: string): RegExp {
  return new RegExp(`^${matcher}$`)
}

const [assetMatcher] = config.matcher
const runsMiddleware = (pathname: string) => toRegExp(assetMatcher).test(pathname)

/** Every file under public/, as the URL path it is served at. */
function publicAssetPaths(dir = PUBLIC_DIR, prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const url = `${prefix}/${entry.name}`
    return entry.isDirectory()
      ? publicAssetPaths(path.join(dir, entry.name), url)
      : [url]
  })
}

describe("middleware matcher", () => {
  it("uses a pattern shape that anchoring can model", () => {
    // If a matcher ever gains a path-to-regexp param (:id), toRegExp stops
    // being a faithful model and every assertion below becomes a lie. The
    // lookbehind skips regex non-capturing groups, "(?:", which are not params.
    expect(assetMatcher).not.toMatch(/(?<!\?):[a-zA-Z]/)
    expect(assetMatcher.startsWith("/")).toBe(true)
  })

  describe("static assets are exempt (no auth, no 307)", () => {
    const assets = publicAssetPaths()

    it("finds real files to check", () => {
      // Guards the guard: if public/ moved, the per-file assertions below would
      // vacuously pass on an empty list.
      expect(assets.length).toBeGreaterThan(0)
    })

    it.each(assets)("%s is served, not auth-gated", (asset) => {
      expect(runsMiddleware(asset)).toBe(false)
    })
  })

  describe("known asset types stay exempt", () => {
    // Spelled out so the intent survives even if public/ is reorganised. The
    // video entry is the specific regression.
    it.each([
      "/landing/end_hero.webm",
      "/landing/hero-image.png",
      "/landing/misir-logo.png",
      "/favicon.ico",
      "/favicon.svg",
      "/apple-touch-icon.png",
      "/site.webmanifest",
      "/fonts/Copernicus-Bold.ttf",
      "/some.mp4",
      "/some.webp",
      "/some.avif",
      "/some.woff2",
    ])("%s bypasses middleware", (asset) => {
      expect(runsMiddleware(asset)).toBe(false)
    })
  })

  describe("app routes still reach the middleware", () => {
    // The failure mode in the other direction: exempting too much would leave
    // authenticated pages unprotected, which is worse than a missing video.
    it.each([
      "/",
      "/dashboard",
      "/dashboard/24/overview",
      "/onboarding",
      "/sign-in",
      "/privacy",
      "/dashboard/chat/9",
    ])("%s is matched so auth can run", (route) => {
      expect(runsMiddleware(route)).toBe(true)
    })
  })

  it("does not exempt a path merely for containing a dot-extension in a query", () => {
    // [^?]* in the pattern stops "?x=.png" from smuggling a page past auth.
    expect(runsMiddleware("/dashboard")).toBe(true)
  })

  it("keeps api routes on their own matcher", () => {
    expect(config.matcher).toContain("/(api|trpc)(.*)")
  })
})
