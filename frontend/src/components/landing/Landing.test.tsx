/**
 * The landing is the only page a signed-out visitor sees, and its whole job is
 * to hand them to Clerk. These tests pin that wiring: if a CTA stops pointing
 * at /sign-in or /sign-up, the funnel is broken and nothing else here matters.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Landing } from "./Landing"

beforeEach(() => {
  // jsdom implements neither; Landing reads matchMedia for reduced-motion and
  // feature-detects IntersectionObserver (falling back to revealing everything,
  // which is what we want under test).
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }))
})

const hrefs = (name: RegExp) =>
  screen.getAllByRole("link", { name }).map((l) => l.getAttribute("href"))

describe("Landing", () => {
  describe("auth entry points", () => {
    it("sends Sign in to /sign-in", () => {
      render(<Landing />)
      expect(hrefs(/^sign in$/i)).not.toHaveLength(0)
      hrefs(/^sign in$/i).forEach((href) => expect(href).toBe("/sign-in"))
    })

    it("sends the beta CTAs to /sign-up", () => {
      render(<Landing />)
      const beta = hrefs(/beta/i)
      expect(beta).not.toHaveLength(0)
      beta.forEach((href) => expect(href).toBe("/sign-up"))
    })

    it("offers a beta CTA in the header and again at the foot of the page", () => {
      // A 4700px page with only a top CTA makes the reader scroll back up.
      render(<Landing />)
      expect(hrefs(/beta/i).length).toBeGreaterThan(1)
    })

    it("points every auth link at a real route", () => {
      // /sign-in and /sign-up exist; a typo'd href would 404 silently.
      render(<Landing />)
      const auth = screen
        .getAllByRole("link")
        .map((l) => l.getAttribute("href"))
        .filter((h) => h?.startsWith("/sign"))
      expect(auth.length).toBeGreaterThan(0)
      auth.forEach((href) => expect(["/sign-in", "/sign-up"]).toContain(href))
    })
  })

  describe("legal links", () => {
    it("links the privacy policy", () => {
      render(<Landing />)
      expect(hrefs(/privacy policy/i)).toContain("/privacy")
    })

    it("links the do-not-sell page", () => {
      render(<Landing />)
      expect(hrefs(/do not sell/i)).toContain("/privacy/do-not-sell")
    })
  })

  describe("closing video", () => {
    it("renders the hero video muted, looping and inline so it can autoplay", () => {
      // Browsers block autoplay unless the video is muted + playsInline; drop
      // either and the closing hero silently freezes on frame one.
      const { container } = render(<Landing />)
      const video = container.querySelector("video")
      expect(video).toBeTruthy()
      expect(video).toHaveAttribute("src", "/landing/end_hero.webm")
      expect(video?.muted).toBe(true)
      expect(video).toHaveAttribute("loop")
      expect(video).toHaveAttribute("playsinline")
    })

    it("gives the video an accessible label", () => {
      const { container } = render(<Landing />)
      expect(container.querySelector("video")).toHaveAttribute("aria-label")
    })
  })

  describe("mobile menu", () => {
    it("is closed initially", () => {
      render(<Landing />)
      expect(screen.getByRole("button", { name: /menu/i })).toHaveAttribute(
        "aria-expanded",
        "false",
      )
    })

    it("opens when the burger is clicked", async () => {
      render(<Landing />)
      const burger = screen.getByRole("button", { name: /menu/i })
      await userEvent.click(burger)
      expect(burger).toHaveAttribute("aria-expanded", "true")
    })

    it("closes again on a second click", async () => {
      render(<Landing />)
      const burger = screen.getByRole("button", { name: /menu/i })
      await userEvent.click(burger)
      await userEvent.click(burger)
      expect(burger).toHaveAttribute("aria-expanded", "false")
    })

    it("keeps a sign-in route inside the mobile menu", async () => {
      render(<Landing />)
      await userEvent.click(screen.getByRole("button", { name: /menu/i }))
      const menu = document.getElementById("mobile-menu")
      expect(menu).toBeTruthy()
      expect(
        within(menu as HTMLElement).getByRole("link", { name: /sign in/i }),
      ).toHaveAttribute("href", "/sign-in")
    })
  })

  it("renders without a real IntersectionObserver", () => {
    // The reveal animation is progressive enhancement: with no observer the
    // copy must still be in the document, not stuck at opacity 0 forever.
    expect(() => render(<Landing />)).not.toThrow()
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0)
  })
})
