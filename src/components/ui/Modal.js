'use client'

import { IconClose } from '@/components/ui/icons'

/**
 * Centered dialog: dim backdrop, click-outside / ✕ to close.
 * Header stays pinned; only the body scrolls; an optional `footer` is pinned
 * at the bottom so primary actions never scroll out of reach.
 */
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-card bg-card shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between p-5 pb-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-faint transition-colors hover:text-ink"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">{children}</div>
        {footer && <div className="shrink-0 border-t border-line/60 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
