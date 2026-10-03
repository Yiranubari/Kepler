import { Prisma } from '@prisma/client';

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);
  const parsed: unknown = JSON.parse(serialized);
  return parsed as Prisma.InputJsonValue;
}

export function isPrismaErrorWithCode(err: unknown): err is { code: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>)['code'] === 'string'
  );
}
