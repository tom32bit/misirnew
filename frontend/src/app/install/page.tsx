import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Install the Misir extension",
  description:
    "Install the Misir Chrome extension — it captures what you read and ask AI, and matches it to your decisions on-device.",
}

/**
 * Public install guide. Reachable signed-out (from the landing page) and
 * signed-in (from the dashboard), so it lives outside /dashboard and is
 * allowlisted in proxy.ts.
 *
 * These are Load-unpacked instructions on purpose: Chromium auto-disables any
 * .crx installed from outside the Web Store, and the user cannot re-enable it.
 * Unpacked is the supported route until the extension is listed.
 */
const STEPS = [
  {
    title: "Download and unzip",
    body: "Unzip it somewhere permanent — Chrome loads the extension from this folder every time it starts, so don't delete it or use a temp folder.",
  },
  {
    title: "Open chrome://extensions",
    body: "Paste chrome://extensions into your address bar and press Enter. Links can't open it for you — Chrome blocks that.",
  },
  {
    title: "Turn on Developer mode",
    body: "Top-right of that page. Unpacked extensions only load with it on.",
  },
  {
    title: 'Click "Load unpacked"',
    body: "Top-left. Select the folder you unzipped — the one containing manifest.json.",
  },
  {
    title: "Sign in, then pin it",
    body: "Sign in to Misir in this browser — the extension reads your session from the site. Then pin it from the puzzle-piece menu so it's one click away.",
  },
]

export default function InstallPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Install the Misir extension</h1>
      <p className="mt-3 text-muted-foreground">
        Misir captures what you read and ask AI, and works out which of your decisions it
        belongs to — on your machine. The extension is how it sees any of that.
      </p>

      <a
        href="/api/download/extension"
        className="mt-8 inline-flex items-center rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        download
      >
        Download for Chrome — 7.3 MB
      </a>
      <p className="mt-2 text-sm text-muted-foreground">
        Chrome, Edge, Brave, or any Chromium browser.
      </p>

      <ol className="mt-12 space-y-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium tabular-nums">
              {i + 1}
            </span>
            <div>
              <h2 className="font-medium">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 space-y-4 rounded-lg border p-5 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">First capture is slow.</strong> The extension
          downloads its ~140 MB language model once, from Hugging Face, and caches it in your
          browser. That model is what reads pages on your device — nothing you don&apos;t save
          is ever uploaded.
        </p>
        <p>
          <strong className="text-foreground">Updates are manual for now.</strong> While
          we&apos;re unlisted, Chrome won&apos;t auto-update it. We&apos;ll tell you when
          there&apos;s a new build — download again and hit Reload on the extensions page.
        </p>
        <p>
          <strong className="text-foreground">
            &quot;Disable developer mode extensions&quot;?
          </strong>{" "}
          Chrome warns about anything not installed from its store. Dismiss it — the extension
          keeps working.
        </p>
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Capture is off until you turn it on, per purpose. See{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          how we handle your data
        </Link>
        .
      </p>
    </main>
  )
}
