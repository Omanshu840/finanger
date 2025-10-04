import { useState } from 'react'
import { type AMFIRecord } from '@/lib/amfi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search } from 'lucide-react'

interface PickSchemeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: AMFIRecord[]
  onSelect: (scheme: AMFIRecord) => void
}

export default function PickSchemeDialog({
  open,
  onOpenChange,
  candidates,
  onSelect
}: PickSchemeDialogProps) {
  const [search, setSearch] = useState('')

  const filtered = candidates.filter(c =>
    c.schemeName.toLowerCase().includes(search.toLowerCase()) ||
    c.isinGrowth?.includes(search.toUpperCase()) ||
    c.isinReinv?.includes(search.toUpperCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Pick Mutual Fund Scheme</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by scheme name or ISIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Results */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No schemes found
                </p>
              ) : (
                filtered.map((scheme) => (
                  <Button
                    key={scheme.schemeCode}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => onSelect(scheme)}
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{scheme.schemeName}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {scheme.isinGrowth && (
                          <span>Growth: {scheme.isinGrowth}</span>
                        )}
                        {scheme.isinReinv && (
                          <span>Div: {scheme.isinReinv}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        NAV: ₹{scheme.nav.toFixed(4)} as on {scheme.date}
                      </p>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
