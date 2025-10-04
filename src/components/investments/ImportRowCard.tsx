import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { Edit2, Check, X, AlertCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImportRowCardProps {
  sourceSymbol: string
  mappedTicker: string
  quantity: number
  price: number | null
  currency: string
  status: 'pending' | 'loading' | 'success' | 'error'
  onTickerChange: (newTicker: string) => void
}

export default function ImportRowCard({
  sourceSymbol,
  mappedTicker,
  quantity,
  price,
  currency,
  status,
  onTickerChange
}: ImportRowCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(mappedTicker)

  const value = price != null ? quantity * price : null

  const handleSave = () => {
    if (editValue.trim()) {
      onTickerChange(editValue.trim().toUpperCase())
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditValue(mappedTicker)
    setIsEditing(false)
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{sourceSymbol}</p>
              <p className="text-xs text-muted-foreground">Qty: {quantity.toLocaleString()}</p>
            </div>

            <Badge
              variant={
                status === 'success' ? 'default' :
                status === 'error' ? 'destructive' :
                status === 'loading' ? 'secondary' :
                'outline'
              }
              className="ml-2"
            >
              {status === 'success' && <CheckCircle className="mr-1 h-3 w-3" />}
              {status === 'error' && <AlertCircle className="mr-1 h-3 w-3" />}
              {status}
            </Badge>
          </div>

          {/* Mapped Ticker */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Yahoo Ticker</p>
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                  placeholder="e.g., RELIANCE.NS"
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1">
                  {mappedTicker || 'Not mapped'}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Price & Value */}
          {status === 'success' && price != null && value != null && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="text-sm font-medium">
                  {formatCurrency(price, currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(value, currency)}
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <p className="text-xs text-destructive">
              Failed to fetch price. Check ticker and try again.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
