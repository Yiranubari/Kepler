import { z } from 'zod';

export const IdentifierString = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
    message: 'Identifier must not contain control characters'
  });
