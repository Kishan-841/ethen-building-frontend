'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { loginSchema } from '@/schemas/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemeModalButton } from '@/components/ui/ThemeModalButton'
import { NodeMark, IconPin, IconMap, IconBuildings } from '@/components/ui/icons'

/** Decorative network graph for the brand panel. */
function NetworkMotif({ className = '' }) {
  return (
    <svg viewBox="0 0 400 300" fill="none" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth="1">
        <path d="M40 250 140 180 90 90M140 180l120 40M260 220 330 120 200 60 90 90M200 60l60 160M330 120l40 130" />
      </g>
      <g fill="currentColor">
        <circle cx="40" cy="250" r="5" />
        <circle cx="90" cy="90" r="5" />
        <circle cx="140" cy="180" r="5" />
        <circle cx="260" cy="220" r="5" />
        <circle cx="330" cy="120" r="5" />
        <circle cx="370" cy="250" r="5" />
      </g>
      <circle cx="200" cy="60" r="6" fill="var(--color-pulse)" />
    </svg>
  )
}

const FEATURES = [
  { icon: IconPin, text: 'Capture buildings with precise GPS' },
  { icon: IconMap, text: 'See coverage live on the interactive map' },
  { icon: IconBuildings, text: 'One source of truth for the field team' },
]

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values) {
    setServerError(null)
    try {
      const res = await apiClient.post('/auth/login', values)
      setAuth(res.data.data)
      router.replace('/dashboard')
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Login failed'))
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col bg-paper lg:flex-row">
      <ThemeModalButton className="absolute right-4 top-4 z-40" />

      {/* Brand panel — full-height on desktop, a compact band on mobile */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-neutral px-6 py-10 text-neutral-content lg:w-[46%] lg:px-14 lg:py-16">
        <NetworkMotif className="pointer-events-none absolute -right-8 bottom-0 h-56 w-auto text-neutral-content/10 lg:h-[26rem]" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-primary text-primary-content">
            <NodeMark className="h-7 w-7" />
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight">ISP Coverage</p>
            <p className="text-xs font-normal text-neutral-content/50">Field survey console</p>
          </div>
        </div>

        <div className="relative mt-10 hidden lg:block">
          <h2 className="max-w-sm text-[28px] font-bold leading-tight tracking-tight">
            Every building, every coordinate — one source of truth.
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {FEATURES.map(({ icon: FeatureIcon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-normal">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <FeatureIcon className="h-4.5 w-4.5" strokeWidth={1.8} />
                </span>
                <span className="text-neutral-content/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-8 hidden text-xs font-normal uppercase tracking-[0.2em] text-neutral-content/40 lg:block">
          Survey · Verify · Connect
        </p>
      </section>

      {/* Form panel */}
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm font-normal text-muted">Sign in to your surveyor account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              id="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            {serverError && (
              <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
                {serverError}
              </p>
            )}

            <Button type="submit" fullWidth loading={isSubmitting} className="mt-1">
              Sign in
            </Button>
          </form>
        </div>
      </section>
    </main>
  )
}
