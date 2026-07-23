import type { MetadataRoute } from "next"

// Only the genuinely public, indexable surface — matches proxy.ts's isPublic
// matcher minus sign-in/sign-up (noindexed, nothing to crawl) and the
// webhook/download/ingest API routes (not pages). /terms isn't a real route
// yet despite being in that matcher, so it's left out until it exists.
const SITE_URL = "https://www.misir.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/install`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy/do-not-sell`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ]
}
