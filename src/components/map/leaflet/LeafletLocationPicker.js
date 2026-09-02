'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createBaseLayer } from '@/lib/leaflet-layers'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'

const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:20px;height:20px;border-radius:9999px;background:#2563eb;border:4px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

export default function LocationPicker({ latitude, longitude, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const baseLayerRef = useRef(null)
  // Placing a pin on the building is easier over imagery, so default satellite.
  const [layer, setLayer] = useMapLayer('picker', 'satellite')
  // The dragend handler is bound once; route the latest onChange through a ref
  // so a drag never fires a stale closure (which reverted edited form fields).
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (mapRef.current) return

    const map = L.map(containerRef.current).setView([latitude, longitude], 18)

    const marker = L.marker([latitude, longitude], { draggable: true, icon: markerIcon }).addTo(map)
    marker.on('dragend', () => {
      const point = marker.getLatLng()
      onChangeRef.current({ latitude: point.lat, longitude: point.lng })
    })

    mapRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current = null
      baseLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (baseLayerRef.current) baseLayerRef.current.remove()
    baseLayerRef.current = createBaseLayer(layer)
    baseLayerRef.current.addTo(map)
  }, [layer])

  useEffect(() => {
    if (markerRef.current) markerRef.current.setLatLng([latitude, longitude])
  }, [latitude, longitude])

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl">
      <div ref={containerRef} className="h-full w-full" />
      <MapLayerControl value={layer} onChange={setLayer} />
    </div>
  )
}
