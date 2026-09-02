'use client'

import { useCallback, useState } from 'react'

// Tiers chosen for field ops: <10 m good, ≤20 m fair, >20 m poor
// (matches the PRD's 20 m warning threshold).
export function classifyAccuracy(meters) {
  if (meters == null) return null
  if (meters < 10) return 'good'
  if (meters <= 20) return 'fair'
  return 'poor'
}

export function useGeolocation() {
  const [state, setState] = useState({
    loading: false,
    position: null,
    accuracy: null,
    error: null,
  })

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({
        loading: false,
        position: null,
        accuracy: null,
        error: 'GPS is not supported on this device',
      })
      return
    }
    setState({ loading: true, position: null, accuracy: null, error: null })
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          loading: false,
          position: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          error: null,
        }),
      (err) =>
        setState({
          loading: false,
          position: null,
          accuracy: null,
          error:
            err.code === err.PERMISSION_DENIED
              ? 'Location permission denied. Enable GPS to add buildings.'
              : 'Could not get your location. Try again.',
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [])

  return { ...state, locate, accuracyLevel: classifyAccuracy(state.accuracy) }
}
