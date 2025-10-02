import { z } from 'zod'

export const expenseSchema = z.object({
  account_id: z.string(),
  category_id: z.string(),
  date: z.date(),
  currency: z.string(),
  amount: z.number(),
  merchant: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  receipt: z
    .union([z.instanceof(File), z.null()])
    .optional(),
})

export type ExpenseFormInput = z.infer<typeof expenseSchema>
