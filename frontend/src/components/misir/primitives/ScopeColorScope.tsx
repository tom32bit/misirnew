import type { CSSProperties, ElementType, ReactNode } from "react"

/**
 * Sets the `--sc` (space color) custom property on a wrapper so all
 * descendant Misir primitives (`SubspaceTag`, `SpaceTag`, dots, bars,
 * `colored` buttons) pick it up without prop-drilling.
 *
 * Mirrors the prototype's pattern of writing `style="--sc: #FF6C3C"` on
 * row/section roots.
 */
export function ScopeColorScope({
  color,
  as,
  className,
  style,
  children,
}: {
  color: string
  as?: ElementType
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const Tag = as ?? "div"
  const merged: CSSProperties = { ...style, ["--sc" as string]: color }
  return (
    <Tag className={className} style={merged}>
      {children}
    </Tag>
  )
}
