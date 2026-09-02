'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { buildingColor, zoneColor, fiberTypeColor } from '@/lib/constants'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { buildingPinCached, clusterRenderer, DECLUTTER_MAP_STYLE } from '@/lib/map-markers'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'

const polygonCentroid = (points) => ({
  lat: points.reduce((sum, p) => sum + p.latitude, 0) / points.length,
  lng: points.reduce((sum, p) => sum + p.longitude, 0) / points.length,
})

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // country-level fallback
const DEFAULT_ZOOM = 5

// Map instance pool: Google bills one "Dynamic Map load" per `new Map()`, so
// the main map is created ONCE per tab session and re-attached on every
// visit. Overlays (markers/zones/fiber) are still torn down per mount — only
// the billable Map object and its viewport survive. window.__mapLoads counts
// constructions so the saving is verifiable in the console.
let pooledMap = null
let pooledContainer = null
let pooledFitted = false
// Below this zoom, small zone polygons are near-invisible — show a colored
// dot notation at the centroid instead.
const ZONE_DETAIL_ZOOM = 13

const pinIcon = (building, selected) => {
  const pin = buildingPinCached({ color: buildingColor(building), selected })
  return {
    url: pin.url,
    scaledSize: new google.maps.Size(pin.width, pin.height),
    anchor: new google.maps.Point(pin.anchorX, pin.anchorY),
  }
}

/** Same contract as LeafletBuildingsMap — Google Maps JS implementation. */
export default function GoogleBuildingsMap({
  buildings,
  zones = [],
  fiberRoutes = [],
  selectedId,
  onSelect,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const zoneOverlaysRef = useRef([])
  const fiberOverlaysRef = useRef([])
  // Hovered/tapped fiber segment → floating details card at the cursor.
  const [fiberInfo, setFiberInfo] = useState(null)
  const clustererRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const selectedIdRef = useRef(selectedId)
  const prevSelectedRef = useRef(null)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])
  const [ready, setReady] = useState(false)
  const [layer, setLayer] = useMapLayer('tab', 'roadmap')

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || mapRef.current || !containerRef.current) return
      if (!pooledMap) {
        // The ONLY place a billable map load can happen for this page.
        pooledContainer = document.createElement('div')
        pooledContainer.style.width = '100%'
        pooledContainer.style.height = '100%'
        pooledMap = new Map(pooledContainer, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeId: layer, // 'roadmap' | 'satellite' | 'hybrid'
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false, // building taps belong to OUR markers, not Google POIs
          styles: DECLUTTER_MAP_STYLE, // hide Google's POI icon clutter
        })
        window.__mapLoads = (window.__mapLoads ?? 0) + 1
      }
      containerRef.current.appendChild(pooledContainer)
      mapRef.current = pooledMap
      clustererRef.current = new MarkerClusterer({
        map: mapRef.current,
        markers: [],
        renderer: clusterRenderer,
      })
      setReady(true)
    })
    return () => {
      cancelled = true
      clustererRef.current?.clearMarkers()
      clustererRef.current = null
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current.clear()
      fiberOverlaysRef.current.forEach((line) => line.setMap(null))
      zoneOverlaysRef.current.forEach((overlay) => overlay.setMap(null))
      zoneOverlaysRef.current = []
      // Detach (never destroy) the pooled map so the next visit is free.
      if (pooledContainer?.parentNode) pooledContainer.parentNode.removeChild(pooledContainer)
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply layer changes to the live map (initial value is set at creation).
  useEffect(() => {
    if (mapRef.current && ready) mapRef.current.setMapTypeId(layer)
  }, [layer, ready])

  // Zone boundaries: faint fill + dashed outline (Google polygons have no
  // native dash — the outline is a polyline of repeated dash symbols).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    zoneOverlaysRef.current.forEach((overlay) => overlay.setMap(null))
    zoneOverlaysRef.current = zones
      .map((zone, index) => ({ zone, color: zoneColor(index) }))
      .filter(({ zone }) => zone.boundary?.length >= 3)
      .flatMap(({ zone, color }) => {
        const path = zone.boundary.map((point) => ({
          lat: point.latitude,
          lng: point.longitude,
        }))
        const fill = new google.maps.Polygon({
          map,
          paths: path,
          strokeOpacity: 0,
          fillColor: color,
          fillOpacity: 0.12,
          clickable: false,
        })
        const dashedOutline = new google.maps.Polyline({
          map,
          path: [...path, path[0]], // close the ring
          strokeOpacity: 0,
          clickable: false,
          icons: [
            {
              icon: { path: 'M 0,-1.2 0,1.2', strokeOpacity: 1, strokeColor: color, scale: 2.5 },
              offset: '0',
              repeat: '14px',
            },
          ],
        })
        // Zone name floating at the polygon's centre — click to zoom to it.
        const label = new google.maps.Marker({
          map,
          position: polygonCentroid(zone.boundary),
          title: `Zoom to ${zone.name}`,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
          label: {
            text: zone.name.toUpperCase(),
            color,
            fontSize: '11px',
            fontWeight: '700',
          },
        })
        label.addListener('click', () => {
          const bounds = new google.maps.LatLngBounds()
          path.forEach((point) => bounds.extend(point))
          map.fitBounds(bounds, 48)
        })
        label.zoneColor = color
        return [fill, dashedOutline, label]
      })

    // Zoomed out: swap the invisible label anchor for a prominent colored
    // dot (name lifted above it) so small zones stay findable.
    const applyZoomStyle = () => {
      const zoomedOut = map.getZoom() < ZONE_DETAIL_ZOOM
      zoneOverlaysRef.current.forEach((overlay) => {
        if (!overlay.zoneColor) return
        overlay.setIcon(
          zoomedOut
            ? {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: overlay.zoneColor,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                labelOrigin: new google.maps.Point(0, -2.4),
              }
            : { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        )
      })
    }
    applyZoomStyle()
    const zoomListener = map.addListener('zoom_changed', applyZoomStyle)
    return () => zoomListener.remove()
  }, [zones, ready])

  // Fiber routes: plain colored polylines (trunk + branches per route).
  // Hover (or tap, on touch) shows a details card, like building pins do.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    fiberOverlaysRef.current.forEach((line) => line.setMap(null))
    fiberOverlaysRef.current = fiberRoutes.flatMap((route) =>
      (route.segments ?? []).map((segment) => {
        const line = new google.maps.Polyline({
          map,
          path: (segment.points ?? []).map((p) => ({ lat: p.latitude, lng: p.longitude })),
          strokeColor: fiberTypeColor(segment.fiberType),
          strokeOpacity: 0.9,
          strokeWeight: 4,
          zIndex: 5,
        })
        const show = (event) => {
          const dom = event.domEvent
          if (!dom) return
          setFiberInfo({
            x: dom.clientX,
            y: dom.clientY,
            name: route.name,
            fiberType: segment.fiberType,
            fiberId: route.fiberId,
            placement: route.placement,
            operator: route.operator?.name,
            remark: route.remark,
          })
        }
        line.addListener('mouseover', show)
        line.addListener('mousemove', show)
        line.addListener('click', show) // touch devices have no hover
        line.addListener('mouseout', () => setFiberInfo(null))
        return line
      }),
    )
  }, [fiberRoutes, ready])

  // Diff markers against the buildings prop — never tear down the world.
  // Selection is handled in its own effect so a tap only re-icons two pins.
  useEffect(() => {
    const map = mapRef.current
    const clusterer = clustererRef.current
    if (!map || !clusterer || !ready) return

    const markers = markersRef.current
    const seen = new Set()
    let changed = false

    buildings.forEach((building) => {
      seen.add(building.id)
      const selected = building.id === selectedIdRef.current
      const key = `${buildingColor(building)}|${selected}`
      let marker = markers.get(building.id)

      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: building.latitude, lng: building.longitude },
          icon: pinIcon(building, selected),
          zIndex: selected ? 1000 : 1, // selected pin sits on top
        })
        marker.addListener('click', () => {
          onSelectRef.current(marker.buildingData)
          map.panTo(marker.getPosition())
          if (map.getZoom() < 17) map.setZoom(17) // zoom in to the tapped building
        })
        marker.pinKey = key
        marker.buildingData = building
        markers.set(building.id, marker)
        clusterer.addMarker(marker, true)
        changed = true
        return
      }

      marker.buildingData = building
      const pos = marker.getPosition()
      if (pos.lat() !== building.latitude || pos.lng() !== building.longitude) {
        marker.setPosition({ lat: building.latitude, lng: building.longitude })
        changed = true
      }
      if (marker.pinKey !== key) {
        marker.setIcon(pinIcon(building, selected))
        marker.setZIndex(selected ? 1000 : 1)
        marker.pinKey = key
      }
    })

    markers.forEach((marker, id) => {
      if (seen.has(id)) return
      clusterer.removeMarker(marker, true)
      marker.setMap(null)
      markers.delete(id)
      changed = true
    })

    if (changed) clusterer.render()

    // Fit-to-all on first load (user decision) — later refetches keep the view.
    // Fit once per SESSION — revisits keep the viewport the user left at.
    if (!pooledFitted && buildings.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      buildings.forEach((b) => bounds.extend({ lat: b.latitude, lng: b.longitude }))
      map.fitBounds(bounds, 48)
      pooledFitted = true
    }
  }, [buildings, ready])

  // Selection: restyle only the previously- and newly-selected pins.
  useEffect(() => {
    selectedIdRef.current = selectedId
    if (!ready) return
    const markers = markersRef.current

    const restyle = (id, selected) => {
      const marker = markers.get(id)
      if (!marker?.buildingData) return
      marker.setIcon(pinIcon(marker.buildingData, selected))
      marker.setZIndex(selected ? 1000 : 1)
      marker.pinKey = `${buildingColor(marker.buildingData)}|${selected}`
    }

    if (prevSelectedRef.current && prevSelectedRef.current !== selectedId) {
      restyle(prevSelectedRef.current, false)
    }
    if (selectedId) restyle(selectedId, true)
    prevSelectedRef.current = selectedId
  }, [selectedId, ready])

  return (
    <div className="relative isolate z-0 h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <MapLayerControl value={layer} onChange={setLayer} position="right-3 top-[4.75rem] lg:top-24" />

      {/* Fiber hover/tap card — fixed at the cursor, like a rich tooltip.
          The fiberRoutes guard hides a stale card when the layer toggles off
          (no mouseout fires once the lines are gone). */}
      {fiberInfo && fiberRoutes.length > 0 && (
        <div
          className="pointer-events-none fixed z-50 w-56 rounded-card border border-line bg-card p-3 shadow-lift"
          style={{
            left: Math.min(fiberInfo.x + 14, window.innerWidth - 240),
            top: Math.min(fiberInfo.y + 14, window.innerHeight - 140),
          }}
        >
          <p className="truncate text-sm font-bold">{fiberInfo.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium">
            <span
              className="flex items-center gap-1.5 rounded-full bg-paper px-2 py-0.5 text-muted"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: fiberTypeColor(fiberInfo.fiberType) }}
              />
              {fiberInfo.fiberType}
            </span>
            {fiberInfo.placement && (
              <span className="rounded-full bg-paper px-2 py-0.5 text-muted">
                {fiberInfo.placement}
              </span>
            )}
            {fiberInfo.fiberId && (
              <span className="rounded-full bg-paper px-2 py-0.5 text-muted">
                {fiberInfo.fiberId}
              </span>
            )}
            {fiberInfo.operator && (
              <span className="rounded-full bg-fiber-tint px-2 py-0.5 text-fiber">
                {fiberInfo.operator}
              </span>
            )}
          </div>
          {fiberInfo.remark && (
            <p className="mt-1.5 line-clamp-2 text-xs font-normal text-muted">{fiberInfo.remark}</p>
          )}
        </div>
      )}
    </div>
  )
}
