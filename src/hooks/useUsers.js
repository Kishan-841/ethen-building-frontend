'use client'

import { createSessionResource } from '@/lib/session-resource'

const useUsersResource = createSessionResource('/users')

/**
 * User directory for filter dropdowns, fetched once per session.
 * Pass `enabled: false` for roles that may not list users (surveyors).
 */
export function useUsers(enabled = true) {
  const { data, loading } = useUsersResource(enabled)
  return { users: data, loading }
}

export const invalidateUsers = () => useUsersResource.invalidate()
