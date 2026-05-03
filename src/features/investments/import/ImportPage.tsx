import { useState } from 'react'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUpload } from './components/FileUpload'
import { ImportFlow } from './components/ImportFlow'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { ParsedFile } from '@/features/investments/types/file-upload.types'
import type { CSVRow } from '@/features/investments/types/csv.types'
import type { ImportSummary } from '@/features/investments/types/import.types'

// ── States ─────────────────────────────────────────────────────────────────
type PageState = 'upload' | 'importing' | 'success'

// ── Import page ────────────────────────────────────────────────────────────

export function ImportPage() {
  usePageTitle()

  const [state, setState] = useState<PageState>('upload')
  const [csvData, setCsvData] = useState<CSVRow[] | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  // ── File upload handlers ──────────────────────────────────────────────────

  function handleFileConfirm(parsed: ParsedFile) {
    let rows: CSVRow[]
    
    if (parsed.meta.fileType === 'xlsx') {
      // For XLSX, the rows are already in the correct format from FileUpload component
      rows = parsed.rows
    } else {
      // For CSV, use rows as-is
      rows = parsed.rows
    }
    
    setCsvData(rows)
    setState('importing')
  }

  function handleFileCancel() {
    setCsvData(null)
    setState('upload')
  }

  // ── Import completion handlers ───────────────────────────────────────────

  function handleImportDone(importSummary: ImportSummary) {
    setSummary(importSummary)
    setState('success')
  }

  function handleImportCancel() {
    setCsvData(null)
    setState('upload')
  }

  function handleReset() {
    setCsvData(null)
    setSummary(null)
    setState('upload')
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12">
      {/* ── Upload State ── */}
      {state === 'upload' && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Import Holdings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload an Excel file with your equity and mutual fund holdings
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <FileUpload
                onConfirm={handleFileConfirm}
                onCancel={handleFileCancel}
                label="Drop your holdings Excel file here"
                className="min-h-[300px]"
              />
            </CardContent>
          </Card>

          {/* Help card */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">File Format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-foreground">Using the example file:</p>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
                  <li>Download or prepare your <code className="bg-muted px-1 py-0.5 rounded text-xs">holding-example.xlsx</code> file</li>
                  <li>Ensure it has separate sheets for "Equity" and "Mutual Funds"</li>
                  <li>Include columns: Symbol, ISIN, and Quantity Available</li>
                  <li>Drop the file above or click to browse</li>
                </ol>
              </div>
              <div className="rounded-lg border border-border/50 bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  💡 The file should have data starting from row 24 with proper headers in row 23
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Importing State ── */}
      {state === 'importing' && csvData && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Review Import</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Check for conflicts and confirm the import
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <ImportFlow
                rows={csvData}
                onDone={handleImportDone}
                onCancel={handleImportCancel}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Success State ── */}
      {state === 'success' && summary && (
        <div className="space-y-4">
          <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-950/40 dark:bg-emerald-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="flex-1">
                  <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">
                    Import complete!
                  </h2>
                  <p className="mt-1 text-sm text-emerald-800/75 dark:text-emerald-300/75">
                    Your holdings have been successfully imported.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.added > 0 && (
              <StatCard
                label="Added"
                value={summary.added}
                color="emerald"
              />
            )}
            {summary.merged > 0 && (
              <StatCard
                label="Merged"
                value={summary.merged}
                color="blue"
              />
            )}
            {summary.replaced > 0 && (
              <StatCard
                label="Replaced"
                value={summary.replaced}
                color="amber"
              />
            )}
            {summary.skipped > 0 && (
              <StatCard
                label="Skipped"
                value={summary.skipped}
                color="slate"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              Import another file
            </Button>
            <Button
              onClick={() => window.location.href = '/assets'}
              className="w-full sm:w-auto"
            >
              View assets
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stat Card Component ────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  color: 'emerald' | 'blue' | 'amber' | 'slate'
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorMap = {
    emerald: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    blue:    'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
    amber:   'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    slate:   'bg-slate-100 text-slate-900 dark:bg-slate-950/50 dark:text-slate-200',
  }

  return (
    <div className={`rounded-lg p-3 text-center ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs font-medium opacity-75">{label}</p>
    </div>
  )
}
