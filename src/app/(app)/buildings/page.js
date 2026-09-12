'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBuildings } from '@/hooks/useBuildings'
import { useOperators } from '@/hooks/useOperators'
import { useCities } from '@/hooks/useCities'
import { useZones } from '@/hooks/useZones'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { BuildingCard, BuildingCardSkeleton } from '@/components/buildings/BuildingCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input, Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { Fab } from '@/components/ui/Fab'
import {
  IconPlus,
  IconSearch,
  IconBuildings,
  IconFilters,
  IconDownload,
} from '@/components/ui/icons'

const SEARCH_DEBOUNCE_MS = 350
// The list endpoint caps pageSize at 500, so a full export pages through it.
const EXPORT_PAGE_SIZE = 500
// Guard against an unbounded loop if the API ever reports a bad total.
const EXPORT_MAX_PAGES = 40

const LIVE_OPTIONS = [
  { value: 'true', label: 'Live (RFS)' },
  { value: 'false', label: 'Not live' },
]

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

const COLUMNS = [
  {
    key: 'buildingName',
    header: 'Building',
    // Cap the width so long addresses truncate instead of widening the table
    // (which pushed the Added column into a horizontal scroll).
    className: 'max-w-[460px]',
    render: (b) => (
      <div className="min-w-0 max-w-[460px]">
        <p className="truncate font-bold">{b.buildingName}</p>
        <p className="truncate text-xs font-normal text-muted">{b.formattedAddress}</p>
      </div>
    ),
  },
  {
    key: 'zone',
    header: 'Zone',
    render: (b) => <span className="line-clamp-2">{b.zone?.name ?? '—'}</span>,
    className: 'max-w-[160px] text-muted',
  },
  {
    key: 'city',
    header: 'City',
    // cityRef is canonical; the legacy zone.city text covers zones the
    // migration could not match to a City row.
    render: (b) => b.zone?.cityRef?.name ?? b.zone?.city ?? '—',
    className: 'max-w-[140px] text-muted',
  },
  {
    key: 'homePass',
    header: 'Home pass',
    render: (b) => b.details?.homePass ?? '—',
    className: 'tabular-nums text-muted',
  },
  {
    key: 'createdAt',
    header: 'Added',
    render: (b) => dateFormat.format(new Date(b.createdAt)),
    className: 'tabular-nums text-muted',
  },
]

function BuildingsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const operatorId = searchParams.get('operatorId') ?? ''
  const cityId = searchParams.get('cityId') ?? ''
  const zoneId = searchParams.get('zoneId') ?? ''
  const isLive = searchParams.get('isLive') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''
  const role = useAuthStore((s) => s.user?.role)
  // Only admins/managers can list operators/cities (both APIs are role-gated).
  const canFilterOperator = role === 'ADMIN' || role === 'MANAGER'
  const { operators } = useOperators()
  const { cities } = useCities()
  // Zones are role-scoped by the API, so surveyors see only their own.
  const { zones } = useZones()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  // Server-side search: debounce keystrokes, reset to page 1 on a new query.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // One source of truth for "what is filtered", so the export cannot drift from
  // what the table shows.
  const activeFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      operatorId: operatorId || undefined,
      cityId: cityId || undefined,
      zoneId: zoneId || undefined,
      isLive: isLive || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [debouncedSearch, operatorId, cityId, zoneId, isLive, dateFrom, dateTo],
  )
  // Counts only what lives in the panel — the search box is its own control
  // above it, so including it would make the badge read one higher than the
  // number of filters the panel actually shows.
  const filterCount = Object.entries(activeFilters).filter(
    ([key, value]) => key !== 'search' && value,
  ).length

  const { buildings, pagination, loading } = useBuildings({
    ...activeFilters,
    page,
    pageSize,
  })

  // Filters live in the URL so a filtered view can be shared or bookmarked.
  const applyFilters = (patch) => {
    setPage(1)
    const next = { cityId, operatorId, zoneId, isLive, dateFrom, dateTo, ...patch }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
    }
    const qs = params.toString()
    router.replace(qs ? `/buildings?${qs}` : '/buildings')
  }
  // Changing city resets the operator and zone unless they belong to the new city.
  const setCity = (id) => {
    const operatorStillValid =
      operatorId && operators.some((o) => o.id === operatorId && (!id || o.city?.id === id))
    const zoneStillValid =
      zoneId && (zones ?? []).some((z) => z.id === zoneId && (!id || z.cityRef?.id === id))
    applyFilters({
      cityId: id,
      operatorId: operatorStillValid ? operatorId : '',
      zoneId: zoneStillValid ? zoneId : '',
    })
  }
  const clearFilters = () => {
    setPage(1)
    setSearch('')
    router.replace('/buildings')
  }
  const visibleOperators = cityId ? operators.filter((o) => o.city?.id === cityId) : operators
  const visibleZones = cityId
    ? (zones ?? []).filter((zone) => zone.cityRef?.id === cityId)
    : (zones ?? [])

  // Exports every row matching the ACTIVE FILTERS, not just the visible page —
  // the list endpoint caps pageSize at 500, so page through it.
  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const rows = []
      for (let p = 1; p <= EXPORT_MAX_PAGES; p += 1) {
        const params = Object.fromEntries(
          Object.entries({ ...activeFilters, page: p, pageSize: EXPORT_PAGE_SIZE }).filter(
            ([, v]) => v !== '' && v != null,
          ),
        )
        const res = await apiClient.get('/buildings', { params })
        const { items, pagination: meta } = res.data.data
        rows.push(...items)
        if (p >= (meta?.totalPages ?? 1)) break
      }

      // v4 exposes only subpath exports — bare 'write-excel-file' doesn't
      // resolve. writeXlsxFile(data) returns { toFile, toBlob }.
      const writeXlsxFile = (await import('write-excel-file/browser')).default
      const header = [
        'Building',
        'Address',
        'Zone',
        'City',
        'Live (RFS)',
        'Wings',
        'Floors',
        'Home pass',
        'Building type',
        'Latitude',
        'Longitude',
        'Added by',
        'Added on',
      ].map((value) => ({ value, fontWeight: 'bold' }))

      await writeXlsxFile([
        header,
        ...rows.map((b) => [
          { value: b.buildingName ?? '' },
          { value: b.formattedAddress ?? '' },
          { value: b.zone?.name ?? '' },
          // cityRef is the canonical link; the legacy text is the fallback for
          // zones the backfill could not match.
          { value: b.zone?.cityRef?.name ?? b.zone?.city ?? '' },
          { value: b.isLive ? 'Yes' : 'No' },
          { value: b.details?.wings ?? null, type: Number },
          { value: b.details?.floors ?? null, type: Number },
          { value: b.details?.homePass ?? null, type: Number },
          { value: b.details?.buildingType ?? '' },
          { value: b.latitude ?? null, type: Number },
          { value: b.longitude ?? null, type: Number },
          { value: b.createdBy?.name ?? '' },
          { value: b.createdAt ? new Date(b.createdAt) : null, type: Date, format: 'dd mmm yyyy' },
        ]),
      ]).toFile(`buildings-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Could not export buildings'))
    } finally {
      setExporting(false)
    }
  }

  const emptyState = (
    <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-soft">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fiber-tint text-fiber">
        <IconBuildings className="h-7 w-7" strokeWidth={1.8} />
      </span>
      <p className="mt-4 font-bold">
        {debouncedSearch || filterCount > 0
          ? 'No buildings match these filters'
          : 'No buildings surveyed'}
      </p>
      <p className="mt-1 max-w-xs text-sm font-normal text-muted">
        {debouncedSearch || filterCount > 0
          ? 'Try a different name, address or zone — or clear the filters.'
          : 'Capture your first building from its entrance to start the registry.'}
      </p>
      {(debouncedSearch || filterCount > 0) && (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-4 text-sm font-medium text-fiber hover:underline"
        >
          Clear all filters
        </button>
      )}
      {!debouncedSearch && filterCount === 0 && (
        <Link
          href="/buildings/add"
          className="mt-5 inline-flex h-12 items-center gap-2 rounded-btn bg-fiber px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-fiber-deep"
        >
          <IconPlus className="h-4.5 w-4.5" />
          Add building
        </Link>
      )}
    </div>
  )

  return (
    <main>
      <PageHeader
        title="Buildings"
        sub={pagination ? `${pagination.total} surveyed` : 'Loading…'}
        action={
          <Link
            href="/buildings/add"
            className="hidden h-12 items-center gap-2 rounded-btn bg-fiber px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-fiber-deep lg:inline-flex"
          >
            <IconPlus className="h-4.5 w-4.5" />
            Add building
          </Link>
        }
      />

      {/* Sticky search + primary filters; the rest live in the panel below. */}
      <div className="sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-3 bg-paper/80 px-4 py-2 backdrop-blur-md lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="relative flex-1 lg:max-w-md">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search building..."
            className="h-12 w-full rounded-full border border-line bg-card pl-11 pr-4 text-[15px] shadow-soft outline-none transition-shadow duration-200 placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15"
          />
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-btn border border-line bg-card px-4 text-sm font-medium transition-colors hover:border-fiber/50 lg:ml-auto"
        >
          <IconFilters className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {filterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-fiber px-1.5 text-xs font-medium text-white">
              {filterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !pagination?.total}
          title={pagination?.total ? 'Export the filtered list to Excel' : 'Nothing to export'}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-btn border border-line bg-card px-4 text-sm font-medium transition-colors hover:border-fiber/50 disabled:opacity-50"
        >
          <IconDownload className="h-4 w-4" />
          <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export'}</span>
        </button>
      </div>

      {filtersOpen && (
        <div className="mb-5 grid gap-4 rounded-card bg-card p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-3">
          {canFilterOperator && cities.length > 0 && (
            <Select
              id="buildings-city"
              label="City"
              value={cityId}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            id="buildings-zone"
            label="Zone"
            value={zoneId}
            onChange={(e) => applyFilters({ zoneId: e.target.value })}
          >
            <option value="">All zones</option>
            {visibleZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>

          {canFilterOperator && operators.length > 0 && (
            <Select
              id="buildings-operator"
              label="Operator"
              value={operatorId}
              onChange={(e) => applyFilters({ operatorId: e.target.value })}
            >
              <option value="">All operators</option>
              {visibleOperators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            id="buildings-live"
            label="Connection"
            value={isLive}
            onChange={(e) => applyFilters({ isLive: e.target.value })}
          >
            <option value="">Any</option>
            {LIVE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Input
            id="buildings-date-from"
            label="Added from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => applyFilters({ dateFrom: e.target.value })}
          />
          <Input
            id="buildings-date-to"
            label="Added to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => applyFilters({ dateTo: e.target.value })}
          />

          {filterCount > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-medium text-fiber hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {exportError && (
        <p className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {exportError}
        </p>
      )}

      <DataTable
        columns={COLUMNS}
        rows={loading ? null : buildings}
        loading={loading}
        renderCard={(building) => <BuildingCard building={building} />}
        renderCardSkeleton={() => <BuildingCardSkeleton />}
        onRowClick={(building) => router.push(`/buildings/${building.id}`)}
        emptyState={emptyState}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        pagination={pagination}
        onPageChange={setPage}
      />

      <Fab href="/buildings/add" label="Add building" />
    </main>
  )
}

// useSearchParams must sit inside a Suspense boundary in the App Router.
export default function BuildingsPage() {
  return (
    <Suspense fallback={null}>
      <BuildingsList />
    </Suspense>
  )
}
