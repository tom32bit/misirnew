"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[200] bg-[rgba(0,0,0,0.5)] backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "duration-200",
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-[50%] top-[50%] z-[201] translate-x-[-50%] translate-y-[-50%]",
          "flex max-h-[calc(100vh-48px)] w-[560px] max-w-[calc(100vw-32px)] flex-col overflow-hidden",
          "rounded-xl border border-[var(--border-strong)] bg-bg",
          "shadow-[var(--shadow-popover)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          "duration-200",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex items-start gap-3.5 border-b border-[var(--border)] px-6 pb-4 pt-5",
        className,
      )}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex flex-col gap-4 overflow-y-auto px-6 py-4", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex items-center justify-between gap-3 border-t border-[var(--border)] bg-bg-subtle px-6 py-3.5",
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("m-0 font-display text-[20px] font-medium tracking-[-0.3px] text-fg", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("m-0 max-w-[420px] text-[13px] leading-[1.55] text-fg-muted", className)}
      {...props}
    />
  )
}

function DialogCloseButton({ className }: { className?: string }) {
  return (
    <DialogClose
      data-slot="dialog-close"
      aria-label="Close"
      className={cn(
        "ml-auto grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-md",
        "text-fg-subtle hover:bg-[var(--bg-hover)] hover:text-fg",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-ring)]",
        "transition-colors",
        className,
      )}
    >
      <X size={14} />
    </DialogClose>
  )
}

export {
  Dialog, DialogTrigger, DialogPortal, DialogClose,
  DialogOverlay, DialogContent,
  DialogHeader, DialogBody, DialogFooter,
  DialogTitle, DialogDescription, DialogCloseButton,
}
