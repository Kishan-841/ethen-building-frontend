'use client'

import dynamic from 'next/dynamic'
import { MAP_PROVIDER } from '@/lib/map-config'

/** Provider dispatcher — see BuildingsMap.js. */
const LocationPicker =
  MAP_PROVIDER === 'google'
    ? dynamic(() => import('./google/GoogleLocationPicker'), { ssr: false })
    : dynamic(() => import('./leaflet/LeafletLocationPicker'), { ssr: false })

export default LocationPicker
