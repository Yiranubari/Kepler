import { getDecodedToken, getEncodedTokenV4 } from '@cashu/cashu-ts';
import { CashuParseError, CashuTokenError } from './errors';
import {
  CashuToken,
  CashuProof,
  CashuWireTokenSchema,
  CashuTokenSchema
} from './types';

export class CashuTokenCodec {
  public static toTokenReference(token: string): string {
    const trimmed = token.trim();
    if (trimmed.length <= 16) {
      return `tokenId: ${trimmed}`;
    }
    return `tokenId: ${trimmed.slice(0, 8)}…${trimmed.slice(-8)}`;
  }

  public static encode(token: CashuToken): string {
    const parseResult = CashuTokenSchema.safeParse(token);
    if (!parseResult.success) {
      throw new CashuTokenError(`Invalid CashuToken for encoding: ${parseResult.error.message}`, {
        reason: parseResult.error.message
      });
    }

    if (token.proofs.length === 0) {
      throw new CashuTokenError('Cannot encode token with empty proofs', {
        reason: 'Proofs array is empty'
      });
    }

    const proofs = token.proofs.map((proof: CashuProof) => {
      if (proof.amount <= 0n) {
        throw new CashuTokenError('Proof amount must be positive', {
          reason: 'Amount must be greater than zero'
        });
      }
      if (proof.amount > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new CashuTokenError('Proof amount exceeds maximum safe integer', {
          reason: 'Amount exceeds Number.MAX_SAFE_INTEGER'
        });
      }
      const sdkProof: {
        id: string;
        amount: number;
        secret: string;
        C: string;
        witness?: string;
      } = {
        id: proof.id,
        amount: Number(proof.amount),
        secret: proof.secret,
        C: proof.C
      };
      if (proof.witness !== null && proof.witness !== undefined) {
        sdkProof.witness = proof.witness;
      }
      return sdkProof;
    });

    const sdkToken: {
      mint: string;
      unit: string;
      proofs: Array<{
        id: string;
        amount: number;
        secret: string;
        C: string;
        witness?: string;
      }>;
      memo?: string;
    } = {
      mint: token.mint,
      unit: token.unit,
      proofs
    };

    if (token.memo !== null && token.memo !== undefined && token.memo.trim() !== '') {
      sdkToken.memo = token.memo;
    }

    try {
      return getEncodedTokenV4(sdkToken);
    } catch (err: unknown) {
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuTokenError(`Failed to encode Cashu token: ${cause.message}`, {
        reason: cause.message
      }, cause);
    }
  }

  public static decode(encoded: string): CashuToken {
    if (typeof encoded !== 'string' || encoded.trim() === '') {
      throw new CashuParseError('Token must be a non-empty string', {
        input: encoded,
        reason: 'Empty or non-string token input'
      });
    }

    let cleaned = encoded.trim();
    if (cleaned.toLowerCase().startsWith('cashu://')) {
      cleaned = cleaned.slice(8);
    } else if (cleaned.toLowerCase().startsWith('cashu:')) {
      cleaned = cleaned.slice(6);
    }

    if (!cleaned.startsWith('cashuA') && !cleaned.startsWith('cashuB')) {
      throw new CashuParseError('Unsupported token prefix: must start with cashuA or cashuB', {
        input: encoded,
        reason: 'Invalid token prefix'
      });
    }

    let rawDecoded: unknown;
    try {
      rawDecoded = getDecodedToken(cleaned);
    } catch (err: unknown) {
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuParseError(`Failed to decode Cashu token: ${cause.message}`, {
        input: encoded,
        reason: cause.message
      }, cause);
    }

    const wireResult = CashuWireTokenSchema.safeParse(rawDecoded);
    if (!wireResult.success) {
      throw new CashuParseError(`Decoded token does not match expected structure: ${wireResult.error.message}`, {
        input: encoded,
        reason: wireResult.error.message
      });
    }

    const wire = wireResult.data;
    const keplerToken: CashuToken = {
      mint: wire.mint,
      unit: wire.unit ?? 'sat',
      proofs: wire.proofs.map((p) => ({
        id: p.id,
        amount: BigInt(p.amount),
        secret: p.secret,
        C: p.C,
        witness: p.witness ?? null
      })),
      memo: wire.memo ?? null
    };

    const validatedResult = CashuTokenSchema.safeParse(keplerToken);
    if (!validatedResult.success) {
      throw new CashuParseError(`Constructed CashuToken failed validation: ${validatedResult.error.message}`, {
        input: encoded,
        reason: validatedResult.error.message
      });
    }

    return validatedResult.data;
  }
}
