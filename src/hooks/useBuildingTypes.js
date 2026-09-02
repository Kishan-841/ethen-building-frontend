'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

export function useBuildingTypes() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/building-types')
      .then((res) => {
        if (!cancelled) setTypes(res.data.data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { types, loading }
}
