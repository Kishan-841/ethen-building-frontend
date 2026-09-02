/**
 * Single switch for the whole mapping stack (search AND display).
 * 'nominatim' → Leaflet + OSM + Nominatim (development)
 * 'google'    → Google Maps JS + Places API New (production)
 */
export const MAP_PROVIDER = process.env.NEXT_PUBLIC_MAP_PROVIDER ?? 'nominatim'

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
