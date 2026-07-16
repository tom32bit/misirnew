/**
 * These adapters produce the percentages a user acts on. The repo's first
 * convention is that every number a user sees is computed deterministically,
 * never by the LLM — so the rule that matters here is that the canonical
 * backend value wins whenever it exists, and the client-side estimate is only
 * ever a fallback for old or empty payloads.
 */
import { describe, expect, it } from "vitest"

import {
  countCriticalGaps,
  deriveReadiness,
  gapSeverityTone,
  sumCaptures,
} from "./adapters"
import type { DashboardPayload, Gap } from "./types"

const gap = (severity: Gap["severity"]): Gap => ({ severity }) as Gap

/** Only the fields these adapters read; the full payload is far larger. */
const dash = (p: Partial<DashboardPayload>): DashboardPayload =>
  p as DashboardPayload

describe("deriveReadiness", () => {
  describe("canonical backend value", () => {
    it("prefers synthesis.readiness", () => {
      expect(deriveReadiness(dash({ synthesis: { readiness: 73 } as never }))).toBe(73)
    })

    it("falls back to misirs_read.coverage when synthesis has no readiness", () => {
      expect(deriveReadiness(dash({ misirs_read: { coverage: 61 } as never }))).toBe(61)
    })

    it("prefers synthesis.readiness over misirs_read.coverage when both exist", () => {
      // Both surfaces must show the same number, and synthesis is the source.
      const d = dash({
        synthesis: { readiness: 80 } as never,
        misirs_read: { coverage: 20 } as never,
      })
      expect(deriveReadiness(d)).toBe(80)
    })

    it("ignores gaps entirely once a canonical value is present", () => {
      // The fallback's gap penalty must not double-count: the backend has
      // already accounted for gaps in its own readiness.
      const d = dash({
        synthesis: { readiness: 90 } as never,
        gaps: [gap("Critical"), gap("Critical"), gap("High")],
      })
      expect(deriveReadiness(d)).toBe(90)
    })

    it("rounds a fractional canonical value", () => {
      expect(deriveReadiness(dash({ synthesis: { readiness: 72.6 } as never }))).toBe(73)
    })

    it("clamps a canonical value above 100", () => {
      expect(deriveReadiness(dash({ synthesis: { readiness: 140 } as never }))).toBe(100)
    })

    it("clamps a negative canonical value to 0", () => {
      expect(deriveReadiness(dash({ synthesis: { readiness: -5 } as never }))).toBe(0)
    })

    it("treats a canonical 0 as a real value, not a missing one", () => {
      // The nullish-coalescing chain must not confuse 0 with absent — a genuine
      // 0% readiness would otherwise silently become the estimate instead.
      const d = dash({
        synthesis: { readiness: 0 } as never,
        research_depth: [{ pct: 90 } as never],
      })
      expect(deriveReadiness(d)).toBe(0)
    })
  })

  describe("client-side fallback", () => {
    it("averages research_depth when no canonical value exists", () => {
      const d = dash({ research_depth: [{ pct: 60 }, { pct: 80 }] as never })
      expect(deriveReadiness(d)).toBe(70)
    })

    it("subtracts 10 per Critical gap", () => {
      const d = dash({
        research_depth: [{ pct: 80 }] as never,
        gaps: [gap("Critical"), gap("Critical")],
      })
      expect(deriveReadiness(d)).toBe(60)
    })

    it("subtracts 4 per High gap", () => {
      const d = dash({
        research_depth: [{ pct: 80 }] as never,
        gaps: [gap("High"), gap("High")],
      })
      expect(deriveReadiness(d)).toBe(72)
    })

    it("does not penalise Medium gaps", () => {
      const d = dash({
        research_depth: [{ pct: 80 }] as never,
        gaps: [gap("Medium"), gap("Medium")],
      })
      expect(deriveReadiness(d)).toBe(80)
    })

    it("never returns a negative number when penalties exceed depth", () => {
      const d = dash({
        research_depth: [{ pct: 10 }] as never,
        gaps: [gap("Critical"), gap("Critical")],
      })
      expect(deriveReadiness(d)).toBe(0)
    })

    it("treats a missing pct as 0 rather than NaN", () => {
      // A NaN would render as "NaN%" on the dashboard.
      const d = dash({ research_depth: [{ pct: 60 }, {}] as never })
      expect(deriveReadiness(d)).toBe(30)
    })

    it("returns 0 for an empty research_depth instead of dividing by zero", () => {
      expect(deriveReadiness(dash({ research_depth: [] }))).toBe(0)
    })
  })

  it("returns 0 for an undefined dashboard", () => {
    expect(deriveReadiness(undefined)).toBe(0)
  })

  it("returns 0 for an empty payload", () => {
    expect(deriveReadiness(dash({}))).toBe(0)
  })
})

describe("countCriticalGaps", () => {
  it("counts only Critical", () => {
    const d = dash({ gaps: [gap("Critical"), gap("High"), gap("Critical"), gap("Medium")] })
    expect(countCriticalGaps(d)).toBe(2)
  })

  it("is 0 for no gaps, undefined gaps, or an undefined dashboard", () => {
    expect(countCriticalGaps(dash({ gaps: [] }))).toBe(0)
    expect(countCriticalGaps(dash({}))).toBe(0)
    expect(countCriticalGaps(undefined)).toBe(0)
  })
})

describe("sumCaptures", () => {
  it("counts activity rows", () => {
    expect(sumCaptures(dash({ activity: [{}, {}, {}] as never }))).toBe(3)
  })

  it("is 0 for an empty or undefined dashboard", () => {
    expect(sumCaptures(dash({}))).toBe(0)
    expect(sumCaptures(undefined)).toBe(0)
  })
})

describe("gapSeverityTone", () => {
  it.each([
    ["Critical", "critical"],
    ["High", "warning"],
    ["Medium", "info"],
  ] as const)("maps %s to %s", (severity, tone) => {
    expect(gapSeverityTone(gap(severity))).toBe(tone)
  })
})
