import {
  useState, useRef, useCallback, type DragEvent, type ChangeEvent, type KeyboardEvent,
} from 'react'
import { parseCSVFile, CSVParseError } from '@/features/investments/utils/csvParser'
import { parseXLSXFile, XLSXParseError } from '@/features/investments/utils/xlsxParser'
import type { FileUploadState, ParsedFile } from '@/features/investments/types/file-upload.types'

interface UseFileDropzoneOptions {
  onParsed?: (parsed: ParsedFile) => void
}

export function useFileDropzone({ onParsed }: UseFileDropzoneOptions = {}) {
  const [state, setState] = useState<FileUploadState>({ status: 'idle' })
  const inputRef          = useRef<HTMLInputElement>(null)
  // Track drag counter to handle child element drag-leave correctly
  const dragCounter       = useRef(0)

  const processFile = useCallback(async (file: File) => {
    setState({ status: 'parsing' })
    try {
      let parsed: ParsedFile

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // Parse XLSX file
        const result = await parseXLSXFile(file)
        // Convert Holding[] to FileRow[] for preview
        parsed = {
          headers: ['Symbol', 'ISIN', 'Quantity', 'Average Cost', 'Type'],
          rows: result.holdings.map((h) => ({
            Symbol: h.symbol,
            ISIN: h.isin,
            Quantity: h.quantity,
            'Average Cost': h.avgCost,
            Type: h.type,
          })),
          meta: {
            fileName: file.name,
            fileSize: file.size,
            totalRows: result.holdings.length,
            fileType: 'xlsx',
          },
        }
      } else {
        // Parse CSV file
        const csvParsed = await parseCSVFile(file)
        parsed = {
          ...csvParsed,
          meta: {
            ...csvParsed.meta,
            fileType: 'csv',
          },
        }
      }

      setState({ status: 'preview', parsed })
      onParsed?.(parsed)
    } catch (err) {
      let message = 'Unexpected error while parsing the file'
      if (err instanceof CSVParseError) {
        message = err.message
      } else if (err instanceof XLSXParseError) {
        message = err.message
      } else if (err instanceof Error) {
        message = err.message
      }
      setState({ status: 'error', message })
    }
  }, [onParsed])

  // ── Drag events ─────────────────────────────────────────────────────────

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (dragCounter.current === 1) setState({ status: 'dragging' })
  }, [])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()   // required to allow drop
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setState({ status: 'idle' })
  }, [])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  // ── File input (fallback) ────────────────────────────────────────────────

  const onInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }, [processFile])

  // ── Keyboard: Enter/Space opens the file picker ──────────────────────────

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle' })
    dragCounter.current = 0
  }, [])

  const openPicker = useCallback(() => inputRef.current?.click(), [])

  return {
    state,
    inputRef,
    dropzoneProps: { onDragEnter, onDragOver, onDragLeave, onDrop, onKeyDown },
    onInputChange,
    openPicker,
    reset,
  }
}
