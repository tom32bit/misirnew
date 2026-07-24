import type { Metadata } from "next"
import { SignIn } from "@clerk/nextjs"
import { WarmBackend } from "@/components/misir/primitives/WarmBackend"

// A crawled sign-in form isn't shareable content, and it would otherwise
// inherit the landing's OG card — index the landing, not this.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg)] p-6">
      <SignIn />
      {/* Spend the API's cold start while the user types, not after. */}
      <WarmBackend />
    </main>
  )
}
