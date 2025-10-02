import { z } from 'zod'

export const profileSchema = z.object({
  base_currency: z.string().length(3, 'Currency code must be 3 characters'),
  timezone: z.string().min(1, 'Timezone is required'),
  locale: z.string().min(1, 'Locale is required'),
  first_day_of_week: z.number().min(0).max(6),
  first_day_of_month: z.number().min(1).max(28),
  number_format: z.string().min(1, 'Number format is required')
})

export type ProfileInput = z.infer<typeof profileSchema>
