'use client'

import { useEffect, useRef, useState } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { getMapProvider } from '@/lib/map-providers'
import { buildingColor, zoneColor } from '@/lib/constants'
import { buildingDotIcon, clusterRenderer, DECLUTTER_MAP_STYLE } from '@/lib/map-markers'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { IconSearch } from '@/components/ui/icons'

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // country-level fallback
const DEFAULT_ZOOM = 5
const MAX_POINTS = 100 // API cap (zone.schemas.js)
const EDIT_COLOR = '#0e7569' // --color-fiber

const polygonCentroid = (points) => ({
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
 * Full-screen draw/edit surface for a zone boundary. One editable polygon is
 * the source of truth: in Draw mode map clicks append vertices, Google's
 * handles drag and insert them, Undo pops the last. Done opens a save panel:
 * update an existing zone's boundary, or create a new zone with it.
 */
export default function GoogleBoundaryMapEditor({
  initialZoneId,
  defaultName = '',
  defaultCity = '',
  initialPoints = [],
  onClose,
  onSaved,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const polygonRef = useRef(null)
  const pathRef = useRef(null)
  const numberMarkersRef = useRef([])
  const rubberRef = useRef(null)
  const buildingMarkersRef = useRef(null) // null = never created (lazy)
  const buildingClustererRef = useRef(null)
  const zoneOverlaysRef = useRef(null)
  const projectionRef = useRef(null) // OverlayView for pixel → LatLng
  const drawingRef = useRef(false)
  const cleanupDomRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [pointCount, setPointCount] = useState(initialPoints.length)
  // Overlays are lazy AND optional: prod has hundreds of buildings/zones, so
  // nothing is fetched or rendered until its legend toggle is on. Buildings
  // default off (rarely needed while drawing); zones default on (overlap
  // avoidance). Both choices persist.
  const [buildingsShown, setBuildingsShown] = useState(() =>
    readPref('boundary-buildings-shown', false),
  )
  const [zonesShown, setZonesShown] = useState(() => readPref('boundary-zones-shown', true))
  const [zonesData, setZonesData] = useState(null)
  // Building tapped in Pan mode — compact details card, like the main map.
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  // Pan & zoom vs Draw: Google's own map-click event proved unreliable, so
  // Draw mode captures DOM clicks on the container and projects them to
  // coordinates — and doubling as an explicit mode makes the UX clearer.
  // Start in Pan so the user can navigate to the area first.
  const [drawing, setDrawing] = useState(false)
  const [layer, setLayer] = useMapLayer('boundary', 'hybrid')

  // Location search (same provider stack as the add-building flow).
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState([])

  // Save panel: update an existing zone's boundary or create a new zone.
  const drawnRef = useRef(null)
  const [zoneList, setZoneList] = useState([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveMode, setSaveMode] = useState(initialZoneId ? 'existing' : 'new')
  const [targetZoneId, setTargetZoneId] = useState(initialZoneId ?? '')
  const [name, setName] = useState(defaultName)
  const [city, setCity] = useState(defaultCity)
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

      // Own the ring as an explicit MVCArray, wrapped in a rings MVCArray:
      // `paths` is a collection of rings, so a flat empty array means ZERO
      // rings (getPath() === undefined) and a flat MVCArray of LatLngs gets
      // misread as rings (v3.65 poly.js forEach crashes). One explicit ring
      // works for every case, including starting empty.
      const path = new google.maps.MVCArray(
        initialPoints.map((p) => new google.maps.LatLng(p.latitude, p.longitude)),
      )
      const polygon = new google.maps.Polygon({
        map,
        paths: new google.maps.MVCArray([path]),
        strokeColor: EDIT_COLOR,
        strokeWeight: 2,
        fillColor: EDIT_COLOR,
        fillOpacity: 0.2,
        editable: true,
        draggable: false,
        zIndex: 10,
      })
      polygonRef.current = polygon
      pathRef.current = path

      // Numbered dots on every vertex — rebuilt on any path change (≤100, cheap).
      const renderNumbers = () => {
        numberMarkersRef.current.forEach((m) => m.setMap(null))
        numberMarkersRef.current = []
        for (let i = 0; i < path.getLength(); i++) {
          numberMarkersRef.current.push(
            new google.maps.Marker({
              map,
              position: path.getAt(i),
              clickable: false,
              zIndex: 11,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: EDIT_COLOR,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
              label: { text: String(i + 1), color: '#ffffff', fontSize: '10px', fontWeight: '700' },
            }),
          )
        }
      }
      const syncCount = () => {
        setPointCount(path.getLength())
        renderNumbers()
      }
      path.addListener('insert_at', syncCount)
      path.addListener('remove_at', syncCount)
      path.addListener('set_at', syncCount)

      // Pixel → LatLng projection (an empty OverlayView is the documented way).
      const projectionOverlay = new google.maps.OverlayView()
      projectionOverlay.onAdd = () => {}
      projectionOverlay.draw = () => {}
      projectionOverlay.onRemove = () => {}
      projectionOverlay.setMap(map)
      projectionRef.current = projectionOverlay

      // Draw mode adds vertices from DOM clicks — Google's map 'click' event
      // proved unreliable, plain container clicks are not.
      const container = containerRef.current
      const pixelToLatLng = (event) => {
        const projection = projectionRef.current?.getProjection()
        if (!projection) return null
        const rect = container.getBoundingClientRect()
        return projection.fromContainerPixelToLatLng(
          new google.maps.Point(event.clientX - rect.left, event.clientY - rect.top),
        )
      }
      const isMapSurface = (event) =>
        // Ignore Google's own controls (zoom buttons, attribution links).
        !event.target.closest('button, a, .gmnoprint, .gm-style-cc')
      const onContainerClick = (event) => {
        if (!drawingRef.current || !isMapSurface(event)) return
        if (path.getLength() >= MAX_POINTS) return
        const latLng = pixelToLatLng(event)
        if (latLng) path.push(latLng)
      }

      // Rubber band from the last vertex to the cursor (desktop only).
      const rubber = new google.maps.Polyline({
        map,
        path: [],
        strokeColor: EDIT_COLOR,
        strokeOpacity: 0.5,
        strokeWeight: 2,
        clickable: false,
        zIndex: 9,
      })
      rubberRef.current = rubber
      const onContainerMove = (event) => {
        const len = path.getLength()
        if (!drawingRef.current || len === 0 || len >= MAX_POINTS) {
          rubber.setPath([])
          return
        }
        const latLng = pixelToLatLng(event)
        rubber.setPath(latLng ? [path.getAt(len - 1), latLng] : [])
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

      // Right-click a vertex to remove it (Undo covers the common case).
      polygon.addListener('rightclick', (event) => {
        if (event.vertex !== undefined) path.removeAt(event.vertex)
      })

      // Start where the work is: the existing boundary, else the default view.
      if (initialPoints.length > 0) {
        const bounds = new google.maps.LatLngBounds()
        initialPoints.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }))
        map.fitBounds(bounds, 64)
      }

      renderNumbers()
      setReady(true)
    })
    return () => {
      cancelled = true
      cleanupDomRef.current?.()
      projectionRef.current?.setMap(null)
      polygonRef.current?.setMap(null)
      numberMarkersRef.current.forEach((m) => m.setMap(null))
      buildingClustererRef.current?.clearMarkers()
      buildingClustererRef.current = null
      zoneOverlaysRef.current?.forEach((o) => o.setMap(null))
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mapRef.current && ready) mapRef.current.setMapTypeId(layer)
  }, [layer, ready])

  // Draw mode: freeze pan/drag gestures (zoom buttons still work) and show a
  // crosshair so every click reads as "place a point". Pan mode restores
  // normal navigation and never adds points.
  useEffect(() => {
    drawingRef.current = drawing
    if (!mapRef.current || !ready) return
    mapRef.current.setOptions({
      gestureHandling: drawing ? 'none' : 'greedy',
      draggableCursor: drawing ? 'crosshair' : null,
    })
    if (!drawing) rubberRef.current?.setPath([])
  }, [drawing, ready])

  // One light zones fetch on mount: the save panel always needs the name
  // list; the boundary data feeds the overlay effect below when toggled on.
  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/zones')
      .then((res) => {
        if (cancelled) return
        setZonesData(res.data.data)
        setZoneList(res.data.data.map((zone) => ({ id: zone.id, name: zone.name })))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Building dots: fetched and created only the first time the toggle is on.
  // Clustered (like the main map) so hundreds of markers never fight the zoom
  // animation, with cheap cached raster icons instead of per-frame vectors.
  useEffect(() => {
    writePref('boundary-buildings-shown', buildingsShown)
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
          // In Draw mode a tap means "place a point" — details only in Pan.
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

  // Zone outlines + labelled centroid dots: created only when toggled on.
  useEffect(() => {
    writePref('boundary-zones-shown', zonesShown)
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
      .filter((zone) => zone.id !== initialZoneId && zone.boundary?.length >= 3)
      .flatMap((zone, index) => {
        const color = zoneColor(index)
        // Bold enough to read on satellite imagery — these exist so new zones
        // can avoid overlapping what's already drawn.
        const outline = new google.maps.Polygon({
          map,
          paths: zone.boundary.map((p) => ({ lat: p.latitude, lng: p.longitude })),
          strokeColor: color,
          strokeOpacity: 0.95,
          strokeWeight: 2.5,
          fillColor: color,
          fillOpacity: 0.15,
          clickable: false,
          zIndex: 1,
        })
        // Small zones vanish at low zoom — a dot + name at the centroid keeps
        // them findable at any zoom (same trick as the main map).
        const label = new google.maps.Marker({
          map,
          position: polygonCentroid(zone.boundary),
          clickable: false,
          zIndex: 3,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: color,
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
            className: 'boundary-zone-label',
          },
        })
        return [outline, label]
      })
  }, [zonesShown, ready, zonesData, initialZoneId])

  // Debounced location search via the existing provider stack. Short inputs
  // clear the list through the same timer (no synchronous setState in effects).
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

  function handleUndo() {
    const path = pathRef.current
    if (path?.getLength() > 0) path.removeAt(path.getLength() - 1)
  }

  function handleClear() {
    pathRef.current?.clear()
  }

  function handleDone() {
    const path = pathRef.current
    const points = []
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i)
      points.push({ latitude: point.lat(), longitude: point.lng() })
    }
    drawnRef.current = points
    setSaveError(null)
    setSaveOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const boundary = drawnRef.current
      if (saveMode === 'existing') {
        // Boundary-only update — the zone's name/city/operator stay untouched.
        await apiClient.patch(`/zones/${targetZoneId}`, { boundary })
      } else {
        await apiClient.post('/zones', { name: name.trim(), city: city.trim(), boundary })
      }
      onSaved?.()
    } catch (err) {
      setSaving(false)
      setSaveError(getApiErrorMessage(err))
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
      {/* Dark halo keeps zone-name labels readable on roadmap AND imagery. */}
      <style>{`.boundary-zone-label { text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.75); }`}</style>
      {/* Header — single row on desktop, title row + button row on mobile */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-card px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-faint">
            Zone boundary
          </p>
          <p className="truncate font-bold">{defaultName?.trim() || 'New zone'}</p>
        </div>
        <p className="shrink-0 text-sm tabular-nums text-muted">
          {pointCount} point{pointCount === 1 ? '' : 's'}
          <span className="hidden sm:inline">
            {pointCount < 3 && ' — need at least 3'}
            {pointCount >= MAX_POINTS && ` — limit ${MAX_POINTS}`}
          </span>
        </p>
        <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto">
          <Button variant="secondary" onClick={handleUndo} disabled={pointCount === 0}>
            Undo
          </Button>
          <Button variant="dangerGhost" onClick={handleClear} disabled={pointCount === 0}>
            Clear
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleDone} disabled={pointCount < 3}>
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

        {/* Mode toggle: Pan & zoom vs Draw (segmented, MapLayerControl style).
            Mobile stacks it below the full-width search, next to the layer control. */}
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
            Other zones
          </label>
        </div>

        <MapLayerControl
          value={layer}
          onChange={setLayer}
          position="right-3 top-[4.25rem] sm:top-3"
        />

        <p className="pointer-events-none absolute bottom-4 left-3 right-16 z-10 rounded-2xl border border-line bg-card/90 px-4 py-1.5 text-center text-xs text-muted shadow sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-full">
          {drawing
            ? 'Tap the map to add points · switch to Pan & zoom to move around'
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
              {selectedBuilding.details?.homePass != null && (
                <span className="rounded-full bg-paper px-2.5 py-0.5 text-muted">
                  {selectedBuilding.details.homePass} home pass
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

        {/* Save panel: pick a zone to update, or create a new one. */}
        {saveOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
            <div className="flex w-full max-w-md flex-col gap-4 rounded-card bg-card p-5 shadow-lift">
              <h2 className="text-base font-bold">Save boundary</h2>

              <div className="flex overflow-hidden rounded-btn border border-line text-sm font-medium">
                <button
                  onClick={() => setSaveMode('existing')}
                  aria-pressed={saveMode === 'existing'}
                  className={`flex-1 px-3 py-2.5 transition-colors ${
                    saveMode === 'existing' ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  Update existing zone
                </button>
                <button
                  onClick={() => setSaveMode('new')}
                  aria-pressed={saveMode === 'new'}
                  className={`flex-1 px-3 py-2.5 transition-colors ${
                    saveMode === 'new' ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  Create new zone
                </button>
              </div>

              {saveMode === 'existing' ? (
                <div className="flex flex-col gap-2">
                  <Select
                    id="boundary-zone"
                    value={targetZoneId}
                    onChange={(e) => setTargetZoneId(e.target.value)}
                  >
                    <option value="">Choose a zone…</option>
                    {zoneList.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs font-normal text-muted">
                    Only the boundary is replaced — the zone&apos;s name, city, and operator stay
                    as they are.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Input
                    id="boundary-name"
                    placeholder="Zone name e.g. Wakad West"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    id="boundary-city"
                    placeholder="City e.g. Pune"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              )}

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
                    saveMode === 'existing' ? !targetZoneId : !name.trim() || !city.trim()
                  }
                  onClick={handleSave}
                >
                  {saveMode === 'existing' ? 'Update zone' : 'Create zone'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
