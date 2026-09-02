'use client'

import { useEffect, useState } from 'react'

/**
 * Light/dark theme control. The boot script in the root layout applies the
 * saved (or system) theme before paint; this hook mirrors it into React state.
 * `theme` is null until mounted — render a neutral control for that frame.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setThemeState(document.documentElement.dataset.theme || 'light')
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  function setTheme(next) {
    document.documentElement.dataset.theme = next
    localStorage.setItem('theme', next)
    setThemeState(next)
  }

  return {
    theme,
    setTheme,
    toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  }
}
