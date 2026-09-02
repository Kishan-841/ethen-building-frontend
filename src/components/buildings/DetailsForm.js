'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { IconDoc, IconCamera } from '@/components/ui/icons'
import { useZones } from '@/hooks/useZones'
import { ZoneSearchSelect } from '@/components/buildings/ZoneSearchSelect'
import { useBuildingTypes } from '@/hooks/useBuildingTypes'
import { buildingDetailsSchema } from '@/schemas/building'

function SectionLabel({ children }) {
  return (
    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-faint">{children}</p>
  )
}

function FileField({ id, label, accept, icon: FieldIcon, tone = 'doc', multiple = false, onChange }) {
  const [names, setNames] = useState([])

  const tones = {
    doc: 'bg-doc-tint text-doc',
    photo: 'bg-fiber-tint text-fiber',
  }

  function handleChange(e) {
    const list = [...e.target.files]
    setNames(list.map((f) => f.name))
    onChange(multiple ? list : (list[0] ?? null))
  }

  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-card border border-dashed border-line bg-card p-4 transition-colors duration-200 hover:border-fiber/50"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}
      >
        <FieldIcon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span
          className={`block truncate text-xs font-normal ${names.length ? 'text-fiber' : 'text-faint'}`}
        >
          {names.length === 0
            ? 'Tap to attach'
            : names.length === 1
              ? names[0]
              : `${names.length} files attached`}
        </span>
      </span>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
      />
    </label>
  )
}

/** Yes/no segmented toggle in the design language. */
function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-card bg-card p-4 shadow-soft">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex rounded-btn border border-line p-0.5">
        {[
          { label: 'No', option: false },
          { label: 'Yes', option: true },
        ].map(({ label: optionLabel, option }) => (
          <button
            key={optionLabel}
            type="button"
            onClick={() => onChange(option)}
            className={`min-h-9 rounded-[10px] px-4 text-sm font-medium transition-colors duration-200 ${
              value === option ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DetailsForm({ onSubmit, submitting, serverError }) {
  const { zones, loading: zonesLoading } = useZones()
  const { types: buildingTypes } = useBuildingTypes()
  // Is the fiber connection live here? Drives the green/red map marker.
  const [isLive, setIsLive] = useState(false)
  // Permission details stay hidden until the surveyor says money changed hands.
  const [permissionPaid, setPermissionPaid] = useState(false)
  const [files, setFiles] = useState({
    permissionLetter: null,
    entrancePhoto: null,
    additionalPhotos: [],
  })
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(buildingDetailsSchema) })
  const zoneId = watch('zoneId')

  function submit(values) {
    // Toggled-off permission details never leave the form.
    onSubmit(
      { ...values, isLive, amountPaid: permissionPaid ? values.amountPaid : undefined },
      { ...files, permissionLetter: permissionPaid ? files.permissionLetter : null },
    )
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <SectionLabel>Connection</SectionLabel>
      <ToggleRow label="Building RFS" value={isLive} onChange={setIsLive} />

      <div className="mt-2" />
      <SectionLabel>Structure</SectionLabel>

      {!zonesLoading && zones.length === 0 && (
        <p className="rounded-btn bg-warn-tint px-4 py-3 text-sm font-normal text-warn">
          No zones assigned to you yet — contact your admin.
        </p>
      )}
      {/* zoneId lives in RHF via this hidden field; the search select drives it. */}
      <input type="hidden" {...register('zoneId')} />
      <ZoneSearchSelect
        zones={zones}
        value={zoneId}
        disabled={zonesLoading}
        error={errors.zoneId?.message}
        onChange={(id) => setValue('zoneId', id, { shouldValidate: true })}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input id="wings" label="Wings" type="number" inputMode="numeric" placeholder="e.g. 2" error={errors.wings?.message} {...register('wings')} />
        <Input id="floors" label="Floors" type="number" inputMode="numeric" placeholder="e.g. 12" error={errors.floors?.message} {...register('floors')} />
      </div>
      <Input
        id="homePass"
        label="Home pass (flats passed)"
        type="number"
        inputMode="numeric"
        placeholder="e.g. 48"
        error={errors.homePass?.message}
        {...register('homePass')}
      />

      <Select id="buildingType" label="Building type" {...register('buildingType')}>
        <option value="">Select type</option>
        {buildingTypes.map((type) => (
          <option key={type.id} value={type.name}>
            {type.name}
          </option>
        ))}
      </Select>

      <div className="mt-2" />
      <SectionLabel>Permission</SectionLabel>

      <ToggleRow
        label="Was a permission amount paid?"
        value={permissionPaid}
        onChange={setPermissionPaid}
      />

      {permissionPaid && (
        <>
          <Input
            id="amountPaid"
            label="Amount paid"
            type="number"
            inputMode="decimal"
            placeholder="e.g. 5000"
            error={errors.amountPaid?.message}
            {...register('amountPaid')}
          />
          <FileField
            id="permissionLetter"
            label="Permission letter (PDF or image)"
            accept="application/pdf,image/*"
            icon={IconDoc}
            tone="doc"
            onChange={(f) => setFiles((s) => ({ ...s, permissionLetter: f }))}
          />
        </>
      )}

      <Textarea
        id="remarks"
        label="Remarks"
        rows={3}
        placeholder="Access notes, society contacts, cabling route…"
        {...register('remarks')}
      />

      <div className="mt-2" />
      <SectionLabel>Photos</SectionLabel>

      <FileField
        id="entrancePhoto"
        label="Entrance photo"
        accept="image/*"
        icon={IconCamera}
        tone="photo"
        onChange={(f) => setFiles((s) => ({ ...s, entrancePhoto: f }))}
      />
      <FileField
        id="additionalPhotos"
        label="Additional photos"
        accept="image/*"
        icon={IconCamera}
        tone="photo"
        multiple
        onChange={(f) => setFiles((s) => ({ ...s, additionalPhotos: f }))}
      />

      {serverError && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {serverError}
        </p>
      )}

      <Button type="submit" fullWidth loading={submitting}>
        Save building
      </Button>
    </form>
  )
}
