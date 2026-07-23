import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublic = createRouteMatcher([
  // Exactly "/" — the landing page. Signed-out visitors must reach it, while the
  // page itself redirects signed-in users on to /dashboard. Not "/(.*)", which
  // would make the entire app public.
  "/",
  // The install guide + its download redirect. Linked from the landing page, so
  // signed-out visitors must reach both — auth-gating them would mean you had to
  // sign in before you could install the thing that does the capturing.
  "/install",
  "/api/download(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  // Crawlers never authenticate, so these must stay reachable — otherwise
  // every search engine gets bounced to /sign-in instead of the real file.
  // Not covered by the matcher's extension exclusions below since .xml/.txt
  // aren't in that list (by design — see the comment on `config.matcher`).
  "/sitemap.xml",
  "/robots.txt",
  // PostHog reverse proxy (see rewrites in next.config.ts). Analytics ingestion
  // must never be auth-gated — a signed-out landing-page visitor generates
  // pageview/autocapture events too, and auth.protect() would 307 them to
  // /sign-in so the beacon never reaches PostHog.
  "/ingest(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect()
})

export const config = {
  matcher: [
    // Run on every route except Next internals and static files.
    //
    // Every asset the landing serves to signed-out visitors must have its
    // extension listed here. Anything missing is treated as a page, hits
    // auth.protect() below, and 307s to /sign-in — so an <img>/<video> silently
    // receives a redirect instead of bytes and just never renders. That is what
    // happened to the landing's end_hero.webm: images were excluded, video was
    // not. Media extensions are listed even when unused today so the next asset
    // dropped into public/ does not trip the same wire.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|avif|png|gif|svg|mp4|webm|ogv|mov|mp3|wav|ogg|ttf|otf|woff2?|eot|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
