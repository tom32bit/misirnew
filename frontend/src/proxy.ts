import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublic = createRouteMatcher([
  // Exactly "/" — the landing page. Signed-out visitors must reach it, while the
  // page itself redirects signed-in users on to /dashboard. Not "/(.*)", which
  // would make the entire app public.
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/privacy(.*)",
  "/terms(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect()
})

export const config = {
  matcher: [
    // Run on every route except Next internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
