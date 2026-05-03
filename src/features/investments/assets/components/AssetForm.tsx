import { Controller } from 'react-hook-form'
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
  FieldGroup,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ASSET_TYPE_CONFIG, ASSET_TYPE_ORDER } from '../assetConfig'
import { useAssetForm } from '../hooks/useAssetForm'
import type { Asset } from '@/features/investments/types/asset.types'

interface AssetFormProps {
  existing?: Asset
  onSuccess?: () => void
}

const TYPE_FIELDS: Record<
  string,
  { symbol?: boolean; schemeCode?: boolean; quantity?: boolean; value?: boolean; buyPrice?: boolean }
> = {
  stock: { symbol: true,      quantity: true,  value: true,  buyPrice: true },
  mf:    { schemeCode: true,  quantity: true,  value: true,  buyPrice: true },
  bank:  { value: true  },
  fd:    { value: true  },
  esop:  { quantity: true,    value: true  },
  cash:  { value: true  },
}

const QUANTITY_LABEL: Record<string, string> = {
  stock: 'Quantity (shares)',
  mf:    'Units',
  esop:  'Options',
}

export function AssetForm({ existing, onSuccess }: AssetFormProps) {
  const { form, watchedType, isEditing, onSubmit, handleTypeChange } =
    useAssetForm({ existing, onSuccess })

  const { control, formState: { errors, isSubmitting } } = form
  const fields = TYPE_FIELDS[watchedType] ?? {}

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>

      {/* ── Name ──────────────────────────────────────────────────────── */}
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Field data-invalid={!!errors.name}>
            <FieldLabel>
              Name <Required />
            </FieldLabel>
            <Input
              placeholder="e.g. Infosys Ltd"
              autoComplete="off"
              aria-invalid={!!errors.name}
              {...field}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>
        )}
      />

      {/* ── Type ──────────────────────────────────────────────────────── */}
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <Field data-invalid={!!errors.type}>
            <FieldLabel>
              Type <Required />
            </FieldLabel>
            <Select value={field.value} onValueChange={handleTypeChange}>
              <SelectTrigger aria-invalid={!!errors.type}>
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPE_ORDER.map((type) => {
                  const config = ASSET_TYPE_CONFIG[type]
                  const Icon = config.icon
                  return (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 ${config.textColor}`}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        {config.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <FieldError>{errors.type?.message}</FieldError>
          </Field>
        )}
      />

      {/* ── Type-specific fields ───────────────────────────────────────── */}
      {watchedType && (
        <>
          <Separator className="opacity-50" />

          <FieldGroup className="flex flex-col gap-5">

            {/* Symbol — stocks only */}
            {fields.symbol && (
              <Controller
                control={control}
                name="symbol"
                render={({ field }) => (
                  <Field data-invalid={!!errors.symbol}>
                    <FieldLabel>
                      Ticker Symbol <Required />
                    </FieldLabel>
                    <Input
                      placeholder="e.g. INFY.NS"
                      autoCapitalize="characters"
                      autoComplete="off"
                      aria-invalid={!!errors.symbol}
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                    />
                    <FieldDescription>
                      NSE format — append .NS (e.g. RELIANCE.NS)
                    </FieldDescription>
                    <FieldError>{errors.symbol?.message}</FieldError>
                  </Field>
                )}
              />
            )}

            {/* Scheme Code — mutual funds only */}
            {fields.schemeCode && (
              <Controller
                control={control}
                name="schemeCode"
                render={({ field }) => (
                  <Field data-invalid={!!errors.schemeCode}>
                    <FieldLabel>
                      AMFI Scheme Code <Required />
                    </FieldLabel>
                    <Input
                      placeholder="e.g. 122639"
                      inputMode="numeric"
                      autoComplete="off"
                      aria-invalid={!!errors.schemeCode}
                      {...field}
                    />
                    <FieldDescription>
                      Find your code at amfiindia.com
                    </FieldDescription>
                    <FieldError>{errors.schemeCode?.message}</FieldError>
                  </Field>
                )}
              />
            )}

            {/* Quantity / Units */}
            {fields.quantity && (
              <Controller
                control={control}
                name="quantity"
                render={({ field }) => (
                  <Field data-invalid={!!errors.quantity}>
                    <FieldLabel>
                      {QUANTITY_LABEL[watchedType] ?? 'Quantity'}
                      {watchedType !== 'esop' && <Required />}
                    </FieldLabel>
                    <Input
                      placeholder="e.g. 25"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={!!errors.quantity}
                      {...field}
                    />
                    <FieldError>{errors.quantity?.message}</FieldError>
                  </Field>
                )}
              />
            )}

            {/* Value */}
            {fields.value && (
              <Controller
                control={control}
                name="value"
                render={({ field }) => (
                  <Field data-invalid={!!errors.value}>
                    <FieldLabel>
                      Value (₹)
                      {['bank', 'fd', 'cash'].includes(watchedType) && <Required />}
                    </FieldLabel>
                    <Input
                      placeholder="e.g. 50000"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={!!errors.value}
                      {...field}
                    />
                    {['stock', 'mf'].includes(watchedType) && (
                      <FieldDescription>
                        Optional — auto-calculated after price refresh
                      </FieldDescription>
                    )}
                    <FieldError>{errors.value?.message}</FieldError>
                  </Field>
                )}
              />
            )}

            {/* Buy Price — stocks & MFs only */}
            {fields.buyPrice && (
              <Controller
                control={control}
                name="buyPrice"
                render={({ field }) => (
                  <Field data-invalid={!!errors.buyPrice}>
                    <FieldLabel>
                      Buy Price per Unit (₹)
                    </FieldLabel>
                    <Input
                      placeholder={`e.g. ${watchedType === 'stock' ? '1500' : '100.50'}`}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={!!errors.buyPrice}
                      {...field}
                    />
                    <FieldDescription>
                      Cost per {watchedType === 'stock' ? 'share' : 'unit'} — used to calculate Profit/Loss
                    </FieldDescription>
                    <FieldError>{errors.buyPrice?.message}</FieldError>
                  </Field>
                )}
              />
            )}

          </FieldGroup>
        </>
      )}

      {/* ── Submit ────────────────────────────────────────────────────── */}
      <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Asset'}
      </Button>

    </form>
  )
}

function Required() {
  return (
    <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
  )
}