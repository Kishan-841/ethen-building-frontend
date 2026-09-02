'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconDashboard, IconMap, IconBuildings, IconUser } from '@/components/ui/icons'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: IconDashboard },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]

/** Mobile-only bottom bar (72px, blurred). Hidden at lg — Sidebar takes over. */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-card/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="mx-auto flex h-18 max-w-lg">
        {NAV_ITEMS.map(({ href, label, icon: NavIcon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors duration-200 ${
                active ? 'font-medium text-fiber' : 'font-normal text-faint'
              }`}
            >
              <NavIcon
                className={`h-5.5 w-5.5 transition-transform duration-300 ${
                  active ? 'scale-105' : ''
                }`}
                strokeWidth={active ? 2 : 1.8}
              />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
