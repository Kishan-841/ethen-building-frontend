'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { buildingColor, zoneColor } from '@/lib/constants'
import { buildingPin } from '@/lib/map-markers'
import { createBaseLayer } from '@/lib/leaflet-layers'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'

// Zone names are user-entered and land in divIcon HTML — escape them.
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  )

const polygonCentroid = (points) => [
  points.reduce((sum, p) => sum + p.latitude, 0) / points.length,
  points.reduce((sum, p) => sum + p.longitude, 0) / points.length,
]

const DEFAULT_CENTER = [20.5937, 78.9629] // country-level fallback when no buildings
const DEFAULT_ZOOM = 5

export default function BuildingsMap({ buildings, zones = [], selectedId, onSelect }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const zoneLayersRef = useRef([])
  const fittedRef = useRef(false)
  const baseLayerRef = useRef(null)
  const [layer, setLayer] = useMapLayer('tab', 'roadmap')

  useEffect(() => {
    if (mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      DEFAULT_CENTER,
      DEFAULT_ZOOM,
    )
    mapRef.current = map

    // Re-tile when the container resizes (e.g. the sidebar collapses) —
    // Leaflet only listens to window resize on its own.
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      baseLayerRef.current = null
    }
  }, [])

  // Swap the base tile layer when the layer choice changes (also adds it on
  // first mount). Base layers live in tilePane, below the marker/zone panes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (baseLayerRef.current) baseLayerRef.current.remove()
    baseLayerRef.current = createBaseLayer(layer)
    baseLayerRef.current.addTo(map)
  }, [layer])

  // Zone boundaries: dashed outline + faint fill, drawn under the markers.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    zoneLayersRef.current.forEach((layer) => layer.remove())
    zoneLayersRef.current = zones
      .map((zone, index) => ({ zone, color: zoneColor(index) }))
      .filter(({ zone }) => zone.boundary?.length >= 3)
      .flatMap(({ zone, color }) => {
        const polygon = L.polygon(
          zone.boundary.map((point) => [point.latitude, point.longitude]),
          {
            color,
            weight: 2.5,
            dashArray: '8 6',
            fillColor: color,
            fillOpacity: 0.12,
            interactive: false,
          },
        ).addTo(map)

        // Zone name floating at the polygon's centre — click to zoom to it.
        const label = L.marker(polygonCentroid(zone.boundary), {
          interactive: true,
          keyboard: false,
          icon: L.divIcon({
            className: '',
            html: `<span style="display:inline-block;transform:translate(-50%,-50%);padding:3px 10px;border-radius:999px;background:${color};color:#fff;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;box-shadow:0 1px 4px rgb(0 0 0/.25);cursor:pointer">${escapeHtml(zone.name)}</span>`,
            iconSize: [0, 0],
          }),
        }).addTo(map)
        label.on('click', () =>
          map.fitBounds(
            L.latLngBounds(zone.boundary.map((point) => [point.latitude, point.longitude])).pad(
              0.15,
            ),
          ),
        )

        return [polygon, label]
      })
  }, [zones])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current.clear()

    buildings.forEach((building) => {
      const isSelected = building.id === selectedId
      const pin = buildingPin({
        color: buildingColor(building),
        selected: isSelected,
      })
      const marker = L.marker([building.latitude, building.longitude], {
        icon: L.divIcon({
          className: '',
          html: pin.svg,
          iconSize: [pin.width, pin.height],
          iconAnchor: [pin.anchorX, pin.anchorY],
        }),
        zIndexOffset: isSelected ? 1000 : 0,
      }).addTo(map)
      marker.on('click', () => {
        onSelect(building)
        // Zoom in to the tapped building (keep deeper zoom if already closer).
        map.setView([building.latitude, building.longitude], Math.max(map.getZoom(), 17), {
          animate: true,
        })
      })
      markersRef.current.set(building.id, marker)
    })

    // Fit-to-all on first load (user decision) — later refetches keep the view.
    if (!fittedRef.current && buildings.length > 0) {
      const bounds = L.latLngBounds(buildings.map((b) => [b.latitude, b.longitude]))
      map.fitBounds(bounds.pad(0.2), { maxZoom: 16 })
      fittedRef.current = true
    }
  }, [buildings, selectedId, onSelect])

  // isolate: trap Leaflet's internal z-indexes (panes go up to 700) in their own
  // stacking context so page overlays like the search bar can sit above at z-40.
  return (
    <div className="relative isolate z-0 h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <MapLayerControl value={layer} onChange={setLayer} position="right-3 top-[4.75rem] lg:top-24" />
    </div>
  )
}
