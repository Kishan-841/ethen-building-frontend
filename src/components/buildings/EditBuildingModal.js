'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { ZoneSearchSelect } from '@/components/buildings/ZoneSearchSelect'
import { useZones } from '@/hooks/useZones'
import { useBuildingTypes } from '@/hooks/useBuildingTypes'

function YesNo({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-btn border border-line bg-card px-4 py-3">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex overflow-hidden rounded-full border border-line">
        {[
          ['No', false],
          ['Yes', true],
        ].map(([text, val]) => (
          <button
            key={text}
            type="button"
            onClick={() => onChange(val)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              value === val ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

const numOrNull = (value) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}
const strOrNull = (value) => {
  const trimmed = String(value ?? '').trim()
  return trimmed || null
}
const dateInput = (value) => (value ? String(value).slice(0, 10) : '')

/** Admin/Manager edit for everything except location. One save, one audit entry. */
export function EditBuildingModal({ building, onClose, onSaved }) {
  const { zones, loading: zonesLoading } = useZones()
  const { types: buildingTypes } = useBuildingTypes()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    buildingName: building.buildingName ?? '',
    formattedAddress: building.formattedAddress ?? '',
    zoneId: building.zoneId ?? '',
    isLive: Boolean(building.isLive),
    wings: building.details?.wings ?? '',
    floors: building.details?.floors ?? '',
    homePass: building.details?.homePass ?? '',
    buildingType: building.details?.buildingType ?? '',
    remarks: building.details?.remarks ?? '',
    amountPaid: building.permission?.amountPaid ?? '',
    permissionStatus: building.permission?.permissionStatus ?? '',
    permissionDate: dateInput(building.permission?.permissionDate),
    renewalDate: dateInput(building.permission?.renewalDate),
    ownerName: building.permission?.ownerName ?? '',
    ownerMobile: building.permission?.ownerMobile ?? '',
  })
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const canSave = form.buildingName.trim() && form.formattedAddress.trim() && form.zoneId

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.patch(`/buildings/${building.id}`, {
        buildingName: form.buildingName.trim(),
        formattedAddress: form.formattedAddress.trim(),
        zoneId: form.zoneId,
        isLive: form.isLive,
        details: {
          wings: numOrNull(form.wings),
          floors: numOrNull(form.floors),
          homePass: numOrNull(form.homePass),
          buildingType: strOrNull(form.buildingType),
          remarks: strOrNull(form.remarks),
        },
        permission: {
          amountPaid: numOrNull(form.amountPaid),
          permissionStatus: strOrNull(form.permissionStatus),
          permissionDate: strOrNull(form.permissionDate),
          renewalDate: strOrNull(form.renewalDate),
          ownerName: strOrNull(form.ownerName),
          ownerMobile: strOrNull(form.ownerMobile),
        },
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the building'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit building"
      footer={
        <Button fullWidth disabled={!canSave} loading={busy} onClick={save}>
          Save changes
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Input id="eb-name" label="Building name" value={form.buildingName} onChange={set('buildingName')} />
        <Input id="eb-address" label="Address" value={form.formattedAddress} onChange={set('formattedAddress')} />
        <ZoneSearchSelect
          zones={zones}
          value={form.zoneId}
          disabled={zonesLoading}
          onChange={(zoneId) => setForm((prev) => ({ ...prev, zoneId }))}
        />
        <YesNo
          label="Building RFS"
          value={form.isLive}
          onChange={(isLive) => setForm((prev) => ({ ...prev, isLive }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input id="eb-wings" label="Wings" type="number" value={form.wings} onChange={set('wings')} />
          <Input id="eb-floors" label="Floors" type="number" value={form.floors} onChange={set('floors')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input id="eb-homepass" label="Home pass" type="number" value={form.homePass} onChange={set('homePass')} />
          <Select id="eb-type" label="Building type" value={form.buildingType} onChange={set('buildingType')}>
            <option value="">Select type</option>
            {buildingTypes.map((type) => (
              <option key={type.id} value={type.name}>
                {type.name}
              </option>
            ))}
          </Select>
        </div>
        <Textarea id="eb-remarks" label="Remarks" rows={2} value={form.remarks} onChange={set('remarks')} />

        <div className="grid grid-cols-2 gap-3">
          <Input id="eb-amount" label="Permission amount" type="number" value={form.amountPaid} onChange={set('amountPaid')} />
          <Input id="eb-status" label="Permission status" value={form.permissionStatus} onChange={set('permissionStatus')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input id="eb-pdate" label="Permission date" type="date" value={form.permissionDate} onChange={set('permissionDate')} />
          <Input id="eb-rdate" label="Renewal date" type="date" value={form.renewalDate} onChange={set('renewalDate')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input id="eb-owner" label="Owner name" value={form.ownerName} onChange={set('ownerName')} />
          <Input id="eb-mobile" label="Owner mobile" value={form.ownerMobile} onChange={set('ownerMobile')} />
        </div>

        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}
      </div>
    </Modal>
  )
}
