'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { parseSpreadsheet, downloadCsvTemplate } from '@/lib/spreadsheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconUpload, IconOkCircle, IconWarn } from '@/components/ui/icons'

const MAX_ROWS = 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Rows → {operator, zone, city, email, row, error?}; drops a header row. */
function validateRows(rawRows) {
  let rows = rawRows.map((cells, index) => ({ cells, row: index + 1 }))
  const first = rows[0]?.cells
  if (first && /^operator$/i.test(first[0]) && /^zones?$/i.test(first[1])) rows = rows.slice(1)
  return rows
    .filter(({ cells }) => cells.some(Boolean))
    .map(({ cells: [operator, zone, city, email], row }) => {
      let error = null
      if (!operator) error = 'Operator is missing'
      else if (!zone) error = 'Zone is missing'
      else if (!email) error = 'Email is missing'
      else if (!EMAIL_RE.test(email)) error = 'Not a valid email'
      return { operator, zone, city: city ?? '', email, row, error }
    })
}

/** Uploads an Operator|Zone|City|Email sheet: creates operators/zones, assigns surveyors. */
export function ImportOperatorMappingModal({ onClose, onImported }) {
  const fileInputRef = useRef(null)
  const [rows, setRows] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const validRows = rows?.filter((r) => !r.error) ?? []
  const operatorCount = new Set(validRows.map((r) => r.operator.toLowerCase())).size

  function reset() {
    setRows(null)
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
      const parsed = validateRows(await parseSpreadsheet(file))
      if (parsed.length === 0) throw new Error('No rows found in the file')
      if (parsed.filter((r) => !r.error).length > MAX_ROWS)
        throw new Error(`Too many rows — up to ${MAX_ROWS} per file. Please split the file.`)
      setRows(parsed)
    } catch (err) {
      setError(err.message || 'Could not read the file')
    }
  }

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.post('/operators/import', {
        rows: validRows.map(({ operator, zone, city, email }) => ({ operator, zone, city, email })),
      })
      setResult(res.data.data)
      onImported()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Import failed — please re-upload'))
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
        <Button className="flex-1" disabled={validRows.length === 0} loading={busy} onClick={handleImport}>
          Import {validRows.length} row{validRows.length === 1 ? '' : 's'}
        </Button>
      </div>
    ) : result ? (
      <Button fullWidth onClick={close}>
        Done
      </Button>
    ) : null

  return (
    <Modal open onClose={close} title="Import operator mapping" footer={footer}>
      {/* Pick */}
      {!rows && !result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            Upload a .xlsx or .csv with columns <b>Operator</b>, <b>Zone</b>, <b>City</b>,{' '}
            <b>Email</b>. Missing operators and zones are created; each surveyor is assigned all
            the zones listed against their email (<b>replaces</b> their current zones).
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
                'operator-mapping-template.csv',
                'Operator,Zone,City,Email\nGALAXY BROADBAND,GALAXY BROADBAND,PCMC,galaxy@example.com\n',
              )
            }
            className="text-sm font-medium text-fiber underline-offset-2 hover:underline"
          >
            Download template (.csv)
          </button>
        </div>
      )}

      {/* Preview */}
      {rows && !result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            {validRows.length} of {rows.length} rows valid · {operatorCount} operator
            {operatorCount === 1 ? '' : 's'}.
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
                  <p className="truncate font-medium">
                    {r.operator || '—'} · {r.zone || '—'}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {r.city || '—'} · {r.email || '—'}
                  </p>
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

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">
            {result.operatorsCreated} operators · {result.zonesCreated} zones created ·{' '}
            {result.zonesLinked} linked · {result.surveyorsUpdated.length} surveyors updated ·{' '}
            {result.skipped.length} skipped
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
