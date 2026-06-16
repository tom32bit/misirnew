import { ChatThread } from "@/components/misir/chat/ChatThread"

export const dynamic = "force-dynamic"

export default async function ChatThreadPage(
  props: PageProps<"/dashboard/chat/[conversationId]">,
) {
  const { conversationId } = await props.params
  const id = Number(conversationId)
  if (Number.isNaN(id)) {
    return (
      <div className="rounded-lg border border-border bg-bg p-6 text-[13px] text-fg-muted">
        Invalid conversation id.
      </div>
    )
  }
  return <ChatThread conversationId={id} />
}
