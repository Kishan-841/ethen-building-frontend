'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Field } from '@/components/ui/Input'
import { IconSearch } from '@/components/ui/icons'

/**
 * Searchable single-select for the building form's zone field.
 * Focus opens the list; typing filters by zone name or city; picking closes.
 */
export function ZoneSearchSelect({ zones, value, onChange, error, disabled, label = 'Zone' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const selected = zones.find((zone) => zone.id === value) ?? null

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return zones
    return zones.filter(
      (zone) => zone.name.toLowerCase().includes(q) || zone.city?.toLowerCase().includes(q),
    )
  }, [zones, query])

  const displayValue = open ? query : selected ? `${selected.name} — ${selected.city}` : ''

  return (
    <div ref={wrapRef} className="relative">
      <Field label={label} error={error} htmlFor="zone-search-select">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            id="zone-search-select"
            value={displayValue}
            disabled={disabled}
            placeholder={disabled ? 'Loading zones…' : 'Search zone or city…'}
            autoComplete="off"
            onFocus={() => {
              setQuery('')
              setOpen(true)
            }}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            className={`h-12 w-full rounded-btn border bg-card pl-10 pr-4 text-[15px] text-ink outline-none transition-shadow duration-200 placeholder:text-faint focus:ring-2 ${
              error
                ? 'border-bad/50 focus:border-bad focus:ring-bad/15'
                : 'border-line focus:border-fiber focus:ring-fiber/15'
            }`}
          />
        </div>
      </Field>

      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-btn border border-line bg-card shadow-lift">
          {matches.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted">No matching zones</p>
          )}
          {matches.map((zone) => (
            <button
              key={zone.id}
              type="button"
              onClick={() => {
                onChange(zone.id)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between gap-2 border-b border-line/60 px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-fiber-tint/50 ${
                zone.id === value ? 'bg-fiber-tint/40 font-medium' : ''
              }`}
            >
              <span className="truncate">{zone.name}</span>
              <span className="shrink-0 text-xs text-muted">{zone.city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
