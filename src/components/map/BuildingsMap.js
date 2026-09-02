'use client'

import dynamic from 'next/dynamic'
import { MAP_PROVIDER } from '@/lib/map-config'

/**
 * Provider dispatcher — consumers keep importing '@/components/map/BuildingsMap'
 * regardless of the configured provider. dynamic() code-splits so only the
 * selected map library ships to the browser.
 */
const BuildingsMap =
  MAP_PROVIDER === 'google'
    ? dynamic(() => import('./google/GoogleBuildingsMap'), { ssr: false })
    : dynamic(() => import('./leaflet/LeafletBuildingsMap'), { ssr: false })

export default BuildingsMap
