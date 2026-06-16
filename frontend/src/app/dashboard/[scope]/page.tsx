import { redirect } from "next/navigation"

export default async function ScopeIndex(
  props: PageProps<"/dashboard/[scope]">,
) {
  const { scope } = await props.params
  redirect(`/dashboard/${scope}/overview`)
}
