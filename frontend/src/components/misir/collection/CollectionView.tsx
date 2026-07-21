"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Icon } from "@/components/misir/primitives/Icon"
import {
  Card,
  SectionHead,
} from "@/components/misir/primitives/Card"
import {
  FilterBar,
  FilterCount,
  Segmented,
  type SegmentOption,
} from "@/components/misir/primitives/FilterBar"
import { Chip } from "@/components/misir/primitives/Chip"
import { SubspaceTag, SpaceTag } from "@/components/misir/primitives/Tag"
import { Skeleton } from "@/components/misir/primitives/Skeleton"
import { useArtifacts, useDeleteArtifact } from "@/lib/hooks/useArtifacts"
import { useSpaces } from "@/lib/hooks/useSpaces"
import { useSubspaces } from "@/lib/hooks/useSubspaces"
import { usePeriodParams } from "@/lib/hooks/usePeriodParams"
import { adaptCaptures, type CaptureVM } from "@/lib/api/capture-adapters"
import { undoableAction } from "@/lib/undoable"
import type { Artifact } from "@/lib/api/types"
import { getSpaceColor } from "@/lib/constants/space-colors"
import { getSubspaceColor } from "@/lib/constants/subspace-colors"
import type { PlatformType, Space, Subspace } from "@/lib/api/types"

type Scope = "all" | number

type TypeKey = "all" | "article" | "aichat" | "pdf" | "video" | "post"

const TYPE_LABEL: Record<TypeKey, string> = {
  all: "All",
  article: "Articles",
  aichat: "AI chats",
  pdf: "PDFs",
  video: "Videos",
  post: "Posts",
}

/**
 * Map a capture's design "type" back to the same TypeKey we filter on.
 * Mirrors the inverse of `captureType()` in surface-icons.ts.
 */
function classifyCapture(c: CaptureVM): Exclude<TypeKey, "all"> {
  switch (c.type) {
    case "AI chat":
      return "aichat"
    case "PDF":
      return "pdf"
    case "Video":
      return "video"
    case "Post":
      return "post"
    default:
      return "article"
  }
}

/** Debounce a string value by `delayMs`. Preserves focus on input fields. */
function useDebounced<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export function CollectionView({ scope }: { scope: Scope }) {
  const search = useSearchParams()
  const router = useRouter()
  const isAll = scope === "all"
  const { period, date, tzOffset } = usePeriodParams()

  const { data: spaces = [] } = useSpaces()

  const [typeFilter, setTypeFilter] = useState<TypeKey>("all")
  const [spaceFilter, setSpaceFilter] = useState<string>(
    isAll ? "all" : String(scope),
  )
  const [subFilter, setSubFilter] = useState<string>(
    search.get("sub") ?? "all",
  )
  const [query, setQuery] = useState<string>(search.get("q") ?? "")
  const debouncedQ = useDebounced(query, 200)

  // Honor `?sub=` deep-link from MisirAsks/SubspaceStatusList navigation.
  useEffect(() => {
    const fromUrl = search.get("sub")
    if (fromUrl && fromUrl !== subFilter) setSubFilter(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const effectiveSpaceId =
    isAll && spaceFilter !== "all"
      ? Number(spaceFilter)
      : !isAll
        ? (scope as number)
        : undefined

  // Subspaces picker is populated from whichever single space is in scope.
  const subspaces = useSubspaces(effectiveSpaceId ?? null)

  const artifactOpts = {
    spaceId: effectiveSpaceId,
    period,
    date,
    tzOffset,
    q: debouncedQ.trim() || undefined,
    limit: 200,
  }
  const artifacts = useArtifacts(artifactOpts)
  const deleteArtifact = useDeleteArtifact(artifactOpts)
  const qc = useQueryClient()

  // House destructive pattern: remove from the cache instantly, offer Undo,
  // and only hit the API once the toast closes un-undone.
  const handleDelete = (id: string) => {
    const idNum = Number(id)
    const cap = captures.find((c) => c.id === id)
    qc.setQueryData<Artifact[]>(["artifacts", artifactOpts], (old) =>
      old?.filter((a) => a.id !== idNum),
    )
    undoableAction({
      message: "Capture deleted",
      description: cap?.title,
      onUndo: () => qc.invalidateQueries({ queryKey: ["artifacts", artifactOpts] }),
      onCommit: () =>
        deleteArtifact.mutate(idNum, {
          onError: () => {
            toast.error("Delete failed", { description: "The capture was restored." })
            qc.invalidateQueries({ queryKey: ["artifacts", artifactOpts] })
          },
        }),
    })
  }

  // Computed inline — React Compiler memoizes these itself; the previous
  // manual useMemo chain tripped react-hooks/preserve-manual-memoization
  // (the compiler couldn't reproduce it, so compilation was skipped).
  // `now` is mount-stable so the derivation stays pure.
  const [now] = useState(() => new Date())
  const captures = adaptCaptures(artifacts.data ?? [], now, subspaces.data ?? [])

  // Counts per type (over the unfiltered fetched set so the segment labels
  // don't shrink to 0 as the user clicks).
  const typeCounts: Record<TypeKey, number> = {
    all: captures.length,
    article: 0,
    aichat: 0,
    pdf: 0,
    video: 0,
    post: 0,
  }
  for (const cap of captures) typeCounts[classifyCapture(cap)]++

  const filtered = captures
    .filter((c) =>
      typeFilter === "all" ? true : classifyCapture(c) === typeFilter,
    )
    .filter((c) =>
      subFilter === "all"
        ? true
        : String(c.subspaceId ?? "—") === subFilter,
    )

  // Group by date label ("Today", "Yesterday", "2d ago", "Aug 14"…)
  const groupMap = new Map<string, CaptureVM[]>()
  for (const c of filtered) {
    const list = groupMap.get(c.date) ?? []
    list.push(c)
    groupMap.set(c.date, list)
  }
  const groups: Array<[string, CaptureVM[]]> = Array.from(groupMap.entries())

  const segOpts: SegmentOption<TypeKey>[] = (Object.keys(TYPE_LABEL) as TypeKey[]).map(
    (k) => ({ value: k, label: TYPE_LABEL[k], count: typeCounts[k] }),
  )

  return (
    <>
      <SectionHead
        icon="library"
        title="Collection"
        small="Everything the extension captured"
        right={
          <span className="font-sans text-[11px] text-fg-subtle tabular-nums">
            {captures.length} total
          </span>
        }
      />

      <Card className="p-0 overflow-hidden">
        <FilterBar>
          {/* Type tabs are the primary filter; on phones they scroll on their
              own full-width row (scrollbar hidden) instead of pushing the
              search/selects off-screen. */}
          <Segmented
            value={typeFilter}
            onChange={setTypeFilter}
            options={segOpts}
            className="mobile:max-w-full mobile:overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />

          {isAll && spaces.length > 0 && (
            <select
              value={spaceFilter}
              onChange={(e) => {
                setSpaceFilter(e.target.value)
                setSubFilter("all")
              }}
              className="h-8 cursor-pointer rounded-lg border border-border bg-bg px-2.5 text-[12.5px] text-fg outline-none transition-colors hover:border-border-strong focus:border-[var(--color-accent)]"
            >
              <option value="all">All spaces</option>
              {spaces.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {(!isAll || spaceFilter !== "all") && (
            <select
              value={subFilter}
              onChange={(e) => {
                setSubFilter(e.target.value)
                const sp = new URLSearchParams(search.toString())
                if (e.target.value === "all") sp.delete("sub")
                else sp.set("sub", e.target.value)
                const qs = sp.toString()
                router.replace(qs ? `?${qs}` : "?")
              }}
              className="h-8 cursor-pointer rounded-lg border border-border bg-bg px-2.5 text-[12.5px] text-fg outline-none transition-colors hover:border-border-strong focus:border-[var(--color-accent)]"
            >
              <option value="all">All subspaces</option>
              {(subspaces.data ?? []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            placeholder="Search title, marker, source…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 min-w-[200px] rounded-lg border border-border bg-bg px-2.5 text-[12.5px] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-[var(--color-accent)] mobile:min-w-0 mobile:flex-1"
          />
          <FilterCount>
            {filtered.length} of {captures.length}
          </FilterCount>
        </FilterBar>

        {artifacts.isLoading && !artifacts.data ? (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <CaptureRowSkeleton key={i} />
            ))}
          </>
        ) : artifacts.isError ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="text-[13px] font-medium text-fg">Couldn&apos;t load captures</div>
            <div className="text-[12.5px] text-fg-muted">Check your connection and try again.</div>
            <button
              onClick={() => artifacts.refetch()}
              className="mt-1 rounded-md border border-border-strong bg-bg px-4 py-2 text-[13px] text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-8 text-center text-[13px] text-fg-subtle">
            {captures.length === 0
              ? "No captures yet. Install the extension to start capturing."
              : "No captures match."}
          </div>
        ) : (
          groups.map(([date, items]) => (
            <DateGroup
              key={date}
              date={date}
              items={items}
              spaces={spaces}
              subspaces={subspaces.data ?? []}
              isAll={isAll}
              onDelete={handleDelete}
            />
          ))
        )}
      </Card>
    </>
  )
}

function CaptureRowSkeleton() {
  return (
    <div
      className="grid items-center gap-3.5 border-b border-border px-4 py-2.5 mobile:grid-cols-[44px_1fr_auto] mobile:gap-2"
      style={{ gridTemplateColumns: "60px 110px 1fr auto" }}
    >
      <Skeleton className="h-3 w-10" />
      <Skeleton className="h-3 w-20 mobile:hidden" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-3 w-44" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  )
}

function DateGroup({
  date,
  items,
  spaces,
  subspaces,
  isAll,
  onDelete,
}: {
  date: string
  items: CaptureVM[]
  spaces: Space[]
  subspaces: Subspace[]
  isAll: boolean
  onDelete: (id: string) => void
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 border-b border-border bg-bg-subtle px-[18px] py-2.5 font-sans text-[10.5px] font-medium uppercase tracking-[0.1em] text-fg-subtle">
        {date}
        <span className="text-fg-faint tabular-nums">{items.length}</span>
      </div>
      {items.map((c) => (
        <CaptureRow
          key={c.id}
          capture={c}
          subspace={
            c.subspaceId != null
              ? subspaces.find((s) => s.id === c.subspaceId) ?? null
              : null
          }
          space={
            isAll && c.spaceId != null
              ? spaces.find((s) => s.id === c.spaceId) ?? null
              : null
          }
          isAll={isAll}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

function CaptureRow({
  capture,
  subspace,
  space,
  isAll,
  onDelete,
}: {
  capture: CaptureVM
  subspace: Subspace | null
  space: Space | null
  isAll: boolean
  onDelete: (id: string) => void
}) {
  const subspaceColor = subspace ? getSubspaceColor(subspace) : undefined
  const spaceColor = space ? getSpaceColor(space) : undefined

  return (
    <div
      className="group grid items-center gap-3.5 border-b border-border px-4 py-3 last:border-b-0 hover:bg-bg-muted mobile:grid-cols-[44px_1fr_auto] mobile:gap-2"
      style={{ gridTemplateColumns: "60px 110px 1fr auto auto" }}
    >
      <div className="whitespace-nowrap font-sans text-[11px] tabular-nums text-fg-subtle">
        {capture.time}
      </div>
      <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap font-sans text-[11px] text-fg-muted mobile:hidden">
        <Icon name={capture.surfaceIcon} size={12} />
        {capture.surface}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Chip variant="type">{capture.type.toLowerCase()}</Chip>
        <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
          {capture.title}
        </span>
        {capture.revisit && (
          <Chip variant="revisit">×{capture.revisit} revisited</Chip>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {capture.marker && <Chip variant="marker">{capture.marker}</Chip>}
        {subspace && (
          <SubspaceTag color={subspaceColor}>{subspace.name}</SubspaceTag>
        )}
        {isAll && space && (
          <SpaceTag color={spaceColor}>{space.name}</SpaceTag>
        )}
      </div>
      <div className="flex items-center gap-1">
        {/* No confirm step — deletion is optimistic and undoable via toast. */}
        <button
          onClick={() => onDelete(capture.id)}
          className="opacity-0 group-hover:opacity-100 rounded p-1 text-fg-faint transition-opacity hover:text-[var(--color-danger)]"
          aria-label="Delete capture"
        >
          <Icon name="trash-2" size={13} />
        </button>
      </div>
    </div>
  )
}
