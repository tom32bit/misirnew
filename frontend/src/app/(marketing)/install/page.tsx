import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import "@/components/landing/landing.css"

export const metadata: Metadata = {
  title: "Install the Misir extension",
  description:
    "Install the Misir Chrome extension — it captures what you read and ask AI, and matches it to your decisions on-device.",
}

/**
 * Public install guide. Reached from the landing nav and the dashboard sidebar,
 * so it is allowlisted in proxy.ts.
 *
 * Styled with the landing design system (.landing) rather than the app's
 * tokens: it sits behind a link on the landing page, so it should read as the
 * same site, not as the dashboard.
 *
 * These are Load-unpacked instructions on purpose — Chromium auto-disables any
 * .crx installed from outside the Web Store and the user cannot re-enable it,
 * so unpacked is the supported route until the extension is listed.
 */
const STEPS = [
  {
    title: "Download and unzip",
    body: "Unzip it somewhere permanent. Chrome loads the extension from this folder every time it starts, so don't use a temp folder or delete it afterwards.",
  },
  {
    title: "Open the extensions page",
    body: "Paste chrome://extensions into your address bar and press Enter. Chrome blocks links from opening it, so it has to be pasted.",
  },
  {
    title: "Turn on Developer mode",
    body: "The toggle is top-right of that page. Unpacked extensions only load while it's on.",
  },
  {
    title: "Click Load unpacked",
    body: "Top-left. Choose the folder you unzipped — the one with manifest.json directly inside it.",
  },
  {
    title: "Sign in, then pin it",
    body: "Sign in to Misir in this browser; the extension reads your session from the site. Then pin it from the puzzle-piece menu so it's one click away.",
  },
]

export default async function InstallPage() {
  // The page is public (reachable signed-out from the landing nav), but a
  // signed-in visitor arrives from the dashboard sidebar — so the nav has to
  // reflect who's looking. Showing "Sign in" to someone already signed in, with
  // no way back to the dashboard, was the bug.
  const { userId } = await auth()
  const signedIn = Boolean(userId)

  return (
    <div className="landing">
      <nav className="top">
        <div className="wrap nav-inner">
          <Link href={signedIn ? "/dashboard" : "/"} className="wordmark">
            <Image src="/landing/misir-logo.png" alt="" width={22} height={22} />
            Misir
          </Link>
          <div className="nav-links">
            <Link href="/privacy" className="quiet">Privacy</Link>
            {signedIn ? (
              <Link href="/dashboard" className="btn btn-ghost sm">← Dashboard</Link>
            ) : (
              <>
                <Link href="/" className="quiet">Home</Link>
                <Link href="/sign-in" className="btn btn-ghost sm">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section>
        <div className="wrap section-pad">
          <div className="install">
            <div className="eyebrow accent">Chrome extension</div>
            <h1 className="h2">Install Misir.</h1>
            <p className="install-lead">
              Misir reads along while you browse and chat with AI, works out which of your
              decisions each page belongs to, and files it there — <b>all on your machine</b>.
              The extension is how it sees any of that.
            </p>

            <div className="hero-ctas">
              <a href="/api/download/extension" className="btn btn-primary" download>
                Download for Chrome — 7.3 MB
              </a>
            </div>
            <p className="hero-note">Chrome · Edge · Brave · any Chromium browser</p>

            <ol className="install-steps">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="n">{i + 1}</span>
                  <div>
                    <h2>{step.title}</h2>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="install-notes">
              <p>
                <b>The first capture is slow.</b> Misir downloads its ~140&nbsp;MB language
                model once and caches it in your browser. That model is what reads pages on
                your device — nothing you don&apos;t save is ever uploaded.
              </p>
              <p>
                <b>Updates are manual for now.</b> While the extension is unlisted, Chrome
                won&apos;t update it for you. We&apos;ll tell you when there&apos;s a new
                build — download again and hit Reload on the extensions page.
              </p>
              <p>
                <b>Chrome will warn about developer mode.</b> It says that about anything not
                installed from its store. Dismiss it; the extension keeps working.
              </p>
            </div>

            <p className="install-legal">
              Capture is off until you turn it on, per purpose.{" "}
              <Link href="/privacy">See how we handle your data</Link>.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot">
          <span className="wordmark">
            <Image src="/landing/misir-logo.png" alt="" width={22} height={22} />
            Misir
          </span>
          <div className="right">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/privacy/do-not-sell">Do Not Sell/Share</Link>
            <span>© 2026 Misir</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
