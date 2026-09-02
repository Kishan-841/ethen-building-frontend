'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { parseSpreadsheet, downloadCsvTemplate } from '@/lib/spreadsheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconUpload, IconOkCircle, IconWarn } from '@/components/ui/icons'

const MAX_ROWS = 500
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Flexible sheet parsing:
 * - Email and Zones columns are auto-detected (either order works), so an
 *   edited zones export (`Zone | Email`) imports as naturally as the template.
 * - Multiple rows with the same email are MERGED into one combined zone set —
 *   a one-zone-per-row sheet must not leave each user with only their last row.
 * Returns { rows } for the preview and { assignments } grouped per user.
 */
function parseAssignments(rawRows) {
  let rows = rawRows.map((cells, index) => ({ cells, row: index + 1 }))
  // Header: no real data row contains the literal word "email".
  if (rows[0]?.cells.some((cell) => /^e-?mail$/i.test(cell))) rows = rows.slice(1)
  rows = rows.filter(({ cells }) => cells.some(Boolean))

  // Majority vote decides which column holds emails; ties fall back to col A.
  const votes = [0, 1].map(
    (col) => rows.filter(({ cells }) => EMAIL_RE.test(cells[col] ?? '')).length,
  )
  const emailCol = votes[1] > votes[0] ? 1 : 0
  const zonesCol = emailCol === 0 ? 1 : 0

  const parsed = rows.map(({ cells, row }) => {
    const email = cells[emailCol] ?? ''
    const zoneNames = (cells[zonesCol] ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
    let error = null
    if (!email) error = 'Email is missing'
    else if (!EMAIL_RE.test(email)) error = 'Not a valid email'
    else if (zoneNames.length === 0) error = 'No zones listed'
    return { email, zoneNames, row, error }
  })

  const byEmail = new Map()
  for (const entry of parsed.filter((r) => !r.error)) {
    const key = entry.email.toLowerCase()
    const existing = byEmail.get(key)
    if (existing) {
      for (const name of entry.zoneNames) {
        if (!existing.zoneNames.some((z) => z.toLowerCase() === name.toLowerCase())) {
          existing.zoneNames.push(name)
        }
      }
    } else {
      byEmail.set(key, { email: entry.email, zoneNames: [...entry.zoneNames] })
    }
  }
  return { rows: parsed, assignments: [...byEmail.values()] }
}

/** Sheet-driven zone assignment: each row REPLACES that surveyor's zones. */
export function BulkAssignZonesModal({ onClose, onAssigned }) {
  const fileInputRef = useRef(null)
  const [parsed, setParsed] = useState(null) // { rows, assignments }
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const rows = parsed?.rows ?? null
  const validRows = rows?.filter((r) => !r.error) ?? []
  const assignments = parsed?.assignments ?? []

  function reset() {
    setParsed(null)
    setResult(null)
    setError(null)
    setBusy(false)
  }

  function close() {
    reset()
    onClose()
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const next = parseAssignments(await parseSpreadsheet(file))
      if (next.rows.length === 0) throw new Error('No rows found in the file')
      if (next.assignments.length > MAX_ROWS)
        throw new Error(`Too many users — up to ${MAX_ROWS} per file. Please split the file.`)
      setParsed(next)
    } catch (err) {
      setError(err.message || 'Could not read the file')
    }
  }

  async function handleAssign() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.post('/users/bulk-zones', { assignments })
      setResult(res.data.data)
      onAssigned()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Assignment failed — please re-upload'))
    } finally {
      setBusy(false)
    }
  }

  const footer =
    rows && !result ? (
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={reset}>
          Back
        </Button>
        <Button className="flex-1" disabled={assignments.length === 0} loading={busy} onClick={handleAssign}>
          Assign {assignments.length} user{assignments.length === 1 ? '' : 's'}
        </Button>
      </div>
    ) : result ? (
      <Button fullWidth onClick={close}>
        Done
      </Button>
    ) : null

  return (
    <Modal open onClose={close} title="Bulk assign zones" footer={footer}>
      {/* Pick state */}
      {!rows && !result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            Upload a .xlsx or .csv with an <b>Email</b> column and a <b>Zones</b> column (either
            order; comma-separate multiple zones, or use one zone per row — rows with the same
            email are combined). The sheet <b>replaces</b> each listed surveyor&apos;s assigned
            zones.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFile}
            className="hidden"
          />
          <Button fullWidth onClick={() => fileInputRef.current?.click()}>
            <IconUpload className="h-4.5 w-4.5" /> Choose file
          </Button>
          <button
            type="button"
            onClick={() =>
              downloadCsvTemplate(
                'zone-assignments-template.csv',
                'Email,Zones\nsurveyor@isp.local,"Baner, Wakad West"\n',
              )
            }
            className="text-sm font-medium text-fiber underline-offset-2 hover:underline"
          >
            Download template (.csv)
          </button>
        </div>
      )}

      {/* Preview state */}
      {rows && !result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            {validRows.length} of {rows.length} rows are valid → {assignments.length} user
            {assignments.length === 1 ? '' : 's'} (same-email rows combined). Users and zone
            names are matched when you assign.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-btn border border-line">
            {rows.map((r) => (
              <div
                key={r.row}
                className="flex items-start gap-2 border-b border-line/60 px-3 py-2 text-sm last:border-b-0"
              >
                {r.error ? (
                  <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
                ) : (
                  <IconOkCircle className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.email || '—'}</p>
                  <p className="truncate text-xs text-muted">{r.zoneNames.join(', ') || '—'}</p>
                </div>
                {r.error && (
                  <span className="shrink-0 text-xs text-bad">
                    row {r.row}: {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result state */}
      {result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">
            {result.updated.length} updated · {result.skipped.length} skipped
          </p>
          {result.skipped.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-btn border border-line">
              {result.skipped.map((s, i) => (
                <div
                  key={`${s.email}-${i}`}
                  className="flex items-center justify-between gap-2 border-b border-line/60 px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="truncate font-medium">{s.email}</span>
                  <span className="shrink-0 text-xs text-muted">{s.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error}
        </p>
      )}
    </Modal>
  )
}
