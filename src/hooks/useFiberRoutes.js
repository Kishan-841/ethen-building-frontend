'use client'

import { useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'

/** Fiber routes for the map layer — fetched once, only after first enable. */
export function useFiberRoutes(enabled) {
  const [routes, setRoutes] = useState([])
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!enabled || fetchedRef.current) return
    fetchedRef.current = true
    let cancelled = false
    apiClient
      .get('/fiber-routes')
      .then((res) => {
        if (!cancelled) setRoutes(res.data.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { routes }
}
