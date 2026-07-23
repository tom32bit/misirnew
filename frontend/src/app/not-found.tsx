import Link from "next/link"
import { Button } from "@/components/misir/primitives/Button"
import { Icon } from "@/components/misir/primitives/Icon"

// Root 404 — catches broken/typo'd links on the public surface (landing,
// /install, /privacy…). /dashboard has its own richer not-found.tsx for
// signed-in routes; this is what a signed-out visitor sees.
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="mx-auto max-w-md rounded-panel border border-border bg-bg p-8 text-center">
        <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full bg-bg-muted text-fg-subtle">
          <Icon name="compass" size={18} />
        </div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
          404
        </div>
        <h1 className="mb-2 font-display text-[22px] font-semibold tracking-tight text-fg">
          Not here.
        </h1>
        <p className="mb-5 text-[13px] leading-[1.55] text-fg-muted">
          That page doesn&apos;t exist, or it moved.
        </p>
        <Link href="/" className="inline-block">
          <Button variant="primary">
            <Icon name="arrow-left" size={12} />
            Back to Misir
          </Button>
        </Link>
      </div>
    </main>
  )
}
