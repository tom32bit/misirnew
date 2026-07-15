/**
 * Validated public environment. Import API_URL from here instead of reading
 * `process.env.NEXT_PUBLIC_API_URL!` inline — the non-null assertion let a
 * missing var slip through to runtime as literal `undefined/...` request URLs.
 * Throwing at module scope surfaces the misconfiguration immediately (build or
 * first render) with a message that says exactly what to fix.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to frontend/.env.local (e.g. ${name}=http://localhost:8000/api/v1).`,
    )
  }
  return value
}

export const API_URL = requireEnv(
  "NEXT_PUBLIC_API_URL",
  process.env.NEXT_PUBLIC_API_URL,
).replace(/\/+$/, "")
