import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type PortfolioAccount } from '@/data/investments'

interface AccountSelectorProps {
  accounts: PortfolioAccount[]
  selectedAccountId?: string
  onAccountChange: (accountId?: string) => void
}

export default function AccountSelector({
  accounts,
  selectedAccountId,
  onAccountChange
}: AccountSelectorProps) {
  return (
    <Select
      value={selectedAccountId || 'all'}
      onValueChange={(value) => onAccountChange(value === 'all' ? undefined : value)}
    >
      <SelectTrigger className="w-full sm:w-[280px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Accounts</SelectItem>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
