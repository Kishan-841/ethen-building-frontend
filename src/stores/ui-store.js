'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** UI preferences persisted across sessions (key read by the boot script too). */
export const useUiStore = create(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'ui-prefs' }
  )
)
