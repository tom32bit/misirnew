import { Providers } from "../providers"

/**
 * Everything that needs a signed-in session or talks to the backend API lives
 * under this group: /sign-in, /sign-up, /onboarding, /dashboard/*. All of it
 * needs ClerkProvider — the client API layer (`lib/api/client.ts`) calls
 * Clerk's `useAuth().getToken()` on every request — and onboarding/dashboard
 * additionally need TanStack Query.
 *
 * The marketing route group ((marketing)/) deliberately has no layout here:
 * it calls no API and needs no auth, so it no longer downloads or mounts any
 * of this.
 */
export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <Providers>{children}</Providers>
}
