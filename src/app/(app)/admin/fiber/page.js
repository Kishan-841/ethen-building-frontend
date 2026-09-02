'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { IconEdit, IconTrash, IconPlus, IconEye } from '@/components/ui/icons'
import { fiberTypeColor } from '@/lib/constants'

// Client-only: Google Maps JS touches window.
const GoogleFiberEditor = dynamic(() => import('@/components/map/google/GoogleFiberEditor'), {
  ssr: false,
})

export default function AdminFiberPage() {
  const [routes, setRoutes] = useState(null)
  const [listError, setListError] = useState(null)
  // undefined = closed, null = new route, object = edit that route.
  const [editorRoute, setEditorRoute] = useState(undefined)
  const [viewRoute, setViewRoute] = useState(null)

  const fetchRoutes = useCallback(
    () =>
      apiClient
        .get('/fiber-routes')
        .then((res) => setRoutes(res.data.data))
        // Empty list (not a permanent "Loading…") when the fetch fails.
        .catch(() => setRoutes([])),
    [],
  )

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  async function handleDelete(route) {
    if (!window.confirm(`Delete fiber route "${route.name}"?`)) return
    setListError(null)
    try {
      await apiClient.delete(`/fiber-routes/${route.id}`)
      fetchRoutes()
    } catch (err) {
      setListError(getApiErrorMessage(err))
    }
  }

  const segmentCount = (route) => route.segments?.length ?? 0
  const pointCount = (route) =>
    (route.segments ?? []).reduce((sum, segment) => sum + (segment.points?.length ?? 0), 0)
  const typeList = (route) => [...new Set((route.segments ?? []).map((s) => s.fiberType))]

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Administration"
        title="Fiber routes"
        sub="Draw the physical fiber network on the map — trunks and branches"
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <Button onClick={() => setEditorRoute(null)}>
        <IconPlus className="h-4.5 w-4.5" />
        Draw new route
      </Button>

      {listError && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {routes === null && <p className="text-sm font-normal text-muted">Loading…</p>}
        {routes?.length === 0 && (
          <p className="text-sm font-normal text-muted">
            No fiber routes yet — draw the first one.
          </p>
        )}
        {routes?.map((route) => (
          <div
            key={route.id}
            className="flex items-center justify-between gap-3 rounded-card bg-card p-4 shadow-soft"
          >
            <span className="flex shrink-0 -space-x-1.5">
              {typeList(route)
                .slice(0, 4)
                .map((type) => (
                  <span
                    key={type}
                    title={type}
                    className="h-4 w-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: fiberTypeColor(type) }}
                  />
                ))}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{route.name}</p>
              <p className="text-sm font-normal text-muted">
                {segmentCount(route)} line{segmentCount(route) === 1 ? '' : 's'} ·{' '}
                {pointCount(route)} points · {typeList(route).join(' + ')}
                {route.placement && ` · ${route.placement}`}
                {route.fiberId && ` · ${route.fiberId}`}
                {route.operator?.name && ` · ${route.operator.name}`}
              </p>
            </div>
            <button
              aria-label="View"
              onClick={() => setViewRoute(route)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
            >
              <IconEye className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
            <button
              aria-label="Edit"
              onClick={() => setEditorRoute(route)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
            >
              <IconEdit className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
            <button
              aria-label="Delete"
              onClick={() => handleDelete(route)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-bad-tint hover:text-bad"
            >
              <IconTrash className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>

      {/* Route details: everything captured at save time, photos included. */}
      <Modal
        open={Boolean(viewRoute)}
        onClose={() => setViewRoute(null)}
        title={viewRoute?.name ?? ''}
      >
        {viewRoute && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              {typeList(viewRoute).map((type) => (
                <span
                  key={type}
                  className="flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-muted"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white shadow"
                    style={{ backgroundColor: fiberTypeColor(type) }}
                  />
                  {type}
                </span>
              ))}
              {viewRoute.placement && (
                <span className="rounded-full bg-paper px-2.5 py-1 text-muted">
                  {viewRoute.placement}
                </span>
              )}
              {viewRoute.operator?.name && (
                <span className="rounded-full bg-fiber-tint px-2.5 py-1 text-fiber">
                  {viewRoute.operator.name}
                </span>
              )}
            </div>

            <div className="rounded-card bg-paper px-4 py-1">
              {[
                ['Fiber ID', viewRoute.fiberId || '—'],
                ['Placement', viewRoute.placement || '—'],
                [
                  'Lines',
                  `${segmentCount(viewRoute)} line${segmentCount(viewRoute) === 1 ? '' : 's'} · ${pointCount(viewRoute)} points`,
                ],
                ['Remark', viewRoute.remark || '—'],
              ].map(([label, value], i) => (
                <div
                  key={label}
                  className={`flex items-baseline justify-between gap-4 py-2.5 ${
                    i > 0 ? 'border-t border-line/60' : ''
                  }`}
                >
                  <span className="shrink-0 text-sm font-normal text-muted">{label}</span>
                  <span className="text-right text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
                Photos {viewRoute.images?.length ? `(${viewRoute.images.length})` : ''}
              </p>
              {viewRoute.images?.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {viewRoute.images.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" title="Open full size">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Fiber route"
                        className="aspect-square w-full rounded-btn border border-line object-cover transition-transform hover:scale-[1.03]"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-normal text-muted">No photos uploaded.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {editorRoute !== undefined && (
        <GoogleFiberEditor
          initialRoute={editorRoute ?? undefined}
          onClose={() => setEditorRoute(undefined)}
          onSaved={() => {
            setEditorRoute(undefined)
            fetchRoutes()
          }}
        />
      )}
    </main>
  )
}
