import Link from 'next/link'
import { IconArrowLeft } from '@/components/ui/icons'

/** Page heading with optional back link and action slot. */
export function PageHeader({ title, sub, backHref, backLabel = 'Back', action }) {
  return (
    <header className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-fiber"
        >
          <IconArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight lg:text-[28px]">{title}</h1>
          {sub && <p className="mt-1 text-sm font-normal text-muted">{sub}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  )
}
