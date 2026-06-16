"use client"

import { ObBack, ObEyebrow, ObGhost, ObPrimary, StepWrap } from "./StepWrap"

const FEATURES = [
  "Saves articles, AI chat threads, PDFs, and posts to your spaces as you browse — one click.",
  "Reads your space markers and suggests where to file each capture automatically.",
  "Works on ChatGPT, Claude, Perplexity, Google, and any article page.",
]

export function StepExtension({
  onBack,
  onInstall,
  onSkip,
}: {
  onBack: () => void
  onInstall: () => void
  onSkip: () => void
}) {
  const installUrl =
    process.env.NEXT_PUBLIC_EXTENSION_INSTALL_URL ?? "https://chromewebstore.google.com/"

  const handleInstall = () => {
    // Open the store in a new tab, then advance to the setup overlay.
    if (typeof window !== "undefined") {
      window.open(installUrl, "_blank", "noopener,noreferrer")
    }
    onInstall()
  }

  return (
    <StepWrap>
      <ObEyebrow>One last thing</ObEyebrow>
      <h1 className="mb-9 font-display text-[42px] font-semibold leading-[1.15] tracking-[-0.03em] text-fg [text-wrap:pretty]">
        Get the extension.
        <br />
        It does the capturing.
      </h1>

      <div className="mb-8 overflow-hidden rounded-xl border border-border">
        <div className="flex items-center gap-4 border-b border-border px-6 py-5">
          <div className="grid h-[52px] w-[52px] flex-none place-items-center rounded-xl bg-accent">
            <svg
              viewBox="0 0 28 28"
              fill="none"
              className="h-7 w-7"
              aria-hidden
            >
              <path
                d="M14 4L6 8V14C6 18.4 9.6 22.5 14 24C18.4 22.5 22 18.4 22 14V8L14 4Z"
                stroke="white"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M10 14L13 17L18 11"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-display text-[16px] font-semibold tracking-[-0.01em] text-fg">
              Misir Capture
            </div>
            <div className="text-[12.5px] text-fg-muted">
              Chrome extension · Free · No account sync needed
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-6 py-5">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-3 text-[13.5px] leading-[1.5] text-fg-muted"
            >
              <span className="mt-2 h-[5px] w-[5px] flex-none rounded-full bg-accent" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3.5 border-t border-border bg-bg-subtle px-6 py-4">
          <ObPrimary onClick={handleInstall}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Add to Chrome
          </ObPrimary>
          <ObGhost onClick={onSkip}>I&apos;ll do this later</ObGhost>
        </div>
      </div>

      <div className="mt-0 flex items-center justify-start gap-3.5">
        <ObBack onClick={onBack} />
      </div>

    </StepWrap>
  )
}
