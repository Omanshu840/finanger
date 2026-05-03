import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { AssetForm } from './components/AssetForm'
import type { Asset } from '@/features/investments/types/asset.types'

// ── Add mode ────────────────────────────────────────────────────────────────
export function AddAssetDrawer() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* FAB trigger — positioned by AssetsPage */}
      <SheetTrigger asChild>
        <Button
          size="icon"
          aria-label="Add new asset"
          className={[
            'fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+16px)]',
            'right-4 z-40',
            'h-14 w-14 rounded-full shadow-lg',
            'active:scale-95 transition-transform duration-150',
          ].join(' ')}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-2xl px-4 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="mb-5 text-left">
          <SheetTitle>Add Asset</SheetTitle>
          <SheetDescription>
            Enter details for your new asset. Fields marked * are required.
          </SheetDescription>
        </SheetHeader>

        <AssetForm onSuccess={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}

// ── Edit mode — triggered from AssetCard onPress ─────────────────────────────
interface EditAssetDrawerProps {
  asset: Asset
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditAssetDrawer({ asset, open, onOpenChange }: EditAssetDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-2xl px-4 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="mb-5 text-left">
          <SheetTitle>Edit Asset</SheetTitle>
          <SheetDescription>
            Update {asset.name}
          </SheetDescription>
        </SheetHeader>

        <AssetForm
          existing={asset}
          onSuccess={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}