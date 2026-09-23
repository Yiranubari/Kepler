import 'dotenv/config';
import { z } from 'zod';
import { ConfigurationError } from '@kepler/shared';

const positiveInt = z.string().transform((v, ctx) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a positive integer' });
    return z.NEVER;
  }
  return n;
});

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  ESPLORA_URL: z.string().url(),
  ESPLORA_FALLBACK_URL: z.string().url(),
  RELAYS: z.string().min(1),
  CASHU_MINT: z.string().url(),
  CASHU_MINT_FALLBACK: z.string().url(),
  RATE_LIMIT_READ_PER_MINUTE: positiveInt,
  RATE_LIMIT_PROPOSE_PER_MINUTE: positiveInt,
  RATE_LIMIT_SEND_PER_HOUR: positiveInt,
  RATE_LIMIT_PUBLISH_PER_HOUR: positiveInt
});

function loadEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigurationError('Environment configuration is invalid', { issues });
  }
  return result.data;
}

export const env = loadEnv();

export type Env = typeof env;
