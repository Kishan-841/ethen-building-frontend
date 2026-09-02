'use client'

import { forwardRef } from 'react'

/** Label + error shell shared by every form control. */
export function Field({ label, error, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-sm font-normal text-bad">{error}</p>}
    </div>
  )
}

const controlClass = (error) =>
  `h-12 rounded-btn border bg-card px-4 text-[15px] text-ink outline-none transition-shadow duration-200 placeholder:text-faint focus:ring-2 ${
    error
      ? 'border-bad/50 focus:border-bad focus:ring-bad/15'
      : 'border-line focus:border-fiber focus:ring-fiber/15'
  }`

export const Input = forwardRef(function Input({ label, error, id, className = '', ...props }, ref) {
  return (
    <Field label={label} error={error} htmlFor={id}>
      <input ref={ref} id={id} className={`${controlClass(error)} ${className}`} {...props} />
    </Field>
  )
})

export const Select = forwardRef(function Select(
  { label, error, id, children, className = '', ...props },
  ref
) {
  return (
    <Field label={label} error={error} htmlFor={id}>
      <select ref={ref} id={id} className={`${controlClass(error)} ${className}`} {...props}>
        {children}
      </select>
    </Field>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, error, id, className = '', ...props },
  ref
) {
  return (
    <Field label={label} error={error} htmlFor={id}>
      <textarea
        ref={ref}
        id={id}
        className={`${controlClass(error)} h-auto py-3 ${className}`}
        {...props}
      />
    </Field>
  )
})
