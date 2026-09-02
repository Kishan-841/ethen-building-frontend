'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BoundaryEditor, parseBoundaryPoints } from '@/components/admin/BoundaryEditor'
import { ImportZonesModal } from '@/components/admin/ImportZonesModal'
import { Pagination } from '@/components/ui/Pagination'
import { invalidateZones } from '@/hooks/useZones'
import { IconEdit, IconTrash, IconPin, IconUpload, IconDownload, IconMap } from '@/components/ui/icons'

// Client-only: Google Maps JS touches window.
const GoogleBoundaryMapEditor = dynamic(
  () => import('@/components/map/google/GoogleBoundaryMapEditor'),
  { ssr: false },
)

const emptyForm = { name: '', city: '', points: [] }

function toFormPoints(boundary) {
  return (boundary ?? []).map((point) => ({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
  }))
}

/** Shared create/edit form: name, city, optional polygon boundary. */
function ZoneForm({ initial, zoneId, onSave, onCancel, onBoundarySaved, saveLabel }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [mapOpen, setMapOpen] = useState(false)

  const parsedBoundary = parseBoundaryPoints(form.points)
  const boundaryValid =
    form.points.length === 0 || (parsedBoundary !== null && form.points.length >= 3)
  const canSave = form.name.trim() && form.city.trim() && boundaryValid

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await onSave({
        name: form.name.trim(),
        city: form.city.trim(),
        boundary: form.points.length === 0 ? null : parsedBoundary,
      })
      // Reset the create form so it's usable again; edit forms unmount on save.
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
          id="zone-name"
          placeholder="Zone name e.g. Wakad West"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          id="zone-city"
          placeholder="City e.g. Pune"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-normal text-muted">
          {form.points.length >= 3 ? `Boundary: ${form.points.length} points` : 'No boundary yet'}
        </p>
        <Button type="button" variant="secondary" onClick={() => setMapOpen(true)}>
          <IconMap className="h-4 w-4" strokeWidth={1.8} />
          Draw on map
        </Button>
      </div>

      {/* Manual rows stay as a transparency/debug fallback, collapsed. */}
      <details className="rounded-btn border border-line/60 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-faint">
          Edit coordinates manually
        </summary>
        <div className="pt-3">
          <BoundaryEditor points={form.points} onChange={(points) => setForm({ ...form, points })} />
        </div>
      </details>

      {mapOpen && (
        <GoogleBoundaryMapEditor
          initialZoneId={zoneId}
          defaultName={form.name}
          defaultCity={form.city}
          initialPoints={parseBoundaryPoints(form.points) ?? []}
          onClose={() => setMapOpen(false)}
          onSaved={() => {
            setMapOpen(false)
            onBoundarySaved?.()
          }}
        />
      )}

      {form.points.length > 0 && !boundaryValid && (
        <p className="text-sm font-normal text-warn">
          Enter valid coordinates for every point (at least 3 points).
        </p>
      )}
      {error && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button className="flex-1" disabled={!canSave} loading={busy} onClick={handleSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}

export default function AdminZonesPage() {
  const [editingId, setEditingId] = useState(null)
  const [listError, setListError] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [refreshTick, setRefreshTick] = useState(0)
  const [exporting, setExporting] = useState(false)
  // { key, data } — loading derived from key mismatch (no sync setState in effects).
  const [result, setResult] = useState(null)

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
      .get('/zones', { params })
      .then((res) => !cancelled && setResult({ key: paramsKey, data: res.data.data }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({ key: paramsKey, error: getApiErrorMessage(err, 'Could not load zones') }),
      )
    return () => {
      cancelled = true
    }
  }, [paramsKey])

  const loading = result?.key !== paramsKey
  const zones = result?.data?.items ?? null
  const pagination = result?.data
    ? { page: result.data.page, totalPages: result.data.totalPages, total: result.data.total }
    : null
  // Called after every zone mutation (create/update/delete/import/boundary
  // save) — also drops the session-cached zone list so dropdowns everywhere
  // pick up the change on their next mount.
  const fetchZones = () => {
    invalidateZones()
    setRefreshTick((tick) => tick + 1)
  }

  async function handleExport() {
    setExporting(true)
    setListError(null)
    try {
      // Full role-scoped list (legacy array shape), independent of the search.
      const all = (await apiClient.get('/zones')).data.data
      // v4 exposes only subpath exports — bare 'write-excel-file' doesn't resolve.
      // v4 API: writeXlsxFile(data) returns { toFile, toBlob } — the old
      // `{ fileName }` option no longer triggers a download.
      const writeXlsxFile = (await import('write-excel-file/browser')).default
      await writeXlsxFile([
        [
          { value: 'Name', fontWeight: 'bold' },
          { value: 'City', fontWeight: 'bold' },
        ],
        ...all.map((zone) => [{ value: zone.name }, { value: zone.city }]),
      ]).toFile(`zones-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not export zones'))
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete(zone) {
    if (!window.confirm(`Delete "${zone.name}"?`)) return
    setListError(null)
    try {
      await apiClient.delete(`/zones/${zone.id}`)
      fetchZones()
    } catch (err) {
      setListError(getApiErrorMessage(err))
    }
  }

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Administration"
        title="Zones"
        sub="Coverage areas — add a boundary to draw the zone on the map"
        backHref="/admin"
        backLabel="Dashboard"
      />

      <div className="mb-3 flex justify-end gap-2">
        <button
          onClick={handleExport}
          disabled={exporting || !zones?.length}
          className="inline-flex items-center gap-2 rounded-btn border border-line bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-fiber/50 disabled:opacity-50"
        >
          <IconDownload className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export to Excel'}
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 rounded-btn border border-line bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-fiber/50"
        >
          <IconUpload className="h-4 w-4" /> Import from Excel
        </button>
      </div>

      <ZoneForm
        initial={emptyForm}
        saveLabel="Add zone"
        onBoundarySaved={fetchZones}
        onSave={async (payload) => {
          await apiClient.post('/zones', payload)
          await fetchZones()
        }}
      />

      {listError && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      <div className="mt-5">
        <Input
          id="zone-search"
          placeholder="Search zone or city…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {loading && zones === null && (
          <p className="text-sm font-normal text-muted">Loading…</p>
        )}
        {!loading && zones?.length === 0 && (
          <p className="text-sm font-normal text-muted">No zones match.</p>
        )}
        {zones?.map((zone) =>
          editingId === zone.id ? (
            <ZoneForm
              key={zone.id}
              zoneId={zone.id}
              onBoundarySaved={() => {
                setEditingId(null)
                fetchZones()
              }}
              initial={{ name: zone.name, city: zone.city, points: toFormPoints(zone.boundary) }}
              saveLabel="Save changes"
              onCancel={() => setEditingId(null)}
              onSave={async (payload) => {
                await apiClient.patch(`/zones/${zone.id}`, payload)
                setEditingId(null)
                await fetchZones()
              }}
            />
          ) : (
            <div
              key={zone.id}
              className="flex items-center justify-between gap-3 rounded-card bg-card p-4 shadow-soft"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{zone.name}</p>
                <p className="truncate text-sm font-normal text-muted">
                  {zone.city}
                  {zone.operator?.name ? ` · ${zone.operator.name}` : ''}
                </p>
                {zone.boundary?.length >= 3 && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-fiber-tint px-2.5 py-0.5 text-xs font-medium text-fiber">
                    <IconPin className="h-3 w-3" /> {zone.boundary.length}-point boundary
                  </p>
                )}
              </div>
              <button
                aria-label="Edit"
                onClick={() => setEditingId(zone.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
              >
                <IconEdit className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
              <button
                aria-label="Delete"
                onClick={() => handleDelete(zone)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-bad-tint hover:text-bad"
              >
                <IconTrash className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>
          ),
        )}
      </div>

      <Pagination pagination={pagination} onChange={setPage} />

      <ImportZonesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchZones}
      />
    </main>
  )
}
