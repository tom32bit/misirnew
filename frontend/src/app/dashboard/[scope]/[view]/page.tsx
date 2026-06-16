import { notFound } from "next/navigation"
import { ViewDispatcher } from "@/components/misir/shell/ViewDispatcher"

const ALLOWED_VIEWS = [
  "home",
  "overview",
  "inbox",
  "notification",
  "collection",
  "comparison",
  "decision",
  "settings",
] as const
type ViewId = (typeof ALLOWED_VIEWS)[number]

function isView(v: string): v is ViewId {
  return (ALLOWED_VIEWS as readonly string[]).includes(v)
}

export default async function ViewPage(
  props: PageProps<"/dashboard/[scope]/[view]">,
) {
  const { scope, view } = await props.params
  if (!isView(view)) notFound()

  const scopeId = scope === "all" ? "all" : Number(scope)
  if (scopeId !== "all" && Number.isNaN(scopeId)) notFound()

  return <ViewDispatcher scope={scopeId} view={view} />
}
