import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { splitwiseClient, type Category } from '@/lib/splitwiseApi'
import { Utensils, Car, Home, ShoppingBag, Heart, Lightbulb, MoreHorizontal } from 'lucide-react'

interface SplitwiseCategorySelectorProps {
  selectedCategory: number | null
  onCategoryChange: (categoryId: number | null) => void
}

const categoryIcons: Record<string, any> = {
  'Food and drink': Utensils,
  'Transportation': Car,
  'Home': Home,
  'Shopping': ShoppingBag,
  'Entertainment': Heart,
  'Utilities': Lightbulb,
  'Life': Heart,
}

export function SplitwiseCategorySelector({
  selectedCategory,
  onCategoryChange,
}: SplitwiseCategorySelectorProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await splitwiseClient.getCategories()
      setCategories(data)
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSelectedCategoryName = () => {
    if (!selectedCategory) return null
    for (const cat of categories) {
      if (cat.id === selectedCategory) return cat.name
      if (cat.subcategories) {
        const subcat = cat.subcategories.find(s => s.id === selectedCategory)
        if (subcat) return subcat.name
      }
    }
    return null
  }

  const getCategoryIcon = (categoryName: string) => {
    const Icon = categoryIcons[categoryName] || MoreHorizontal
    return Icon
  }

  const selectedName = getSelectedCategoryName()

  return (
    <div>
      <Button
        variant="outline"
        className="w-full justify-start h-full p-1"
        onClick={() => setShowDialog(true)}
      >
        {selectedName ? (
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              {(() => {
                const Icon = getCategoryIcon(selectedName)
                return <Icon className="h-10 w-10 text-primary" />
              })()}
            </div>
          </div>
        ) : (
          <></>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Category</DialogTitle>
            <DialogDescription>
              Choose a category for this expense
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {categories.map((category) => {
                const Icon = getCategoryIcon(category.name)
                return (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      {category.name}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {category.subcategories ? (
                        category.subcategories.map((subcat) => (
                          <Button
                            key={subcat.id}
                            variant={selectedCategory === subcat.id ? 'default' : 'outline'}
                            className="justify-start h-auto py-3"
                            onClick={() => {
                              onCategoryChange(subcat.id)
                              setShowDialog(false)
                            }}
                          >
                            <span className="text-sm">{subcat.name}</span>
                          </Button>
                        ))
                      ) : (
                        <Button
                          variant={selectedCategory === category.id ? 'default' : 'outline'}
                          className="justify-start h-auto py-3"
                          onClick={() => {
                            onCategoryChange(category.id)
                            setShowDialog(false)
                          }}
                        >
                          <span className="text-sm">{category.name}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
