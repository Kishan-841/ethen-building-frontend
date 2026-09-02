'use client'

import { createSessionResource } from '@/lib/session-resource'

const useOperatorsResource = createSessionResource('/operators')

/** Full operator list for filter dropdowns, fetched once per session. */
export function useOperators() {
  const { data, loading } = useOperatorsResource()
  return { operators: data, loading }
}

export const invalidateOperators = () => useOperatorsResource.invalidate()
