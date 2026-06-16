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
  "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com",
  // Clerk SDK + Cloudflare Turnstile (Clerk bot protection). 'unsafe-eval' is
  // only needed in dev (React debug eval); never in prod.
  "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com" +
    (isDev ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://*.gravatar.com",
  "font-src 'self' data:", // next/font self-hosts, so no fonts.gstatic.com needed
  `connect-src 'self'${api ? " " + api : ""} https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com`,
  "worker-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com",
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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
    ],
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
