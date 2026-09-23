import { ValidationError } from './exceptions/ValidationError';

export class CanonicalJson {
  public static stringify(value: unknown): string {
    return JSON.stringify(CanonicalJson.canonicalize(value));
  }

  private static canonicalize(value: unknown): unknown {
    if (value === null) {
      return null;
    }

    if (value === undefined) {
      throw new ValidationError('CanonicalJson does not support undefined values', { receivedType: 'undefined' });
    }

    if (typeof value === 'function') {
      throw new ValidationError('CanonicalJson does not support function values', { receivedType: 'function' });
    }

    if (typeof value === 'symbol') {
      throw new ValidationError('CanonicalJson does not support symbol values', { receivedType: 'symbol' });
    }

    if (typeof value === 'bigint') {
      throw new ValidationError('CanonicalJson does not support BigInt values', { receivedType: 'bigint' });
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => CanonicalJson.canonicalize(item));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const sortedKeys = Object.keys(obj).sort();
      const sorted: Record<string, unknown> = {};
      for (const key of sortedKeys) {
        const val = obj[key];
        if (val === undefined) {
          continue;
        }
        sorted[key] = CanonicalJson.canonicalize(val);
      }
      return sorted;
    }

    return value;
  }
}
