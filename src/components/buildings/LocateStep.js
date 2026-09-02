'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/auth-store'
import { IconCrosshair, IconPin } from '@/components/ui/icons'
import { GPS_ACCURACY_WARN_METERS } from '@/lib/constants'

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
    <div className="mt-2 flex flex-col gap-3 rounded-card border border-dashed border-line bg-card/60 p-4">
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
        Continue with these coordinates
      </Button>
    </div>
  )
}

export function LocateStep({ geo, onContinue, onManualPosition }) {
  const { loading, position, accuracy, accuracyLevel, error, locate } = geo
  const role = useAuthStore((s) => s.user?.role)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4 rounded-card bg-card p-5 shadow-soft">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fiber-tint text-fiber">
          <IconCrosshair
            className={`h-5.5 w-5.5 ${loading ? 'animate-signal' : ''}`}
            strokeWidth={1.8}
          />
        </span>
        <p className="text-sm font-normal leading-relaxed text-muted">
          Stand at the <span className="font-medium text-ink">building entrance</span>, then
          capture your GPS location. This anchors the whole record.
        </p>
      </div>

      {error && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      {position && (
        <div className={`rounded-card px-5 py-4 ${LEVEL_STYLES[accuracyLevel] ?? ''}`}>
          <p className="text-xl font-bold tabular-nums tracking-tight">
            ±{Math.round(accuracy)} m
          </p>
          <p className="mt-0.5 text-xs font-normal tabular-nums opacity-80">
            GPS accuracy · {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
          </p>
          {accuracy > GPS_ACCURACY_WARN_METERS && (
            <p className="mt-2 text-sm font-normal">
              Accuracy is low. Move outdoors or near a window and re-capture if possible.
            </p>
          )}
        </div>
      )}

      <Button
        onClick={locate}
        loading={loading}
        fullWidth
        variant={position ? 'secondary' : 'primary'}
      >
        {position ? 'Re-capture location' : 'Capture my location'}
      </Button>

      {position && (
        <Button onClick={onContinue} fullWidth>
          Continue
        </Button>
      )}

      {role === 'ADMIN' && <ManualCoordinates onSubmit={onManualPosition} />}
    </div>
  )
}
