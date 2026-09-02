import Link from 'next/link'

export function BuildingCard({ building }) {
  return (
    <Link
      href={`/buildings/${building.id}`}
      className="relative block overflow-hidden rounded-card bg-card p-5 pl-6 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      {/* Fiber accent edge — every surveyed building is feasible */}
      <span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-ok" />
      <p className="min-w-0 truncate text-[15px] font-bold">{building.buildingName}</p>
      <p className="mt-1 truncate text-sm font-normal text-muted">{building.formattedAddress}</p>
      <div className="mt-3 flex gap-4 text-xs font-normal text-faint">
        {building.zone?.name && <span>{building.zone.name}</span>}
        {building.details?.homePass != null && <span>{building.details.homePass} home pass</span>}
        {building.distanceMeters != null && <span>{building.distanceMeters} m away</span>}
      </div>
    </Link>
  )
}

export function BuildingCardSkeleton() {
  return (
    <div className="shimmer rounded-card bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-2/5 rounded bg-line" />
        <div className="h-6 w-24 rounded-full bg-line/70" />
      </div>
      <div className="mt-2 h-3 w-3/5 rounded bg-line/70" />
      <div className="mt-4 h-3 w-1/4 rounded bg-line/50" />
    </div>
  )
}
