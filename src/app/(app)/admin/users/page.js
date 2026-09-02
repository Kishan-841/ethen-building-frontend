'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DataTable } from '@/components/ui/DataTable'
import { ZoneMultiSelect } from '@/components/admin/ZoneMultiSelect'
import { invalidateUsers } from '@/hooks/useUsers'
import { BulkAssignZonesModal } from '@/components/admin/BulkAssignZonesModal'
import { useAuthStore } from '@/stores/auth-store'
import { IconPlus, IconEdit, IconUpload } from '@/components/ui/icons'

const ROLES = ['SURVEYOR', 'MANAGER', 'ADMIN']
const roleLabel = (role) => role.charAt(0) + role.slice(1).toLowerCase()

// Keep the assigned-zones line short so it never widens the row (which would
// push the action buttons into a horizontal scroll). Show a couple of names,
// then "+N more".
function zoneSummary(zones, max = 2) {
  const names = zones.map((zone) => zone.name)
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} +${names.length - max} more`
}

const ROLE_CHIP = {
  ADMIN: 'bg-doc-tint text-doc',
  MANAGER: 'bg-fiber-tint text-fiber',
  SURVEYOR: 'bg-scan-tint text-scan',
}

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_CHIP[role]}`}>
      {roleLabel(role)}
    </span>
  )
}

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex rounded-full bg-ok-tint px-2.5 py-0.5 text-xs font-medium text-ok">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-line/60 px-2.5 py-0.5 text-xs font-medium text-muted">
      Inactive
    </span>
  )
}

/** Shared create/edit dialog. `initial` set ⇒ edit mode (password optional). */
function UserFormModal({ onClose, onSaved, initial, isSelf, zones }) {
  const isEdit = Boolean(initial)
  // Mounted fresh per open (parent renders conditionally with a key), so state
  // initializes directly from props — no sync-setState-in-effect needed.
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name,
          email: initial.email,
          password: '',
          role: initial.role,
          zoneIds: initial.assignedZones?.map((zone) => zone.id) ?? [],
        }
      : { name: '', email: '', password: '', role: 'SURVEYOR', zoneIds: [] },
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (isEdit) {
        const patch = { name: form.name, email: form.email }
        if (!isSelf) patch.role = form.role // never let an admin change their own role
        if (form.password.trim()) patch.password = form.password
        if (form.role === 'SURVEYOR') patch.zoneIds = form.zoneIds
        await apiClient.patch(`/users/${initial.id}`, patch)
      } else {
        const body = { ...form }
        if (body.role !== 'SURVEYOR') delete body.zoneIds
        await apiClient.post('/users', body)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the user'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit user' : 'Add team member'}
      footer={
        <Button type="submit" form="user-form" fullWidth loading={busy}>
          {isEdit ? 'Save changes' : 'Create user'}
        </Button>
      }
    >
      <form id="user-form" onSubmit={submit} className="flex flex-col gap-3">
        <Input id="u-name" label="Full name" value={form.name} onChange={set('name')} required />
        <Input
          id="u-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={set('email')}
          required
        />
        <Input
          id="u-pass"
          label={isEdit ? 'New password' : 'Password'}
          type="password"
          placeholder={isEdit ? 'Leave blank to keep current' : '8+, with a letter & number'}
          value={form.password}
          onChange={set('password')}
          required={!isEdit}
        />
        <Select
          id="u-role"
          label={isSelf ? 'Role (you can’t change your own)' : 'Role'}
          value={form.role}
          onChange={set('role')}
          disabled={isSelf}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </Select>

        {form.role === 'SURVEYOR' && (
          <ZoneMultiSelect
            zones={zones}
            selectedIds={form.zoneIds}
            onChange={(zoneIds) => setForm((prev) => ({ ...prev, zoneIds }))}
          />
        )}

        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}
      </form>
    </Modal>
  )
}

// Matched-height row buttons (kept out of the tall <Button> so Edit and
// Deactivate/Activate line up).
const ACTION_BTN =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-btn border px-3.5 text-sm font-medium transition-colors duration-200 active:scale-[0.98] disabled:opacity-50'

function RowActions({ user, currentUserId, busyId, onEdit, onToggle }) {
  const busy = busyId === user.id
  const isSelf = user.id === currentUserId
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => onEdit(user)}
        className={`${ACTION_BTN} border-line text-muted hover:border-faint hover:text-ink`}
      >
        <IconEdit className="h-4 w-4" strokeWidth={1.8} />
        Edit
      </button>
      {!isSelf && (
        <button
          type="button"
          onClick={() => onToggle(user)}
          disabled={busy}
          className={`${ACTION_BTN} ${
            user.isActive
              ? 'border-bad/30 text-bad hover:bg-bad-tint'
              : 'border-ok/40 text-ok hover:bg-ok-tint'
          }`}
        >
          {busy && <span className="loading loading-spinner loading-xs" />}
          {user.isActive ? 'Deactivate' : 'Activate'}
        </button>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin = currentUser?.role === 'ADMIN'
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [refreshTick, setRefreshTick] = useState(0)
  // { key, data } — loading derived from key mismatch, so effects never
  // call setState synchronously (react-hooks/set-state-in-effect).
  const [result, setResult] = useState(null)
  const [zones, setZones] = useState([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    apiClient
      .get('/zones')
      .then((res) => setZones(res.data.data))
      .catch(() => setZones([]))
  }, [])

  const paramsKey = useMemo(() => {
    const p = { page, pageSize: 50, tick: refreshTick }
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim()
    if (roleFilter) p.role = roleFilter
    return JSON.stringify(p)
  }, [page, debouncedSearch, roleFilter, refreshTick])

  useEffect(() => {
    let cancelled = false
    const { tick, ...params } = JSON.parse(paramsKey)
    apiClient
      .get('/users', { params })
      .then((res) => !cancelled && setResult({ key: paramsKey, data: res.data.data }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({ key: paramsKey, error: getApiErrorMessage(err, 'Could not load users') }),
      )
    return () => {
      cancelled = true
    }
  }, [paramsKey])

  const loading = result?.key !== paramsKey
  const users = result?.data?.items ?? null
  const pagination = result?.data
    ? { page: result.data.page, totalPages: result.data.totalPages, total: result.data.total }
    : null
  const listError = !loading && result?.error ? result.error : null
  // User mutations also drop the session-cached user directory (filter
  // dropdowns) so it refetches on next use.
  const refresh = () => {
    invalidateUsers()
    setRefreshTick((tick) => tick + 1)
  }

  async function toggleActive(user) {
    setBusyId(user.id)
    setError(null)
    try {
      await apiClient.patch(`/users/${user.id}`, { isActive: !user.isActive })
      refresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Update failed'))
    } finally {
      setBusyId(null)
    }
  }

  const youTag = (u) =>
    u.id === currentUser?.id && <span className="ml-1.5 text-xs font-normal text-faint">(you)</span>

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div className="min-w-0 max-w-[280px]">
          <p className="truncate font-bold">
            {u.name}
            {youTag(u)}
          </p>
          <p className="truncate text-xs font-normal text-muted">{u.email}</p>
          {u.role === 'SURVEYOR' && u.assignedZones?.length > 0 && (
            <p
              className="mt-0.5 truncate text-xs font-normal text-faint"
              title={u.assignedZones.map((zone) => zone.name).join(', ')}
            >
              Zones: {zoneSummary(u.assignedZones)}
            </p>
          )}
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => <RoleBadge role={u.role} /> },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge active={u.isActive} /> },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (u) => (
              <RowActions
                user={u}
                currentUserId={currentUser?.id}
                busyId={busyId}
                onEdit={setEditUser}
                onToggle={toggleActive}
              />
            ),
          },
        ]
      : []),
  ]

  const renderCard = (u) => (
    <div className={`rounded-card bg-card p-4 shadow-soft ${u.isActive ? '' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">
            {u.name}
            {youTag(u)}
          </p>
          <p className="truncate text-sm font-normal text-muted">{u.email}</p>
          {u.role === 'SURVEYOR' && u.assignedZones?.length > 0 && (
            <p
              className="mt-0.5 truncate text-xs font-normal text-faint"
              title={u.assignedZones.map((zone) => zone.name).join(', ')}
            >
              Zones: {zoneSummary(u.assignedZones)}
            </p>
          )}
        </div>
        <RoleBadge role={u.role} />
      </div>
      <div className="mt-2">
        <StatusBadge active={u.isActive} />
      </div>
      {isAdmin && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <RowActions
            user={u}
            currentUserId={currentUser?.id}
            busyId={busyId}
            onEdit={setEditUser}
            onToggle={toggleActive}
          />
        </div>
      )}
    </div>
  )

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        sub="Survey team accounts and roles"
        backHref="/dashboard"
        backLabel="Dashboard"
        action={
          isAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <IconPlus className="h-4.5 w-4.5" />
              Add user
            </Button>
          )
        }
      />

      {(error || listError) && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error ?? listError}
        </p>
      )}

      {isAdmin && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setBulkAssignOpen(true)}
            className="inline-flex items-center gap-2 rounded-btn border border-line bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-fiber/50"
          >
            <IconUpload className="h-4 w-4" /> Bulk assign zones
          </button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Input
            id="u-search"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          id="u-role-filter"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        keyField="id"
        renderCard={renderCard}
        pagination={pagination}
        onPageChange={setPage}
        emptyState={<p className="text-sm font-normal text-muted">No matching users.</p>}
      />

      {createOpen && (
        <UserFormModal zones={zones} onClose={() => setCreateOpen(false)} onSaved={refresh} />
      )}
      {editUser && (
        <UserFormModal
          key={editUser.id}
          initial={editUser}
          zones={zones}
          isSelf={editUser.id === currentUser?.id}
          onClose={() => setEditUser(null)}
          onSaved={refresh}
        />
      )}
      {bulkAssignOpen && (
        <BulkAssignZonesModal onClose={() => setBulkAssignOpen(false)} onAssigned={refresh} />
      )}
    </main>
  )
}
