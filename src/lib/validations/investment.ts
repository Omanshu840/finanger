import { z } from 'zod'

export const transactionTypes = ['buy', 'sell', 'dividend', 'fee', 'interest', 'split'] as const
export type TransactionType = typeof transactionTypes[number]

export const transactionSchema = z.object({
  type: z.enum(transactionTypes),
  asset_id: z.string().uuid('Please select an asset').optional(),
  portfolio_account_id: z.string().uuid('Please select an account'),
  trade_date: z.date({
    required_error: 'Trade date is required'
  }),
  settle_date: z.date().optional().nullable(),
  quantity: z.number().positive('Quantity must be positive').optional().nullable(),
  price: z.number().positive('Price must be positive').optional().nullable(),
  amount: z.number().optional().nullable(),
  fee: z.number().min(0, 'Fee cannot be negative').default(0),
  currency: z.string().length(3, 'Currency must be 3 characters').default('INR'),
  notes: z.string().optional()
}).refine(data => {
  // Buy/sell require asset, quantity, and price
  if (data.type === 'buy' || data.type === 'sell' || data.type === 'split') {
    return data.asset_id && data.quantity && data.price
  }
  // Dividend/interest/fee can have amount instead
  return true
}, {
  message: 'Buy/Sell/Split transactions require asset, quantity, and price'
})

export type TransactionFormInput = z.infer<typeof transactionSchema>
