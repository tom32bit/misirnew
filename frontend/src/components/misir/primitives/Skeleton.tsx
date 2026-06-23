"use client"

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-[var(--bg-muted)] ${className}`} />
  )
}
