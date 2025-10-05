import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SplitwiseFriendGroupSelector } from './SplitwiseFriendGroupSelector'
import { SplitwiseExpenseForm } from './SplitwiseExpenseForm'
import type { SplitwiseGroup, SplitwiseFriend } from '@/lib/splitwiseApi'
import { toast } from 'sonner'

interface SplitwiseExpenseSheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SplitwiseExpenseSheet({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SplitwiseExpenseSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'friend' | 'group'
    data: SplitwiseFriend | SplitwiseGroup
  } | null>(null)

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen

  const handleEntitySelect = (type: 'friend' | 'group', data: SplitwiseFriend | SplitwiseGroup) => {
    setSelectedEntity({ type, data })
  }

  const handleBack = () => {
    setSelectedEntity(null)
  }

  const handleSuccess = () => {
    setSelectedEntity(null)
    setOpen(false)
    toast.success('Expense added successfully');
  }

  const handleClose = () => {
    setSelectedEntity(null)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl p-0 flex flex-col"
      >
        <ScrollArea className="h-full">
          {!selectedEntity ? (
            <SplitwiseFriendGroupSelector
              onSelect={handleEntitySelect}
              onClose={handleClose}
            />
          ) : (
            <SplitwiseExpenseForm
              entity={selectedEntity}
              onBack={handleBack}
              onSuccess={handleSuccess}
            />
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// Export floating button variant
export function SplitwiseFloatingAddButton() {
  return (
    <SplitwiseExpenseSheet
      trigger={
        <Button
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 sm:h-auto sm:w-auto sm:rounded-md sm:px-6"
        >
          <Plus className="h-6 w-6 sm:mr-2" />
          <span className="hidden sm:inline">Add Expense</span>
        </Button>
      }
    />
  )
}
