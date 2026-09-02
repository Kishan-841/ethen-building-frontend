'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { parseSpreadsheet, downloadCsvTemplate } from '@/lib/spreadsheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconUpload, IconOkCircle, IconWarn } from '@/components/ui/icons'

const MAX_ROWS = 500
const MAX_LEN = 100

/** Rows -> {name, city, row, error?}; drops an auto-detected header row. */
function validateRows(rawRows) {
  let rows = rawRows.map((cells, index) => ({ cells, row: index + 1 }))
  const first = rows[0]?.cells
  if (first && /^name$/i.test(first[0]) && /^city$/i.test(first[1])) rows = rows.slice(1)
  return rows
    .filter(({ cells }) => cells[0] || cells[1]) // ignore fully blank lines
    .map(({ cells: [name, city], row }) => {
      let error = null
      if (!name) error = 'Name is missing'
      else if (name.length > MAX_LEN) error = `Name is over ${MAX_LEN} characters`
      else if (!city) error = 'City is missing'
      else if (city.length > MAX_LEN) error = `City is over ${MAX_LEN} characters`
      return { name, city, row, error }
    })
}

export function ImportZonesModal({ open, onClose, onImported }) {
  const fileInputRef = useRef(null)
  const [rows, setRows] = useState(null) // null = pick state
  const [result, setResult] = useState(null) // set = result state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const validRows = rows?.filter((r) => !r.error) ?? []

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
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setError(null)
    try {
      const parsed = validateRows(await parseSpreadsheet(file))
      if (parsed.length === 0) throw new Error('No rows found in the file')
      if (parsed.filter((r) => !r.error).length > MAX_ROWS)
        throw new Error(`Too many rows — up to ${MAX_ROWS} zones per file. Please split the file.`)
      setRows(parsed)
    } catch (err) {
      setError(err.message || 'Could not read the file')
    }
  }

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.post('/zones/bulk', {
        zones: validRows.map(({ name, city }) => ({ name, city })),
      })
      setResult(res.data.data)
      onImported()
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Import failed — please re-upload (existing zones are skipped)'),
      )
    } finally {
      setBusy(false)
    }
  }

  const footer = rows && !result ? (
    <div className="flex gap-3">
      <Button variant="secondary" className="flex-1" onClick={reset}>
        Back
      </Button>
      <Button className="flex-1" disabled={validRows.length === 0} loading={busy} onClick={handleImport}>
        Import {validRows.length} zone{validRows.length === 1 ? '' : 's'}
      </Button>
    </div>
  ) : result ? (
    <Button fullWidth onClick={close}>
      Done
    </Button>
  ) : null

  return (
    <Modal open={open} onClose={close} title="Import zones from Excel" footer={footer}>
      {/* Pick state */}
      {!rows && !result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            Upload a .xlsx or .csv file with two columns: <b>Name</b> and <b>City</b>. A header row
            is optional. Existing zone names are skipped, so re-uploading is safe.
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
              downloadCsvTemplate('zones-template.csv', 'Name,City\nWakad West,Pune\nBaner,Pune\n')
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
            {validRows.length} of {rows.length} rows are valid.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-btn border border-line">
            {rows.map((r) => (
              <div
                key={r.row}
                className="flex items-center gap-2 border-b border-line/60 px-3 py-2 text-sm last:border-b-0"
              >
                {r.error ? (
                  <IconWarn className="h-4 w-4 shrink-0 text-bad" />
                ) : (
                  <IconOkCircle className="h-4 w-4 shrink-0 text-ok" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{r.name || '—'}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{r.city || '—'}</span>
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
            {result.created.length} created · {result.skipped.length} skipped
          </p>
          {result.skipped.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-btn border border-line">
              {result.skipped.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-2 border-b border-line/60 px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="truncate font-medium">{s.name}</span>
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
