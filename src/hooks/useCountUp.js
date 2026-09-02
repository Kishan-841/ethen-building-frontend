'use client'

import { useEffect, useState } from 'react'

/** Softly counts from 0 to target. Jumps straight to target under reduced motion. */
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target == null) return
    // Reduced motion jumps to the target in a single frame.
    const ms = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration
    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = ms === 0 ? 1 : Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3) // soft ease-out
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
