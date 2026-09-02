'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { IconWarn } from '@/components/ui/icons'

export function DuplicateWarningStep({ candidates, onContinue, onBack }) {
  const router = useRouter()
  const hasExactMatch = candidates.some((c) => c.samePlaceId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-card bg-warn-tint px-5 py-4">
        <IconWarn className="mt-0.5 h-5 w-5 shrink-0 text-warn" strokeWidth={1.8} />
        <div>
          <p className="font-bold text-warn">Possible existing building</p>
          <p className="mt-1 text-sm font-normal text-warn/90">
            {hasExactMatch
              ? 'This exact place is already registered.'
              : `Found ${candidates.length} building(s) nearby. Check before creating a duplicate.`}
          </p>
        </div>
      </div>

      {candidates.map((candidate) => (
        <button
          key={candidate.id}
          // Masked candidates (name null) belong to another surveyor — their
          // detail page would 404, so don't navigate.
          onClick={
            candidate.buildingName ? () => router.push(`/buildings/${candidate.id}`) : undefined
          }
          className={`rounded-card bg-card p-4 text-left shadow-soft transition-all duration-200 ${
            candidate.buildingName
              ? 'hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.99]'
              : 'cursor-default'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate font-bold">
              {candidate.buildingName ?? 'Existing building'}
            </p>
            <span className="shrink-0 text-xs font-normal tabular-nums text-faint">
              {candidate.distanceMeters} m
            </span>
          </div>
          {candidate.formattedAddress && (
            <p className="mt-0.5 text-sm font-normal text-muted">{candidate.formattedAddress}</p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {candidate.samePlaceId && (
              <span className="rounded-full bg-bad-tint px-2.5 py-0.5 text-xs font-medium text-bad">
                Same place ID
              </span>
            )}
            {candidate.similarName && (
              <span className="rounded-full bg-warn-tint px-2.5 py-0.5 text-xs font-medium text-warn">
                Similar name
              </span>
            )}
            <span className="rounded-full bg-fiber-tint px-2.5 py-0.5 text-xs font-medium text-fiber">
              Open existing →
            </span>
          </div>
        </button>
      ))}

      {!hasExactMatch && (
        <Button variant="secondary" fullWidth onClick={onContinue}>
          This is a different building — continue
        </Button>
      )}
      <Button variant="ghost" fullWidth onClick={onBack}>
        Go back
      </Button>
    </div>
  )
}
