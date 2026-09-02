import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { GOOGLE_MAPS_API_KEY } from '@/lib/map-config'

let configured = false

/** Options are set once, lazily — the Maps JS script loads on first import. */
function ensureConfigured() {
  if (!configured) {
    setOptions({ key: GOOGLE_MAPS_API_KEY, v: 'weekly' })
    configured = true
  }
}

export function loadGoogleMaps() {
  ensureConfigured()
  return importLibrary('maps')
}

export function loadGoogleMarker() {
  ensureConfigured()
  return importLibrary('marker')
}
