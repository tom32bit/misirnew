"use client"

import { Icon } from "@/components/misir/primitives/Icon"

export function ProConGrid({
  pros,
  cons,
}: {
  pros: string[]
  cons: string[]
}) {
  return (
    <div className="grid grid-cols-2 gap-3.5 mobile:grid-cols-1">
      <Column tone="success" title="Tailwinds for this path" items={pros} />
      <Column tone="danger" title="Headwinds against it" items={cons} />
    </div>
  )
}

function Column({
  tone,
  title,
  items,
}: {
  tone: "success" | "danger"
  title: string
  items: string[]
}) {
  const ringColor =
    tone === "success" ? "var(--color-success)" : "var(--color-danger)"
  const ringBg = `color-mix(in srgb, ${ringColor} 10%, transparent)`
  const icon = tone === "success" ? "check" : "x"

  return (
    <div
      className="overflow-hidden rounded-panel border border-border bg-bg"
      style={{ borderTop: `3px solid ${ringColor}` }}
    >
      <div className="flex items-center gap-2.5 border-b border-border px-[18px] py-3.5">
        <div
          className="grid h-[22px] w-[22px] place-items-center rounded-full"
          style={{ background: ringBg, color: ringColor }}
        >
          <Icon name={icon} size={13} />
        </div>
        <span className="font-display text-[14px] font-medium text-fg">{title}</span>
      </div>
      <ul className="m-0 list-none px-[22px] py-1.5">
        {items.map((t, i) => (
          <li
            key={i}
            className="flex gap-2.5 border-b border-border py-2.5 font-serif text-[13px] leading-[1.55] text-fg-muted last:border-b-0"
          >
            <span
              className="mt-[7px] block h-1.5 w-1.5 flex-none rounded-full opacity-55"
              style={{ background: ringColor }}
            />
            <span>{t}</span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-3 text-[12.5px] text-fg-subtle">Nothing here yet.</li>
        )}
      </ul>
    </div>
  )
}
