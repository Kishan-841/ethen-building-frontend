'use client'

import { Button } from '@/components/ui/Button'
import { IconPlus, IconTrash } from '@/components/ui/icons'

const inputClass =
  'h-11 w-full rounded-btn border border-line bg-card px-3 text-sm tabular-nums outline-none transition-shadow duration-200 placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15'

export function parseBoundaryPoints(points) {
  const parsed = points.map((point) => ({
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
  }))
  const allValid = parsed.every(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      point.longitude >= -180 &&
      point.longitude <= 180,
  )
  return allValid ? parsed : null
}

/**
 * Ordered polygon vertices as lat/lng rows. Empty list = no boundary;
 * otherwise at least 3 points are required (validated by the parent).
 */
export function BoundaryEditor({ points, onChange }) {
  const setPoint = (index, key, value) => {
    const next = points.map((point, i) => (i === index ? { ...point, [key]: value } : point))
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">
        Boundary points {points.length > 0 && `(${points.length} — need at least 3)`}
      </p>

      {points.map((point, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-center font-mono text-xs text-faint">{index + 1}</span>
          <input
            value={point.latitude}
            placeholder="Latitude e.g. 18.6018"
            inputMode="decimal"
            onChange={(e) => setPoint(index, 'latitude', e.target.value)}
            className={inputClass}
          />
          <input
            value={point.longitude}
            placeholder="Longitude e.g. 73.7542"
            inputMode="decimal"
            onChange={(e) => setPoint(index, 'longitude', e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            aria-label="Remove point"
            onClick={() => onChange(points.filter((_, i) => i !== index))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-bad-tint hover:text-bad"
          >
            <IconTrash className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          onChange([
            ...points,
            ...(points.length === 0
              ? [
                  { latitude: '', longitude: '' },
                  { latitude: '', longitude: '' },
                  { latitude: '', longitude: '' },
                ]
              : [{ latitude: '', longitude: '' }]),
          ])
        }
      >
        <IconPlus className="h-4 w-4" />
        {points.length === 0 ? 'Add boundary (3 points)' : 'Add point'}
      </Button>
    </div>
  )
}
