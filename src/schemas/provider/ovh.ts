import { z } from 'zod'
import { baseProviderSchema } from './base-provider'

export const ovhProviderSchema = baseProviderSchema.extend({
  name: z.literal('ovh'),
  endpoint: z.string().url('OVH endpoint must be a valid URL'),
  applicationKey: z.string().min(1, 'OVH application key is required'),
  applicationSecret: z.string().min(1, 'OVH application secret is required'),
  consumerKey: z.string().min(1, 'OVH consumer key is required'),
})

export type OvhProvider = z.infer<typeof ovhProviderSchema>
