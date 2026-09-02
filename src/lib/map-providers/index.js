import { MAP_PROVIDER } from '@/lib/map-config'
import { nominatimProvider } from './nominatim-provider.js'
import { googlePlacesProvider } from './google-places-provider.js'

const providers = {
  nominatim: nominatimProvider,
  google: googlePlacesProvider,
}

export function getMapProvider() {
  const provider = providers[MAP_PROVIDER]
  if (!provider) throw new Error(`Unknown map provider: ${MAP_PROVIDER}`)
  return provider
}
