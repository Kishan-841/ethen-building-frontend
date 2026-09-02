'use client'

import { createSessionResource } from '@/lib/session-resource'

const useCitiesResource = createSessionResource('/cities')

/** Full city list for admin forms and filter dropdowns, fetched once per session. */
export function useCities() {
  const { data, loading } = useCitiesResource()
  return { cities: data, loading }
}

export const invalidateCities = () => useCitiesResource.invalidate()
