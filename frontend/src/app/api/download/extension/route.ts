import { NextResponse } from "next/server"

/**
 * Redirects to the packaged extension zip in Supabase Storage.
 *
 * Why a redirect rather than linking the storage URL directly from the page:
 *   - The URL stays server-side. It is deploy config, not part of the client
 *     bundle, so moving the file (new bucket, R2, a CDN) is one env var and no
 *     rebuild — every existing /install link keeps working.
 *   - It avoids a build-time dependency. `lib/env.ts` throws at module scope for
 *     a missing var and CI only sets NEXT_PUBLIC_API_URL, so a required public
 *     var here would break the build. Route handlers are always dynamic, so this
 *     is read per request instead.
 *
 * Set EXTENSION_ZIP_URL (server-side, NOT NEXT_PUBLIC_) to the public object
 * URL, e.g.
 *   https://<ref>.supabase.co/storage/v1/object/public/downloads/misir-extension-latest.zip
 */
export async function GET() {
  const url = process.env.EXTENSION_ZIP_URL

  if (!url) {
    // Explicit over a broken download: say what is unset rather than 404.
    return NextResponse.json(
      { error: "EXTENSION_ZIP_URL is not configured on this deployment." },
      { status: 503 },
    )
  }

  return NextResponse.redirect(url, 302)
}
