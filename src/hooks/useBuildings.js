'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

export function useBuildings(filters = {}) {
  const [buildings, setBuildings] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const filtersKey = JSON.stringify(filters)

  const fetchBuildings = useCallback(() => {
    setLoading(true)
    const params = Object.fromEntries(
      Object.entries(JSON.parse(filtersKey)).filter(([, v]) => v !== '' && v != null),
    )
    return apiClient
      .get('/buildings', { params })
      .then((res) => {
        setBuildings(res.data.data.items)
        setPagination(res.data.data.pagination)
      })
      .catch(() => {
        // Keep the last-known list rather than throwing an unhandled rejection
        // that would mis-render an empty registry.
        setPagination(null)
      })
      .finally(() => setLoading(false))
  }, [filtersKey])

  useEffect(() => {
    fetchBuildings()
  }, [fetchBuildings])

  return { buildings, pagination, loading, refetch: fetchBuildings }
}
