'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'

// Recharts accepts CSS custom properties, so charts follow the active theme.
// Live = fiber connection is live (green/red, same as the map markers).
const LIVE_META = [
  { key: 'live', label: 'Live', color: 'var(--ok)' },
  { key: 'notLive', label: 'Not live', color: 'var(--bad)' },
]

const axisProps = {
  tick: { fill: 'var(--muted)', fontSize: 11 },
  stroke: 'var(--line)',
}
const tooltipStyle = {
  contentStyle: {
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--ink)',
  },
  labelStyle: { color: 'var(--muted)' },
  cursor: { fill: 'var(--line)', opacity: 0.3 },
}

/** Section card wrapper with a title and an empty-state fallback. */
function ChartCard({ title, hasData, children, height = 220 }) {
  return (
    <div className="rounded-card bg-card p-5 shadow-soft">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-faint">{title}</p>
      {hasData ? (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>{children}</ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[180px] items-center justify-center text-sm text-muted">
          No data yet
        </div>
      )}
    </div>
  )
}

export function LiveDonut({ byLive }) {
  const data = LIVE_META.map((s) => ({ ...s, value: byLive?.[s.key] ?? 0 })).filter(
    (d) => d.value > 0,
  )
  return (
    <ChartCard title="Connection status" hasData={data.length > 0}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={45} outerRadius={75} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} stroke="var(--card)" />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
      </PieChart>
    </ChartCard>
  )
}

/** Reused for buildings-by-operator and home-pass-by-operator. */
export function OperatorBar({ title, byOperator, dataKey, max = 8 }) {
  const data = [...(byOperator ?? [])]
    .sort((a, b) => (b[dataKey] ?? 0) - (a[dataKey] ?? 0))
    .slice(0, max)
    .map((row) => ({ name: row.name, value: row[dataKey] ?? 0 }))
  return (
    <ChartCard title={title} hasData={data.some((d) => d.value > 0)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={110} {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="value" fill="var(--fiber)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartCard>
  )
}

export function SurveysLine({ overTime }) {
  const data = overTime ?? []
  return (
    <ChartCard title="Surveys over time (30 days)" hasData={data.length > 0}>
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} minTickGap={24} />
        <YAxis {...axisProps} allowDecimals={false} width={28} />
        <Tooltip {...tooltipStyle} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--fiber)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartCard>
  )
}
