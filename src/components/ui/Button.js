'use client'

// DaisyUI btn variants — content (text) color is theme-managed, so buttons
// stay legible on every theme, light or dark.
const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-outline',
  ghost: 'btn-ghost text-primary',
  success: 'btn-success',
  danger: 'btn-error',
  dangerGhost: 'btn-outline btn-error',
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`btn h-12 min-h-12 gap-2 rounded-btn text-[15px] font-medium normal-case ${VARIANTS[variant]} ${fullWidth ? 'btn-block' : ''} ${className}`}
      {...props}
    >
      {loading && <span className="loading loading-spinner loading-sm" />}
      {children}
    </button>
  )
}
