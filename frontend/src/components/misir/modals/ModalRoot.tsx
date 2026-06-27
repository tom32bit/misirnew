"use client"

import { useUIStore } from "@/lib/stores/ui-store"
import { NewSpaceModal } from "./NewSpaceModal"
import { NewChatModal } from "./NewChatModal"
import { EditSpaceModal } from "./EditSpaceModal"

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
      <EditSpaceModal
        open={modal?.kind === "edit-space"}
        spaceId={modal?.kind === "edit-space" ? modal.spaceId : undefined}
        onClose={closeModal}
      />
    </>
  )
}
