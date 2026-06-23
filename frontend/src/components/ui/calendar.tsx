"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar bg-bg-subtle p-3 [--cell-size:--spacing(8)]",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root:     cn("w-fit", defaultClassNames.root),
        months:   cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month:    cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav:      cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-40",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-40",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-[13px] font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative rounded-md border border-[var(--border-strong)] has-focus:border-[#61AAF2]",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("absolute inset-0 bg-bg-subtle opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "font-sans font-medium text-fg select-none",
          captionLayout === "label"
            ? "text-[13px]"
            : "flex h-8 items-center gap-1 rounded-md pr-1 pl-2 text-[13px] [&>svg]:size-3.5 [&>svg]:text-fg-subtle",
          defaultClassNames.caption_label,
        ),
        weekdays:           cn("flex", defaultClassNames.weekdays),
        weekday:            cn("flex-1 rounded-md text-[11px] font-medium text-fg-subtle select-none", defaultClassNames.weekday),
        week:               cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
        week_number:        cn("text-[11px] text-fg-faint select-none", defaultClassNames.week_number),
        day: cn(
          "group/day relative aspect-square h-full w-full p-0 text-center select-none",
          "[&:last-child[data-selected=true]_button]:rounded-r-md",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-md"
            : "[&:first-child[data-selected=true]_button]:rounded-l-md",
          defaultClassNames.day,
        ),
        range_start:  cn("rounded-l-md bg-[var(--color-accent-tint)]", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end:    cn("rounded-r-md bg-[var(--color-accent-tint)]", defaultClassNames.range_end),
        today:        cn("rounded-md bg-[var(--bg-muted)] data-[selected=true]:rounded-none", defaultClassNames.today),
        outside:      cn("text-fg-faint aria-selected:text-fg-faint", defaultClassNames.outside),
        disabled:     cn("text-fg-faint opacity-40", defaultClassNames.disabled),
        hidden:       cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />
        ),
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left")  return <ChevronLeftIcon  className={cn("size-4", className)} {...props} />
          if (orientation === "right") return <ChevronRightIcon className={cn("size-4", className)} {...props} />
          return <ChevronDownIcon className={cn("size-4", className)} {...props} />
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => (
          <td {...props}>
            <div className="flex size-(--cell-size) items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal",
        "data-[selected-single=true]:bg-accent data-[selected-single=true]:text-fg-on-accent",
        "data-[range-start=true]:rounded-l-md data-[range-start=true]:bg-accent data-[range-start=true]:text-fg-on-accent",
        "data-[range-end=true]:rounded-r-md data-[range-end=true]:bg-accent data-[range-end=true]:text-fg-on-accent",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-[var(--color-accent-soft)]",
        "group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:shadow-[0_0_0_2px_#61AAF2]",
        "[&>span]:text-[10px] [&>span]:opacity-70",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
