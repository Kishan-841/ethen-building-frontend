import { z } from 'zod'

const optionalPositiveInt = z
  .union([z.literal(''), z.coerce.number().int().positive()])
  .transform((v) => (v === '' ? undefined : v))
  .optional()

const optionalNonNegative = z
  .union([z.literal(''), z.coerce.number().nonnegative()])
  .transform((v) => (v === '' ? undefined : v))
  .optional()

export const buildingDetailsSchema = z.object({
  zoneId: z.string().min(1, 'Select a zone'),
  wings: optionalPositiveInt,
  floors: optionalPositiveInt,
  homePass: optionalNonNegative,
  buildingType: z.string().optional(),
  remarks: z.string().max(1000).optional(),
  amountPaid: optionalNonNegative,
})
