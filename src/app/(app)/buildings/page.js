'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBuildings } from '@/hooks/useBuildings'
import { useOperators } from '@/hooks/useOperators'
import { useCities } from '@/hooks/useCities'
import { useAuthStore } from '@/stores/auth-store'
import { BuildingCard, BuildingCardSkeleton } from '@/components/buildings/BuildingCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { Fab } from '@/components/ui/Fab'
import { IconPlus, IconSearch, IconBuildings } from '@/components/ui/icons'

const SEARCH_DEBOUNCE_MS = 350

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
  const role = useAuthStore((s) => s.user?.role)
  // Only admins/managers can list operators/cities (both APIs are role-gated).
  const canFilterOperator = role === 'ADMIN' || role === 'MANAGER'
  const { operators } = useOperators()
  const { cities } = useCities()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Server-side search: debounce keystrokes, reset to page 1 on a new query.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const { buildings, pagination, loading } = useBuildings({
    search: debouncedSearch || undefined,
    operatorId: operatorId || undefined,
    cityId: cityId || undefined,
    page,
    pageSize,
  })

  const applyFilters = (nextCityId, nextOperatorId) => {
    setPage(1)
    const params = new URLSearchParams()
    if (nextCityId) params.set('cityId', nextCityId)
    if (nextOperatorId) params.set('operatorId', nextOperatorId)
    const qs = params.toString()
    router.replace(qs ? `/buildings?${qs}` : '/buildings')
  }
  // Changing city resets the operator unless it belongs to the new city.
  const setCity = (id) => {
    const operatorStillValid =
      operatorId && operators.some((o) => o.id === operatorId && (!id || o.city?.id === id))
    applyFilters(id, operatorStillValid ? operatorId : '')
  }
  const setOperator = (id) => applyFilters(cityId, id)
  const visibleOperators = cityId ? operators.filter((o) => o.city?.id === cityId) : operators

  const emptyState = (
    <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-soft">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fiber-tint text-fiber">
        <IconBuildings className="h-7 w-7" strokeWidth={1.8} />
      </span>
      <p className="mt-4 font-bold">
        {debouncedSearch ? 'No buildings match your search' : 'No buildings surveyed'}
      </p>
      <p className="mt-1 max-w-xs text-sm font-normal text-muted">
        {debouncedSearch
          ? 'Try a different name, address or zone.'
          : 'Capture your first building from its entrance to start the registry.'}
      </p>
      {!debouncedSearch && (
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

      {/* Sticky search + operator filter */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 flex items-center gap-3 bg-paper/80 px-4 py-2 backdrop-blur-md lg:static lg:mx-0 lg:mb-5 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="relative flex-1 lg:max-w-md">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search building..."
            className="h-12 w-full rounded-full border border-line bg-card pl-11 pr-4 text-[15px] shadow-soft outline-none transition-shadow duration-200 placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15"
          />
        </div>
        {canFilterOperator && cities.length > 0 && (
          <div className="w-36 shrink-0 sm:w-44 lg:ml-auto">
            <Select id="buildings-city" value={cityId} onChange={(e) => setCity(e.target.value)}>
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {canFilterOperator && operators.length > 0 && (
          <div className={`w-44 shrink-0 sm:w-56 ${cities.length > 0 ? '' : 'lg:ml-auto'}`}>
            <Select
              id="buildings-operator"
              value={operatorId}
              onChange={(e) => setOperator(e.target.value)}
            >
              <option value="">All operators</option>
              {visibleOperators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

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
