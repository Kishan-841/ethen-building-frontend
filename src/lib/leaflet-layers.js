import L from 'leaflet'

const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
// Esri World Imagery — free, no API key. Note {y}/{x} order (ArcGIS tiling).
const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
// Transparent street/place labels to pair with imagery for "hybrid".
const ESRI_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'

/**
 * Returns a LayerGroup for a base-layer key, ready to add to the map. Grouping
 * lets "hybrid" bundle imagery + a labels overlay behind one swap.
 */
export function createBaseLayer(layer) {
  if (layer === 'satellite') {
    return L.layerGroup([
      L.tileLayer(ESRI_IMAGERY, { maxZoom: 19, attribution: 'Tiles &copy; Esri' }),
    ])
  }
  if (layer === 'hybrid') {
    return L.layerGroup([
      L.tileLayer(ESRI_IMAGERY, { maxZoom: 19, attribution: 'Tiles &copy; Esri' }),
      L.tileLayer(ESRI_LABELS, { maxZoom: 19 }),
    ])
  }
  // roadmap
  return L.layerGroup([
    L.tileLayer(OSM, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }),
  ])
}
