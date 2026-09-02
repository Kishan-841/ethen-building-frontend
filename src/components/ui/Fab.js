'use client'

import Link from 'next/link'
import { IconPlus } from '@/components/ui/icons'

/** Mobile-only floating action button (64×64, above the bottom nav). */
export function Fab({ href, label = 'Add' }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="group fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-16 w-16 items-center justify-center rounded-fab bg-fiber text-white shadow-fab transition-all duration-200 hover:scale-[1.04] hover:bg-fiber-deep active:scale-95 lg:hidden"
    >
      <IconPlus className="h-7 w-7 transition-transform duration-300 group-hover:rotate-90" />
    </Link>
  )
}
