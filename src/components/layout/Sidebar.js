'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { apiClient } from '@/lib/api-client'
import { useTheme } from '@/hooks/useTheme'
import { MANAGE_LINKS } from '@/lib/manage-links'
import {
  NodeMark,
  IconDashboard,
  IconMap,
  IconBuildings,
  IconUser,
  IconSun,
  IconMoon,
  IconCollapse,
  IconExpand,
  IconLogout,
} from '@/components/ui/icons'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]

function initials(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const iconBtn =
  'flex h-9 w-9 items-center justify-center rounded-btn text-neutral-content/60 transition-colors duration-200 hover:bg-neutral-content/10 hover:text-neutral-content'

/**
 * Desktop rail on the theme's neutral surface (adapts to every DaisyUI theme).
 * Collapse toggle sits top-right; a logout button anchors the bottom.
 * Width lives in --sidebar-w so the content shell and map track it.
 */
export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUiStore()
  const { theme, toggle: toggleTheme } = useTheme()

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '80px' : '280px')
  }, [collapsed])

  function handleLogout() {
    apiClient.post('/auth/logout').catch(() => {}) // audit only — never block logout
    clearAuth()
    router.replace('/login')
  }

  // Plain render helper (not a component) — keeps link identity stable and
  // shares one style between the main nav and the Manage section.
  const navLink = ({ href, label, icon: NavIcon }) => {
    const active = pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-center gap-3 rounded-btn py-2.5 text-sm font-medium transition-colors duration-200 ${
          collapsed ? 'justify-center px-0' : 'px-3.5'
        } ${
          active
            ? 'bg-primary text-primary-content shadow-sm'
            : 'text-neutral-content/60 hover:bg-neutral-content/10 hover:text-neutral-content'
        }`}
      >
        <NavIcon
          className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
            collapsed ? '' : 'group-hover:translate-x-0.5'
          }`}
          strokeWidth={1.8}
        />
        {!collapsed && label}
      </Link>
    )
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-neutral text-neutral-content transition-[width] duration-300 lg:flex ${
        collapsed ? 'w-20' : 'w-[280px]'
      }`}
    >
      {/* Header: brand + collapse toggle (top-right) */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-3 pb-6 pt-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-btn bg-primary text-primary-content">
            <NodeMark className="h-6 w-6" />
          </span>
          <button onClick={toggleSidebar} title="Expand sidebar" aria-label="Expand sidebar" className={iconBtn}>
            <IconExpand className="h-4.5 w-4.5" strokeWidth={1.8} />
          </button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2 px-5 pb-6 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-primary text-primary-content">
              <NodeMark className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-tight tracking-tight">
                ISP Coverage
              </p>
              <p className="truncate text-xs font-normal text-neutral-content/50">
                Field survey console
              </p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className={`${iconBtn} -mr-1 shrink-0`}
          >
            <IconCollapse className="h-4.5 w-4.5" strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Nav (scrollable — the Manage section makes it tall on short screens) */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3">
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => navLink(item))}
        </div>

        {/* Manage: the dashboard's admin grid, mirrored for big screens.
            Sidebar entry is ADMIN-only (user decision). */}
        {user?.role === 'ADMIN' && (
          <>
            {collapsed ? (
              <div className="mx-auto my-3 h-px w-8 bg-neutral-content/15" />
            ) : (
              <p className="px-3.5 pb-1 pt-5 text-[11px] font-medium uppercase tracking-wider text-neutral-content/40">
                Manage
              </p>
            )}
            <div className="flex flex-col gap-1">{MANAGE_LINKS.map((item) => navLink(item))}</div>
          </>
        )}
      </nav>

      {/* Bottom: user + theme toggle + logout */}
      <div
        className={`mt-auto flex flex-col gap-2 border-t border-neutral-content/10 pb-5 pt-4 ${
          collapsed ? 'items-center px-2' : 'px-3'
        }`}
      >
        {user && (
          <Link
            href="/profile"
            title={collapsed ? user.name : undefined}
            className={`flex items-center gap-3 rounded-btn transition-colors duration-200 hover:bg-neutral-content/10 ${
              collapsed ? 'p-1.5' : 'px-2 py-2'
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {initials(user.name)}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block text-xs font-normal capitalize text-neutral-content/50">
                  {user.role?.toLowerCase()}
                </span>
              </span>
            )}
          </Link>
        )}

        <div className={`flex gap-2 ${collapsed ? 'flex-col items-center' : ''}`}>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            className={iconBtn}
          >
            {theme === 'dark' ? (
              <IconSun className="h-4.5 w-4.5" strokeWidth={1.8} />
            ) : (
              <IconMoon className="h-4.5 w-4.5" strokeWidth={1.8} />
            )}
          </button>
          <button
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            className={`flex h-9 items-center justify-center gap-2 rounded-btn text-sm font-medium text-neutral-content/70 transition-colors duration-200 hover:bg-error/15 hover:text-error ${
              collapsed ? 'w-9' : 'flex-1'
            }`}
          >
            <IconLogout className="h-4.5 w-4.5" strokeWidth={1.8} />
            {!collapsed && 'Log out'}
          </button>
        </div>
      </div>
    </aside>
  )
}
