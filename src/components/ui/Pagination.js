'use client'

import { IconArrowLeft } from '@/components/ui/icons'

/** Prev/next pager with large touch targets; hidden for a single page. */
export function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.totalPages <= 1) return null
  const { page, totalPages, total } = pagination

  const buttonClass =
    'flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-btn border border-line bg-card px-4 text-sm font-medium transition-colors duration-200 hover:border-fiber/50 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
      <button
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <IconArrowLeft className="h-4 w-4" />
        Prev
      </button>

      <p className="text-sm font-normal tabular-nums text-muted">
        Page {page} of {totalPages}
        <span className="hidden sm:inline"> · {total} total</span>
      </p>

      <button
        className={buttonClass}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        Next
        <IconArrowLeft className="h-4 w-4 rotate-180" />
      </button>
    </nav>
  )
}
