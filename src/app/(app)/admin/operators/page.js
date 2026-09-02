'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { ImportOperatorMappingModal } from '@/components/admin/ImportOperatorMappingModal'
import { useCities, invalidateCities } from '@/hooks/useCities'
import { invalidateOperators } from '@/hooks/useOperators'
import { invalidateZones } from '@/hooks/useZones'
import { IconEdit, IconTrash, IconUpload, IconLayers } from '@/components/ui/icons'

const emptyForm = { name: '', cityId: '' }

/** Shared create/edit form: name + optional city (picked from the city list). */
function OperatorForm({ initial, cities, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await onSave({ name: form.name.trim(), cityId: form.cityId || null })
      if (!onCancel) setForm(initial)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-soft">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="op-name"
          placeholder="Operator name e.g. GALAXY BROADBAND"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Select
          id="op-city"
          value={form.cityId}
          onChange={(e) => setForm({ ...form, cityId: e.target.value })}
        >
          <option value="">No city</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>
      </div>
      {error && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button className="flex-1" disabled={!form.name.trim()} loading={busy} onClick={handleSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}

export default function AdminOperatorsPage() {
  const [editingId, setEditingId] = useState(null)
  const [listError, setListError] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [refreshTick, setRefreshTick] = useState(0)
  const [result, setResult] = useState(null)
  const { cities } = useCities()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const paramsKey = useMemo(() => {
    const p = { page, pageSize: 50, tick: refreshTick }
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim()
    return JSON.stringify(p)
  }, [page, debouncedSearch, refreshTick])

  useEffect(() => {
    let cancelled = false
    const { tick, ...params } = JSON.parse(paramsKey)
    apiClient
      .get('/operators', { params })
      .then((res) => !cancelled && setResult({ key: paramsKey, data: res.data.data }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({ key: paramsKey, error: getApiErrorMessage(err, 'Could not load operators') }),
      )
    return () => {
      cancelled = true
    }
  }, [paramsKey])

  const loading = result?.key !== paramsKey
  const operators = result?.data?.items ?? null
  const pagination = result?.data
    ? { page: result.data.page, totalPages: result.data.totalPages, total: result.data.total }
    : null
  // Operator mutations invalidate the operator dropdown cache; the mapping
  // import also creates zones and cities, so those caches drop too (cheap —
  // it only forces one refetch on next use).
  const refresh = () => {
    invalidateOperators()
    invalidateZones()
    invalidateCities()
    setRefreshTick((t) => t + 1)
  }

  async function handleDelete(operator) {
    if (!window.confirm(`Delete operator "${operator.name}"? Its zones stay, unlinked.`)) return
    setListError(null)
    try {
      await apiClient.delete(`/operators/${operator.id}`)
      refresh()
    } catch (err) {
      setListError(getApiErrorMessage(err))
    }
  }

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Administration"
        title="Operators"
        sub="Groups of zones — filter the map by operator and bulk-assign surveyors"
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 rounded-btn border border-line bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-fiber/50"
        >
          <IconUpload className="h-4 w-4" /> Import mapping
        </button>
      </div>

      <OperatorForm
        initial={emptyForm}
        cities={cities}
        saveLabel="Add operator"
        onSave={async (payload) => {
          await apiClient.post('/operators', payload)
          refresh()
        }}
      />

      {listError && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      <div className="mt-5">
        <Input
          id="op-search"
          placeholder="Search operator or city…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {loading && operators === null && (
          <p className="text-sm font-normal text-muted">Loading…</p>
        )}
        {!loading && operators?.length === 0 && (
          <p className="text-sm font-normal text-muted">No operators match.</p>
        )}
        {operators?.map((operator) =>
          editingId === operator.id ? (
            <OperatorForm
              key={operator.id}
              initial={{ name: operator.name, cityId: operator.city?.id ?? '' }}
              cities={cities}
              saveLabel="Save changes"
              onCancel={() => setEditingId(null)}
              onSave={async (payload) => {
                await apiClient.patch(`/operators/${operator.id}`, payload)
                setEditingId(null)
                refresh()
              }}
            />
          ) : (
            <div
              key={operator.id}
              className="flex items-center justify-between gap-3 rounded-card bg-card p-4 shadow-soft"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{operator.name}</p>
                <p className="truncate text-sm font-normal text-muted">
                  {operator.city?.name || 'No city'}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-fiber-tint px-2.5 py-0.5 text-xs font-medium text-fiber">
                  <IconLayers className="h-3 w-3" /> {operator.zoneCount} zone
                  {operator.zoneCount === 1 ? '' : 's'}
                </p>
              </div>
              <button
                aria-label="Edit"
                onClick={() => setEditingId(operator.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
              >
                <IconEdit className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
              <button
                aria-label="Delete"
                onClick={() => handleDelete(operator)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-bad-tint hover:text-bad"
              >
                <IconTrash className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>
          ),
        )}
      </div>

      <Pagination pagination={pagination} onChange={setPage} />

      {importOpen && (
        <ImportOperatorMappingModal onClose={() => setImportOpen(false)} onImported={refresh} />
      )}
    </main>
  )
}
