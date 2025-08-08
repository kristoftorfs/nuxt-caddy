import { z } from 'zod'

export const projectSchema = z.strictObject({
  hostnames: z.array(
    z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i, 'Hostnames can only contain letters, numbers and hyphens'),
  ).min(1, 'At least one hostname must be provided'),
}).readonly()

export type ProjectConfiguration = z.infer<typeof projectSchema>
