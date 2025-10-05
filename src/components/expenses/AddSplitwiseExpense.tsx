// AddExpense.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CalendarIcon,
  Upload,
  Users,
  DollarSign,
  Percent,
  Hash,
  Plus,
  Minus,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  splitwiseClient,
  type SplitwiseGroup,
  type SplitwiseFriend,
  type Currency,
  type Category,
  type GroupMember,
  type CreateExpensePayload
} from '@/lib/splitwiseApi'

type SplitMethod = 'equally' | 'exact' | 'percentage' | 'shares' | 'adjustment'

interface Participant {
  id: number
  name: string
  email: string
  picture?: string
  paidAmount: number
  owedAmount: number
  shares?: number
  percentage?: number
  adjustment?: number
}

export default function AddSplitwiseExpense() {
  // Basic expense info
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState<Date>(new Date())
  const [currency, setCurrency] = useState('USD')
  
  // Context (group or friend)
  const [splitContext, setSplitContext] = useState<'group' | 'friend'>('group')
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null)
  
  // Category
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  
  // Payers
  const [multiplePayers, setMultiplePayers] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  
  // Split method
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equally')
  
  // Recurring
  const [isRecurring, setIsRecurring] = useState(false)
  const [repeatInterval, setRepeatInterval] = useState<'weekly' | 'fortnightly' | 'monthly' | 'yearly'>('monthly')
  
  // Data from API
  const [groups, setGroups] = useState<SplitwiseGroup[]>([])
  const [friends, setFriends] = useState<SplitwiseFriend[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // UI State
  const [loading, setLoading] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Fetch initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  // Update participants when group/friend changes
  useEffect(() => {
    updateParticipants()
  }, [selectedGroupId, selectedFriendId, splitContext, groups, friends, currentUser])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [user, groupsData, friendsData, currenciesData, categoriesData] = await Promise.all([
        splitwiseClient.getCurrentUser(),
        splitwiseClient.getGroups(),
        splitwiseClient.getFriends(),
        splitwiseClient.getCurrencies(),
        splitwiseClient.getCategories()
      ])
      
      setCurrentUser(user)
      setGroups(groupsData)
      setFriends(friendsData)
      setCurrencies(currenciesData)
      setCategories(categoriesData)
      
      // Set default group if available
      if (groupsData.length > 0) {
        setSelectedGroupId(groupsData[0].id)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateParticipants = () => {
    if (!currentUser) return

    let newParticipants: Participant[] = []

    if (splitContext === 'group' && selectedGroupId !== null) {
      const group = groups.find(g => g.id === selectedGroupId)
      if (group) {
        newParticipants = group.members.map(member => ({
          id: member.id,
          name: `${member.first_name} ${member.last_name}`,
          email: member.email,
          picture: member.picture?.medium,
          paidAmount: 0,
          owedAmount: 0,
          shares: 1,
          percentage: 0,
          adjustment: 0
        }))
      }
    } else if (splitContext === 'friend' && selectedFriendId !== null) {
      const friend = friends.find(f => f.id === selectedFriendId)
      if (friend) {
        newParticipants = [
          {
            id: currentUser.id,
            name: `${currentUser.first_name} ${currentUser.last_name}`,
            email: currentUser.email,
            picture: currentUser.picture?.medium,
            paidAmount: 0,
            owedAmount: 0,
            shares: 1,
            percentage: 50,
            adjustment: 0
          },
          {
            id: friend.id,
            name: `${friend.first_name} ${friend.last_name}`,
            email: friend.email,
            picture: friend.picture?.medium,
            paidAmount: 0,
            owedAmount: 0,
            shares: 1,
            percentage: 50,
            adjustment: 0
          }
        ]
      }
    }

    // Set current user as default payer
    if (newParticipants.length > 0 && !multiplePayers) {
      const totalAmount = parseFloat(amount) || 0
      newParticipants = newParticipants.map(p => 
        p.id === currentUser.id 
          ? { ...p, paidAmount: totalAmount }
          : { ...p, paidAmount: 0 }
      )
    }

    setParticipants(newParticipants)
    calculateSplit(newParticipants)
  }

  const calculateSplit = (parts: Participant[] = participants) => {
    const totalAmount = parseFloat(amount) || 0
    if (totalAmount === 0 || parts.length === 0) return parts

    let updatedParticipants = [...parts]

    switch (splitMethod) {
      case 'equally':
        const equalShare = totalAmount / parts.length
        updatedParticipants = parts.map(p => ({
          ...p,
          owedAmount: parseFloat(equalShare.toFixed(2))
        }))
        break

      case 'percentage':
        updatedParticipants = parts.map(p => ({
          ...p,
          owedAmount: parseFloat(((totalAmount * (p.percentage || 0)) / 100).toFixed(2))
        }))
        break

      case 'shares':
        const totalShares = parts.reduce((sum, p) => sum + (p.shares || 1), 0)
        updatedParticipants = parts.map(p => ({
          ...p,
          owedAmount: parseFloat(((totalAmount * (p.shares || 1)) / totalShares).toFixed(2))
        }))
        break

      case 'adjustment':
        const baseShare = totalAmount / parts.length
        updatedParticipants = parts.map(p => ({
          ...p,
          owedAmount: parseFloat((baseShare + (p.adjustment || 0)).toFixed(2))
        }))
        break

      // For 'exact', amounts are manually set
      case 'exact':
      default:
        break
    }

    setParticipants(updatedParticipants)
    return updatedParticipants
  }

  const handleAmountChange = (value: string) => {
    setAmount(value)
    if (!multiplePayers && currentUser) {
      const updated = participants.map(p =>
        p.id === currentUser.id
          ? { ...p, paidAmount: parseFloat(value) || 0 }
          : p
      )
      calculateSplit(updated)
    } else {
      calculateSplit()
    }
  }

  const handlePaidAmountChange = (participantId: number, value: string) => {
    const updated = participants.map(p =>
      p.id === participantId
        ? { ...p, paidAmount: parseFloat(value) || 0 }
        : p
    )
    setParticipants(updated)
  }

  const handleOwedAmountChange = (participantId: number, value: string) => {
    const updated = participants.map(p =>
      p.id === participantId
        ? { ...p, owedAmount: parseFloat(value) || 0 }
        : p
    )
    setParticipants(updated)
  }

  const handleSharesChange = (participantId: number, value: string) => {
    const updated = participants.map(p =>
      p.id === participantId
        ? { ...p, shares: parseInt(value) || 1 }
        : p
    )
    calculateSplit(updated)
  }

  const handlePercentageChange = (participantId: number, value: string) => {
    const updated = participants.map(p =>
      p.id === participantId
        ? { ...p, percentage: parseFloat(value) || 0 }
        : p
    )
    calculateSplit(updated)
  }

  const handleAdjustmentChange = (participantId: number, value: string) => {
    const updated = participants.map(p =>
      p.id === participantId
        ? { ...p, adjustment: parseFloat(value) || 0 }
        : p
    )
    calculateSplit(updated)
  }

  const handleSubmit = async () => {
    if (!amount || !description || participants.length === 0) {
      alert('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)

      const payload: CreateExpensePayload = {
        cost: amount,
        description,
        details: notes || undefined,
        date: date.toISOString(),
        currency_code: currency,
        category_id: selectedCategoryId || undefined,
        group_id: splitContext === 'group' ? selectedGroupId || undefined : undefined,
        repeat_interval: isRecurring ? repeatInterval : 'never',
        users: participants.map(p => ({
          user_id: p.id,
          paid_share: p.paidAmount.toFixed(2),
          owed_share: p.owedAmount.toFixed(2)
        }))
      }

      const result = await splitwiseClient.createExpense(payload)

      if (result.errors && Object.keys(result.errors).length > 0) {
        console.error('Expense creation errors:', result.errors)
        alert('Failed to create expense. Please check your inputs.')
      } else {
        alert('Expense created successfully!')
        // Reset form
        resetForm()
      }
    } catch (error) {
      console.error('Failed to create expense:', error)
      alert('Failed to create expense')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setAmount('')
    setDescription('')
    setNotes('')
    setDate(new Date())
    setMultiplePayers(false)
    setSplitMethod('equally')
    setIsRecurring(false)
    updateParticipants()
  }

  const getTotalPaid = () => participants.reduce((sum, p) => sum + p.paidAmount, 0)
  const getTotalOwed = () => participants.reduce((sum, p) => sum + p.owedAmount, 0)

  if (loading && !currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add Splitwise Expense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <div className="flex gap-2">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-72">
                      {currencies.map(curr => (
                        <SelectItem key={curr.currency_code} value={curr.currency_code}>
                          {curr.currency_code}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d || new Date())
                      setDatePickerOpen(false)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              placeholder="e.g., Dinner at restaurant"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={selectedCategoryId?.toString() || ''}
              onValueChange={(value) => setSelectedCategoryId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="h-72">
                  {categories.map(cat => (
                    <React.Fragment key={cat.id}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        {cat.name}
                      </div>
                      {cat.subcategories?.map(sub => (
                        <SelectItem key={sub.id} value={sub.id.toString()}>
                          <span className="ml-4">{sub.name}</span>
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Split Context */}
          <div className="space-y-2">
            <Label>Split with</Label>
            <Tabs value={splitContext} onValueChange={(v) => setSplitContext(v as 'group' | 'friend')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="group">Group</TabsTrigger>
                <TabsTrigger value="friend">Friend</TabsTrigger>
              </TabsList>
              
              <TabsContent value="group" className="space-y-2">
                <Select
                  value={selectedGroupId?.toString() || ''}
                  onValueChange={(value) => setSelectedGroupId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name} ({group.members.length} members)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
              
              <TabsContent value="friend" className="space-y-2">
                <Select
                  value={selectedFriendId?.toString() || ''}
                  onValueChange={(value) => setSelectedFriendId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select friend" />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-72">
                      {friends.map(friend => (
                        <SelectItem key={friend.id} value={friend.id.toString()}>
                          {friend.first_name} {friend.last_name}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>
          </div>

          <Separator />

          {/* Paid By Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Paid by</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="multiple-payers" className="text-sm font-normal">
                  Multiple people
                </Label>
                <Switch
                  id="multiple-payers"
                  checked={multiplePayers}
                  onCheckedChange={(checked) => {
                    setMultiplePayers(checked)
                    if (!checked && currentUser) {
                      const updated = participants.map(p => ({
                        ...p,
                        paidAmount: p.id === currentUser.id ? parseFloat(amount) || 0 : 0
                      }))
                      setParticipants(updated)
                    }
                  }}
                />
              </div>
            </div>

            {multiplePayers ? (
              <div className="space-y-3">
                {participants.map(participant => (
                  <div key={participant.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={participant.picture} />
                      <AvatarFallback>
                        {participant.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm">{participant.name}</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={participant.paidAmount || ''}
                      onChange={(e) => handlePaidAmountChange(participant.id, e.target.value)}
                      className="w-32"
                    />
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-medium">Total Paid:</span>
                  <span className="text-sm font-medium">
                    {currency} {getTotalPaid().toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                {currentUser && (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.picture?.medium} />
                      <AvatarFallback>
                        {currentUser.first_name[0]}{currentUser.last_name && currentUser.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm">
                      {currentUser.first_name} {currentUser.last_name}
                    </span>
                    <Badge variant="secondary">Payer</Badge>
                  </>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Split Method */}
          <div className="space-y-4">
            <Label className="text-base">Split method</Label>
            
            <Tabs value={splitMethod} onValueChange={(v) => {
              setSplitMethod(v as SplitMethod)
              setTimeout(() => calculateSplit(), 0)
            }}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="equally">
                  <Users className="h-4 w-4 mr-1" />
                  Equally
                </TabsTrigger>
                <TabsTrigger value="exact">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Exact
                </TabsTrigger>
                <TabsTrigger value="percentage">
                  <Percent className="h-4 w-4 mr-1" />
                  %
                </TabsTrigger>
                <TabsTrigger value="shares">
                  <Hash className="h-4 w-4 mr-1" />
                  Shares
                </TabsTrigger>
                <TabsTrigger value="adjustment">
                  <Plus className="h-4 w-4 mr-1" />
                  Adjust
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 space-y-3">
                {splitMethod === 'equally' && (
                  <div className="space-y-3">
                    {participants.map(participant => (
                      <div key={participant.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={participant.picture} />
                          <AvatarFallback>
                            {participant.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm">{participant.name}</span>
                        <span className="text-sm font-medium">
                          {currency} {participant.owedAmount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {splitMethod === 'exact' && (
                  <div className="space-y-3">
                    {participants.map(participant => (
                      <div key={participant.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={participant.picture} />
                          <AvatarFallback>
                            {participant.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm">{participant.name}</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={participant.owedAmount || ''}
                          onChange={(e) => handleOwedAmountChange(participant.id, e.target.value)}
                          className="w-32"
                        />
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-medium">Total Split:</span>
                      <span className={cn(
                        "text-sm font-medium",
                        Math.abs(getTotalOwed() - parseFloat(amount || '0')) > 0.01 && "text-destructive"
                      )}>
                        {currency} {getTotalOwed().toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {splitMethod === 'percentage' && (
                  <div className="space-y-3">
                    {participants.map(participant => (
                      <div key={participant.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={participant.picture} />
                          <AvatarFallback>
                            {participant.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm">{participant.name}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={participant.percentage || ''}
                            onChange={(e) => handlePercentageChange(participant.id, e.target.value)}
                            className="w-20"
                          />
                          <span className="text-sm">%</span>
                          <span className="text-sm font-medium w-20 text-right">
                            {currency} {participant.owedAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-medium">Total:</span>
                      <span className={cn(
                        "text-sm font-medium",
                        Math.abs(participants.reduce((sum, p) => sum + (p.percentage || 0), 0) - 100) > 0.1 && "text-destructive"
                      )}>
                        {participants.reduce((sum, p) => sum + (p.percentage || 0), 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}

                {splitMethod === 'shares' && (
                  <div className="space-y-3">
                    {participants.map(participant => (
                      <div key={participant.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={participant.picture} />
                          <AvatarFallback>
                            {participant.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm">{participant.name}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="1"
                            value={participant.shares || ''}
                            onChange={(e) => handleSharesChange(participant.id, e.target.value)}
                            className="w-20"
                          />
                          <span className="text-sm">shares</span>
                          <span className="text-sm font-medium w-20 text-right">
                            {currency} {participant.owedAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {splitMethod === 'adjustment' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Start with equal split, then adjust individual amounts
                    </p>
                    {participants.map(participant => (
                      <div key={participant.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={participant.picture} />
                          <AvatarFallback>
                            {participant.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm">{participant.name}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={participant.adjustment || ''}
                            onChange={(e) => handleAdjustmentChange(participant.id, e.target.value)}
                            className="w-24"
                          />
                          <span className="text-sm font-medium w-20 text-right">
                            = {currency} {participant.owedAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tabs>
          </div>

          <Separator />

          {/* Recurring */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="recurring" className="text-base">
                Recurring expense
              </Label>
              <Switch
                id="recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>

            {isRecurring && (
              <Select value={repeatInterval} onValueChange={(v: any) => setRepeatInterval(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={loading || !amount || !description}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Save Expense'}
            </Button>
            <Button
              variant="outline"
              onClick={resetForm}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
