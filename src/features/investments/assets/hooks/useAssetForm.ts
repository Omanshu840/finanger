import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { nanoid } from 'nanoid'
import { assetFormSchema, type AssetFormValues } from '../assetSchema'
import { useAssetActions } from '@/store/selectors'
import type { Asset } from '@/features/investments/types/asset.types'

interface UseAssetFormOptions {
  /** Pass an existing asset to pre-populate (edit mode) */
  existing?: Asset
  onSuccess?: () => void
}

export function useAssetForm({ existing, onSuccess }: UseAssetFormOptions = {}) {
  const { addAsset, updateAsset } = useAssetActions()
  const isEditing = Boolean(existing)

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    mode: 'onTouched',     // validate on blur; show errors only after field touched
    defaultValues: {
      name:       existing?.name       ?? '',
      type:       existing?.type       ?? '',
      symbol:     existing?.symbol     ?? '',
      schemeCode: existing?.schemeCode ?? '',
      quantity:   existing?.quantity   != null ? String(existing.quantity) : '',
      value:      existing?.value      != null ? String(existing.value)    : '',
      buyPrice:   existing?.buyPrice   != null ? String(existing.buyPrice) : '',
    },
  })

  // Watch type to drive conditional field visibility in the UI
  const watchedType = form.watch('type')

  function onSubmit(data: AssetFormValues) {
    const now = Date.now()

    if (isEditing && existing) {
      updateAsset(existing.id, {
        name:       data.name,
        type:       data.type as Asset['type'],
        symbol:     data.symbol     || undefined,
        schemeCode: data.schemeCode || undefined,
        quantity:   data.quantity   ? parseFloat(data.quantity) : undefined,
        value:      data.value      ? parseFloat(data.value)    : undefined,
        buyPrice:   data.buyPrice   ? parseFloat(data.buyPrice) : undefined,
        lastUpdated: now,
      })
    } else {
      addAsset({
        id:          nanoid(),
        name:        data.name,
        type:        data.type as Asset['type'],
        symbol:      data.symbol     || undefined,
        isin:        '',  // ISIN can be added later via import or manual edit
        schemeCode:  data.schemeCode || undefined,
        quantity:    data.quantity   ? parseFloat(data.quantity) : undefined,
        value:       data.value      ? parseFloat(data.value)    : undefined,
        buyPrice:    data.buyPrice   ? parseFloat(data.buyPrice) : undefined,
        lastUpdated: now,
      })
    }

    onSuccess?.()
  }

  // Clear type-specific fields when type changes
  function handleTypeChange(newType: string) {
    form.setValue('type', newType, { shouldValidate: true })
    form.resetField('symbol')
    form.resetField('schemeCode')
    form.resetField('quantity')
    form.resetField('value')
    form.resetField('buyPrice')
  }

  return { form, watchedType, isEditing, onSubmit: form.handleSubmit(onSubmit), handleTypeChange }
}