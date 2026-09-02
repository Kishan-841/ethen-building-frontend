'use client'

import { useEffect, useRef, useState } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { getMapProvider } from '@/lib/map-providers'
import { buildingColor, zoneColor, FIBER_TYPES, fiberTypeColor } from '@/lib/constants'
import { buildingDotIcon, clusterRenderer, DECLUTTER_MAP_STYLE } from '@/lib/map-markers'
import { useMapLayer } from '@/lib/useMapLayer'
import { useOperators } from '@/hooks/useOperators'
import { MapLayerControl } from '@/components/map/MapLayerControl'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { IconSearch } from '@/components/ui/icons'
import { uploadFile } from '@/lib/upload'

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // country-level fallback
const DEFAULT_ZOOM = 5
const MAX_SEGMENT_POINTS = 200 // API caps (fiber-route.schemas.js)
const MAX_SEGMENTS = 50
const SNAP_PX = 12 // branch starts snap to an existing vertex within this radius

const polylineCentroid = (points) => ({
  lat: points.reduce((sum, p) => sum + p.latitude, 0) / points.length,
  lng: points.reduce((sum, p) => sum + p.longitude, 0) / points.length,
})

// Overlay preferences persist across sessions (same idea as useMapLayer).
const readPref = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === '1'
  } catch {
    return fallback
  }
}
const writePref = (key, value) => {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Private mode — the toggle still works for this session.
  }
}

/**
 * Full-screen draw/edit surface for a fiber route: multiple editable
 * polylines (trunk + branches). In Draw mode taps extend the ACTIVE line;
 * "New line" starts a branch whose first tap snaps to any existing vertex.
 * Save… updates an existing route's geometry/color or creates a new route.
 */
export default function GoogleFiberEditor({ initialRoute, onClose, onSaved }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const segmentsRef = useRef([]) // [{ path: MVCArray<LatLng>, polyline }]
  const activeRef = useRef(-1) // index taps append to (always the last segment)
  const vertexMarkersRef = useRef([])
  const rubberRef = useRef(null)
  const addSegmentRef = useRef(null)
  const syncRef = useRef(null)
  const buildingMarkersRef = useRef(null) // null = never created (lazy)
  const buildingClustererRef = useRef(null)
  const zoneOverlaysRef = useRef(null)
  const projectionRef = useRef(null) // OverlayView for pixel → LatLng
  const drawingRef = useRef(false)
  const cleanupDomRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [counts, setCounts] = useState({ lines: 0, points: 0, segments: 0, activeLen: 0 })
  // The type selected for the line being drawn — switching type mid-route
  // starts a new segment continuing from the last point.
  const initialType = initialRoute?.segments?.at(-1)?.fiberType ?? '2 core'
  const [currentType, setCurrentType] = useState(initialType)
  const typeRef = useRef(initialType)
  // Overlays are lazy AND optional (same pattern as the boundary editor).
  const [buildingsShown, setBuildingsShown] = useState(() =>
    readPref('fiber-buildings-shown', false),
  )
  const [zonesShown, setZonesShown] = useState(() => readPref('fiber-zones-shown', false))
  const [zonesData, setZonesData] = useState(null)
  // Existing fiber routes render as context by default — the whole point is
  // seeing what's already laid so new lines don't overlap or duplicate it.
  const [othersShown, setOthersShown] = useState(() => readPref('fiber-others-shown', true))
  const [routesData, setRoutesData] = useState(null)
  const otherFiberRef = useRef(null)
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  // Pan & zoom vs Draw — DOM clicks + projection; Google's map 'click' event
  // is unreliable in Maps JS v3.65. Start in Pan to navigate first.
  const [drawing, setDrawing] = useState(false)
  const [layer, setLayer] = useMapLayer('fiber', 'hybrid')

  // Location search (same provider stack as the add-building flow).
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState([])

  // Save panel: update an existing route or create a new one.
  const drawnRef = useRef(null)
  const [routeList, setRouteList] = useState([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveMode, setSaveMode] = useState(initialRoute?.id ? 'existing' : 'new')
  const [targetRouteId, setTargetRouteId] = useState(initialRoute?.id ?? '')
  const [name, setName] = useState(initialRoute?.name ?? '')
  const [fiberId, setFiberId] = useState(initialRoute?.fiberId ?? '')
  const [operatorId, setOperatorId] = useState(initialRoute?.operatorId ?? '')
  const { operators } = useOperators()
  const [placement, setPlacement] = useState(initialRoute?.placement ?? 'OUT')
  const [remark, setRemark] = useState(initialRoute?.remark ?? '')
  const [images, setImages] = useState(initialRoute?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || mapRef.current || !containerRef.current) return
      const map = new Map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: layer,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        styles: DECLUTTER_MAP_STYLE,
      })
      mapRef.current = map

      // Plain dots on every vertex; the ACTIVE line's last vertex is bigger —
      // that's where the next tap extends from. Junctions read naturally as
      // overlapping dots.
      const renderDots = () => {
        vertexMarkersRef.current.forEach((m) => m.setMap(null))
        vertexMarkersRef.current = []
        segmentsRef.current.forEach((segment, segIndex) => {
          const path = segment.path
          for (let i = 0; i < path.getLength(); i++) {
            const isGrowingTip =
              segIndex === activeRef.current && i === path.getLength() - 1
            vertexMarkersRef.current.push(
              new google.maps.Marker({
                map,
                position: path.getAt(i),
                clickable: false,
                zIndex: 11,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isGrowingTip ? 7 : 4.5,
                  fillColor: fiberTypeColor(segment.fiberType),
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                },
              }),
            )
          }
        })
      }
      const sync = () => {
        const segments = segmentsRef.current
        setCounts({
          lines: segments.filter((s) => s.path.getLength() >= 2).length,
          points: segments.reduce((sum, s) => sum + s.path.getLength(), 0),
          segments: segments.length,
          activeLen: segments[activeRef.current]?.path.getLength() ?? 0,
        })
        renderDots()
      }
      syncRef.current = sync

      // Polylines take a FLAT path (unlike polygon rings) — an explicit
      // MVCArray of LatLngs is still the safe construction on v3.65.
      const addSegment = (points = [], fiberType = typeRef.current) => {
        const path = new google.maps.MVCArray(
          points.map((p) =>
            p instanceof google.maps.LatLng ? p : new google.maps.LatLng(p.latitude, p.longitude),
          ),
        )
        const polyline = new google.maps.Polyline({
          map,
          path,
          strokeColor: fiberTypeColor(fiberType),
          strokeOpacity: 0.95,
          strokeWeight: 3,
          editable: true,
          zIndex: 10,
        })
        path.addListener('insert_at', sync)
        path.addListener('remove_at', sync)
        path.addListener('set_at', sync)
        // Right-click a vertex to remove it (Undo covers the common case).
        polyline.addListener('rightclick', (event) => {
          if (event.vertex !== undefined) path.removeAt(event.vertex)
        })
        segmentsRef.current.push({ path, polyline, fiberType })
        activeRef.current = segmentsRef.current.length - 1
        sync()
      }
      addSegmentRef.current = addSegment

      // Pixel → LatLng projection (an empty OverlayView is the documented way).
      const projectionOverlay = new google.maps.OverlayView()
      projectionOverlay.onAdd = () => {}
      projectionOverlay.draw = () => {}
      projectionOverlay.onRemove = () => {}
      projectionOverlay.setMap(map)
      projectionRef.current = projectionOverlay

      const container = containerRef.current
      const clickPixel = (event) => {
        const rect = container.getBoundingClientRect()
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
      }
      const pixelToLatLng = (pixel) => {
        const projection = projectionRef.current?.getProjection()
        if (!projection) return null
        return projection.fromContainerPixelToLatLng(new google.maps.Point(pixel.x, pixel.y))
      }
      const isMapSurface = (event) =>
        // Ignore Google's own controls (zoom buttons, attribution links).
        !event.target.closest('button, a, .gmnoprint, .gm-style-cc')

      // A branch's FIRST point snaps to the nearest existing vertex so the
      // split is exact geometry, not eyeballed.
      const snapToVertex = (pixel) => {
        const projection = projectionRef.current?.getProjection()
        if (!projection) return null
        let best = null
        let bestDist = SNAP_PX
        segmentsRef.current.forEach((segment, segIndex) => {
          if (segIndex === activeRef.current) return
          const path = segment.path
          for (let i = 0; i < path.getLength(); i++) {
            const vertex = path.getAt(i)
            const vp = projection.fromLatLngToContainerPixel(vertex)
            const dist = Math.hypot(vp.x - pixel.x, vp.y - pixel.y)
            if (dist <= bestDist) {
              bestDist = dist
              best = vertex
            }
          }
        })
        return best
      }

      const onContainerClick = (event) => {
        if (!drawingRef.current || !isMapSurface(event)) return
        const active = segmentsRef.current[activeRef.current]
        if (!active || active.path.getLength() >= MAX_SEGMENT_POINTS) return
        const pixel = clickPixel(event)
        const snapped = active.path.getLength() === 0 ? snapToVertex(pixel) : null
        const latLng = snapped ?? pixelToLatLng(pixel)
        if (latLng) active.path.push(latLng)
      }

      // Rubber band from the active line's last vertex to the cursor.
      const rubber = new google.maps.Polyline({
        map,
        path: [],
        strokeColor: fiberTypeColor(typeRef.current),
        strokeOpacity: 0.5,
        strokeWeight: 2,
        clickable: false,
        zIndex: 9,
      })
      rubberRef.current = rubber
      const onContainerMove = (event) => {
        const active = segmentsRef.current[activeRef.current]
        const len = active?.path.getLength() ?? 0
        if (!drawingRef.current || len === 0 || len >= MAX_SEGMENT_POINTS) {
          rubber.setPath([])
          return
        }
        const latLng = pixelToLatLng(clickPixel(event))
        rubber.setPath(latLng ? [active.path.getAt(len - 1), latLng] : [])
      }
      const onContainerLeave = () => rubber.setPath([])
      container.addEventListener('click', onContainerClick)
      container.addEventListener('mousemove', onContainerMove)
      container.addEventListener('mouseleave', onContainerLeave)
      cleanupDomRef.current = () => {
        container.removeEventListener('click', onContainerClick)
        container.removeEventListener('mousemove', onContainerMove)
        container.removeEventListener('mouseleave', onContainerLeave)
      }

      // Load the existing route (or start a fresh empty trunk), then frame it.
      const initialSegments = initialRoute?.segments ?? []
      if (initialSegments.length > 0) {
        initialSegments.forEach((segment) =>
          addSegment(segment.points ?? [], segment.fiberType ?? '2 core'),
        )
        const bounds = new google.maps.LatLngBounds()
        initialSegments
          .flatMap((segment) => segment.points ?? [])
          .forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }))
        map.fitBounds(bounds, 64)
      } else {
        addSegment([])
      }

      setReady(true)
    })
    return () => {
      cancelled = true
      cleanupDomRef.current?.()
      projectionRef.current?.setMap(null)
      segmentsRef.current.forEach((segment) => segment.polyline.setMap(null))
      segmentsRef.current = []
      vertexMarkersRef.current.forEach((m) => m.setMap(null))
      buildingClustererRef.current?.clearMarkers()
      buildingClustererRef.current = null
      zoneOverlaysRef.current?.forEach((o) => o.setMap(null))
      otherFiberRef.current?.forEach((o) => o.setMap(null))
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mapRef.current && ready) mapRef.current.setMapTypeId(layer)
  }, [layer, ready])

  // Draw mode: freeze pan/drag gestures (zoom buttons still work), crosshair.
  useEffect(() => {
    drawingRef.current = drawing
    if (!mapRef.current || !ready) return
    mapRef.current.setOptions({
      gestureHandling: drawing ? 'none' : 'greedy',
      draggableCursor: drawing ? 'crosshair' : null,
    })
    if (!drawing) rubberRef.current?.setPath([])
  }, [drawing, ready])

  // One fetch on mount feeds both the save panel's route list and the
  // "other fiber" context overlay.
  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/fiber-routes')
      .then((res) => {
        if (cancelled) return
        setRoutesData(res.data.data)
        setRouteList(res.data.data.map((r) => ({ id: r.id, name: r.name })))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Existing fiber overlay: each route in its own color, dimmer and thinner
  // than the line being drawn, with a name tag at its start point.
  useEffect(() => {
    writePref('fiber-others-shown', othersShown)
    const map = mapRef.current
    if (!ready || !map || !routesData) return
    if (!othersShown) {
      otherFiberRef.current?.forEach((overlay) => overlay.setMap(null))
      return
    }
    if (otherFiberRef.current) {
      otherFiberRef.current.forEach((overlay) => overlay.setMap(map))
      return
    }
    otherFiberRef.current = routesData
      .filter((route) => route.id !== initialRoute?.id && route.segments?.length)
      .flatMap((route) => {
        const lines = route.segments.map(
          (segment) =>
            new google.maps.Polyline({
              map,
              path: (segment.points ?? []).map((p) => ({ lat: p.latitude, lng: p.longitude })),
              strokeColor: fiberTypeColor(segment.fiberType),
              strokeOpacity: 0.65,
              strokeWeight: 2.5,
              clickable: false,
              zIndex: 4,
            }),
        )
        const start = route.segments[0]?.points?.[0]
        if (start) {
          lines.push(
            new google.maps.Marker({
              map,
              position: { lat: start.latitude, lng: start.longitude },
              clickable: false,
              zIndex: 4,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: fiberTypeColor(route.segments[0]?.fiberType),
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                labelOrigin: new google.maps.Point(0, -2.4),
              },
              label: {
                text: route.name.toUpperCase(),
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '700',
                className: 'fiber-zone-label',
              },
            }),
          )
        }
        return lines
      })
  }, [othersShown, ready, routesData, initialRoute?.id])

  // Lazy zones fetch feeds the zones overlay only when first enabled.
  useEffect(() => {
    if (!zonesShown || zonesData) return
    let cancelled = false
    apiClient
      .get('/zones')
      .then((res) => {
        if (!cancelled) setZonesData(res.data.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [zonesShown, zonesData])

  // Building dots: fetched/created only the first time the toggle is on;
  // clustered with cached raster icons (main-map performance treatment).
  useEffect(() => {
    writePref('fiber-buildings-shown', buildingsShown)
    const map = mapRef.current
    if (!ready || !map) return
    if (!buildingsShown) {
      buildingClustererRef.current?.clearMarkers()
      return
    }
    if (buildingMarkersRef.current) {
      buildingClustererRef.current?.addMarkers(buildingMarkersRef.current)
      return
    }
    let cancelled = false
    apiClient
      .get('/buildings', { params: { pageSize: 500 } })
      .then((res) => {
        if (cancelled || !mapRef.current) return
        const markers = res.data.data.items.map((building) => {
          const dot = buildingDotIcon(buildingColor(building))
          const marker = new google.maps.Marker({
            position: { lat: building.latitude, lng: building.longitude },
            zIndex: 2,
            icon: {
              url: dot.url,
              scaledSize: new google.maps.Size(dot.size, dot.size),
              anchor: new google.maps.Point(dot.size / 2, dot.size / 2),
            },
          })
          marker.addListener('click', () => {
            if (!drawingRef.current) setSelectedBuilding(building)
          })
          return marker
        })
        buildingMarkersRef.current = markers
        buildingClustererRef.current = new MarkerClusterer({
          map: mapRef.current,
          markers,
          renderer: clusterRenderer,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [buildingsShown, ready])

  // Zone outlines + labelled centroid dots (context for laying fiber).
  useEffect(() => {
    writePref('fiber-zones-shown', zonesShown)
    const map = mapRef.current
    if (!ready || !map || !zonesData) return
    if (!zonesShown) {
      zoneOverlaysRef.current?.forEach((overlay) => overlay.setMap(null))
      return
    }
    if (zoneOverlaysRef.current) {
      zoneOverlaysRef.current.forEach((overlay) => overlay.setMap(map))
      return
    }
    zoneOverlaysRef.current = zonesData
      .filter((zone) => zone.boundary?.length >= 3)
      .flatMap((zone, index) => {
        const zc = zoneColor(index)
        const outline = new google.maps.Polygon({
          map,
          paths: zone.boundary.map((p) => ({ lat: p.latitude, lng: p.longitude })),
          strokeColor: zc,
          strokeOpacity: 0.95,
          strokeWeight: 2.5,
          fillColor: zc,
          fillOpacity: 0.15,
          clickable: false,
          zIndex: 1,
        })
        const label = new google.maps.Marker({
          map,
          position: polylineCentroid(zone.boundary),
          clickable: false,
          zIndex: 3,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: zc,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            labelOrigin: new google.maps.Point(0, -2.4),
          },
          label: {
            text: zone.name.toUpperCase(),
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: '700',
            className: 'fiber-zone-label',
          },
        })
        return [outline, label]
      })
  }, [zonesShown, ready, zonesData])

  // Debounced location search via the existing provider stack.
  useEffect(() => {
    const input = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        if (input.length < 3) {
          setPredictions([])
          return
        }
        const center = mapRef.current?.getCenter()
        getMapProvider()
          .autocomplete({
            input,
            latitude: center?.lat() ?? DEFAULT_CENTER.lat,
            longitude: center?.lng() ?? DEFAULT_CENTER.lng,
            signal: controller.signal,
          })
          .then((results) => setPredictions(results.slice(0, 5)))
          .catch(() => {})
      },
      input.length < 3 ? 0 : 350,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  async function jumpTo(prediction) {
    setQuery('')
    setPredictions([])
    let { latitude, longitude } = prediction
    if (latitude == null) {
      try {
        ;({ latitude, longitude } = await getMapProvider().getPlaceDetails({
          placeId: prediction.placeId,
        }))
      } catch {
        return
      }
    }
    mapRef.current?.panTo({ lat: latitude, lng: longitude })
    mapRef.current?.setZoom(15)
  }

  // Switching type mid-route: the cable continues in the new type — a new
  // segment starts at the active line's last point. On a line that hasn't
  // really started (0–1 points), just retype/recolor it.
  function selectType(type) {
    setCurrentType(type)
    typeRef.current = type
    rubberRef.current?.setOptions({ strokeColor: fiberTypeColor(type) })
    const active = segmentsRef.current[activeRef.current]
    if (!active) return
    if (active.path.getLength() >= 2) {
      if (active.fiberType !== type) {
        addSegmentRef.current?.([active.path.getAt(active.path.getLength() - 1)], type)
      }
    } else {
      active.fiberType = type
      active.polyline.setOptions({ strokeColor: fiberTypeColor(type) })
      syncRef.current?.()
    }
  }

  function handleNewLine() {
    addSegmentRef.current?.([], typeRef.current)
  }

  function handleUndo() {
    const segments = segmentsRef.current
    const active = segments[activeRef.current]
    if (!active) return
    if (active.path.getLength() > 0) active.path.removeAt(active.path.getLength() - 1)
    // An emptied branch disappears; drawing resumes on the previous line.
    if (active.path.getLength() === 0 && segments.length > 1) {
      active.polyline.setMap(null)
      segments.splice(activeRef.current, 1)
      activeRef.current = segments.length - 1
      syncRef.current?.()
    }
  }

  function handleClearAll() {
    segmentsRef.current.forEach((segment) => segment.polyline.setMap(null))
    segmentsRef.current = []
    addSegmentRef.current?.([])
  }

  function handleDone() {
    const segments = segmentsRef.current
      .map((segment) => {
        const points = []
        for (let i = 0; i < segment.path.getLength(); i++) {
          const point = segment.path.getAt(i)
          points.push({ latitude: point.lat(), longitude: point.lng() })
        }
        return { fiberType: segment.fiberType, points }
      })
      .filter((segment) => segment.points.length >= 2)
    drawnRef.current = segments
    setSaveError(null)
    setSaveOpen(true)
  }

  // Picking an existing target pre-fills its saved details so an update
  // starts from what's on record.
  function selectTarget(id) {
    setTargetRouteId(id)
    const route = routesData?.find((r) => r.id === id)
    if (route) {
      setFiberId(route.fiberId ?? '')
      setPlacement(route.placement ?? 'OUT')
      setOperatorId(route.operatorId ?? '')
      setRemark(route.remark ?? '')
      setImages(route.images ?? [])
    }
  }

  async function handleImagesPicked(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    setSaveError(null)
    try {
      for (const file of files) {
        const url = await uploadFile(file)
        setImages((prev) => [...prev, url])
      }
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Image upload failed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        segments: drawnRef.current,
        fiberId: fiberId.trim(),
        placement,
        operatorId: operatorId || null,
        remark: remark.trim() || null,
        images,
      }
      if (saveMode === 'existing') {
        // Geometry + details update — the route's name stays.
        await apiClient.patch(`/fiber-routes/${targetRouteId}`, payload)
      } else {
        await apiClient.post('/fiber-routes', { name: name.trim(), ...payload })
      }
      onSaved?.()
    } catch (err) {
      setSaving(false)
      setSaveError(getApiErrorMessage(err))
    }
  }

  const detailsComplete = Boolean(fiberId.trim())

  const canBranch = ready && counts.activeLen >= 2 && counts.segments < MAX_SEGMENTS

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
      {/* Dark halo keeps zone-name labels readable on roadmap AND imagery. */}
      <style>{`.fiber-zone-label { text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.75); }`}</style>
      {/* Header — single row on desktop, title row + button row on mobile */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-card px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-faint">
            Fiber route
          </p>
          <p className="truncate font-bold">{initialRoute?.name?.trim() || 'New route'}</p>
        </div>
        <p className="shrink-0 text-sm tabular-nums text-muted">
          {counts.lines} line{counts.lines === 1 ? '' : 's'} · {counts.points} point
          {counts.points === 1 ? '' : 's'}
        </p>
        <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto">
          <Button variant="secondary" onClick={handleUndo} disabled={counts.points === 0}>
            Undo
          </Button>
          <Button variant="secondary" onClick={handleNewLine} disabled={!canBranch}>
            New line
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleDone} disabled={counts.lines < 1}>
            Save…
          </Button>
        </div>
      </div>

      {/* Map + floating controls */}
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />

        <div className="absolute left-3 right-3 top-3 z-10 sm:right-auto sm:w-72 sm:max-w-[calc(100%-6rem)]">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search location…"
              className="h-11 w-full rounded-xl border border-line bg-card pl-9 pr-3 text-sm shadow-md outline-none focus:border-fiber focus:ring-2 focus:ring-fiber/15"
            />
          </div>
          {predictions.length > 0 && (
            <div className="mt-1 overflow-hidden rounded-xl border border-line bg-card shadow-lift">
              {predictions.map((prediction) => (
                <button
                  key={prediction.placeId}
                  onClick={() => jumpTo(prediction)}
                  className="block w-full truncate px-3 py-2.5 text-left text-sm transition-colors hover:bg-paper"
                >
                  <span className="font-medium">{prediction.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {prediction.formattedAddress}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mode toggle: Pan & zoom vs Draw (segmented). */}
        <div className="absolute left-3 top-[4.25rem] z-10 flex overflow-hidden rounded-btn border border-line bg-card/95 text-xs font-medium shadow-soft backdrop-blur sm:left-1/2 sm:top-3 sm:-translate-x-1/2 sm:text-sm">
          <button
            onClick={() => setDrawing(false)}
            aria-pressed={!drawing}
            className={`px-3 py-2.5 transition-colors sm:px-4 ${
              drawing ? 'text-muted hover:text-ink' : 'bg-fiber text-white'
            }`}
          >
            Pan &amp; zoom
          </button>
          <button
            onClick={() => {
              setDrawing(true)
              setSelectedBuilding(null) // a stale card is noise while drawing
            }}
            aria-pressed={drawing}
            className={`px-3 py-2.5 transition-colors sm:px-4 ${
              drawing ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
            }`}
          >
            Draw points
          </button>
        </div>

        {/* Fiber type selector + legend in one: the color IS the type. While
            drawing, switching type continues the cable as a new segment. */}
        <div className="absolute left-3 top-[7.25rem] z-10 flex max-w-[calc(100%-6rem)] flex-wrap gap-1.5 rounded-btn border border-line bg-card/95 p-1.5 shadow-soft backdrop-blur sm:left-1/2 sm:top-[3.9rem] sm:-translate-x-1/2">
          {FIBER_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => selectType(type)}
              aria-pressed={currentType === type}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
                currentType === type ? 'bg-paper ring-1 ring-line' : 'text-muted hover:text-ink'
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full border border-white shadow"
                style={{ backgroundColor: fiberTypeColor(type) }}
              />
              {type}
            </button>
          ))}
        </div>

        {/* Legend: overlays load lazily — nothing is fetched until enabled. */}
        <div className="absolute bottom-[4.5rem] left-3 z-10 flex flex-col gap-2 sm:bottom-4 sm:flex-row">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-xs font-medium shadow-md">
            <input
              type="checkbox"
              checked={buildingsShown}
              onChange={(e) => {
                setBuildingsShown(e.target.checked)
                if (!e.target.checked) setSelectedBuilding(null)
              }}
              className="checkbox checkbox-xs"
            />
            Buildings
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-xs font-medium shadow-md">
            <input
              type="checkbox"
              checked={zonesShown}
              onChange={(e) => setZonesShown(e.target.checked)}
              className="checkbox checkbox-xs"
            />
            Zones
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-xs font-medium shadow-md">
            <input
              type="checkbox"
              checked={othersShown}
              onChange={(e) => setOthersShown(e.target.checked)}
              className="checkbox checkbox-xs"
            />
            Other fiber
          </label>
          {counts.points > 0 && (
            <button
              onClick={handleClearAll}
              className="rounded-full border border-line bg-card px-3.5 py-2 text-xs font-medium text-bad shadow-md transition-colors hover:bg-bad-tint"
            >
              Clear all
            </button>
          )}
        </div>

        <MapLayerControl
          value={layer}
          onChange={setLayer}
          position="right-3 top-[4.25rem] sm:top-3"
        />

        <p className="pointer-events-none absolute bottom-4 left-3 right-16 z-10 rounded-2xl border border-line bg-card/90 px-4 py-1.5 text-center text-xs text-muted shadow sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-full">
          {drawing
            ? 'Tap to extend the line · New line + tap near a point to branch'
            : 'Navigate to the area, then switch to Draw points · drag handles to adjust'}
        </p>

        {/* Tapped building (Pan mode): compact details, like the main map. */}
        {selectedBuilding && (
          <div className="absolute bottom-16 left-3 right-3 z-10 mx-auto max-w-sm rounded-card border border-line bg-card p-4 shadow-lift sm:bottom-14">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{selectedBuilding.buildingName}</p>
                <p className="truncate text-sm font-normal text-muted">
                  {selectedBuilding.formattedAddress}
                </p>
              </div>
              <button
                aria-label="Close"
                onClick={() => setSelectedBuilding(null)}
                className="shrink-0 p-1 text-faint transition-colors hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span
                className={`rounded-full px-2.5 py-0.5 ${
                  selectedBuilding.isLive ? 'bg-fiber-tint text-fiber' : 'bg-bad-tint text-bad'
                }`}
              >
                {selectedBuilding.isLive ? 'Live' : 'Not live'}
              </span>
              {selectedBuilding.zone?.name && (
                <span className="rounded-full bg-paper px-2.5 py-0.5 text-muted">
                  {selectedBuilding.zone.name}
                </span>
              )}
              <a
                href={`/buildings/${selectedBuilding.id}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-fiber hover:underline"
              >
                Open building ↗
              </a>
            </div>
          </div>
        )}

        {/* Save panel: update an existing route, or create a new one. */}
        {saveOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-card bg-card p-5 shadow-lift">
              <h2 className="text-base font-bold">Save fiber route</h2>

              <div className="flex overflow-hidden rounded-btn border border-line text-sm font-medium">
                <button
                  onClick={() => setSaveMode('existing')}
                  aria-pressed={saveMode === 'existing'}
                  className={`flex-1 px-3 py-2.5 transition-colors ${
                    saveMode === 'existing' ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  Update existing route
                </button>
                <button
                  onClick={() => setSaveMode('new')}
                  aria-pressed={saveMode === 'new'}
                  className={`flex-1 px-3 py-2.5 transition-colors ${
                    saveMode === 'new' ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  Create new route
                </button>
              </div>

              {saveMode === 'existing' ? (
                <div className="flex flex-col gap-2">
                  <Select
                    id="fiber-route-target"
                    value={targetRouteId}
                    onChange={(e) => selectTarget(e.target.value)}
                  >
                    <option value="">Choose a route…</option>
                    {routeList.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs font-normal text-muted">
                    The route&apos;s lines and color are replaced — its name stays.
                  </p>
                </div>
              ) : (
                <Input
                  id="fiber-route-name"
                  placeholder="Route name e.g. Wakad trunk"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  id="fiber-id"
                  placeholder="Fiber ID e.g. FBR-014"
                  value={fiberId}
                  onChange={(e) => setFiberId(e.target.value)}
                />
                <Select
                  id="fiber-operator"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                >
                  <option value="">No operator</option>
                  {operators.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-btn border border-line bg-card px-4 py-3">
                <span className="text-sm font-medium text-ink">Placement</span>
                <div className="flex overflow-hidden rounded-full border border-line">
                  {['IN', 'OUT'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={placement === option}
                      onClick={() => setPlacement(option)}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                        placement === option ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                id="fiber-remark"
                rows={2}
                placeholder="Remark (optional)"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
                  Photos
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {images.map((url) => (
                    <span key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Fiber"
                        className="h-14 w-14 rounded-btn border border-line object-cover"
                      />
                      <button
                        aria-label="Remove photo"
                        onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bad text-[10px] font-bold text-white shadow"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-btn border border-dashed border-line text-xl text-muted transition-colors hover:border-fiber hover:text-fiber">
                    {uploading ? <span className="loading loading-spinner loading-sm" /> : '+'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={handleImagesPicked}
                    />
                  </label>
                </div>
              </div>

              {saveError && (
                <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
                  {saveError}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={saving}
                  onClick={() => setSaveOpen(false)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  loading={saving}
                  disabled={
                    uploading ||
                    !detailsComplete ||
                    (saveMode === 'existing' ? !targetRouteId : !name.trim())
                  }
                  onClick={handleSave}
                >
                  {saveMode === 'existing' ? 'Update route' : 'Create route'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
