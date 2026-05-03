import { z } from 'zod'
import { ASSET_TYPE_ORDER } from './assetConfig'

// ─── Field-level schemas ────────────────────────────────────────────────────
const requiredString = (label: string) =>
  z.string().trim().min(1, `${label} is required`)

// ─── Base schema — all assets share these ───────────────────────────────────
export const assetFormSchema = z
  .object({
    name:       requiredString('Name'),
    type:       z.enum(ASSET_TYPE_ORDER as [string, ...string[]], 'Select an asset type'),
    symbol:     z.string().trim().optional(),
    schemeCode: z.string().trim().optional(),
    quantity:   z.string().trim().optional(),
    value:      z.string().trim().optional(),
    buyPrice:   z.string().trim().optional(),
  })
  // ── Conditional validation per type ──────────────────────────────────────
  .superRefine((data, ctx) => {
    const required = (field: keyof typeof data, label: string) => {
      if (!data[field] || String(data[field]).trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${label} is required for ${data.type}`,
        })
      }
    }

    const mustBePositive = (field: 'quantity' | 'value' | 'buyPrice', label: string) => {
      const n = parseFloat(data[field] ?? '')
      if (!isNaN(n) && n <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${label} must be greater than 0`,
        })
      }
    }

    switch (data.type) {
      case 'stock':
        required('symbol', 'Ticker symbol')
        required('quantity', 'Quantity')
        mustBePositive('quantity', 'Quantity')
        if (data.buyPrice) mustBePositive('buyPrice', 'Buy price')
        break
      case 'mf':
        required('schemeCode', 'Scheme code')
        required('quantity', 'Units')
        mustBePositive('quantity', 'Units')
        if (data.buyPrice) mustBePositive('buyPrice', 'Buy price')
        break
      case 'bank':
      case 'fd':
      case 'cash':
        required('value', 'Value')
        mustBePositive('value', 'Value')
        break
      case 'esop':
        // both optional — but if provided must be positive
        mustBePositive('quantity', 'Quantity')
        mustBePositive('value', 'Value')
        break
    }
  })

export type AssetFormValues = z.infer<typeof assetFormSchema>
