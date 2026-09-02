'use client'

import { useState } from 'react'
import { ThemePicker } from '@/components/ui/ThemePicker'
import { IconPalette, IconClose } from '@/components/ui/icons'

/** A "Theme" button that opens a modal of theme swatches. Reusable anywhere. */
export function ThemeModalButton({ className = '' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 items-center gap-2 rounded-btn border border-line bg-card px-3.5 text-sm font-medium text-muted shadow-soft transition-colors duration-200 hover:border-faint hover:text-ink ${className}`}
      >
        <IconPalette className="h-4.5 w-4.5" strokeWidth={1.8} />
        Theme
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-card bg-card p-5 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-bold">Choose a theme</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1 text-faint transition-colors hover:text-ink"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm font-normal text-muted">
              Applies instantly and is remembered on this device.
            </p>
            <ThemePicker />
          </div>
        </div>
      )}
    </>
  )
}
