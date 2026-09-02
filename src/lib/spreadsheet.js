/**
 * Shared .xlsx/.csv parsing for import modals.
 * Returns rows as arrays of trimmed strings (all columns preserved).
 *
 * Both parser packages expose only subpath exports (no bare import), and
 * read-excel-file v9 returns [{ sheet, data }] rather than plain rows.
 */
export async function parseSpreadsheet(file) {
  const ext = file.name.toLowerCase().split('.').pop()
  let rows
  if (ext === 'xlsx') {
    const readXlsxFile = (await import('read-excel-file/browser')).default
    const parsed = await readXlsxFile(file)
    rows = Array.isArray(parsed?.[0]?.data) ? parsed[0].data : parsed
  } else if (ext === 'csv') {
    const Papa = (await import('papaparse')).default
    const result = await new Promise((resolve, reject) =>
      Papa.parse(file, { skipEmptyLines: 'greedy', complete: resolve, error: reject }),
    )
    rows = result.data
  } else {
    throw new Error('Unsupported file type — upload a .xlsx or .csv file')
  }
  return rows.map((row) => (row ?? []).map((cell) => String(cell ?? '').trim()))
}

/** Client-side CSV download without any dependency. */
export function downloadCsvTemplate(filename, content) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // Firefox/Safari need the anchor in the document, and revoking synchronously
  // can cancel the download — append, click, then clean up on the next tick.
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 0)
}
