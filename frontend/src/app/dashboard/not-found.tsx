import Link from "next/link"

export default function DashboardNotFound() {
  return (
    <div className="mx-auto mt-24 max-w-md rounded-lg border border-border bg-bg p-8 text-center">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
        404
      </div>
      <h2 className="mb-2 font-display text-[22px] font-semibold tracking-tight text-fg">
        Not here.
      </h2>
      <p className="mb-5 text-[13px] leading-[1.55] text-fg-muted">
        The view or space you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1.5 text-[12.5px] font-medium text-fg-on-accent hover:bg-accent-hover"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
