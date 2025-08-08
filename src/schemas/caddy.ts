import { z } from 'zod'
import { providerSchema } from './providers'

export const caddySchema = z.strictObject({
  provider: providerSchema,
  port: z.number()
    .int('Port must be an integer')
    .min(1, 'Port must be greater than 0')
    .max(65535, 'Port must be less than 65536')
    .default(2019),
  domain: z.string()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i, 'Invalid domain format'),
}).readonly()

export type CaddyConfiguration = z.infer<typeof caddySchema>
