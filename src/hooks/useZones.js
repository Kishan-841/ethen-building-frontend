'use client'

import { createSessionResource } from '@/lib/session-resource'

const useZonesResource = createSessionResource('/zones')

/** Zone list (role-scoped by the API), fetched once per session. */
export function useZones() {
  const { data, loading } = useZonesResource()
  return { zones: data, loading }
}

export const invalidateZones = () => useZonesResource.invalidate()
