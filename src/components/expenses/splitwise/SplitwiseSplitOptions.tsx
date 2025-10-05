import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { type GroupMember } from '@/lib/splitwiseApi'
import { Percent, Hash, DollarSign, Plus, Equal, Check } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type SplitMethod = 'equally' | 'exact' | 'percentage' | 'shares' | 'adjustment'

interface SplitwiseSplitOptionsProps {
  participants: GroupMember[]
  amount: string
  currency: string
  splitMethod: SplitMethod
  owedShares: Map<number, string>
  onSplitMethodChange: (method: SplitMethod) => void
  onOwedSharesChange: (shares: Map<number, string>) => void
}

export function SplitwiseSplitOptions({
  participants,
  amount,
  currency,
  splitMethod,
  owedShares,
  onSplitMethodChange,
  onOwedSharesChange,
}: SplitwiseSplitOptionsProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [open, setOpen] = useState(false)
  const [activeMethod, setActiveMethod] = useState<SplitMethod>(splitMethod)
  const [localOwedShares, setLocalOwedShares] = useState<Map<number, string>>(new Map(owedShares));
  const [selectedParticipants, setSelectedParticipants] = useState<Set<number>>(
    new Set(participants.map(p => p.id))
  )

  const toggleParticipant = (userId: number) => {
    const newSelected = new Set(selectedParticipants)
    if (newSelected.has(userId)) {
      // Don't allow deselecting if only one participant is left
      if (newSelected.size > 1) {
        newSelected.delete(userId)
      }
    } else {
      newSelected.add(userId)
    }
    setSelectedParticipants(newSelected)
  }


  const updateActiveMethod = (method: SplitMethod) => {
    convertSplits(activeMethod, method);
    setActiveMethod(method);
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName ? lastName[0] : ''}`.toUpperCase()
  }

  const getEqualSplitAmount = () => {
    const selectedCount = selectedParticipants.size
    return selectedCount > 0 ? (totalAmount / selectedCount).toFixed(2) : '0.00'
  }

  const convertSplits = (fromMethod: SplitMethod, toMethod: SplitMethod) => {
    if (fromMethod === toMethod || participants.length === 0) return

    const newSplits = new Map<number, string>()
    const total = totalAmount

    // Calculate current exact amounts based on fromMethod
    const currentAmounts = new Map<number, number>()
    
    participants.forEach(p => {
      let exactAmount = 0

      if (fromMethod === 'equally') {
        // Only selected participants get a share
        if (selectedParticipants.has(p.id)) {
          exactAmount = total / selectedParticipants.size
        } else {
          exactAmount = 0
        }
      } else if (fromMethod === 'exact') {
        exactAmount = parseFloat(localOwedShares.get(p.id) || '0')
      } else if (fromMethod === 'percentage') {
        const percentage = parseFloat(localOwedShares.get(p.id) || '0')
        exactAmount = (percentage / 100) * total
      } else if (fromMethod === 'shares') {
        const shares = parseFloat(localOwedShares.get(p.id) || '1')
        const totalSharesSum = participants.reduce((sum, pp) => 
          sum + parseFloat(localOwedShares.get(pp.id) || '1'), 0)
        exactAmount = totalSharesSum > 0 ? (shares / totalSharesSum) * total : 0
      } else if (fromMethod === 'adjustment') {
        const adjustment = parseFloat(localOwedShares.get(p.id) || '0')
        const baseAmount = total / participants.length
        exactAmount = baseAmount + adjustment
      }

      currentAmounts.set(p.id, exactAmount)
    })

    // Convert to the target method
    participants.forEach(p => {
      const exactAmount = currentAmounts.get(p.id) || 0

      if (toMethod === 'equally') {
        // Mark participant as selected if they have a non-zero amount
        if (exactAmount > 0) {
          selectedParticipants.add(p.id)
        }
        newSplits.set(p.id, '')
      } else if (toMethod === 'exact') {
        newSplits.set(p.id, exactAmount.toFixed(2))
      } else if (toMethod === 'percentage') {
        const percentage = total > 0 ? (exactAmount / total) * 100 : 0
        newSplits.set(p.id, percentage.toFixed(2))
      } else if (toMethod === 'shares') {
        const minAmount = Math.min(...Array.from(currentAmounts.values()).filter(v => v > 0))
        const shares = minAmount > 0 ? Math.round(exactAmount / minAmount) : 1
        newSplits.set(p.id, Math.max(1, shares).toString())
      } else if (toMethod === 'adjustment') {
        const baseAmount = 0
        newSplits.set(p.id, baseAmount.toFixed(2))
      }
    })

    setLocalOwedShares(newSplits)
  }

  const handleOwedShareChange = (userId: number, value: string) => {
    const newShares = new Map(localOwedShares)
    newShares.set(userId, value)
    setLocalOwedShares(newShares)
  }

  const handleSave = () => {
    onSplitMethodChange(activeMethod)
    // For equally split, save which participants are selected
    if (activeMethod === 'equally') {
      const equalSplits = new Map<number, string>()
      const splitAmount = getEqualSplitAmount()
      participants.forEach(p => {
        equalSplits.set(p.id, selectedParticipants.has(p.id) ? splitAmount : '0')
      })
      onOwedSharesChange(equalSplits)
    } else if(activeMethod === "percentage") {
      const percentageSplits = new Map<number, string>()
      participants.forEach(p => {
        percentageSplits.set(p.id, getPercentageAmount(p.id).toString());
      })
      onOwedSharesChange(percentageSplits)
    } else if (activeMethod === "shares") {
      const shareSplits = new Map<number, string>()
      participants.forEach(p => {
        shareSplits.set(p.id, getShareAmount(p.id).toString());
      })
      onOwedSharesChange(shareSplits);
    } else if(activeMethod === "adjustment") {
      const adjustmentSplits = new Map<number, string>()
      participants.forEach(p => {
        adjustmentSplits.set(p.id, getAdjustmentPreview(p.id).toString());
      })
      onOwedSharesChange(adjustmentSplits);
    } else {
      onOwedSharesChange(new Map(localOwedShares))
    }

    setShowDialog(false)
  }

  const getTotalOwed = () => {
    return Array.from(localOwedShares.values())
      .reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
  }

  const getTotalPercentage = () => {
    return Array.from(localOwedShares.values())
      .reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
  }

  const getTotalShares = () => {
    return Array.from(localOwedShares.values())
      .reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
  }

  const getAdjustmentPreview = (participantId: number) => {
    const total = parseFloat(amount);
    let participantTotal = 0;
    participants.forEach(p => {
      participantTotal += parseFloat(localOwedShares.get(p.id) || '0');
    });
    const baseAmount = total - participantTotal;
    const adjustment = baseAmount / participants.length;
    return parseFloat(localOwedShares.get(participantId) || '0') + adjustment;
  }

  const getShareAmount = (participantId: number) => {
    const total = parseFloat(amount);
    const shares = parseFloat(localOwedShares.get(participantId) || '1')
    const totalSharesSum = getTotalShares()
    return totalSharesSum > 0 ? (shares / totalSharesSum) * total : 0
  }

  const getPercentageAmount = (participantId: number) => {
    const total = parseFloat(amount);
    const percentage = parseFloat(localOwedShares.get(participantId) || '0')
    return (percentage / 100) * total
  }

  const splitMethodLabels: Record<SplitMethod, { label: string; icon: any }> = {
    equally: { label: 'Equally', icon: Equal },
    exact: { label: 'Exact amounts', icon: DollarSign },
    percentage: { label: 'Percentages', icon: Percent },
    shares: { label: 'Shares', icon: Hash },
    adjustment: { label: 'Adjustment', icon: Plus },
  }

  const totalAmount = parseFloat(amount || '0');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Split</Label>
      </div>

      {/* Split Method Badge/Button */}
      <Button
        variant="outline"
        className="w-full justify-between h-auto py-4"
        onClick={() => setShowDialog(true)}
      >
        <div className="flex items-center gap-2">
          {splitMethodLabels[splitMethod].icon && (
            <div className="p-1.5 rounded-md bg-primary/10">
              {(() => {
                const Icon = splitMethodLabels[splitMethod].icon
                return <Icon className="h-4 w-4 text-primary" />
              })()}
            </div>
          )}
          <span className="font-medium">{splitMethodLabels[splitMethod].label}</span>
        </div>
      </Button>

      {/* Split Dialog */}
      <Sheet open={showDialog} onOpenChange={setShowDialog}>
        {/* <ScrollArea className="h-full"> */}
        <SheetContent className="w-full sm:max-w-2xl px-4  py-6 max-h-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Split Method</DialogTitle>
            <DialogDescription>
              Choose how to divide {currency} {amount || '0.00'} among {participants.length} people
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-1 bg-muted/50 rounded-lg p-4">
            <p className="font-medium">{splitMethodLabels[activeMethod].label}</p>
            <p className="text-sm text-muted-foreground">
              {activeMethod === 'equally' && 'Select which people owe an equal share.'}
              {activeMethod === 'exact' && 'Specify exactly how much each person owes.'}
              {activeMethod === 'percentage' && 'Enter the percentage split that iss fair for your situation.'}
              {activeMethod === 'shares' && 'Great for time-based splitting (2 nights → 2 shares) and splitting across families (family of 3 → 3 shares).'}
              {activeMethod === 'adjustment' && 'Enter adiustments to reflect who owes extra, Splitwise will distribute the remainder equally.'}
            </p>
          </div>

          <Tabs value={activeMethod} className="mt-2" onValueChange={(v) => updateActiveMethod(v as SplitMethod)}>
            <TabsList className="w-full">
              {(Object.keys(splitMethodLabels) as SplitMethod[]).map((method) => (
                <TabsTrigger
                  key={method}
                  value={method}
                  className=""
                >
                  <div className="flex items-center justify-center gap-2">
                    {splitMethodLabels[method].icon && (
                      <div className="p-1 rounded-md">
                        {(() => {
                          const Icon = splitMethodLabels[method].icon
                          return <Icon className="h-4 w-4 text-primary" />
                        })()}
                      </div>
                    )}
                    {/* <span className="text-xs font-medium">{splitMethodLabels[method].label}</span> */}
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          
          <div className="flex-1 overflow-y-auto">
            {/* Equally Split */}
            {activeMethod === 'equally' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  {participants.map((participant) => {
                    const isSelected = selectedParticipants.has(participant.id)
                    const canDeselect = selectedParticipants.size > 1
                    
                    return (
                      <Button
                        key={participant.id}
                        onClick={() => toggleParticipant(participant.id)}
                        disabled={isSelected && !canDeselect}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all h-auto",
                          isSelected 
                            ? "bg-primary/5" 
                            : "bg-background hover:border-primary/50",
                          isSelected && !canDeselect && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                            isSelected 
                              ? "border-primary bg-primary" 
                              : "border-muted-foreground"
                          )}>
                            {isSelected && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={participant.picture?.medium} />
                            <AvatarFallback className="text-xs">
                              {getInitials(participant.first_name, participant.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn(
                            "text-sm font-medium",
                            isSelected ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {participant.first_name}
                          </span>
                        </div>
                        <Badge variant={isSelected ? "default" : "secondary"}>
                          ₹{isSelected ? getEqualSplitAmount() : '0.00'}
                        </Badge>
                      </Button>
                    )
                  })}
                </div>

                {selectedParticipants.size < participants.length && (
                  <div className="flex justify-between items-center pt-2 px-3 border-t text-sm">
                    <span className="text-muted-foreground">
                      {participants.length - selectedParticipants.size} {participants.length - selectedParticipants.size === 1 ? 'person' : 'people'} not included
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Exact Amount */}
            {activeMethod === 'exact' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={participant.picture?.medium} />
                        <AvatarFallback className="text-xs">
                          {getInitials(participant.first_name, participant.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-sm font-medium truncate">
                        {participant.first_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="w-24 h-9 text-right"
                          value={localOwedShares.get(participant.id) || ''}
                          onChange={(e) => handleOwedShareChange(participant.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 px-3 border-t">
                    <span className="text-sm font-semibold">Total split:</span>
                    <span
                      className={`text-sm font-bold ${
                        Math.abs(getTotalOwed() - (parseFloat(amount) || totalAmount)) > 0.01
                          ? 'text-destructive'
                          : 'text-green-600'
                      }`}
                    >
                      ₹{getTotalOwed().toFixed(2)} / ₹{(parseFloat(amount) || totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Percentage */}
            {activeMethod === 'percentage' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={participant.picture?.medium} />
                        <AvatarFallback className="text-xs">
                          {getInitials(participant.first_name, participant.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 gap-1 grow">
                        <span className="text-sm font-medium block truncate">
                          {participant.first_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ₹{getPercentageAmount(participant.id).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="1"
                          placeholder="0"
                          className="w-20 h-9 text-right"
                          value={localOwedShares.get(participant.id) || ''}
                          onChange={(e) => handleOwedShareChange(participant.id, e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 px-3 border-t">
                    <span className="text-sm font-semibold">Total:</span>
                    <span
                      className={`text-sm font-bold ${
                        Math.abs(getTotalPercentage() - 100) > 0.01
                          ? 'text-destructive'
                          : 'text-green-600'
                      }`}
                    >
                      {getTotalPercentage().toFixed(1)}% / 100%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Shares */}
            {activeMethod === 'shares' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={participant.picture?.medium} />
                        <AvatarFallback className="text-xs">
                          {getInitials(participant.first_name, participant.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 gap-1 grow">
                        <span className="text-sm font-medium block truncate">
                          {participant.first_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ₹{getShareAmount(participant.id).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="1"
                          className="w-16 h-9 text-right"
                          value={localOwedShares.get(participant.id)}
                          onChange={(e) => handleOwedShareChange(participant.id, e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">sh</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 px-3 border-t">
                    <span className="text-sm font-semibold">Total shares:</span>
                    <span className="text-sm font-bold text-primary">
                      {getTotalShares()} shares = ₹{(parseFloat(amount) || totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Adjustment */}
            {activeMethod === 'adjustment' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {participants.map((participant) => {
                    const previewAmount = getAdjustmentPreview(participant.id)
                    return (
                      <div key={participant.id} className="flex items-center gap-3 p-3 rounded-lg border">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={participant.picture?.medium} />
                          <AvatarFallback className="text-xs">
                            {getInitials(participant.first_name, participant.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 gap-1 grow">
                          <span className="text-sm font-medium block truncate">
                            {participant.first_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ₹{previewAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-20 h-9 text-right"
                            value={localOwedShares.get(participant.id) || ''}
                            onChange={(e) => handleOwedShareChange(participant.id, e.target.value)}
                          />
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex justify-between items-center pt-2 px-3 border-t">
                    <span className="text-sm font-semibold">Net adjustment:</span>
                    <span className={`text-sm font-bold ${
                      Math.abs(getTotalOwed()) > 0.01 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {getTotalOwed() >= 0 ? '+' : ''}₹{getTotalOwed().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave}>
              Apply Split
            </Button>
          </div>
        </SheetContent>
        {/* </ScrollArea> */}
      </Sheet>

      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Each person pays</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {participants.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1">
              {p.first_name} • ₹{owedShares.get(p.id)}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
