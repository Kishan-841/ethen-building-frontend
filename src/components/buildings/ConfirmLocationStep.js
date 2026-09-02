'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { IconPin } from '@/components/ui/icons'

const LocationPicker = dynamic(() => import('@/components/map/LocationPicker'), { ssr: false })

export function ConfirmLocationStep({ draft, onDraftChange, onContinue, manual, busy = false }) {
  return (
    <div className="flex flex-col gap-4">
      {/*
        The name is ALWAYS editable: map providers may return unit-level or
        empty names ("Office No 915, 9th Floor…") — the surveyor standing at
        the entrance knows the real building name. Prefilled when a candidate
        was selected; empty (and focused) on the manual path.
      */}
      <Input
        id="buildingName"
        label="Building name"
        placeholder="e.g. Sunrise Apartments"
        autoFocus={manual || !draft.buildingName}
        value={draft.buildingName}
        onChange={(e) => onDraftChange({ ...draft, buildingName: e.target.value })}
      />
      {draft.nameSuggested && (
        <p className="-mt-2 rounded-btn bg-warn-tint px-4 py-3 text-sm font-normal text-warn">
          Auto-suggested from the closest place on the map — it may not be this
          building&apos;s real name. Please verify or correct it before saving.
        </p>
      )}

      <div className="flex items-start gap-3 rounded-card bg-card p-4 shadow-soft">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fiber-tint text-fiber">
          <IconPin className="h-4.5 w-4.5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Address</p>
          <p className="mt-0.5 text-sm font-normal text-ink">{draft.formattedAddress}</p>
        </div>
      </div>

      <p className="text-sm font-normal text-muted">
        Drag the pin if it is not exactly on the building entrance.
      </p>

      <div className="overflow-hidden rounded-card shadow-soft">
        <LocationPicker
          latitude={draft.latitude}
          longitude={draft.longitude}
          onChange={({ latitude, longitude }) => onDraftChange({ ...draft, latitude, longitude })}
        />
        {/* Live readout — re-renders as the pin moves */}
        <p className="bg-card px-4 py-3 text-sm font-normal tabular-nums text-muted">
          {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}
        </p>
      </div>

      <Button fullWidth onClick={onContinue} disabled={!draft.buildingName?.trim()} loading={busy}>
        Confirm location
      </Button>
    </div>
  )
}
