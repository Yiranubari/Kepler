export class CanonicalJson {
  public static stringify(value: unknown): string {
    return JSON.stringify(CanonicalJson.canonicalize(value));
  }

  private static canonicalize(value: unknown): unknown {
    if (value === null) {
      return null;
    }

    if (value === undefined) {
      throw new Error('CanonicalJson does not support undefined values');
    }

    if (typeof value === 'function') {
      throw new Error('CanonicalJson does not support function values');
    }

    if (typeof value === 'symbol') {
      throw new Error('CanonicalJson does not support symbol values');
    }

    if (typeof value === 'bigint') {
      throw new Error('CanonicalJson does not support BigInt values');
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
