import { useState } from 'react'
import { Check, AlertTriangle, Info, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ConflictRow } from './ConflictRow'
import { useImportPreview } from '../hooks/useImportPreview'
import type { CSVRow } from '@/features/investments/types/csv.types'
import type { ImportSummary, ConflictResolution } from '@/features/investments/types/import.types'

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Preview', 'Conflicts', 'Done'] as const
type Step = (typeof STEPS)[number]

function StepIndicator({ current }: { current: Step }) {
  return (
    <ol className="flex items-center gap-1" aria-label="Import progress">
      {STEPS.map((step, i) => {
        const idx     = STEPS.indexOf(current)
        const done    = i < idx
        const active  = step === current
        return (
          <li key={step} className="flex items-center gap-1">
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                done   && 'bg-primary text-primary-foreground',
                active && 'bg-primary/20 text-primary ring-1 ring-primary',
                !done && !active && 'bg-muted text-muted-foreground',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {step}
            </span>
            {i < STEPS.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/40" aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── Preview table (collapsed version for the flow) ────────────────────────────

function PreviewTable({ rows }: { rows: ReturnType<typeof useImportPreview>['previewRows'] }) {
  const SHOW = 6
  const visible   = rows.slice(0, SHOW)
  const remaining = rows.length - SHOW

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {['Symbol', 'Qty', 'Avg Cost', 'Status'].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(({ holding, conflict }, i) => (
            <tr
              key={holding.symbol}
              className={cn(
                'border-b border-border/50 last:border-0',
                i % 2 === 0 ? 'bg-background' : 'bg-muted/20',
              )}
            >
              <td className="px-3 py-2 font-medium">{holding.symbol}</td>
              <td className="px-3 py-2 tabular-nums">{holding.quantity.toLocaleString('en-IN')}</td>
              <td className="px-3 py-2 tabular-nums">
                {holding.avgCost > 0 ? `₹${holding.avgCost.toFixed(2)}` : '—'}
              </td>
              <td className="px-3 py-2">
                {conflict ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                    <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                    Existing
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                    New
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {remaining > 0 && (
        <p className="px-3 py-2 text-center text-xs text-muted-foreground">
          +{remaining} more rows
        </p>
      )}
    </div>
  )
}

// ── Main ImportFlow ───────────────────────────────────────────────────────────

interface ImportFlowProps {
  rows:      CSVRow[]
  onDone:    (summary: ImportSummary) => void
  onCancel:  () => void
}

export function ImportFlow({ rows, onDone, onCancel }: ImportFlowProps) {
  const [step, setStep] = useState<Step>('Preview')
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const {
    previewRows,
    parseSkipped,
    hasConflicts,
    conflictCount,
    newCount,
    effectiveResolution,
    setResolution,
    setAllResolutions,
    confirmImport,
    holdingConflictKey,
  } = useImportPreview(rows)

  function handlePreviewNext() {
    // Skip conflicts step if there are none
    setStep(hasConflicts ? 'Conflicts' : 'Done')
    if (!hasConflicts) {
      const s = confirmImport()
      setSummary(s)
      onDone(s)
    }
  }

  function handleConflictConfirm() {
    const s = confirmImport()
    setSummary(s)
    setSummary(s)
    setStep('Done')
    onDone(s)
  }

  return (
    <div className="flex flex-col gap-5">
      <StepIndicator current={step} />

      {/* ── Step: Preview ── */}
      {step === 'Preview' && (
        <>
          {/* Stats row */}
          <div className="flex flex-wrap gap-3">
            <StatChip
              icon={<Check className="h-3.5 w-3.5 text-emerald-600" />}
              label={`${newCount} new`}
              color="emerald"
            />
            {conflictCount > 0 && (
              <StatChip
                icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                label={`${conflictCount} existing`}
                color="amber"
              />
            )}
            {parseSkipped > 0 && (
              <StatChip
                icon={<Info className="h-3.5 w-3.5 text-muted-foreground" />}
                label={`${parseSkipped} skipped`}
                color="muted"
              />
            )}
          </div>

          <PreviewTable rows={previewRows} />

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={onCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button size="sm" onClick={handlePreviewNext} className="w-full sm:w-auto">
              {hasConflicts ? `Review ${conflictCount} conflict${conflictCount > 1 ? 's' : ''}` : `Import ${previewRows.length} holdings`}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </>
      )}

      {/* ── Step: Conflicts ── */}
      {step === 'Conflicts' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {conflictCount} holding{conflictCount > 1 ? 's' : ''} already exist. Choose how to handle each.
            </p>
            {/* Bulk resolution */}
            <div
              role="group"
              aria-label="Apply resolution to all conflicts"
              className="flex shrink-0 overflow-hidden rounded-md border border-border"
            >
              {(['merge', 'replace', 'skip'] as ConflictResolution[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setAllResolutions(r)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium capitalize',
                    'border-r border-border last:border-r-0',
                    'bg-background text-muted-foreground',
                    'hover:bg-muted transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                  )}
                  title={`Apply "${r}" to all conflicts`}
                >
                  All: {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {previewRows
              .filter((r) => r.conflict)
              .map((row) => {
                const key = holdingConflictKey(row.holding)
                return (
                  <ConflictRow
                    key={key}
                    row={row}
                    resolution={effectiveResolution(key)}
                    onResolution={(r) => setResolution(key, r)}
                  />
                )
              })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => setStep('Preview')} className="w-full sm:w-auto">
              Back
            </Button>
            <Button size="sm" onClick={handleConflictConfirm} className="w-full sm:w-auto">
              Confirm import
            </Button>
          </div>
        </>
      )}

      {/* ── Step: Done ── */}
      {step === 'Done' && summary && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <Check className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold">Import complete</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.added > 0    && `${summary.added} added · `}
              {summary.merged > 0   && `${summary.merged} merged · `}
              {summary.replaced > 0 && `${summary.replaced} replaced · `}
              {summary.skipped > 0  && `${summary.skipped} skipped`}
            </p>
          </div>
          <Button size="sm" onClick={onCancel}>Done</Button>
        </div>
      )}
    </div>
  )
}

// ── Tiny helper ───────────────────────────────────────────────────────────────

function StatChip({
  icon, label, color,
}: {
  icon: React.ReactNode
  label: string
  color: 'emerald' | 'amber' | 'muted'
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    amber:   'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    muted:   'bg-muted text-muted-foreground',
  }
  return (
    <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', colors[color])}>
      {icon}{label}
    </span>
  )
}
