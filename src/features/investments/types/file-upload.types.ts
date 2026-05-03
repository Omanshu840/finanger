// Unified file upload types supporting CSV and XLSX

import type { CSVRow } from '@/features/investments/types/csv.types'

export type FileRow = CSVRow

export interface ParsedFile {
  headers: string[]
  rows:    FileRow[]
  meta: {
    fileName:    string
    fileSize:    number    // bytes
    totalRows:   number    // excluding header
    fileType:    'csv' | 'xlsx'
  }
}

export type FileUploadState =
  | { status: 'idle' }
  | { status: 'dragging' }
  | { status: 'parsing' }
  | { status: 'preview'; parsed: ParsedFile }
  | { status: 'error'; message: string }
