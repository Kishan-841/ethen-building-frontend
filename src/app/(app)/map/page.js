'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useBuildings } from '@/hooks/useBuildings'
import { useZones } from '@/hooks/useZones'
import { useFiberRoutes } from '@/hooks/useFiberRoutes'
import { FilterSheet } from '@/components/map/FilterSheet'
import { SelectedBuildingCard } from '@/components/map/SelectedBuildingCard'
import { MapLegend } from '@/components/map/MapLegend'
import { Fab } from '@/components/ui/Fab'
import { IconSearch } from '@/components/ui/icons'

const BuildingsMap = dynamic(() => import('@/components/map/BuildingsMap'), { ssr: false })

export default function MapPage() {
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // One API call per pause in typing — not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  // Legend-driven declutter toggles.
  const [buildingsShown, setBuildingsShown] = useState(true)
  const [zonesShown, setZonesShown] = useState(true)
  const [liveShown, setLiveShown] = useState(true)
  const [notLiveShown, setNotLiveShown] = useState(true)
  // Fiber layer is lazy: nothing is fetched until first toggled on. The
  // operator filter scopes it — routes without an operator always show.
  const [fiberShown, setFiberShown] = useState(false)
  const { routes: fiberRoutes } = useFiberRoutes(fiberShown)
  const visibleFiberRoutes = useMemo(() => {
    if (!fiberShown) return []
    if (!filters.operatorId) return fiberRoutes
    return fiberRoutes.filter((route) => route.operatorId === filters.operatorId)
  }, [fiberShown, fiberRoutes, filters.operatorId])

  const query = useMemo(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  )
  // The map wants everything the API allows in one page (markers, not rows).
  const { buildings, loading } = useBuildings({ ...query, pageSize: 500 })
  const { zones } = useZones()
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  // The Buildings row is the master switch; Live / Not live filter within it.
  const visibleBuildings = buildingsShown
    ? buildings.filter((b) => (b.isLive ? liveShown : notLiveShown))
    : []

  return (
    // z-50 lifts the page's own stacking context above the z-40 bottom nav —
    // fixed ancestors cap children's z-index, so the legend sheet/backdrop
    // could never cover the nav from inside without it.
    <div className="fixed inset-x-0 top-0 z-50 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] transition-[left] duration-300 lg:bottom-0 lg:left-[var(--sidebar-w)]">
      <BuildingsMap
        buildings={visibleBuildings}
        zones={zonesShown ? zones : []}
        fiberRoutes={visibleFiberRoutes}
        selectedId={selected?.id}
        onSelect={setSelected}
      />

      <div className="absolute inset-x-3 top-3 z-40 flex gap-2 lg:inset-x-6 lg:top-6">
        <div className="relative flex-1 lg:max-w-md">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search building, address, zone…"
            className="min-h-12 w-full rounded-xl border border-line bg-card pl-11 pr-4 text-base shadow-md outline-none focus:ring-2 focus:ring-fiber/30"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className="relative min-h-12 rounded-xl border border-line bg-card px-4 font-medium shadow-md transition-colors active:bg-paper"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-fiber text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Sits BELOW the map-style switcher on mobile — on one row they collide. */}
      <p className="absolute left-1/2 top-[7.25rem] z-40 -translate-x-1/2 rounded-full border border-line bg-card px-4 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted shadow sm:top-20 lg:top-24">
        {loading
          ? 'Loading…'
          : `${visibleBuildings.length} building${visibleBuildings.length === 1 ? '' : 's'}${
              zonesShown && zones.length ? ` · ${zones.length} zones` : ''
            }`}
      </p>

      <MapLegend
        buildingCount={buildings.length}
        liveCount={buildings.filter((b) => b.isLive).length}
        notLiveCount={buildings.filter((b) => !b.isLive).length}
        buildingsShown={buildingsShown}
        onToggleBuildings={() => setBuildingsShown((v) => !v)}
        zonesShown={zonesShown}
        zoneCount={zones.length}
        onToggleZones={() => setZonesShown((v) => !v)}
        liveShown={liveShown}
        onToggleLive={() => setLiveShown((v) => !v)}
        notLiveShown={notLiveShown}
        onToggleNotLive={() => setNotLiveShown((v) => !v)}
        fiberShown={fiberShown}
        fiberCount={visibleFiberRoutes.length}
        onToggleFiber={() => setFiberShown((v) => !v)}
      />

      <SelectedBuildingCard building={selected} onClose={() => setSelected(null)} />
      <FilterSheet
        open={filtersOpen}
        filters={filters}
        onApply={setFilters}
        onClose={() => setFiltersOpen(false)}
      />
      {!selected && <Fab href="/buildings/add" label="Add Building" />}
    </div>
  )
}
