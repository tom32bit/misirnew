import { describe, expect, it } from "vitest"

import { adaptCapture, adaptCaptures, adaptSubspaces, pad2 } from "./capture-adapters"
import type { Artifact, DashboardSubspaceStat, Subspace } from "./types"

/** Only the fields the adapters read. */
function artifact(p: Partial<Artifact> = {}): Artifact {
  return {
    id: 1,
    url: "https://example.com/a",
    domain: "example.com",
    title: "A title",
    platform: "web",
    space_id: 10,
    subspace_id: null,
    matched_marker_ids: [],
    metadata: {},
    captured_at: "2026-07-16T09:30:00.000Z",
    ...p,
  } as Artifact
}

function subspace(p: Partial<Subspace> = {}): Subspace {
  return { id: 1, space_id: 10, name: "Sub", description: null, ...p } as Subspace
}

const NOW = new Date("2026-07-16T12:00:00.000Z")

describe("pad2", () => {
  it("pads single digits and leaves two-digit values alone", () => {
    expect(pad2(0)).toBe("00")
    expect(pad2(9)).toBe("09")
    expect(pad2(10)).toBe("10")
    expect(pad2(59)).toBe("59")
  })
})

describe("adaptCapture", () => {
  describe("subspace resolution", () => {
    it("prefers the artifact's own subspace_id above everything else", () => {
      // The extension matched this on-device; nothing should second-guess it.
      const a = artifact({
        subspace_id: 7,
        metadata: { subspace_id: 99 },
        matched_marker_ids: [1, 2],
      })
      const subs = [subspace({ id: 42, marker_ids: [1, 2] })]
      expect(adaptCapture(a, NOW, subs).subspaceId).toBe(7)
    })

    it("falls back to legacy metadata.subspace_id when the column is null", () => {
      const a = artifact({ subspace_id: null, metadata: { subspace_id: 99 } })
      expect(adaptCapture(a, NOW).subspaceId).toBe(99)
    })

    it("falls back to marker overlap when neither id is present", () => {
      const a = artifact({ subspace_id: null, matched_marker_ids: [1, 2, 3] })
      const subs = [subspace({ id: 42, marker_ids: [1, 2, 3] })]
      expect(adaptCapture(a, NOW, subs).subspaceId).toBe(42)
    })

    it("ignores a non-numeric metadata.subspace_id", () => {
      const a = artifact({ subspace_id: null, metadata: { subspace_id: "99" } })
      expect(adaptCapture(a, NOW).subspaceId).toBeNull()
    })

    it("picks the subspace with the highest overlap ratio", () => {
      const a = artifact({ subspace_id: null, matched_marker_ids: [1, 2] })
      const subs = [
        subspace({ id: 1, marker_ids: [1, 9, 8, 7] }), // 1/4 = 0.25 — below threshold
        subspace({ id: 2, marker_ids: [1, 2] }), // 2/2 = 1.0
      ]
      expect(adaptCapture(a, NOW, subs).subspaceId).toBe(2)
    })

    it("requires at least 30% overlap", () => {
      // 1 of 4 markers = 0.25 — deliberately left unmatched rather than
      // force-fit, matching the repo's precision-over-recall rule.
      const a = artifact({ subspace_id: null, matched_marker_ids: [1] })
      const subs = [subspace({ id: 1, marker_ids: [1, 9, 8, 7] })]
      expect(adaptCapture(a, NOW, subs).subspaceId).toBeNull()
    })

    it("accepts overlap exactly at the 30% boundary", () => {
      // 3 of 10 = 0.3 — the threshold is >=, so this must match.
      const a = artifact({ subspace_id: null, matched_marker_ids: [1, 2, 3] })
      const subs = [subspace({ id: 1, marker_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })]
      expect(adaptCapture(a, NOW, subs).subspaceId).toBe(1)
    })

    it("is null when the artifact matched no markers", () => {
      const a = artifact({ subspace_id: null, matched_marker_ids: [] })
      const subs = [subspace({ id: 1, marker_ids: [1, 2] })]
      expect(adaptCapture(a, NOW, subs).subspaceId).toBeNull()
    })

    it("skips subspaces that have no markers instead of dividing by zero", () => {
      const a = artifact({ subspace_id: null, matched_marker_ids: [1] })
      const subs = [subspace({ id: 1, marker_ids: [] }), subspace({ id: 2, marker_ids: [1] })]
      expect(adaptCapture(a, NOW, subs).subspaceId).toBe(2)
    })
  })

  describe("date bucket", () => {
    const at = (iso: string) => adaptCapture(artifact({ captured_at: iso }), NOW).date

    it("labels the same calendar day Today", () => {
      expect(at("2026-07-16T01:00:00.000Z")).toBe("Today")
    })

    it("labels the previous calendar day Yesterday", () => {
      expect(at("2026-07-15T12:00:00.000Z")).toBe("Yesterday")
    })

    it("uses Nd ago inside the last week", () => {
      expect(at("2026-07-13T12:00:00.000Z")).toBe("3d ago")
    })

    it("switches to a date once a week old", () => {
      // 7 days is the cliff: no longer "6d ago".
      expect(at("2026-07-09T12:00:00.000Z")).not.toMatch(/ago/)
    })

    it("treats a future timestamp as Today rather than a negative day count", () => {
      expect(at("2026-07-17T12:00:00.000Z")).toBe("Today")
    })
  })

  describe("revisit count", () => {
    it("is undefined when the artifact was only opened once", () => {
      // The original open is not a revisit.
      const a = artifact({ artifact_open_event: [{ count: 1 }] } as Partial<Artifact>)
      expect(adaptCapture(a, NOW).revisit).toBeUndefined()
    })

    it("is undefined when there are no open events", () => {
      expect(adaptCapture(artifact(), NOW).revisit).toBeUndefined()
    })

    it("excludes the original open from the count", () => {
      const a = artifact({ artifact_open_event: [{ count: 4 }] } as Partial<Artifact>)
      expect(adaptCapture(a, NOW).revisit).toBe(3)
    })
  })

  describe("marker label", () => {
    it("prefers metadata.marker_label", () => {
      const a = artifact({
        metadata: { marker_label: "Chosen", matched_markers: ["Other"] },
      })
      expect(adaptCapture(a, NOW).marker).toBe("Chosen")
    })

    it("falls back to a string entry in matched_markers", () => {
      const a = artifact({ metadata: { matched_markers: ["From array"] } })
      expect(adaptCapture(a, NOW).marker).toBe("From array")
    })

    it("reads .label off an object entry in matched_markers", () => {
      const a = artifact({ metadata: { matched_markers: [{ label: "Labelled" }] } })
      expect(adaptCapture(a, NOW).marker).toBe("Labelled")
    })

    it("falls back to the first tag", () => {
      const a = artifact({ artifact_tag: [{ tag: "tagged" }] } as Partial<Artifact>)
      expect(adaptCapture(a, NOW).marker).toBe("tagged")
    })

    it("is an empty string when nothing is available", () => {
      expect(adaptCapture(artifact(), NOW).marker).toBe("")
    })

    it("ignores a non-string label on an object entry", () => {
      const a = artifact({ metadata: { matched_markers: [{ label: 42 }] } })
      expect(adaptCapture(a, NOW).marker).toBe("")
    })
  })

  it("falls back to the url when the artifact has no title", () => {
    const a = artifact({ title: null, url: "https://example.com/no-title" })
    expect(adaptCapture(a, NOW).title).toBe("https://example.com/no-title")
  })

  it("stringifies the id so it can key a list", () => {
    expect(adaptCapture(artifact({ id: 12 }), NOW).id).toBe("12")
  })
})

describe("adaptCaptures", () => {
  it("maps every artifact, preserving order", () => {
    const out = adaptCaptures([artifact({ id: 1 }), artifact({ id: 2 })], NOW)
    expect(out.map((c) => c.id)).toEqual(["1", "2"])
  })

  it("returns an empty array for no artifacts", () => {
    expect(adaptCaptures([], NOW)).toEqual([])
  })
})

describe("adaptSubspaces", () => {
  const stat = (p: Partial<DashboardSubspaceStat> = {}): DashboardSubspaceStat => ({
    id: 1,
    name: "Sub",
    captures: 0,
    completeness: 0,
    last_captured_at: null,
    ...p,
  })

  const daysAgo = (n: number) =>
    new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

  it("prefers the backend stat over locally attributed artifacts", () => {
    // The backend joins markers properly; local attribution is the fallback.
    const subs = [subspace({ id: 1 })]
    const arts = [artifact({ subspace_id: 1 }), artifact({ subspace_id: 1 })]
    const out = adaptSubspaces(subs, arts, undefined, [stat({ id: 1, captures: 99 })], NOW)
    expect(out[0].captures).toBe(99)
  })

  it("falls back to counting owned artifacts when no stat exists", () => {
    const subs = [subspace({ id: 1 })]
    const arts = [artifact({ subspace_id: 1 }), artifact({ subspace_id: 1 })]
    expect(adaptSubspaces(subs, arts, undefined, [], NOW)[0].captures).toBe(2)
  })

  it("attributes artifacts via legacy metadata.subspace_id too", () => {
    const subs = [subspace({ id: 5 })]
    const arts = [artifact({ subspace_id: null, metadata: { subspace_id: 5 } })]
    expect(adaptSubspaces(subs, arts, undefined, [], NOW)[0].captures).toBe(1)
  })

  it("does not attribute an artifact belonging to another subspace", () => {
    const subs = [subspace({ id: 1 })]
    const arts = [artifact({ subspace_id: 2 })]
    expect(adaptSubspaces(subs, arts, undefined, [], NOW)[0].captures).toBe(0)
  })

  describe("weekDelta", () => {
    it("is last7 minus prior7 on the month view", () => {
      const subs = [subspace({ id: 1 })]
      const arts = [
        artifact({ subspace_id: 1, captured_at: daysAgo(1) }),
        artifact({ subspace_id: 1, captured_at: daysAgo(2) }),
        artifact({ subspace_id: 1, captured_at: daysAgo(9) }), // prior week
      ]
      const out = adaptSubspaces(subs, arts, undefined, [], NOW, "month")
      expect(out[0].weekDelta).toBe(1) // 2 - 1
    })

    it("ignores the prior week outside the month view", () => {
      // week/today payloads stop at 7d, so a prior7 count would always be 0 and
      // make every delta look positive. Asserting the guard holds.
      const subs = [subspace({ id: 1 })]
      const arts = [
        artifact({ subspace_id: 1, captured_at: daysAgo(1) }),
        artifact({ subspace_id: 1, captured_at: daysAgo(9) }),
      ]
      const out = adaptSubspaces(subs, arts, undefined, [], NOW, "week")
      expect(out[0].weekDelta).toBe(1) // last7 = 1, prior7 forced to 0
    })
  })

  describe("completeness and flags", () => {
    it("clamps a stat completeness above 100", () => {
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        [],
        undefined,
        [stat({ id: 1, completeness: 150 })],
        NOW,
      )
      expect(out[0].completeness).toBe(100)
    })

    it("clamps a negative stat completeness to 0", () => {
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        [],
        undefined,
        [stat({ id: 1, completeness: -20 })],
        NOW,
      )
      expect(out[0].completeness).toBe(0)
    })

    it("estimates completeness from capture count without a stat", () => {
      const arts = [artifact({ subspace_id: 1 }), artifact({ subspace_id: 1 })]
      const out = adaptSubspaces([subspace({ id: 1 })], arts, undefined, [], NOW)
      expect(out[0].completeness).toBe(20) // 2 captures * 10
    })

    it("flags critical below 25% completeness", () => {
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        [],
        undefined,
        [stat({ id: 1, completeness: 24 })],
        NOW,
      )
      expect(out[0].flag).toBe("critical")
      expect(out[0].flagNote).toBeTruthy()
    })

    it("flags low below 40% only when nothing landed this week", () => {
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        [],
        undefined,
        [stat({ id: 1, completeness: 30 })],
        NOW,
      )
      expect(out[0].flag).toBe("low")
    })

    it("does not flag low when captures arrived this week", () => {
      const arts = [artifact({ subspace_id: 1, captured_at: daysAgo(1) })]
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        arts,
        undefined,
        [stat({ id: 1, completeness: 30 })],
        NOW,
      )
      expect(out[0].flag).toBeUndefined()
    })

    it("leaves a healthy subspace unflagged and unnoted", () => {
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        [],
        undefined,
        [stat({ id: 1, completeness: 80 })],
        NOW,
      )
      expect(out[0].flag).toBeUndefined()
      expect(out[0].flagNote).toBeUndefined()
    })
  })

  describe("lastHit", () => {
    it("prefers the stat's last_captured_at", () => {
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        [],
        undefined,
        [stat({ id: 1, last_captured_at: new Date(NOW.getTime() - 30 * 60_000).toISOString() })],
        NOW,
      )
      expect(out[0].lastHit).toBe("30m ago")
    })

    it("falls back to the most recent owned artifact", () => {
      const arts = [
        artifact({ subspace_id: 1, captured_at: daysAgo(3) }),
        artifact({ subspace_id: 1, captured_at: new Date(NOW.getTime() - 2 * 60 * 60_000).toISOString() }),
      ]
      expect(adaptSubspaces([subspace({ id: 1 })], arts, undefined, [], NOW)[0].lastHit).toBe("2h ago")
    })

    it("is an em dash when nothing was ever captured", () => {
      expect(adaptSubspaces([subspace({ id: 1 })], [], undefined, [], NOW)[0].lastHit).toBe("—")
    })

    it.each([
      [30_000, "just now"],
      [5 * 60_000, "5m ago"],
      [3 * 60 * 60_000, "3h ago"],
      [25 * 60 * 60_000, "Yesterday"],
      [3 * 24 * 60 * 60_000, "3d ago"],
      [14 * 24 * 60 * 60_000, "2w ago"],
    ])("renders %dms ago as %s", (ms, label) => {
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        [],
        undefined,
        [stat({ id: 1, last_captured_at: new Date(NOW.getTime() - ms).toISOString() })],
        NOW,
      )
      expect(out[0].lastHit).toBe(label)
    })

    it("shows an em dash for an unparseable timestamp rather than NaN", () => {
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        [],
        undefined,
        [stat({ id: 1, last_captured_at: "not a date" })],
        NOW,
      )
      expect(out[0].lastHit).toBe("—")
    })

    it("does not render a future timestamp as a negative age", () => {
      const out = adaptSubspaces(
        [subspace({ id: 1 })],
        [],
        undefined,
        [stat({ id: 1, last_captured_at: new Date(NOW.getTime() + 60_000).toISOString() })],
        NOW,
      )
      expect(out[0].lastHit).toBe("just now")
    })
  })

  it("returns an empty array when there are no subspaces", () => {
    expect(adaptSubspaces([], [artifact()], undefined, [], NOW)).toEqual([])
  })
})
