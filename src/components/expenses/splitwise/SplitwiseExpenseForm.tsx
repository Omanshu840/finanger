import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ChevronLeft } from 'lucide-react'
import {
  splitwiseClient,
  type SplitwiseGroup,
  type SplitwiseFriend,
  type GroupMember,
} from '@/lib/splitwiseApi'
import { SplitwisePayerSelector } from './SplitwisePayerSelector'
import { SplitwiseSplitOptions } from './SplitwiseSplitOptions'
import { SplitwiseCategorySelector } from './SplitwiseCategorySelector'
import { SplitwiseDatePicker } from './SplitwiseDatePicker'
import { SplitwiseImageUpload } from './SplitwiseImageUpload'

interface SplitwiseExpenseFormProps {
  entity: {
    type: 'friend' | 'group'
    data: SplitwiseFriend | SplitwiseGroup
  }
  onBack: () => void
  onSuccess: () => void
}

type SplitMethod = 'equally' | 'exact' | 'percentage' | 'shares' | 'adjustment'

export function SplitwiseExpenseForm({
  entity,
  onBack,
  onSuccess,
}: SplitwiseExpenseFormProps) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('0')
  const [currency] = useState('INR')
  const [date, setDate] = useState<Date>(new Date())
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState<number | null>(18);
  const [images, setImages] = useState<string[]>([])
  
  const [participants, setParticipants] = useState<GroupMember[]>([])
  const [selectedPayer, setSelectedPayer] = useState<number | null>(null)
  const [multiplePayers, setMultiplePayers] = useState(false)
  const [payerShares, setPayerShares] = useState<Map<number, string>>(new Map())
  
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equally')
  const [owedShares, setOwedShares] = useState<Map<number, string>>(new Map())
  
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    loadParticipants()
  }, [entity])

  // Auto-suggest category based on description
  useEffect(() => {
    if (description) {
      suggestCategory(description)
    }
  }, [description])

  useEffect(() => {
    const equalShares = new Map<number, string>()
    if (amount && participants.length > 0) {
      const amt = parseFloat(amount) || 0
      const share = (amt / participants.length).toFixed(2)
      participants.forEach(p => {
        equalShares.set(p.id, share)
      })
    }
    setOwedShares(equalShares)
  }, [amount, participants])

  const loadParticipants = async () => {
    try {
      setInitialLoading(true)
      const currentUser = await splitwiseClient.getCurrentUser()

      if (entity.type === 'group') {
        const group = entity.data as SplitwiseGroup
        const groupDetails = await splitwiseClient.getGroup(group.id)
        setParticipants(groupDetails.members)
      } else {
        const friend = entity.data as SplitwiseFriend
        setParticipants([
          {
            id: currentUser.id,
            first_name: currentUser.first_name,
            last_name: currentUser.last_name,
            email: currentUser.email,
            picture: currentUser.picture,
          },
          {
            id: friend.id,
            first_name: friend.first_name,
            last_name: friend.last_name,
            email: friend.email,
            picture: friend.picture,
          },
        ])
      }

      // Set current user as default payer
      setSelectedPayer(currentUser.id)
      setPayerShares(new Map([[currentUser.id, amount || '0']]))
    } catch (error) {
      console.error('Error loading participants:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  const suggestCategory = async (desc: string) => {
    const categories = await splitwiseClient.getCategories()
    const lowerDesc = desc.toLowerCase()
    
    // Simple keyword matching for category suggestion
    const categoryKeywords: Record<string, string[]> = {
      'Food and drink': ['dinner', 'lunch', 'breakfast', 'food', 'restaurant', 'cafe', 'coffee', 'drink', 'meal'],
      'Entertainment': ['movie', 'concert', 'show', 'ticket', 'game', 'entertainment'],
      'Transportation': ['uber', 'taxi', 'bus', 'train', 'flight', 'travel', 'petrol', 'gas'],
      'Home': ['rent', 'electricity', 'water', 'internet', 'utilities'],
      'Shopping': ['shopping', 'clothes', 'amazon', 'flipkart'],
    }

    for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerDesc.includes(keyword))) {
        const matchedCategory = categories.find(c => c.name === categoryName)
        if (matchedCategory) {
          setCategory(matchedCategory.id)
          break
        }
      }
    }
  }

  const handleSubmit = async () => {
    if (!description || !amount || !selectedPayer) {
      alert('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)

      const groupId = entity.type === 'group' ? (entity.data as SplitwiseGroup).id : 0

      const users = participants.map(p => ({
        user_id: p.id,
        paid_share: multiplePayers ? (payerShares.get(p.id) || '0') : (p.id === selectedPayer ? amount : '0'),
        owed_share: (owedShares.get(p.id) || '0')
      }))

      await splitwiseClient.createExpense({
        cost: amount,
        description,
        details: notes || undefined,
        date: date.toISOString(),
        currency_code: currency,
        category_id: category || undefined,
        group_id: groupId,
        split_equally: splitMethod === 'equally',
        users: users,
      })

      onSuccess()
    } catch (error) {
      console.error('Error creating expense:', error)
      alert('Failed to create expense')
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const entityName = entity.type === 'group' 
    ? (entity.data as SplitwiseGroup).name 
    : `${(entity.data as SplitwiseFriend).first_name} ${(entity.data as SplitwiseFriend).last_name}`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold truncate">{entityName}</h2>
            <p className="text-sm text-muted-foreground">
              {participants.length} {participants.length === 1 ? 'person' : 'people'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-6">
        {/* Primary Fields */}
        <div className="flex flex-col gap-2">
          {/* Description */}
          <div className="flex items-center gap-2">
            {/* Category */}
            <SplitwiseCategorySelector
              selectedCategory={category}
              onCategoryChange={setCategory}
            />
            <Input
              placeholder="Dinner, Movie"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-normal h-10"
            />
          </div>

          {/* Amount - Prominent */}
          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                ₹
              </span>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg h-12 pl-8 font-bold md:text-lg"
              />
            </div>
          </div>

          {/* Date */}
          <SplitwiseDatePicker date={date} onDateChange={setDate} />
        </div>

        <Separator />

        {/* Payer Selector */}
        <SplitwisePayerSelector
          participants={participants}
          selectedPayer={selectedPayer}
          multiplePayers={multiplePayers}
          payerShares={payerShares}
          amount={amount}
          currency={currency}
          onPayerChange={setSelectedPayer}
          onMultiplePayersToggle={() => setMultiplePayers(!multiplePayers)}
          onPayerShareChange={(userId, value) => {
            const newShares = new Map(payerShares)
            newShares.set(userId, value)
            setPayerShares(newShares)
          }}
        />

        <Separator />

        {/* Split Options */}
        <SplitwiseSplitOptions
          participants={participants}
          amount={amount}
          currency={currency}
          splitMethod={splitMethod}
          owedShares={owedShares}
          onSplitMethodChange={setSplitMethod}
          onOwedSharesChange={setOwedShares}
        />

        <Separator />

        {/* Secondary Features - Collapsible */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Additional Details</Label>
          
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm text-muted-foreground">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Image Upload */}
          <SplitwiseImageUpload
            images={images}
            onImagesChange={setImages}
          />
        </div>
      </div>

      {/* Footer - Sticky Action Button */}
      <div className="px-6 py-4 border-t sticky bottom-0 bg-background">
        <Button
          size="lg"
          className="w-full text-lg h-12"
          onClick={handleSubmit}
          disabled={loading || !description || !amount}
        >
          {loading ? 'Saving...' : 'Save Expense'}
        </Button>
      </div>
    </div>
  )
}
