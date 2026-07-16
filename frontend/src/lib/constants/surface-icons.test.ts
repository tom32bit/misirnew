import { describe, expect, it } from "vitest"

import { captureType, platformLabel, surfaceIcon, surfaceLabel } from "./surface-icons"

type Src = { platform?: string; domain?: string | null; url?: string }

describe("platformLabel", () => {
  it.each([
    ["chatgpt", "ChatGPT"],
    ["notebooklm", "NotebookLM"],
    ["deepseek", "DeepSeek"],
    ["youtube", "YouTube"],
    ["web", "Web"],
  ])("renders the canonical name for %s", (key, label) => {
    expect(platformLabel(key)).toBe(label)
  })

  it("normalises the capitalised form the backend sometimes emits", () => {
    // Whole point of the map: one platform must never appear spelled two ways.
    expect(platformLabel("Chatgpt")).toBe("ChatGPT")
    expect(platformLabel("chatgpt")).toBe("ChatGPT")
  })

  it("strips a trailing colon", () => {
    expect(platformLabel("claude:")).toBe("Claude")
  })

  it("trims surrounding whitespace", () => {
    expect(platformLabel("  gemini  ")).toBe("Gemini")
  })

  it("capitalises an unknown platform rather than dropping it", () => {
    expect(platformLabel("mistral")).toBe("Mistral")
  })

  it.each([null, undefined, "", "   "])("renders an em dash for %o", (key) => {
    expect(platformLabel(key)).toBe("—")
  })
})

describe("surfaceIcon", () => {
  it.each(["claude", "chatgpt", "gemini", "perplexity", "deepseek", "grok", "copilot", "notebooklm", "kimi"])(
    "uses the chat icon for %s",
    (platform) => {
      expect(surfaceIcon({ platform } as Src)).toBe("messages-square")
    },
  )

  it("uses the play icon for youtube by platform or domain", () => {
    expect(surfaceIcon({ platform: "youtube" } as Src)).toBe("play")
    expect(surfaceIcon({ platform: "web", domain: "m.youtube.com" } as Src)).toBe("play")
  })

  it.each(["x.com", "twitter.com", "www.linkedin.com"])("uses the social icon for %s", (domain) => {
    expect(surfaceIcon({ platform: "web", domain } as Src)).toBe("at-sign")
  })

  it("uses the document icon for a pdf url or a .gov domain", () => {
    expect(surfaceIcon({ platform: "web", url: "https://a.com/paper.PDF" } as Src)).toBe("file-text")
    expect(surfaceIcon({ platform: "web", domain: "sec.gov" } as Src)).toBe("file-text")
  })

  it("falls back to the globe icon", () => {
    expect(surfaceIcon({ platform: "web", domain: "example.com" } as Src)).toBe("globe")
  })

  it("does not crash on a fully empty artifact", () => {
    expect(surfaceIcon({} as Src)).toBe("globe")
  })

  it("prefers the AI-chat icon even when the domain looks like something else", () => {
    // Platform is the stronger signal — an AI chat about a PDF is still a chat.
    expect(surfaceIcon({ platform: "claude", url: "https://a.com/x.pdf" } as Src)).toBe("messages-square")
  })
})

describe("captureType", () => {
  it("labels AI platforms as AI chat", () => {
    expect(captureType({ platform: "claude" } as Src)).toBe("AI chat")
  })

  it("labels youtube as Video", () => {
    expect(captureType({ platform: "youtube" } as Src)).toBe("Video")
    expect(captureType({ platform: "web", domain: "youtube.com" } as Src)).toBe("Video")
  })

  it("labels social domains as Post", () => {
    expect(captureType({ platform: "web", domain: "x.com" } as Src)).toBe("Post")
  })

  it("labels pdfs and .gov as PDF", () => {
    expect(captureType({ platform: "web", url: "https://a.com/f.pdf" } as Src)).toBe("PDF")
    expect(captureType({ platform: "web", domain: "irs.gov" } as Src)).toBe("PDF")
  })

  it("is case-insensitive about the pdf extension", () => {
    expect(captureType({ platform: "web", url: "https://a.com/F.PDF" } as Src)).toBe("PDF")
  })

  it("defaults to Article", () => {
    expect(captureType({ platform: "web", domain: "example.com" } as Src)).toBe("Article")
  })
})

describe("surfaceLabel", () => {
  it("prefers the domain", () => {
    expect(surfaceLabel({ domain: "claude.ai", url: "https://other.com/x" } as Src)).toBe("claude.ai")
  })

  it("extracts the host from the url when there is no domain", () => {
    expect(surfaceLabel({ url: "https://bloomberg.com/a/b" } as Src)).toBe("bloomberg.com")
  })

  it("strips a www. prefix", () => {
    expect(surfaceLabel({ url: "https://www.example.com/x" } as Src)).toBe("example.com")
  })

  it("keeps a non-leading www", () => {
    expect(surfaceLabel({ url: "https://wwww.example.com/x" } as Src)).toBe("wwww.example.com")
  })

  it("returns an em dash for a malformed url instead of throwing", () => {
    expect(surfaceLabel({ url: "not-a-url" } as Src)).toBe("—")
  })

  it("returns an em dash when there is neither domain nor url", () => {
    expect(surfaceLabel({} as Src)).toBe("—")
  })
})
