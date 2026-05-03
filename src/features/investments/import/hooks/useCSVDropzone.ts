import {
  useState, useRef, useCallback, type DragEvent, type ChangeEvent, type KeyboardEvent,
} from 'react'
import { parseCSVFile, CSVParseError } from '@/features/investments/utils/csvParser'
import type { CSVUploadState, ParsedCSV } from '@/features/investments/types/csv.types'

interface UseCSVDropzoneOptions {
  onParsed?: (parsed: ParsedCSV) => void
}

export function useCSVDropzone({ onParsed }: UseCSVDropzoneOptions = {}) {
  const [state, setState] = useState<CSVUploadState>({ status: 'idle' })
  const inputRef          = useRef<HTMLInputElement>(null)
  // Track drag counter to handle child element drag-leave correctly
  const dragCounter       = useRef(0)

  const processFile = useCallback(async (file: File) => {
    setState({ status: 'parsing' })
    try {
      const parsed = await parseCSVFile(file)
      setState({ status: 'preview', parsed })
      onParsed?.(parsed)
    } catch (err) {
      const message = err instanceof CSVParseError
        ? err.message
        : 'Unexpected error while parsing the file'
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