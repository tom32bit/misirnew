import type { MetadataRoute } from "next"

// Belt-and-suspenders alongside the per-route `robots: noindex` metadata
// (sign-in/up, /dashboard, /onboarding) — crawlers that ignore per-page meta
// still get steered off private/auth surfaces here.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/sign-in", "/sign-up", "/onboarding"],
    },
    sitemap: "https://www.misir.app/sitemap.xml",
  }
}
