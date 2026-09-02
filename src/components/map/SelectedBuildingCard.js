'use client'

import Link from 'next/link'

export function SelectedBuildingCard({ building, onClose }) {
  if (!building) return null

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-line bg-card p-4 shadow-xl lg:left-auto lg:right-6 lg:bottom-6 lg:w-96">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{building.buildingName}</p>
          <p className="truncate text-sm text-muted">{building.formattedAddress}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 text-faint transition-colors hover:text-ink">
          ✕
        </button>
      </div>

      {building.zone?.name && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ok" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-faint">
            {building.zone.name}
          </span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {building.details?.homePass != null && <span>{building.details.homePass} home pass</span>}
        {building.details?.wings != null && <span>{building.details.wings} wings</span>}
        {building.details?.floors != null && <span>{building.details.floors} floors</span>}
      </div>

      <Link
        href={`/buildings/${building.id}`}
        className="mt-3 block rounded-xl bg-fiber py-3 text-center font-semibold text-white transition-colors active:bg-fiber-deep"
      >
        View Details
      </Link>
    </div>
  )
}
