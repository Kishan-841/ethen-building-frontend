'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

/** Client-side gate for the admin section — the API enforces roles for real. */
export default function AdminLayout({ children }) {
  const router = useRouter()
  const role = useAuthStore((s) => s.user?.role)
  const allowed = role === 'ADMIN' || role === 'MANAGER'

  useEffect(() => {
    if (role && !allowed) router.replace('/map')
  }, [role, allowed, router])

  if (!allowed) return null
  return children
}
