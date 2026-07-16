"use client"

import { useCallback, useEffect, useState } from "react"

export type Theme = "light" | "dark"

// Versioned deliberately. The app defaults to day; bumping the key from the
// legacy "misir.theme" retires every previously-saved preference in one shot,
// so anyone who had toggled to dark lands back on day once. New toggles persist
// under this key as normal. Keep this in sync with the bootstrap in layout.tsx.
const STORAGE_KEY = "misir.theme.v2"

function readTheme(): Theme {
  if (typeof document === "undefined") return "light"
  const attr = document.documentElement.getAttribute("data-theme")
  return attr === "dark" ? "dark" : "light"
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    setTheme(readTheme())
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark"
    document.documentElement.setAttribute("data-theme", next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore quota / privacy errors
    }
    setTheme(next)
  }, [])

  return [theme, toggle]
}
