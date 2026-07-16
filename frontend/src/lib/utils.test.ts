import { describe, expect, it } from "vitest"

import { cn, stripInlineMarkdown } from "./utils"

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b")
  })

  it("drops falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c")
  })

  it("lets a later tailwind class win over an earlier conflicting one", () => {
    // The whole reason twMerge is here: `cn(base, override)` must let callers
    // override, not emit both and leave it to CSS order.
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("keeps non-conflicting tailwind classes", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4")
  })

  it("supports conditional object syntax", () => {
    expect(cn({ a: true, b: false })).toBe("a")
  })

  it("returns an empty string for no input", () => {
    expect(cn()).toBe("")
  })
})

describe("stripInlineMarkdown", () => {
  // The model sometimes wraps report fields in markdown the UI has already
  // styled; left in, it renders as literal asterisks to the user.
  it("removes ** bold **", () => {
    expect(stripInlineMarkdown("**bold**")).toBe("bold")
  })

  it("removes __bold__", () => {
    expect(stripInlineMarkdown("__bold__")).toBe("bold")
  })

  it("removes *italic*", () => {
    expect(stripInlineMarkdown("*italic*")).toBe("italic")
  })

  it("removes `code`", () => {
    expect(stripInlineMarkdown("`code`")).toBe("code")
  })

  it("removes a leading bullet", () => {
    expect(stripInlineMarkdown("- a point")).toBe("a point")
  })

  it("removes a leading heading marker", () => {
    expect(stripInlineMarkdown("## Heading")).toBe("Heading")
  })

  it("handles bold inside a sentence", () => {
    expect(stripInlineMarkdown("the **key** risk")).toBe("the key risk")
  })

  it("handles several markers at once", () => {
    expect(stripInlineMarkdown("- **bold** and *italic* and `code`")).toBe(
      "bold and italic and code",
    )
  })

  it("trims surrounding whitespace", () => {
    expect(stripInlineMarkdown("  spaced  ")).toBe("spaced")
  })

  it("leaves plain text untouched", () => {
    expect(stripInlineMarkdown("just text")).toBe("just text")
  })

  it("does not mangle a bare asterisk used as punctuation", () => {
    expect(stripInlineMarkdown("2 * 3 = 6")).toBe("2 * 3 = 6")
  })

  it("does not treat a mid-word underscore as markdown", () => {
    expect(stripInlineMarkdown("snake_case_name")).toBe("snake_case_name")
  })

  it.each([null, undefined, ""])("returns an empty string for %o", (input) => {
    expect(stripInlineMarkdown(input)).toBe("")
  })
})
