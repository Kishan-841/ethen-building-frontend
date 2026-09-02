'use client'

const OPTIONS = [
  { key: 'roadmap', label: 'Map' },
  { key: 'satellite', label: 'Satellite' },
  { key: 'hybrid', label: 'Hybrid' },
]

/**
 * Floating base-layer switcher, top-right of a map. Identical across providers.
 * Stops pointer events from reaching the map so a click never pans underneath.
 */
export function MapLayerControl({ value, onChange, position = 'right-3 top-3' }) {
  return (
    <div
      className={`absolute z-[500] flex overflow-hidden rounded-btn border border-line bg-card/95 text-xs font-medium shadow-soft backdrop-blur ${position}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`px-3 py-1.5 transition-colors ${
            value === option.key ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
