import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import type { Space, Subspace, Marker } from '@/types'

interface DBStatus {
  spacesLoading: boolean
  subspacesLoading: boolean
  markersLoading: boolean
  spaces: Space[]
  subspaces: Subspace[]
  markers: Marker[]
  error: string | null
}

export function useDBStatus() {
  const [status, setStatus] = useState<DBStatus>({
    spacesLoading: true,
    subspacesLoading: true,
    markersLoading: true,
    spaces: [],
    subspaces: [],
    markers: [],
    error: null,
  })

  useEffect(() => {
    async function loadData() {
      try {
        setStatus((prev) => ({ ...prev, spacesLoading: true }))
        const spaces = await db.spaces.toArray()
        setStatus((prev) => ({
          ...prev,
          spaces,
          spacesLoading: false,
        }))
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load spaces',
          spacesLoading: false,
        }))
      }

      try {
        setStatus((prev) => ({ ...prev, subspacesLoading: true }))
        const subspaces = await db.subspaces.toArray()
        setStatus((prev) => ({
          ...prev,
          subspaces,
          subspacesLoading: false,
        }))
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load subspaces',
          subspacesLoading: false,
        }))
      }

      try {
        setStatus((prev) => ({ ...prev, markersLoading: true }))
        const markers = await db.markers.toArray()
        setStatus((prev) => ({
          ...prev,
          markers,
          markersLoading: false,
        }))
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load markers',
          markersLoading: false,
        }))
      }
    }

    loadData()

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30_000)
    return () => clearInterval(interval)
  }, [])

  return status
}
