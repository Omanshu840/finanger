import { useId } from 'react'
import { UploadCloud, FileText, X, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCSVDropzone } from '../hooks/useCSVDropzone'
import type { ParsedCSV } from '@/features/investments/types/csv.types'

// ── Sub-components ────────────────────────────────────────────────────────────

const PREVIEW_ROWS = 5   // rows shown in the preview table

function PreviewTable({ parsed }: { parsed: ParsedCSV }) {
  const previewRows = parsed.rows.slice(0, PREVIEW_ROWS)
  const remaining   = parsed.meta.totalRows - PREVIEW_ROWS

  return (
    <div className="flex flex-col gap-3">
      {/* File meta */}
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium truncate">{parsed.meta.fileName}</span>
        <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
          {parsed.meta.totalRows.toLocaleString('en-IN')} rows
        </span>
      </div>

      {/* Scrollable table */}
      <div
        className="overflow-x-auto rounded-lg border border-border"
        role="region"
        aria-label="CSV preview"
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {parsed.headers.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'border-b border-border/50 last:border-0',
                  i % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                )}
              >
                {parsed.headers.map((h) => (
                  <td
                    key={h}
                    className="whitespace-nowrap px-3 py-2 tabular-nums text-foreground"
                  >
                    {row[h] == null ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : (
                      String(row[h])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* "And N more rows" */}
      {remaining > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          +{remaining.toLocaleString('en-IN')} more row{remaining > 1 ? 's' : ''} not shown
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface CSVUploadProps {
  /** Called when parsing succeeds — use this to import the data */
  onConfirm:  (parsed: ParsedCSV) => void
  /** Called when the user cancels / resets */
  onCancel?:  () => void
  /** Label shown in the dropzone */
  label?:     string
  className?: string
}

export function CSVUpload({
  onConfirm,
  onCancel,
  label     = 'Drop your CSV here',
  className,
}: CSVUploadProps) {
  const inputId = useId()

  const { state, inputRef, dropzoneProps, onInputChange, openPicker, reset } =
    useCSVDropzone()

  function handleCancel() {
    reset()
    onCancel?.()
  }

  function handleConfirm() {
    if (state.status === 'preview') {
      onConfirm(state.parsed)
    }
  }

  const isDragging = state.status === 'dragging'
  const isParsing  = state.status === 'parsing'
  const isPreview  = state.status === 'preview'
  const isError    = state.status === 'error'

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* ── Hidden file input (accessible fallback) ── */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Upload CSV file"
        onChange={onInputChange}
        tabIndex={-1}
      />

      {/* ── Dropzone — hidden once we have a preview ── */}
      {!isPreview && (
        <div
          {...dropzoneProps}
          role="button"
          tabIndex={0}
          aria-label={`${label}. Press Enter or Space to browse files.`}
          aria-describedby="csv-upload-hint"
          aria-disabled={isParsing}
          onClick={isParsing ? undefined : openPicker}
          className={cn(
            // Base
            'relative flex flex-col items-center justify-center gap-3',
            'rounded-xl border-2 border-dashed px-6 py-10',
            'cursor-pointer select-none text-center',
            'transition-all duration-200',
            // Focus ring
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            // States
            isDragging
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
            isParsing && 'pointer-events-none opacity-60',
            isError   && 'border-destructive/50 bg-destructive/5',
          )}
        >
          {/* Icon */}
          <span
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              isDragging ? 'bg-primary/10' : 'bg-muted',
            )}
            aria-hidden="true"
          >
            {isParsing ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isError ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <UploadCloud
                className={cn(
                  'h-5 w-5 transition-colors',
                  isDragging ? 'text-primary' : 'text-muted-foreground',
                )}
              />
            )}
          </span>

          {/* Text */}
          <div>
            {isParsing ? (
              <p className="text-sm font-medium text-muted-foreground">Parsing file…</p>
            ) : isError ? (
              <>
                <p className="text-sm font-medium text-destructive">
                  {(state as Extract<typeof state, { status: 'error' }>).message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try a different file
                </p>
              </>
            ) : isDragging ? (
              <p className="text-sm font-semibold text-primary">Release to upload</p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {label}
                </p>
                <p id="csv-upload-hint" className="mt-1 text-xs text-muted-foreground">
                  or{' '}
                  <label
                    htmlFor={inputId}
                    className="cursor-pointer font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    browse files
                  </label>
                  {' '}· CSV only · max 10 MB
                </p>
              </>
            )}
          </div>

          {/* Drag-active ring pulse */}
          {isDragging && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/30 animate-pulse"
            />
          )}
        </div>
      )}

      {/* ── Preview ── */}
      {isPreview && (
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <PreviewTable parsed={state.parsed} />

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="w-full sm:w-auto"
            >
              <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="w-full sm:w-auto"
            >
              Upload different file
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              className="w-full sm:w-auto"
            >
              Import {state.parsed.meta.totalRows.toLocaleString('en-IN')} rows
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}