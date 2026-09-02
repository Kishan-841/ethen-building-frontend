'use client'

import { useState } from 'react'

const LAYERS = ['roadmap', 'satellite', 'hybrid']
const keyFor = (context) => `map-layer:${context}`

/**
 * Remembered base-layer choice for a map surface.
 * `context` scopes the memory ('tab' vs 'picker') so each screen keeps its own.
 */
export function useMapLayer(context, defaultLayer = 'roadmap') {
  const [layer, setLayerState] = useState(() => {
    if (typeof window === 'undefined') return defaultLayer
    const stored = window.localStorage.getItem(keyFor(context))
    return LAYERS.includes(stored) ? stored : defaultLayer
  })

  const setLayer = (next) => {
    if (!LAYERS.includes(next)) return
    setLayerState(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(keyFor(context), next)
  }

  return [layer, setLayer]
}
