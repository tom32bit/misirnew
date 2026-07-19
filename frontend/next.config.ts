import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Origin of the FastAPI backend the app talks to (REST + SSE chat stream).
// Read at config time (Node) so it can be allow-listed in connect-src.
function apiOrigin(): string {
  try {
    return process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
      : "";
  } catch {
    return "";
  }
}

// ── Content-Security-Policy ──────────────────────────────────────────────────
// Two policies, by design:
//
// 1) ENFORCED (Content-Security-Policy): only directives that cannot break
//    Clerk / Next.js / the API, because none of them gate script/style/connect
//    loading. These deliver real protection at zero risk — clickjacking
//    (frame-ancestors), <base> injection (base-uri), and plugin/object abuse
//    (object-src). upgrade-insecure-requests is prod-only so localhost (http)
//    dev keeps working.
//
// 2) REPORT-ONLY (Content-Security-Policy-Report-Only): the full target policy
//    incl. Clerk + the backend API. Shipped Report-Only so violations are
//    logged (DevTools / a future report endpoint) WITHOUT blocking anything —
//    the OWASP/MDN-recommended CSP rollout. Promote to enforced once the
//    console is clean; for a strict end state, move to nonce-based CSP in
//    proxy.ts (Next then auto-applies the nonce to its scripts incl. the
//    beforeInteractive theme bootstrap), which removes the need for
//    'unsafe-inline' below.
const enforcedCsp = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const api = apiOrigin();
const reportOnlyCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.misir.app https://accounts.misir.app",
  // Clerk SDK + Cloudflare Turnstile (Clerk bot protection). 'unsafe-eval' is
  // only needed in dev (React debug eval); never in prod. clerk.misir.app /
  // accounts.misir.app are the production custom-domain Frontend API + Account
  // portal (dev instances still use *.clerk.accounts.dev).
  "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.misir.app https://accounts.misir.app https://challenges.cloudflare.com" +
    (isDev ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://clerk.misir.app https://*.gravatar.com",
  "font-src 'self' data:", // next/font self-hosts, so no fonts.gstatic.com needed
  `connect-src 'self'${api ? " " + api : ""} https://*.clerk.accounts.dev https://*.clerk.com https://clerk.misir.app https://accounts.misir.app https://clerk-telemetry.com`,
  "worker-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.misir.app https://accounts.misir.app",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
  // HSTS — harmless over http (browsers ignore); enforces HTTPS once served
  // over TLS. Add `; preload` and submit to hstspreload.org as a separate opt-in.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" }, // legacy backstop for frame-ancestors
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

// ── PostHog reverse proxy ────────────────────────────────────────────────────
// Analytics traffic is served first-party under /ingest and rewritten to
// PostHog's ingestion + asset hosts. Benefits: (1) ad-blockers that block
// *.posthog.com don't blank our analytics, (2) the browser only ever talks to
// our own origin, so the CSP connect-src/script-src stay 'self' — no external
// hosts to allow-list. The upstream region is derived from NEXT_PUBLIC_POSTHOG_HOST
// (the project's home region, e.g. https://us.i.posthog.com or https://eu.i.posthog.com);
// its asset host is the same host with the i.→assets. swap PostHog uses.
function posthogUpstream(): { api: string; assets: string } {
  const fallback = "https://us.i.posthog.com";
  let api = fallback;
  try {
    api = process.env.NEXT_PUBLIC_POSTHOG_HOST
      ? new URL(process.env.NEXT_PUBLIC_POSTHOG_HOST).origin
      : fallback;
  } catch {
    api = fallback;
  }
  // us.i.posthog.com → us-assets.i.posthog.com ; eu.i.posthog.com → eu-assets.i.posthog.com
  const assets = api.replace("://us.i.", "://us-assets.i.").replace("://eu.i.", "://eu-assets.i.");
  return { api, assets };
}

const ph = posthogUpstream();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  // PostHog appends a trailing slash to some ingestion paths; without this Next
  // would 308-redirect and drop the payload.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // Static assets (array.js, recorder, toolbar) — must come first so the
      // more specific /static prefix wins over the catch-all below.
      { source: "/ingest/static/:path*", destination: `${ph.assets}/static/:path*` },
      { source: "/ingest/:path*", destination: `${ph.api}/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
