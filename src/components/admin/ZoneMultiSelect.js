'use client'

import { useMemo, useState } from 'react'
import { IconClose, IconSearch } from '@/components/ui/icons'

/** Searchable multi-select for zone assignment: filter as you type, chips for picks. */
export function ZoneMultiSelect({ zones, selectedIds, onChange }) {
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => zones.filter((zone) => selectedIds.includes(zone.id)),
    [zones, selectedIds],
  )
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return zones.filter(
      (zone) =>
        !selectedIds.includes(zone.id) &&
        (!q || zone.name.toLowerCase().includes(q) || zone.city?.toLowerCase().includes(q)),
    )
  }, [zones, selectedIds, query])

  const add = (id) => onChange([...selectedIds, id])
  const remove = (id) => onChange(selectedIds.filter((zoneId) => zoneId !== id))

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">Assigned zones</span>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((zone) => (
            <span
              key={zone.id}
              className="inline-flex items-center gap-1 rounded-full bg-fiber-tint px-2.5 py-1 text-xs font-medium text-fiber"
            >
              {zone.name}
              <button
                type="button"
                aria-label={`Remove ${zone.name}`}
                onClick={() => remove(zone.id)}
                className="hover:opacity-70"
              >
                <IconClose className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search zones…"
          className="h-11 w-full rounded-btn border border-line bg-card pl-9 pr-3 text-sm text-ink outline-none placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15"
        />
      </div>

      <div className="max-h-44 overflow-y-auto rounded-btn border border-line">
        {matches.length === 0 && <p className="px-3 py-2.5 text-sm text-muted">No matching zones</p>}
        {matches.map((zone) => (
          <button
            key={zone.id}
            type="button"
            onClick={() => add(zone.id)}
            className="flex w-full items-center justify-between gap-2 border-b border-line/60 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-fiber-tint/50"
          >
            <span className="truncate font-medium">{zone.name}</span>
            <span className="shrink-0 text-xs text-muted">{zone.city}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
