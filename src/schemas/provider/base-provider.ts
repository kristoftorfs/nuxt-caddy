import { z } from 'zod'

export const baseProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required'),
})
