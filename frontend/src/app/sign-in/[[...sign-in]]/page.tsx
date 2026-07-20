import { SignIn } from "@clerk/nextjs"
import { WarmBackend } from "@/components/misir/primitives/WarmBackend"

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg)] p-6">
      <SignIn />
      {/* Spend the API's cold start while the user types, not after. */}
      <WarmBackend />
    </main>
  )
}
