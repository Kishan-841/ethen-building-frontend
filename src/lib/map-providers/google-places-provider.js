import { GOOGLE_MAPS_API_KEY } from '@/lib/map-config'
import { nominatimProvider } from './nominatim-provider.js'

const PLACES_BASE_URL = 'https://places.googleapis.com/v1'
// Bias results to the surveyor's surroundings — same intent as the
// Nominatim viewbox (~500 m).
const SEARCH_BIAS_RADIUS_METERS = 500
const MAX_RESULTS = 8
// Autocomplete biases (not restricts) to a wider area — surveyors search by
// name and the building may be a few km off from where they're standing.
const AUTOCOMPLETE_BIAS_RADIUS_METERS = 20000

/**
 * Google Places API (New) provider.
 *
 * searchNearby uses Text Search (one request returns id + name + address +
 * coordinates) instead of per-keystroke Autocomplete + Place Details — our
 * search-on-submit UX makes that the cheaper call pattern, honoring the
 * migration guide's cost rules (single call per search, no Nearby Search).
 *
 * reverseGeocode intentionally stays on Nominatim: the migration guide
 * excludes the Geocoding API, and the reverse-geocoded "current address" is
 * display-only context for the manual path. Free beats billed here.
 */

function toCandidate(place) {
  return {
    placeId: place.id,
    // `||` not `??`: an empty-string displayName must also fall through.
    name: place.displayName?.text || place.formattedAddress?.split(',')[0] || '',
    // Google's labeled building-name concept — e.g. tapping an office
    // ("Rovensa Next India") still yields its building ("City Avenue").
    premise:
      place.addressComponents?.find((component) => component.types?.includes('premise'))
        ?.longText ?? '',
    formattedAddress: place.formattedAddress ?? '',
    latitude: place.location.latitude,
    longitude: place.location.longitude,
  }
}

export const googlePlacesProvider = {
  reverseGeocode: nominatimProvider.reverseGeocode,

  // NOTE: no POI-based name derivation. Google's nearby POIs are
  // self-registered businesses (tested: shops categorized as
  // apartment_complex) — tenant names, not building names. Building-name
  // suggestions come from OSM's curated building tag via reverseGeocode.

  /**
   * Type-ahead predictions (partial matching). A sessionToken bundles every
   * keystroke of one search + the final getPlaceDetails into ONE billed
   * session — the cost-safe pattern for autocomplete. Returns lightweight
   * predictions (no coordinates); details are fetched only on selection.
   */
  async autocomplete({ input, latitude, longitude, sessionToken, signal }) {
    const body = { input, sessionToken }
    // Bias to the surveyor's surroundings only when a location is known —
    // lets type-ahead work before GPS is captured.
    if (latitude != null && longitude != null) {
      body.locationBias = {
        circle: {
          center: { latitude, longitude },
          radius: AUTOCOMPLETE_BIAS_RADIUS_METERS,
        },
      }
    }
    const res = await fetch(`${PLACES_BASE_URL}/places:autocomplete`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Autocomplete failed (${res.status})`)
    const data = await res.json()
    return (data.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction)
      .filter(Boolean)
      .map((prediction) => ({
        placeId: prediction.placeId,
        primaryText: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? '',
        secondaryText: prediction.structuredFormat?.secondaryText?.text ?? '',
      }))
  },

  /** Resolve a selected prediction to full details, closing the session. */
  async getPlaceDetails({ placeId, sessionToken }) {
    const params = new URLSearchParams()
    if (sessionToken) params.set('sessionToken', sessionToken)
    const res = await fetch(`${PLACES_BASE_URL}/places/${placeId}?${params}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
      },
    })
    if (!res.ok) throw new Error(`Place details failed (${res.status})`)
    return toCandidate(await res.json())
  },

  async searchNearby({ latitude, longitude, query }) {
    const res = await fetch(`${PLACES_BASE_URL}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents',
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: MAX_RESULTS,
        locationBias: {
          circle: {
            center: { latitude, longitude },
            radius: SEARCH_BIAS_RADIUS_METERS,
          },
        },
      }),
    })
    if (!res.ok) throw new Error(`Places search failed (${res.status})`)

    const data = await res.json()
    return (data.places ?? []).map(toCandidate)
  },
}
