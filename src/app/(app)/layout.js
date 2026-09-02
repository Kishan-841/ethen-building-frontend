import { AuthGuard } from '@/components/layout/AuthGuard'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function AppLayout({ children }) {
  return (
    <AuthGuard>
      <div className="min-h-dvh bg-paper">
        <Sidebar />
        <div className="transition-[padding-left] duration-300 lg:pl-[var(--sidebar-w)]">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-32 pt-6 lg:px-10 lg:pb-16 lg:pt-10">
            {children}
          </div>
        </div>
        <BottomNav />
      </div>
    </AuthGuard>
  )
}
