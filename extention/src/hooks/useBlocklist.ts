import { useState, useEffect, useCallback } from 'react'
import { getBlocklist, setBlocklist, DEFAULT_BLOCKLIST } from '@/lib/blocklist'

export function useBlocklist() {
  const [list, setList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBlocklist().then((l) => {
      setList(l)
      setLoading(false)
    })
  }, [])

  const add = useCallback(
    async (raw: string) => {
      const domain = raw
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
      if (!domain || list.includes(domain)) return
      const next = [...list, domain]
      await setBlocklist(next)
      setList(next)
    },
    [list],
  )

  const remove = useCallback(
    async (domain: string) => {
      const next = list.filter((d) => d !== domain)
      await setBlocklist(next)
      setList(next)
    },
    [list],
  )

  const reset = useCallback(async () => {
    await setBlocklist(DEFAULT_BLOCKLIST)
    setList(DEFAULT_BLOCKLIST)
  }, [])

  const replaceAll = useCallback(async (incoming: string[]) => {
    await setBlocklist(incoming)
    setList(incoming)
  }, [])

  return { list, loading, add, remove, reset, setList: replaceAll, defaults: DEFAULT_BLOCKLIST }
}
