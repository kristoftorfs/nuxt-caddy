import { z } from 'zod'
import { cloudflareProviderSchema } from './provider/cloudflare'
import { ovhProviderSchema } from './provider/ovh'

export const providerSchema = z.discriminatedUnion('name', [
  cloudflareProviderSchema.strict(),
  ovhProviderSchema.strict(),
])

export type Provider = z.infer<typeof providerSchema>
