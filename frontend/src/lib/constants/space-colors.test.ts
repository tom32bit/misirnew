import { describe, expect, it } from "vitest"

import { getSpaceColor } from "./space-colors"

const HEX = /^#[0-9A-F]{6}$/i

describe("getSpaceColor", () => {
  it("uses the seeded colour for a known prototype name", () => {
    expect(getSpaceColor({ id: 1, name: "Series A" })).toBe("#FF6C3C")
  })

  it("matches seeded names case-insensitively and ignores surrounding space", () => {
    expect(getSpaceColor({ id: 1, name: "  SERIES A  " })).toBe("#FF6C3C")
  })

  it("lets the seeded name win over the id hash", () => {
    // Two different ids, same seeded name — the name is the stronger signal.
    expect(getSpaceColor({ id: 1, name: "roadmap" })).toBe("#2A6A4A")
    expect(getSpaceColor({ id: 999, name: "roadmap" })).toBe("#2A6A4A")
  })

  it("is deterministic for the same id", () => {
    // The colour keys dots, rings and tags across surfaces; it must not drift
    // between renders or pages.
    const a = getSpaceColor({ id: 42, name: "Unseeded" })
    const b = getSpaceColor({ id: 42, name: "Unseeded" })
    expect(a).toBe(b)
  })

  it("ignores the name when it is not seeded, keying only off the id", () => {
    expect(getSpaceColor({ id: 42, name: "One name" })).toBe(
      getSpaceColor({ id: 42, name: "Totally different" }),
    )
  })

  it("treats a numeric and string id as the same space", () => {
    expect(getSpaceColor({ id: 7 })).toBe(getSpaceColor({ id: "7" }))
  })

  it("always returns a colour from the palette", () => {
    for (let id = 0; id < 50; id++) {
      expect(getSpaceColor({ id, name: "x" })).toMatch(HEX)
    }
  })

  it("spreads ids across more than one palette entry", () => {
    // A hash that collapsed to a single colour would still be deterministic but
    // would make every space look identical.
    const seen = new Set(
      Array.from({ length: 50 }, (_, id) => getSpaceColor({ id, name: "x" })),
    )
    expect(seen.size).toBeGreaterThan(1)
  })

  it.each([null, undefined])("falls back to the accent colour for %o", (space) => {
    expect(getSpaceColor(space)).toBe("#FF6C3C")
  })

  it("handles a space with no name", () => {
    expect(getSpaceColor({ id: 3 })).toMatch(HEX)
  })

  it("handles a null name", () => {
    expect(getSpaceColor({ id: 3, name: null })).toMatch(HEX)
  })
})
