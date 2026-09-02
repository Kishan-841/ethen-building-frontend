'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { uploadFile } from '@/lib/upload'
import { useAuthStore } from '@/stores/auth-store'
import { IconDoc, IconCamera } from '@/components/ui/icons'

const PHOTO_LABELS = {
  PERMISSION_LETTER: 'Permission letter',
  ENTRANCE: 'Entrance',
  ADDITIONAL: 'Additional',
}

const ADD_OPTIONS = [
  // Permission letters feed the legal permission record — managers/admins only.
  { type: 'PERMISSION_LETTER', label: 'Permission letter', accept: 'application/pdf,image/*', managerOnly: true },
  { type: 'ENTRANCE', label: 'Entrance photo', accept: 'image/*' },
  { type: 'ADDITIONAL', label: 'Additional photo', accept: 'image/*' },
]

/** Documents & photos grid: add (any role), delete (admin/manager, or the
 *  surveyor who created the building — so they can replace a wrong photo). */
export function PhotoManager({ building, onChanged }) {
  const user = useAuthStore((s) => s.user)
  const role = user?.role
  const isManager = role === 'ADMIN' || role === 'MANAGER'
  const canDelete = isManager || building?.createdById === user?.id
  const addOptions = ADD_OPTIONS.filter((option) => !option.managerOnly || isManager)
  const fileInputRef = useRef(null)
  const [pendingType, setPendingType] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function startAdd(option) {
    setPendingType(option)
    // Defer click until the input's accept attribute reflects the chosen type.
    requestAnimationFrame(() => fileInputRef.current?.click())
  }

  async function handleFilePicked(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file || !pendingType) return
    setBusy(true)
    setError(null)
    try {
      const url = await uploadFile(file)
      await apiClient.post(`/buildings/${building.id}/photos`, { type: pendingType.type, url })
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Upload failed'))
    } finally {
      setBusy(false)
      setPendingType(null)
    }
  }

  async function handleDelete(photo) {
    if (!window.confirm(`Delete this ${PHOTO_LABELS[photo.type]?.toLowerCase() ?? 'file'}?`)) return
    setBusy(true)
    setError(null)
    try {
      await apiClient.delete(`/buildings/${building.id}/photos/${photo.id}`)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete the file'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Documents</p>

      <input ref={fileInputRef} type="file" accept={pendingType?.accept} onChange={handleFilePicked} className="hidden" />

      {building.photos?.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {building.photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-card bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                {photo.url.endsWith('.pdf') ? (
                  <span className="flex h-32 flex-col items-center justify-center gap-2 text-sm font-normal text-muted">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-doc-tint text-doc">
                      <IconDoc className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    {PHOTO_LABELS[photo.type] ?? 'Document'}
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={PHOTO_LABELS[photo.type] ?? photo.type}
                    className="h-32 w-full object-cover"
                  />
                )}
              </a>
              <span className="absolute left-2 top-2 rounded-full bg-ink/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur">
                {PHOTO_LABELS[photo.type]}
              </span>
              {canDelete && (
                <button
                  onClick={() => handleDelete(photo)}
                  disabled={busy}
                  aria-label="Delete file"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/60 text-white backdrop-blur transition-colors hover:bg-bad"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {addOptions.map((option) => {
          // One entrance photo / permission letter per building; deleting the
          // existing one re-enables its button. ADDITIONAL stays unlimited.
          const alreadyUploaded =
            option.type !== 'ADDITIONAL' &&
            building.photos?.some((photo) => photo.type === option.type)
          return (
            <button
              key={option.type}
              onClick={() => startAdd(option)}
              disabled={busy || alreadyUploaded}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-medium text-muted shadow-soft transition-colors hover:border-doc/40 hover:text-doc disabled:opacity-50"
            >
              <IconCamera className="h-4 w-4" strokeWidth={1.8} />
              {alreadyUploaded
                ? `${option.label} uploaded ✓`
                : busy && pendingType?.type === option.type
                  ? 'Uploading…'
                  : `Add ${option.label.toLowerCase()}`}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-bad-tint px-4 py-3 text-sm text-bad">{error}</p>
      )}
    </section>
  )
}
