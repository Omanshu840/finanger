import Papa from 'papaparse'
import type { ParsedCSV, CSVRow } from '@/features/investments/types/csv.types'

const MAX_FILE_SIZE_MB = 10

export class CSVParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CSVParseError'
  }
}

export function parseCSVFile(file: File): Promise<ParsedCSV> {
  // Guard: file type
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    return Promise.reject(new CSVParseError('Only .csv files are supported'))
  }

  // Guard: file size
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return Promise.reject(
      new CSVParseError(`File too large (max ${MAX_FILE_SIZE_MB} MB)`),
    )
  }

  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(file, {
      header:        true,   // first row becomes object keys
      dynamicTyping: true,   // numbers parsed as number, not string
      skipEmptyLines: true,  // ignore blank rows
      transformHeader: (h) => h.trim(),  // strip whitespace from headers

      complete(results) {
        if (results.errors.length > 0) {
          // Non-fatal row errors — filter out bad rows, keep good ones
          const criticalError = results.errors.find(
            (e) => e.type === 'Delimiter' || e.type === 'Quotes',
          )
          if (criticalError) {
            reject(new CSVParseError(`Parse error: ${criticalError.message}`))
            return
          }
        }

        const headers = results.meta.fields ?? []
        if (headers.length === 0) {
          reject(new CSVParseError('CSV has no columns'))
          return
        }

        resolve({
          headers,
          rows: results.data,
          meta: {
            fileName:  file.name,
            fileSize:  file.size,
            totalRows: results.data.length,
            delimiter: results.meta.delimiter,
          },
        })
      },

      error(err) {
        reject(new CSVParseError(err.message))
      },
    })
  })
}