import Link from "next/link"
import { Button } from "@/components/misir/primitives/Button"
import { Icon } from "@/components/misir/primitives/Icon"

export default function DashboardNotFound() {
  return (
    <div className="mx-auto mt-24 max-w-md rounded-panel border border-border bg-bg p-8 text-center">
      <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full bg-bg-muted text-fg-subtle">
        <Icon name="compass" size={18} />
      </div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
        404
      </div>
      <h2 className="mb-2 font-display text-[22px] font-semibold tracking-tight text-fg">
        Not here.
      </h2>
      <p className="mb-5 text-[13px] leading-[1.55] text-fg-muted">
        The view or space you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/dashboard" className="inline-block">
        <Button variant="primary">
          <Icon name="arrow-left" size={12} />
          Back to dashboard
        </Button>
      </Link>
    </div>
  )
}
