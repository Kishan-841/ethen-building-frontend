'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/auth-store'
import { IconSearch, IconPin, IconCrosshair } from '@/components/ui/icons'
import { getMapProvider } from '@/lib/map-providers'
import { GPS_ACCURACY_WARN_METERS } from '@/lib/constants'

const MIN_QUERY = 3
const DEBOUNCE_MS = 400

const LEVEL_STYLES = {
  good: 'bg-ok-tint text-ok',
  fair: 'bg-warn-tint text-warn',
  poor: 'bg-bad-tint text-bad',
}

/** Admin-only: type coordinates instead of standing at the building. */
function ManualCoordinates({ onSubmit }) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')

  const latNum = Number(lat)
  const lngNum = Number(lng)
  const valid =
    lat.trim() !== '' &&
    lng.trim() !== '' &&
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180

  return (
    <div className="flex flex-col gap-3 rounded-card border border-dashed border-line bg-card/60 p-4">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-faint">
        <IconPin className="h-3.5 w-3.5" /> Admin: enter coordinates instead
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="manual-lat"
          placeholder="Latitude"
          inputMode="decimal"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />
        <Input
          id="manual-lng"
          placeholder="Longitude"
          inputMode="decimal"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
        />
      </div>
      <Button
        variant="secondary"
        fullWidth
        disabled={!valid}
        onClick={() => onSubmit({ latitude: latNum, longitude: lngNum })}
      >
        Use these coordinates
      </Button>
    </div>
  )
}

/**
 * Unified "find the building" step. Search-first: the type-ahead is always
 * available (GPS only biases results). Capturing a location is optional and,
 * when done, unlocks "add a building right here" and enriches search.
 */
export function SearchStep({ position, geo, onSelect, onManual, onManualPosition }) {
  const role = useAuthStore((s) => s.user?.role)
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState(null) // null = idle, [] = no matches
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false) // fetching details after a pick
  const [error, setError] = useState(null)
  const [currentAddress, setCurrentAddress] = useState(null)
  const [osmBuildingName, setOsmBuildingName] = useState('')
  // One session token spans all keystrokes of a search + the final details
  // fetch — Google bills that as a single session, not per request.
  const sessionRef = useRef(null)
  const abortRef = useRef(null)

  // Free Nominatim reverse geocode — address context + name suggestion. Only
  // once a location exists (GPS or admin-entered).
  useEffect(() => {
    if (!position) return // no location yet — search runs unbiased
    let cancelled = false
    getMapProvider()
      .reverseGeocode(position)
      .then((place) => {
        if (cancelled) return
        setCurrentAddress(place.formattedAddress)
        setOsmBuildingName(place.buildingName ?? '')
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentAddress(`${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`)
        }
      })
    return () => {
      cancelled = true
    }
  }, [position])

  // Debounced type-ahead. Works with OR without a location — GPS only biases.
  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY) {
      setPredictions(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      if (!sessionRef.current) sessionRef.current = crypto.randomUUID()
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const results = await getMapProvider().autocomplete({
          input: q,
          latitude: position?.latitude,
          longitude: position?.longitude,
          sessionToken: sessionRef.current,
          signal: controller.signal,
        })
        setPredictions(results)
        setError(null)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('Search failed. Check your connection and try again.')
          setPredictions([])
        }
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, position])

  async function handleSelectPrediction(prediction) {
    setResolving(true)
    setError(null)
    try {
      const candidate = await getMapProvider().getPlaceDetails({
        placeId: prediction.placeId,
        sessionToken: sessionRef.current,
      })
      sessionRef.current = null // close the billing session
      onSelect(candidate)
    } catch {
      setError('Could not load that building. Try another, or add it manually.')
      setResolving(false)
    }
  }

  function handleManual() {
    const addressDerivedName =
      currentAddress && /[a-z]/i.test(currentAddress) ? currentAddress.split(',')[0].trim() : ''
    onManual({ address: currentAddress, suggestedName: osmBuildingName || addressDerivedName })
  }

  const showNoMatches = predictions?.length === 0 && !loading && query.trim().length >= MIN_QUERY
  const { position: gpsPosition, loading: locating, accuracy, accuracyLevel, error: geoError, locate } =
    geo ?? {}

  return (
    <div className="flex flex-col gap-4">
      {/* Search — always available, with or without a captured location */}
      <div>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-faint" />
          <input
            id="building-search"
            type="text"
            autoComplete="off"
            placeholder="Search building by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-full border border-line bg-card pl-11 pr-11 text-[15px] outline-none transition-shadow duration-200 placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15"
          />
          {(loading || resolving) && (
            <span className="loading loading-spinner loading-sm absolute right-4 top-1/2 -translate-y-1/2 text-fiber" />
          )}
        </div>

        {predictions?.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {predictions.map((prediction) => (
              <button
                key={prediction.placeId}
                disabled={resolving}
                onClick={() => handleSelectPrediction(prediction)}
                className="flex items-start gap-3 rounded-card bg-card p-3.5 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.99] disabled:opacity-50"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fiber-tint text-fiber">
                  <IconPin className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{prediction.primaryText}</span>
                  {prediction.secondaryText && (
                    <span className="mt-0.5 block truncate text-sm font-normal text-muted">
                      {prediction.secondaryText}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {showNoMatches && (
          <p className="mt-2 rounded-btn bg-scan-tint px-4 py-3 text-sm font-normal text-scan">
            No matches. Try fewer words, or capture your location below to add the building here.
          </p>
        )}
        {query.trim().length > 0 && query.trim().length < MIN_QUERY && (
          <p className="mt-2 px-1 text-xs font-normal text-faint">
            Keep typing — at least {MIN_QUERY} letters.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-medium uppercase tracking-wide text-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* Location — optional. Enriches search + lets you add a building right here. */}
      {position ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-card bg-card p-4 shadow-soft">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fiber-tint text-fiber">
              <IconCrosshair className="h-4.5 w-4.5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-faint">
                  Your current location
                </p>
                {gpsPosition && accuracy != null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${LEVEL_STYLES[accuracyLevel] ?? 'bg-paper text-muted'}`}
                  >
                    ±{Math.round(accuracy)} m
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm font-normal text-ink">
                {currentAddress ?? 'Finding address…'}
              </p>
              {gpsPosition && accuracy > GPS_ACCURACY_WARN_METERS && (
                <p className="mt-1.5 text-xs font-normal text-warn">
                  Accuracy is low — move outdoors or near a window and re-capture.
                </p>
              )}
            </div>
          </div>

          <Button variant="secondary" fullWidth onClick={handleManual} disabled={resolving}>
            Add a building at this location
          </Button>
          {locate && (
            <Button variant="ghost" fullWidth onClick={locate} loading={locating}>
              Re-capture location
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-card border border-dashed border-line bg-card/60 p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-faint">
            <IconCrosshair className="h-3.5 w-3.5" /> Pin your exact spot (optional)
          </p>
          <p className="text-sm font-normal text-muted">
            Standing at the building? Capture your GPS to add it right here and sharpen the search
            above.
          </p>
          {geoError && (
            <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
              {geoError}
            </p>
          )}
          {locate && (
            <Button fullWidth loading={locating} onClick={locate}>
              Capture my location
            </Button>
          )}
        </div>
      )}

      {role === 'ADMIN' && <ManualCoordinates onSubmit={onManualPosition} />}
    </div>
  )
}
