'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useZones } from '@/hooks/useZones'
import { useOperators } from '@/hooks/useOperators'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/stores/auth-store'

const selectClass =
  'min-h-12 w-full rounded-xl border border-line bg-card px-4 text-base outline-none focus:ring-2 focus:ring-fiber/30'

/** Mounted only while open, so `local` initializes fresh from the current
 *  filters each time — no state-sync effect needed. */
export function FilterSheet({ open, filters, onApply, onClose }) {
  if (!open) return null
  return <FilterSheetBody filters={filters} onApply={onApply} onClose={onClose} />
}

function FilterSheetBody({ filters, onApply, onClose }) {
  const { zones } = useZones()
  const { operators } = useOperators()
  const role = useAuthStore((s) => s.user?.role)
  const canFilterSurveyor = role === 'ADMIN' || role === 'MANAGER'
  // Session-cached — reopening the sheet costs zero requests.
  const { users: surveyors } = useUsers(canFilterSurveyor)
  const [local, setLocal] = useState(filters)

  // Picking an operator narrows the zone list to that operator's zones and
  // clears a now-mismatched zone selection.
  const shownZones = local.operatorId
    ? zones.filter((zone) => zone.operator?.id === local.operatorId)
    : zones
  const setOperator = (e) => {
    const operatorId = e.target.value
    setLocal((prev) => {
      const next = { ...prev, operatorId }
      if (operatorId && !zones.some((z) => z.id === prev.zoneId && z.operator?.id === operatorId)) {
        next.zoneId = ''
      }
      return next
    })
  }

  const set = (key) => (e) => setLocal({ ...local, [key]: e.target.value })

  return (
    // Mobile: the sheet rests on top of the bottom nav (72px + safe area), so
    // its pinned action row is never hidden behind the bar.
    <div
      className="fixed inset-0 z-50 flex items-end bg-ink/50 pb-[calc(72px+env(safe-area-inset-bottom))] lg:items-center lg:justify-center lg:pb-0"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80dvh] w-full flex-col rounded-t-2xl bg-card lg:max-w-md lg:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line lg:hidden" />
          <h2 className="mb-2 text-lg font-semibold tracking-tight">Filters</h2>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
          {operators.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Operator</label>
              <select className={selectClass} value={local.operatorId ?? ''} onChange={setOperator}>
                <option value="">All operators</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted">Zone</label>
            <select className={selectClass} value={local.zoneId ?? ''} onChange={set('zoneId')}>
              <option value="">All zones</option>
              {shownZones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>

          {canFilterSurveyor && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Surveyor</label>
              <select
                className={selectClass}
                value={local.createdById ?? ''}
                onChange={set('createdById')}
              >
                <option value="">All surveyors</option>
                {surveyors.map((surveyor) => (
                  <option key={surveyor.id} value={surveyor.id}>{surveyor.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input id="dateFrom" label="From" type="date" value={local.dateFrom ?? ''} onChange={set('dateFrom')} />
            <Input id="dateTo" label="To" type="date" value={local.dateTo ?? ''} onChange={set('dateTo')} />
          </div>

        </div>

        <div className="flex shrink-0 gap-3 border-t border-line/60 px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={() => { onApply({}); onClose() }}>
            Clear
          </Button>
          <Button className="flex-1" onClick={() => { onApply(local); onClose() }}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}
