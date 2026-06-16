"use client"

import { useUIStore } from "@/lib/stores/ui-store"
import { NewSpaceModal } from "./NewSpaceModal"
import { NewChatModal } from "./NewChatModal"

export function ModalRoot() {
  const modal = useUIStore((s) => s.modal)
  const closeModal = useUIStore((s) => s.closeModal)

  return (
    <>
      <NewSpaceModal
        open={modal?.kind === "new-space"}
        onClose={closeModal}
      />
      <NewChatModal
        open={modal?.kind === "new-chat"}
        defaultSpaceId={
          modal?.kind === "new-chat" ? modal.defaultSpaceId : undefined
        }
        onClose={closeModal}
      />
    </>
  )
}
