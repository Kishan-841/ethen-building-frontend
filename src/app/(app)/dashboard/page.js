'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useBuildings } from '@/hooks/useBuildings'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useOperators } from '@/hooks/useOperators'
import { useCities } from '@/hooks/useCities'
import { MANAGE_LINKS } from '@/lib/manage-links'
import { useCountUp } from '@/hooks/useCountUp'
import { Select } from '@/components/ui/Input'
import { LiveDonut, OperatorBar, SurveysLine } from '@/components/dashboard/DashboardCharts'
import {
  IconBuildings,
  IconHome,
  IconMap,
  IconPin,
  IconUser,
  IconDoc,
  IconLogs,
  IconLayers,
  IconNavigate,
  NodeMark,
} from '@/components/ui/icons'

const currency = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ icon: StatIcon, tone, label, value, sub, href }) {
  const shown = useCountUp(value ?? 0)
  const body = (
    <>
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
        <StatIcon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight">
        {value == null ? '—' : shown}
      </p>
      <p className="mt-0.5 text-sm font-normal text-muted">{label}</p>
      {sub && <p className="mt-1 text-xs font-normal text-faint">{sub}</p>}
    </>
  )
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-card bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
      >
        {body}
      </Link>
    )
  }
  return <div className="rounded-card bg-card p-5 shadow-soft">{body}</div>
}

/** Clickable count tile (Operators / Zones) that redirects. */
function CountTile({ href, icon: TileIcon, label, value }) {
  const shown = useCountUp(value ?? 0)
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-card bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fiber-tint text-fiber">
        <TileIcon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold tabular-nums tracking-tight">
          {value == null ? '—' : shown}
        </span>
        <span className="block truncate text-sm font-normal text-muted">{label}</span>
      </span>
    </Link>
  )
}


export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = ['ADMIN', 'MANAGER'].includes(user?.role)
  const [operatorId, setOperatorId] = useState('')
  const [cityId, setCityId] = useState('')
  const { operators } = useOperators()
  const { cities } = useCities()
  const { stats: serverStats } = useDashboardStats(operatorId, cityId)

  const visibleOperators = cityId ? operators.filter((o) => o.city?.id === cityId) : operators
  const selectCity = (id) => {
    setCityId(id)
    // Keep the operator only if it belongs to the newly selected city.
    if (id && !operators.some((o) => o.id === operatorId && o.city?.id === id)) setOperatorId('')
  }
  // One page of everything — feeds the recent list and the stats fallback.
  const { buildings, loading } = useBuildings({ pageSize: 500 })

  // Server stats when available; otherwise computed from the registry so
  // every role sees a live dashboard.
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        total: serverStats.totalBuildings,
        homePass: serverStats.totalHomePass,
        permissionCost: serverStats.totalPermissionCost,
      }
    }
    if (loading) return null
    let homePass = 0
    for (const b of buildings) {
      homePass += b.details?.homePass ?? 0
    }
    return { total: buildings.length, homePass, permissionCost: null }
  }, [serverStats, buildings, loading])

  const recent = useMemo(() => {
    if (loading) return null
    return [...buildings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
  }, [buildings, loading])

  const selectedOperatorName = operators.find((o) => o.id === operatorId)?.name
  const selectedCityName = cities.find((c) => c.id === cityId)?.name
  const scopeLabel = [selectedCityName, selectedOperatorName].filter(Boolean).join(' · ')

  return (
    <main className="stagger">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-[28px]">
            {greeting()}
            {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm font-normal text-muted">
            {scopeLabel ? `Showing ${scopeLabel}` : 'Coverage at a glance'}
          </p>
        </div>
        {canManage && operators.length > 0 && (
          // Stacked on mobile — a long operator name would otherwise widen
          // the row past the viewport and make the page scroll sideways.
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row">
            {cities.length > 0 && (
              <div className="min-w-0 sm:w-44">
                <Select id="dash-city" value={cityId} onChange={(e) => selectCity(e.target.value)}>
                  <option value="">All cities</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="min-w-0 sm:w-56">
            <Select
              id="dash-operator"
              className="max-w-full"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
            >
              <option value="">All operators</option>
              {visibleOperators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </Select>
            </div>
          </div>
        )}
      </header>

      {/* Stats */}
      {stats === null ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="shimmer rounded-card bg-card p-5 shadow-soft">
              <div className="h-10 w-10 rounded-full bg-line/60" />
              <div className="mt-4 h-8 w-16 rounded bg-line" />
              <div className="mt-2 h-3 w-24 rounded bg-line/60" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={IconBuildings}
            tone="bg-fiber-tint text-fiber"
            label="Buildings surveyed"
            value={stats.total}
            href={`/buildings${operatorId ? `?operatorId=${operatorId}` : ''}`}
          />
          <StatCard
            icon={IconHome}
            tone="bg-scan-tint text-scan"
            label="Home pass"
            value={stats.homePass}
            sub="flats passed"
            href={`/buildings${operatorId ? `?operatorId=${operatorId}` : ''}`}
          />
        </div>
      )}

      {/* Count tiles + operator-filtered charts (admin / manager) */}
      {canManage && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <CountTile
              href="/admin/operators"
              icon={IconLayers}
              label="Operators"
              value={serverStats?.operatorCount}
            />
            <CountTile
              href="/admin/zones"
              icon={IconPin}
              label={selectedOperatorName ? `Zones in ${selectedOperatorName}` : 'Zones'}
              value={serverStats?.zoneCount}
            />
          </div>

          {serverStats && (
            <section className="mt-5">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-faint">
                Insights{selectedOperatorName ? ` · ${selectedOperatorName}` : ''}
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <LiveDonut byLive={serverStats.byLive} />
                <SurveysLine overTime={serverStats.overTime} />
                <OperatorBar
                  title="Buildings by operator"
                  byOperator={serverStats.byOperator}
                  dataKey="buildings"
                />
                <OperatorBar
                  title="Home pass by operator"
                  byOperator={serverStats.byOperator}
                  dataKey="homePass"
                />
              </div>
            </section>
          )}
        </>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Recent surveys */}
        <section className="rounded-card bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">Recent surveys</p>
            <Link
              href="/buildings"
              className="text-sm font-medium text-fiber transition-colors duration-200 hover:text-fiber-deep"
            >
              View all
            </Link>
          </div>
          <div className="mt-2">
            {recent === null &&
              [0, 1, 2].map((i) => <div key={i} className="shimmer my-3 h-10 rounded-btn bg-line/40" />)}
            {recent?.length === 0 && (
              <p className="py-6 text-center text-sm font-normal text-muted">
                No surveys yet — add your first building to see it here.
              </p>
            )}
            {recent?.map((b, i) => (
              <Link
                key={b.id}
                href={`/buildings/${b.id}`}
                className={`flex items-center justify-between gap-3 py-3 transition-colors duration-200 hover:text-fiber ${
                  i > 0 ? 'border-t border-line/60' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{b.buildingName}</span>
                  <span className="block truncate text-xs font-normal text-faint">
                    {b.zone?.name}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-normal tabular-nums text-faint">
                  {b.details?.homePass != null ? `${b.details.homePass} HP` : ''}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {/* Map shortcut */}
          <Link
            href="/map"
            className="group relative flex min-h-40 flex-1 flex-col justify-between overflow-hidden rounded-card bg-navy p-5 text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
          >
            <NodeMark className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 text-white/10 transition-transform duration-500 group-hover:scale-105" />
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse/15 text-pulse">
              <IconMap className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block font-bold">Coverage map</span>
              <span className="mt-0.5 block text-sm font-normal text-white/60">
                See every building plotted live
              </span>
            </span>
          </Link>

          {/* Permission cost (privileged) */}
          {canManage && stats?.permissionCost != null && (
            <div className="rounded-card bg-card p-5 shadow-soft">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-doc">
                ₹{currency.format(stats.permissionCost)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-normal uppercase tracking-wide text-muted">
                <IconDoc className="h-3.5 w-3.5" /> Total permission cost
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Manage (admin / manager) */}
      {canManage && (
        <section className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Manage</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {MANAGE_LINKS.filter((link) => !link.adminOnly || user?.role === 'ADMIN').map(
              ({ href, label, sub, icon: LinkIcon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3.5 rounded-card bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fiber-tint text-fiber">
                    <LinkIcon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">{label}</span>
                    <span className="block truncate text-sm font-normal text-muted">{sub}</span>
                  </span>
                </Link>
              ),
            )}
          </div>
        </section>
      )}
    </main>
  )
}
