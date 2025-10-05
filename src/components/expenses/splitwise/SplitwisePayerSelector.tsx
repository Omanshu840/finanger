import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { type GroupMember } from '@/lib/splitwiseApi'
import { Check } from 'lucide-react'

interface SplitwisePayerSelectorProps {
  participants: GroupMember[]
  selectedPayer: number | null
  multiplePayers: boolean
  payerShares: Map<number, string>
  amount: string
  currency: string
  onPayerChange: (userId: number) => void
  onMultiplePayersToggle: () => void
  onPayerShareChange: (userId: number, value: string) => void
}

export function SplitwisePayerSelector({
  participants,
  selectedPayer,
  multiplePayers,
  payerShares,
  amount,
  currency,
  onPayerChange,
  onMultiplePayersToggle,
  onPayerShareChange,
}: SplitwisePayerSelectorProps) {
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName ? lastName[0]: ''}`.toUpperCase()
  }

  const getTotalPaid = () => {
    return Array.from(payerShares.values()).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Paid by</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMultiplePayersToggle}
          className="text-primary"
        >
          {multiplePayers ? 'Single payer' : '+ Multiple people'}
        </Button>
      </div>

      {!multiplePayers ? (
        <div className="flex gap-3 pb-2 flex-wrap">
          {participants.map((participant) => (
            <Button
              key={participant.id}
              onClick={() => onPayerChange(participant.id)}
              className={`flex flex-col items-center gap-1 min-w-[70px] py-2 px-0 rounded-lg transition-all h-auto text-primary ${
                selectedPayer === participant.id
                  ? 'bg-primary/10 ring-2 ring-primary'
                  : 'bg-background hover:bg-muted'
              }`}
            >
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={participant.picture?.medium} />
                  <AvatarFallback className={selectedPayer === participant.id ? 'bg-primary text-primary-foreground' : ''}>
                    {getInitials(participant.first_name, participant.last_name)}
                  </AvatarFallback>
                </Avatar>
                {selectedPayer === participant.id && (
                  <div className="absolute -top-1 -right-1 bg-primary rounded-full p-1">
                    <Check className="h-2 text-primary-foreground" />
                  </div>
                )}
              </div>
              <span className="text-xs font-medium text-center truncate ">
                {participant.first_name}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center gap-3 p-3 rounded-lg border">
              <Avatar className="h-10 w-10">
                <AvatarImage src={participant.picture?.medium} />
                <AvatarFallback>
                  {getInitials(participant.first_name, participant.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm font-medium">
                {participant.first_name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{currency}</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-24 h-9"
                  value={payerShares.get(participant.id) || ''}
                  onChange={(e) => onPayerShareChange(participant.id, e.target.value)}
                />
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 px-3">
            <span className="text-sm font-semibold">Total paid:</span>
            <span
              className={`text-sm font-bold ${
                getTotalPaid() !== parseFloat(amount || '0')
                  ? 'text-destructive'
                  : 'text-green-600'
              }`}
            >
              {currency} {getTotalPaid().toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
