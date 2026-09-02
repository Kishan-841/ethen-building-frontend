'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ThemePicker } from '@/components/ui/ThemePicker'
import { IconLogout } from '@/components/ui/icons'

function initials(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()

  function handleLogout() {
    apiClient.post('/auth/logout').catch(() => {}) // audit only — never block logout
    clearAuth()
    router.replace('/login')
  }

  return (
    <main className="stagger mx-auto max-w-2xl">
      <PageHeader title="Profile" />

      {user && (
        <div className="rounded-card bg-card p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-fiber-tint text-lg font-bold text-fiber">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{user.name}</p>
              <p className="truncate text-sm font-normal text-muted">{user.email}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-line/60 pt-4">
            <p className="text-xs font-normal uppercase tracking-wide text-faint">Role</p>
            <p className="mt-1.5 inline-flex rounded-full bg-fiber-tint px-3 py-1 text-xs font-medium capitalize text-fiber">
              {user.role?.toLowerCase()}
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-card bg-card p-5 shadow-soft">
        <p className="text-xs font-normal uppercase tracking-wide text-faint">Theme</p>
        <p className="mt-0.5 mb-3 text-sm font-normal text-muted">
          Pick a look — it applies across the whole app instantly.
        </p>
        <ThemePicker />
      </div>

      <div className="mt-6">
        <Button variant="dangerGhost" fullWidth onClick={handleLogout}>
          <IconLogout className="h-4.5 w-4.5" />
          Log out
        </Button>
      </div>
    </main>
  )
}
