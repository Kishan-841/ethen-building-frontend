'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DataTable } from '@/components/ui/DataTable'
import { SYSTEM_LOG_MODULES, SYSTEM_LOG_ACTIONS } from '@/lib/constants'
import { IconLogs } from '@/components/ui/icons'

const EMPTY_FILTERS = { dateFrom: '', dateTo: '', userId: '', module: '', action: '', status: '' }

const ROLE_CHIP = {
  ADMIN: 'bg-doc-tint text-doc',
  MANAGER: 'bg-fiber-tint text-fiber',
  SURVEYOR: 'bg-scan-tint text-scan',
}

function StatusChip({ status }) {
  return status === 'SUCCESS' ? (
    <span className="inline-flex rounded-full bg-ok-tint px-2.5 py-0.5 text-xs font-medium text-ok">
      Success
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-bad-tint px-2.5 py-0.5 text-xs font-medium text-bad">
      Failed
    </span>
  )
}

function JsonBlock({ label, value }) {
  if (value === null || value === undefined) return null
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <pre className="max-h-56 overflow-auto rounded-btn border border-line bg-base-200/60 p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function DetailRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex justify-between gap-4 border-b border-line/50 py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  )
}

function LogDetailModal({ log, onClose }) {
  return (
    <Modal open={Boolean(log)} onClose={onClose} title="Log details">
      {log && (
        <div className="flex flex-col gap-4">
          <div>
            <DetailRow label="Timestamp" value={new Date(log.createdAt).toLocaleString()} />
            <DetailRow label="User" value={log.userName ?? '—'} />
            <DetailRow label="Email" value={log.userEmail} />
            <DetailRow label="Role" value={log.userRole} />
            <DetailRow label="Module / Action" value={`${log.module} · ${log.action}`} />
            <DetailRow label="Description" value={log.description} />
            <DetailRow label="Record ID" value={log.recordId} />
            <DetailRow label="Building ID" value={log.buildingId} />
            <DetailRow label="IP address" value={log.ipAddress} />
            <DetailRow
              label="Client"
              value={[log.device, log.browser, log.os].filter(Boolean).join(' · ')}
            />
            <DetailRow label="Request" value={`${log.httpMethod} ${log.requestUrl}`} />
            <DetailRow label="Status code" value={log.statusCode} />
            <DetailRow label="Error" value={log.errorMessage} />
          </div>
          {(log.oldValue || log.newValue) && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <JsonBlock label="Old value" value={log.oldValue} />
              <JsonBlock label="New value" value={log.newValue} />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function SystemLogsPage() {
  const router = useRouter()
  const role = useAuthStore((s) => s.user?.role)

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  // { key, data } or { key, error } — loading is derived from key mismatch,
  // so effects never call setState synchronously (react-hooks/set-state-in-effect).
  const [result, setResult] = useState(null)
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)

  // The admin layout admits MANAGER too; logs are strictly ADMIN.
  useEffect(() => {
    if (role && role !== 'ADMIN') router.replace('/dashboard')
  }, [role, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    apiClient
      .get('/users')
      .then((res) => setUsers(res.data.data))
      .catch(() => setUsers([]))
  }, [])

  const paramsKey = useMemo(() => {
    const p = { page, pageSize }
    // Interpret both ends as the viewer's LOCAL calendar day. `new Date('YYYY-MM-DD')`
    // parses as UTC midnight, so build both boundaries with an explicit local time.
    if (filters.dateFrom) p.dateFrom = new Date(`${filters.dateFrom}T00:00:00`).toISOString()
    if (filters.dateTo) p.dateTo = new Date(`${filters.dateTo}T23:59:59.999`).toISOString()
    for (const key of ['userId', 'module', 'action', 'status']) {
      if (filters[key]) p[key] = filters[key]
    }
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim()
    return JSON.stringify(p)
  }, [filters, debouncedSearch, page, pageSize])

  useEffect(() => {
    if (role !== 'ADMIN') return
    let cancelled = false
    apiClient
      .get('/system-logs', { params: JSON.parse(paramsKey) })
      .then((res) => !cancelled && setResult({ key: paramsKey, data: res.data.data }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({ key: paramsKey, error: getApiErrorMessage(err, 'Could not load logs') }),
      )
    return () => {
      cancelled = true
    }
  }, [paramsKey, role])

  const loading = result?.key !== paramsKey
  const data = result?.data ?? null
  const error = !loading && result?.error ? result.error : null

  const setFilter = (key) => (e) => {
    setFilters((prev) => ({ ...prev, [key]: e.target.value }))
    setPage(1)
  }

  if (role !== 'ADMIN') return null

  const columns = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (log) => (
        <span className="whitespace-nowrap tabular-nums">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'userName',
      header: 'User',
      render: (log) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{log.userName ?? '—'}</span>
          {log.userRole && (
            <span
              className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_CHIP[log.userRole] ?? 'bg-line/60 text-muted'}`}
            >
              {log.userRole}
            </span>
          )}
        </div>
      ),
    },
    { key: 'module', header: 'Module' },
    { key: 'action', header: 'Action' },
    { key: 'description', header: 'Description', className: 'max-w-[360px] truncate' },
    { key: 'ipAddress', header: 'IP address', render: (log) => log.ipAddress ?? '—' },
    { key: 'status', header: 'Status', render: (log) => <StatusChip status={log.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="System logs"
        sub="Immutable audit trail of every action in the system"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <Input
          id="log-from"
          label="From"
          type="date"
          value={filters.dateFrom}
          onChange={setFilter('dateFrom')}
        />
        <Input
          id="log-to"
          label="To"
          type="date"
          value={filters.dateTo}
          onChange={setFilter('dateTo')}
        />
        <Select id="log-user" label="User" value={filters.userId} onChange={setFilter('userId')}>
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select id="log-module" label="Module" value={filters.module} onChange={setFilter('module')}>
          <option value="">All modules</option>
          {SYSTEM_LOG_MODULES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <Select id="log-action" label="Action" value={filters.action} onChange={setFilter('action')}>
          <option value="">All actions</option>
          {SYSTEM_LOG_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select id="log-status" label="Status" value={filters.status} onChange={setFilter('status')}>
          <option value="">Any status</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
        </Select>
        <Input
          id="log-search"
          label="Search"
          placeholder="User, email, IP, record…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {error && <p className="mb-4 text-sm text-bad">{error}</p>}

      <DataTable
        columns={columns}
        rows={data?.items}
        loading={loading}
        onRowClick={setSelected}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        pagination={data && { page: data.page, totalPages: data.totalPages, total: data.total }}
        onPageChange={setPage}
        emptyState={
          <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-card p-10 text-center">
            <IconLogs className="h-8 w-8 text-muted" />
            <p className="font-medium">No log entries match</p>
            <p className="text-sm text-muted">Try widening the date range or clearing filters.</p>
          </div>
        }
        renderCard={(log) => (
          <button
            onClick={() => setSelected(log)}
            className="w-full rounded-card border border-line bg-card p-4 text-left shadow-soft"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
                {log.module} · {log.action}
              </span>
              <StatusChip status={log.status} />
            </div>
            <p className="mt-1 truncate text-sm text-muted">{log.description}</p>
            <p className="mt-2 text-xs text-muted">
              {log.userName ?? '—'} · {log.ipAddress ?? '—'} ·{' '}
              {new Date(log.createdAt).toLocaleString()}
            </p>
          </button>
        )}
      />

      <LogDetailModal log={selected} onClose={() => setSelected(null)} />
    </>
  )
}
