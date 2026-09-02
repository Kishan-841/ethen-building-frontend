'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/Button'

/**
 * Shows whether the fiber connection is live and lets an admin/manager flip it
 * — the action that turns the map marker green (live) or red (not live).
 */
export function LiveToggle({ building, onChanged }) {
  const role = useAuthStore((s) => s.user?.role)
  const canEdit = role === 'ADMIN' || role === 'MANAGER'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function setLive(isLive) {
    setBusy(true)
    setError(null)
    try {
      await apiClient.patch(`/buildings/${building.id}/status`, { isLive })
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update connection status'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Connection</p>
      <div className="flex items-center justify-between gap-3 rounded-card bg-card p-4 shadow-soft">
        <span className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${building.isLive ? 'bg-ok' : 'bg-bad'}`} />
          <span className="text-sm font-medium">{building.isLive ? 'Live' : 'Not live'}</span>
        </span>
        {canEdit &&
          (building.isLive ? (
            <Button
              variant="dangerGhost"
              className="!h-9 !min-h-9 !px-4 text-sm"
              loading={busy}
              onClick={() => setLive(false)}
            >
              Mark not live
            </Button>
          ) : (
            <Button
              variant="success"
              className="!h-9 !min-h-9 !px-4 text-sm"
              loading={busy}
              onClick={() => setLive(true)}
            >
              Mark live
            </Button>
          ))}
      </div>
      {error && (
        <p className="mt-2 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}
    </section>
  )
}
