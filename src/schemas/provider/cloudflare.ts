// Cloudflare provider schema
import { baseProviderSchema } from './base-provider'
import { z } from 'zod'

export const cloudflareProviderSchema = baseProviderSchema.extend({
  name: z.literal('cloudflare'),
  api_token: z.string().min(1, 'Cloudflare token is required').default('{env.CLOUDFLARE_API_KEY}'),
})

export type CloudflareProvider = z.infer<typeof cloudflareProviderSchema>
