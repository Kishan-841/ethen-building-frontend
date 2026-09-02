'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { CrudList } from '@/components/admin/CrudList'

export default function AdminBuildingTypesPage() {
  const [types, setTypes] = useState(null)

  const fetchTypes = useCallback(
    () =>
      apiClient
        .get('/building-types')
        .then((res) => setTypes(res.data.data))
        // Empty list (not a permanent "Loading…") when the fetch fails.
        .catch(() => setTypes([])),
    [],
  )

  useEffect(() => {
    fetchTypes()
  }, [fetchTypes])

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Administration"
        title="Building types"
        sub="Options shown in the add-building form"
        backHref="/admin"
        backLabel="Dashboard"
      />

      <CrudList
        items={types}
        addLabel="Add"
        fields={[{ name: 'name', placeholder: 'Type name' }]}
        renderItem={(type) => <p className="truncate font-bold">{type.name}</p>}
        onCreate={async (draft) => {
          await apiClient.post('/building-types', draft)
          await fetchTypes()
        }}
        onUpdate={async (id, draft) => {
          await apiClient.patch(`/building-types/${id}`, draft)
          await fetchTypes()
        }}
        onDelete={async (id) => {
          await apiClient.delete(`/building-types/${id}`)
          await fetchTypes()
        }}
      />
    </main>
  )
}
