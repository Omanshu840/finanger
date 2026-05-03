export type CSVRow = Record<string, string | number | null>

export interface ParsedCSV {
  headers: string[]
  rows:    CSVRow[]
  meta: {
    fileName:    string
    fileSize:    number    // bytes
    totalRows:   number    // excluding header
    delimiter:   string
  }
}

export type CSVUploadState =
  | { status: 'idle' }
  | { status: 'dragging' }
  | { status: 'parsing' }
  | { status: 'preview'; parsed: ParsedCSV }
  | { status: 'error';   message: string }