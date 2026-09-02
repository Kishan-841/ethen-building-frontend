const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
// ≈500 m half-width viewbox — keeps results to the surveyor's surroundings.
const SEARCH_RADIUS_DEG = 0.005
// Name search casts wider (~11 km) since surveyors search by name.
const NAME_SEARCH_RADIUS_DEG = 0.1
const OSM_TYPE_PREFIX = { node: 'N', way: 'W', relation: 'R' }

function toCandidate(item) {
  return {
    placeId: `${item.osm_type}:${item.osm_id}`,
    name: item.name || item.display_name.split(',')[0],
    formattedAddress: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Map provider request failed (${res.status})`)
  return res.json()
}

export const nominatimProvider = {
  async reverseGeocode({ latitude, longitude }) {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'jsonv2',
      addressdetails: '1',
    })
    const data = await fetchJson(`${NOMINATIM_BASE_URL}/reverse?${params}`)
    return {
      ...toCandidate(data),
      // Only a real OSM building tag counts as a building-name suggestion —
      // curated mapper data, unlike self-registered POI names. Empty when the
      // reversed feature is a road/area (the common case).
      buildingName:
        data.address?.building ?? (data.category === 'building' ? (data.name ?? '') : ''),
    }
  },

  // Dev-mode type-ahead. Nominatim has no session tokens, so predictions
  // carry no billing concern; it returns coordinates inline, but we keep the
  // prediction shape symmetric with Google (details fetched on selection).
  async autocomplete({ input, latitude, longitude, signal }) {
    const params = new URLSearchParams({
      q: input,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
    })
    // Bias to the surveyor's surroundings when a location is known; without it,
    // search runs unbiased so type-ahead works before GPS is captured.
    if (latitude != null && longitude != null) {
      const r = NAME_SEARCH_RADIUS_DEG
      params.set('viewbox', `${longitude - r},${latitude + r},${longitude + r},${latitude - r}`)
      params.set('bounded', '0') // bias, don't restrict
    }
    const res = await fetch(`${NOMINATIM_BASE_URL}/search?${params}`, {
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!res.ok) throw new Error(`Autocomplete failed (${res.status})`)
    const data = await res.json()
    return data.map((item) => ({
      placeId: `${item.osm_type}:${item.osm_id}`,
      primaryText: item.name || item.display_name.split(',')[0],
      secondaryText: item.display_name,
    }))
  },

  async getPlaceDetails({ placeId }) {
    const [osmType, osmId] = placeId.split(':')
    const params = new URLSearchParams({
      osm_ids: `${OSM_TYPE_PREFIX[osmType] ?? 'W'}${osmId}`,
      format: 'jsonv2',
      addressdetails: '1',
    })
    const data = await fetchJson(`${NOMINATIM_BASE_URL}/lookup?${params}`)
    const item = data[0]
    return {
      ...toCandidate(item),
      premise: item.address?.building ?? '',
    }
  },

  async searchNearby({ latitude, longitude, query }) {
    const r = SEARCH_RADIUS_DEG
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '8',
      viewbox: `${longitude - r},${latitude + r},${longitude + r},${latitude - r}`,
      bounded: '1',
    })
    const data = await fetchJson(`${NOMINATIM_BASE_URL}/search?${params}`)
    return data.map(toCandidate)
  },
}
