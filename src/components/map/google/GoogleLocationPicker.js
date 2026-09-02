'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'

/** Same contract as LeafletLocationPicker — draggable pin on Google Maps JS. */
export default function GoogleLocationPicker({ latitude, longitude, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [ready, setReady] = useState(false)
  // Default satellite so the pin lands on the building from imagery.
  const [layer, setLayer] = useMapLayer('picker', 'satellite')
  // dragend binds once — route the latest onChange through a ref to avoid a
  // stale closure reverting edited form fields.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || mapRef.current) return
      const map = new Map(containerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 18,
        mapTypeId: layer, // 'roadmap' | 'satellite' | 'hybrid'
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      })

      const marker = new google.maps.Marker({
        map,
        position: { lat: latitude, lng: longitude },
        draggable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#0e7569', // --color-fiber
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      })
      marker.addListener('dragend', () => {
        const point = marker.getPosition()
        onChangeRef.current({ latitude: point.lat(), longitude: point.lng() })
      })

      mapRef.current = map
      markerRef.current = marker
      setReady(true)
    })
    return () => {
      cancelled = true
      markerRef.current?.setMap(null)
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ready && markerRef.current) {
      markerRef.current.setPosition({ lat: latitude, lng: longitude })
    }
  }, [latitude, longitude, ready])

  // Apply layer changes to the live map.
  useEffect(() => {
    if (mapRef.current && ready) mapRef.current.setMapTypeId(layer)
  }, [layer, ready])

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl">
      <div ref={containerRef} className="h-full w-full" />
      <MapLayerControl value={layer} onChange={setLayer} />
    </div>
  )
}
