'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/api-client'
import { IconEdit, IconTrash } from '@/components/ui/icons'

/**
 * Generic admin card list: inline add form, per-item edit form, delete with
 * confirm. `fields` describes the inputs; `renderItem` the read view.
 * All mutations delegate to the callers' API functions and refetch on success.
 */
export function CrudList({ items, fields, renderItem, onCreate, onUpdate, onDelete, addLabel }) {
  const emptyDraft = Object.fromEntries(fields.map((field) => [field.name, '']))
  const [draft, setDraft] = useState(emptyDraft)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'h-12 flex-1 rounded-btn border border-line bg-card px-4 text-[15px] outline-none transition-shadow duration-200 placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15'

  // Plain render helper (NOT a component) — defining a component inside render
  // remounts the inputs each keystroke and drops focus. Returning elements from
  // a function keeps their identity stable across renders.
  const fieldInputs = (value, onChange) =>
    fields.map((field) => (
      <input
        key={field.name}
        value={value[field.name]}
        placeholder={field.placeholder}
        onChange={(e) => onChange({ ...value, [field.name]: e.target.value })}
        className={inputClass}
      />
    ))

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (fields.some((field) => !draft[field.name].trim())) return
          run(async () => {
            await onCreate(draft)
            setDraft(emptyDraft)
          })
        }}
      >
        {fieldInputs(draft, setDraft)}
        <Button type="submit" loading={busy}>
          {addLabel}
        </Button>
      </form>

      {error && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      {items === null && <p className="text-sm font-normal text-muted">Loading…</p>}
      {items?.length === 0 && <p className="text-sm font-normal text-muted">Nothing here yet.</p>}

      {items?.map((item) =>
        editingId === item.id ? (
          <form
            key={item.id}
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                await onUpdate(item.id, editDraft)
                setEditingId(null)
              })
            }}
          >
            {fieldInputs(editDraft, setEditDraft)}
            <Button type="submit" loading={busy}>
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </form>
        ) : (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-card bg-card p-4 shadow-soft"
          >
            <div className="min-w-0 flex-1">{renderItem(item)}</div>
            {onUpdate && (
              <button
                aria-label="Edit"
                onClick={() => {
                  setEditingId(item.id)
                  setEditDraft(
                    Object.fromEntries(fields.map((field) => [field.name, item[field.name] ?? ''])),
                  )
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
              >
                <IconEdit className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            )}
            {onDelete && (
              <button
                aria-label="Delete"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Delete "${item.name}"?`)) return
                  run(() => onDelete(item.id))
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-bad-tint hover:text-bad"
              >
                <IconTrash className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            )}
          </div>
        ),
      )}
    </div>
  )
}
