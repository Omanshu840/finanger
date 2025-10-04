import { useState } from 'react'
import { type AMFIRecord } from '@/lib/amfi'
import { formatCurrency } from '@/lib/currency'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, Edit2 } from 'lucide-react'
import PickSchemeDialog from './PickSchemeDialog'

export interface MFRow {
  id: string
  sourceSymbol: string
  isin?: string
  schemeName?: string
  units: number
  matchType: 'isin' | 'name' | 'manual' | 'none'
  matched?: AMFIRecord
  candidates?: AMFIRecord[]
  nav: number | null
  navDate: string | null,
  avgPrice?: number
}

interface MFImportTableProps {
  rows: MFRow[]
  onSchemeSelect: (id: string, scheme: AMFIRecord) => void
}

export default function MFImportTable({ rows, onSchemeSelect }: MFImportTableProps) {
  const [pickingSchemeFor, setPickingSchemeFor] = useState<MFRow | null>(null)

  const getStatusBadge = (row: MFRow) => {
    switch (row.matchType) {
      case 'isin':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">
            <CheckCircle className="mr-1 h-3 w-3" />
            By ISIN
          </Badge>
        )
      case 'name':
        return (
          <Badge variant="default" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
            <CheckCircle className="mr-1 h-3 w-3" />
            By Name
          </Badge>
        )
      case 'manual':
        return (
          <Badge variant="default" className="bg-purple-500/10 text-purple-700 dark:text-purple-400">
            Manual
          </Badge>
        )
      default:
        if (row.candidates && row.candidates.length > 1) {
          return (
            <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="mr-1 h-3 w-3" />
              Multiple ({row.candidates.length})
            </Badge>
          )
        }
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Not Found
          </Badge>
        )
    }
  }

  return (
    <>
      <div className="space-y-3">
        {rows.map((row) => {
          const value = row.nav != null ? row.units * row.nav : null

          return (
            <Card key={row.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{row.sourceSymbol}</p>
                      {row.isin && (
                        <p className="text-xs text-muted-foreground">ISIN: {row.isin}</p>
                      )}
                    </div>
                    {getStatusBadge(row)}
                  </div>

                  {/* Matched Scheme */}
                  {row.matched && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Matched Scheme</p>
                      <p className="text-sm font-medium">{row.matched.schemeName}</p>
                    </div>
                  )}

                  {/* Units & NAV */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Units</p>
                      <p className="text-sm font-medium">{row.units.toLocaleString()}</p>
                    </div>
                    {row.nav != null && (
                      <div>
                        <p className="text-xs text-muted-foreground">NAV</p>
                        <p className="text-sm font-medium">
                          {formatCurrency(row.nav, 'INR')}
                        </p>
                        {row.navDate && (
                          <p className="text-xs text-muted-foreground">{row.navDate}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Value */}
                  {value != null && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Current Value</p>
                      <p className="text-lg font-bold">
                        {formatCurrency(value, 'INR')}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {(row.matchType === 'none' || row.candidates) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPickingSchemeFor(row)}
                      className="w-full"
                    >
                      <Edit2 className="mr-2 h-3 w-3" />
                      {row.candidates ? 'Pick Scheme' : 'Manual Mapping'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pick Scheme Dialog */}
      {pickingSchemeFor && (
        <PickSchemeDialog
          open={!!pickingSchemeFor}
          onOpenChange={(open) => !open && setPickingSchemeFor(null)}
          candidates={pickingSchemeFor.candidates || []}
          onSelect={(scheme) => {
            onSchemeSelect(pickingSchemeFor.id, scheme)
            setPickingSchemeFor(null)
          }}
        />
      )}
    </>
  )
}
