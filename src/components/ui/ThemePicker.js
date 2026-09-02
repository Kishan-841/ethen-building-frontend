'use client'

import { useTheme } from '@/hooks/useTheme'
import { IconOkCircle } from '@/components/ui/icons'

// DaisyUI 5 built-in themes. Each swatch renders in its OWN theme (via the
// data-theme attribute) so the preview is truthful.
const THEMES = [
  'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave',
  'retro', 'cyberpunk', 'valentine', 'halloween', 'garden', 'forest', 'aqua',
  'lofi', 'pastel', 'fantasy', 'wireframe', 'black', 'luxury', 'dracula',
  'cmyk', 'autumn', 'business', 'acid', 'lemonade', 'night', 'coffee',
  'winter', 'dim', 'nord', 'sunset', 'caramellatte', 'abyss', 'silk',
]

export function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {THEMES.map((name) => {
        const active = theme === name
        return (
          <button
            key={name}
            data-theme={name}
            onClick={() => setTheme(name)}
            aria-pressed={active}
            className={`overflow-hidden rounded-btn border-2 bg-base-100 text-left transition-transform duration-200 hover:-translate-y-0.5 ${
              active ? 'border-primary' : 'border-base-300'
            }`}
          >
            <div className="flex items-center justify-between px-3 pt-2.5">
              <span className="truncate text-sm font-semibold capitalize text-base-content">
                {name}
              </span>
              {active && <IconOkCircle className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />}
            </div>
            <div className="flex gap-1 p-3">
              <span className="h-5 flex-1 rounded bg-primary" />
              <span className="h-5 flex-1 rounded bg-secondary" />
              <span className="h-5 flex-1 rounded bg-accent" />
              <span className="h-5 flex-1 rounded bg-neutral" />
            </div>
          </button>
        )
      })}
    </div>
  )
}
