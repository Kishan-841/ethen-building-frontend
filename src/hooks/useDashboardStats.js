'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

/** Dashboard stats, refetched when the operator/city filters change. */
export function useDashboardStats(operatorId = '', cityId = '') {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const params = {
      ...(operatorId && { operatorId }),
      ...(cityId && { cityId }),
    }
    apiClient
      .get('/stats/dashboard', { params })
      .then((res) => !cancelled && setStats(res.data.data))
      .catch(() => !cancelled && setError('Could not load dashboard stats'))
    return () => {
      cancelled = true
    }
  }, [operatorId, cityId])

  return { stats, error }
}
