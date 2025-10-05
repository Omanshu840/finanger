import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Users, User, X, ChevronRight } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  splitwiseClient,
  type SplitwiseGroup,
  type SplitwiseFriend,
} from '@/lib/splitwiseApi'
import { Button } from '@/components/ui/button'

interface SplitwiseFriendGroupSelectorProps {
  onSelect: (type: 'friend' | 'group', data: SplitwiseFriend | SplitwiseGroup) => void
  onClose: () => void
}

export function SplitwiseFriendGroupSelector({
  onSelect,
  onClose,
}: SplitwiseFriendGroupSelectorProps) {
  const [groups, setGroups] = useState<SplitwiseGroup[]>([])
  const [friends, setFriends] = useState<SplitwiseFriend[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends')
  const [viewAll, setViewAll] = useState(false);

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [groupsData, friendsData] = await Promise.all([
        splitwiseClient.getGroups(),
        splitwiseClient.getFriends(),
      ])
      setGroups(groupsData)
      setFriends(friendsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName ? lastName[0] : ''}`.toUpperCase()
  }

  const getBalance = (entity: SplitwiseFriend | SplitwiseGroup) => {
    if ('balance' in entity && entity.balance && entity.balance.length > 0) {
      const balance = entity.balance[0]
      const amount = parseFloat(balance.amount)
      if (amount === 0) return null
      return {
        amount: Math.abs(amount),
        currency: balance.currency_code,
        type: amount > 0 ? 'owed' : 'owes',
      }
    }
    return null
  }

  const isWithinLast7Days = (dateString: string): boolean => {
    const inputDate = new Date(dateString);
    const now = new Date();

    // Difference in milliseconds
    const diffMs = now.getTime() - inputDate.getTime();

    // 7 days in milliseconds
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return diffMs <= sevenDaysMs && diffMs >= 0;
  }

  const filteredFriends = friends.filter(
    (friend) =>
      friend.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (friend.last_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Add Expense</h2>
          {/* <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button> */}
        </div>
        <p className="text-sm text-muted-foreground">
          Select a friend or group to split an expense
        </p>
      </div>

      {/* Search */}
      <div className="px-6 py-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search friends or groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <div className="px-6 pt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="friends" className="gap-2">
              <User className="h-4 w-4" />
              Friends ({filteredFriends.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Users className="h-4 w-4" />
              Groups ({filteredGroups.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="friends" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="px-6 py-4 space-y-2">
              {filteredFriends.length === 0 ? (
                <div className="text-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'No friends found' : 'No friends yet'}
                  </p>
                </div>
              ) : (
                <>
                {filteredFriends.map((friend) => {
                  const balance = getBalance(friend)
                  if (!viewAll && (!(balance || isWithinLast7Days(friend.updated_at)))) return <></>;
                  return (
                    <Card
                      key={friend.id}
                      className="cursor-pointer hover:shadow-md transition-all py-0"
                      onClick={() => onSelect('friend', friend)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.picture?.medium} />
                          <AvatarFallback>
                            {getInitials(friend.first_name, friend.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="truncate">
                            {friend.first_name} {friend.last_name}
                          </p>
                          {balance && (
                            <p className={`text-sm ${balance.type === 'owed' ? 'text-green-600' : 'text-orange-600'}`}>
                              {balance.type === 'owed' ? 'owes you' : 'you owe'}{' '}
                              ₹{balance.amount.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  )
                })}

                {!viewAll &&
                  <div className='text-center mt-6 space-y-2'>
                    <p className='text-sm text-muted-foreground'>Hiding friends that were updated over 7 days ago.</p>
                    <Button variant="outline" className="justify-center" onClick={() => setViewAll(true)}>Show all friends</Button>
                  </div>
                }
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="groups" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="px-6 py-4 space-y-2">
              {filteredGroups.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'No groups found' : 'No groups yet'}
                  </p>
                </div>
              ) : (
                <>
                  {filteredGroups.map((group) => {
                    if (!viewAll && !isWithinLast7Days(group.updated_at)) return <></>;
                    return (
                      <Card
                        key={group.id}
                        className="cursor-pointer hover:shadow-md transition-all py-0"
                        onClick={() => onSelect('group', group)}
                      >
                        <CardContent className="flex items-center gap-4 p-4">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={group.avatar?.medium} />
                          </Avatar>
                          <div className="flex-1 min-w-0 flex-wrap">
                            <p className="truncate whitespace-normal break-words">{group.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {group.members.length} members
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </CardContent>
                      </Card>
                  )})}
                  {!viewAll &&
                    <div className='text-center mt-6 space-y-2'>
                      <p className='text-sm text-muted-foreground'>Hiding groups that were updated over 7 days ago.</p>
                      <Button variant="outline" className="justify-center" onClick={() => setViewAll(true)}>Show all groups</Button>
                    </div>
                  }
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
