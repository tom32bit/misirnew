"use client"

import { useParams, useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "collection", label: "Collection" },
  { id: "comparison", label: "Comparison" },
  { id: "decision", label: "Decision tree" },
  { id: "settings", label: "Settings" },
] as const

export function SpaceTabNav() {
  const params = useParams<{ scope?: string; view?: string }>()
  const router = useRouter()

  const scope = params?.scope ?? "all"
  const view = params?.view ?? ""

  if (scope === "all") return null

  return (
    <div className="border-b border-border px-[18px]">
      <Tabs
        value={view}
        onValueChange={(v) => router.push(`/dashboard/${scope}/${v}`)}
        activationMode="manual"
      >
        <TabsList className="h-10 gap-0 rounded-none bg-transparent p-0">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={[
                "h-full rounded-none px-3 py-0",
                "text-[13px] font-medium text-fg-muted",
                "-mb-px border-b-2 border-transparent",
                "hover:text-fg transition-colors duration-150",
                "data-[state=active]:bg-transparent",
                "data-[state=active]:text-fg",
                "data-[state=active]:border-fg",
              ].join(" ")}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
