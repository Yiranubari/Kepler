import { Prisma } from '@prisma/client';
import { InternalError } from '@kepler/shared';

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value, (_key, val) =>
    typeof val === 'bigint' ? val.toString() : val
  );
  const parsed: unknown = JSON.parse(serialized);
  return parsed as Prisma.InputJsonValue;
}

export function fromPrismaJson<T>(
  value: unknown,
  validator: (v: unknown) => v is T
): T {
  if (!validator(value)) {
    throw new InternalError('Stored JSON does not match expected shape', {
      reason: 'INVALID_STORED_SHAPE'
    });
  }
  return value;
}

export function isPrismaErrorWithCode(err: unknown): err is { code: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>)['code'] === 'string'
  );
}
