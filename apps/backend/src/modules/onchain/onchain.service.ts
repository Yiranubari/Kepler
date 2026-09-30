import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import * as btc from '@scure/btc-signer';
import { base64 } from '@scure/base';
import { KeplerLogger, ValidationError } from '@kepler/shared';
import type { BitcoinClient, Utxo } from '@kepler/bitcoin';
import type {
  DeriveRequest,
  DeriveResponse,
  UtxosRequest,
  UtxosResponse,
  FeesRequest,
  FeesResponse,
  PsbtBuildRequest,
  PsbtBuildResponse,
  PsbtBroadcastRequest,
  PsbtBroadcastResponse,
  OnchainUtxoItem
} from './onchain.types';
import {
  DeriveRequestSchema,
  UtxosRequestSchema,
  FeesRequestSchema,
  PsbtBuildRequestSchema,
  PsbtBroadcastRequestSchema
} from './onchain.validators';
import { XpubDeriver } from './xpub.deriver';
import { UtxoSelector } from './utxo.selector';
import { PsbtBuilder } from './psbt.builder';
import { OnchainBroadcastError } from './onchain.errors';

export class OnchainService {
  constructor(
    private readonly bitcoinClient: BitcoinClient,
    private readonly logger: KeplerLogger
  ) {}

  public async derive(request: DeriveRequest): Promise<DeriveResponse> {
    const validated = this.validate(DeriveRequestSchema, request);
    const startTime = performance.now();

    const addresses = XpubDeriver.deriveAddresses(
      validated.xpub,
      validated.network,
      validated.count,
      validated.change ?? false
    );
    const changeAddress = XpubDeriver.deriveChangeAddress(
      validated.xpub,
      validated.network
    );

    const durationMs = performance.now() - startTime;
    this.logger.debug('Derived addresses successfully', {
      network: validated.network,
      count: addresses.length,
      durationMs
    });

    return {
      addresses,
      changeAddress
    };
  }

  public async utxos(request: UtxosRequest): Promise<UtxosResponse> {
    const validated = this.validate(UtxosRequestSchema, request);
    const startTime = performance.now();

    const seen = new Set<string>();
    const utxos: OnchainUtxoItem[] = [];
    let totalSatsBigInt = 0n;

    for (const address of validated.addresses) {
      const addressUtxos = await this.bitcoinClient.getUtxos(address);
      for (const item of addressUtxos) {
        const key = `${item.txid}:${item.vout}`;
        if (!seen.has(key)) {
          seen.add(key);
          totalSatsBigInt += item.value;
          utxos.push({
            txid: item.txid,
            vout: item.vout,
            valueSats: item.value.toString(),
            address,
            confirmed: item.status.confirmed
          });
        }
      }
    }

    const durationMs = performance.now() - startTime;
    this.logger.debug('Fetched UTXOs successfully', {
      network: validated.network,
      addressCount: validated.addresses.length,
      utxoCount: utxos.length,
      totalSats: totalSatsBigInt.toString(),
      durationMs
    });

    return {
      utxos,
      totalSats: totalSatsBigInt.toString()
    };
  }

  public async fees(request: FeesRequest): Promise<FeesResponse> {
    const validated = this.validate(FeesRequestSchema, request);
    const startTime = performance.now();

    const recommended = await this.bitcoinClient.getRecommendedFees();
    const response: FeesResponse = {
      fastest: recommended.fastestFee,
      halfHour: recommended.halfHourFee,
      hour: recommended.hourFee,
      economy: recommended.economyFee,
      minimum: recommended.minimumFee
    };

    const durationMs = performance.now() - startTime;
    this.logger.debug('Fetched recommended fees successfully', {
      network: validated.network,
      fastest: response.fastest,
      economy: response.economy,
      durationMs
    });

    return response;
  }

  public async buildPsbt(request: PsbtBuildRequest): Promise<PsbtBuildResponse> {
    const validated = this.validate(PsbtBuildRequestSchema, request);
    const startTime = performance.now();

    const derivedChangeAddress = XpubDeriver.deriveChangeAddress(
      validated.xpub,
      validated.network
    );
    const changeAddress = validated.changeAddress || derivedChangeAddress;

    const receivingAddresses = XpubDeriver.deriveAddresses(
      validated.xpub,
      validated.network,
      20,
      false
    );

    const uniqueAddresses = Array.from(
      new Set([derivedChangeAddress, ...receivingAddresses])
    );

    const seenUtxos = new Set<string>();
    const availableUtxos: Array<Utxo & { address: string }> = [];

    for (const addr of uniqueAddresses) {
      const list = await this.bitcoinClient.getUtxos(addr);
      for (const item of list) {
        const key = `${item.txid}:${item.vout}`;
        if (!seenUtxos.has(key)) {
          seenUtxos.add(key);
          availableUtxos.push({
            ...item,
            address: addr
          });
        }
      }
    }

    const targetSats = BigInt(validated.amountSats);
    const selection = UtxoSelector.select(
      availableUtxos,
      targetSats,
      validated.feeRate,
      changeAddress
    );

    const psbt = PsbtBuilder.build({
      xpub: validated.xpub,
      network: validated.network,
      inputs: selection.inputs,
      totalInputSats: selection.totalInputSats,
      toAddress: validated.toAddress,
      amountSats: targetSats,
      feeSats: selection.feeSats,
      changeSats: selection.changeSats,
      changeAddress
    });

    const outputCount = selection.changeSats >= 294n ? 2 : 1;
    const response: PsbtBuildResponse = {
      psbt,
      feeSats: selection.feeSats.toString(),
      inputCount: selection.inputs.length,
      outputCount
    };

    const durationMs = performance.now() - startTime;
    this.logger.info('Built PSBT successfully', {
      network: validated.network,
      inputCount: response.inputCount,
      outputCount: response.outputCount,
      feeSats: response.feeSats,
      durationMs
    });

    return response;
  }

  public async broadcast(
    request: PsbtBroadcastRequest
  ): Promise<PsbtBroadcastResponse> {
    const validated = this.validate(PsbtBroadcastRequestSchema, request);
    const startTime = performance.now();

    let psbtBytes: Uint8Array;
    try {
      psbtBytes = base64.decode(validated.signedPsbt);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Invalid base64 encoding';
      throw new OnchainBroadcastError('Failed to decode base64 PSBT', {
        reason
      }, err instanceof Error ? err : undefined);
    }

    let rawHex: string;
    try {
      const tx = btc.Transaction.fromPSBT(psbtBytes);
      try {
        tx.finalize();
      } catch (finalizeErr: unknown) {
        throw new OnchainBroadcastError(
          'Transaction finalization failed due to missing signatures',
          {
            reason: 'MISSING_SIGNATURES'
          },
          finalizeErr instanceof Error ? finalizeErr : undefined
        );
      }

      if (!tx.isFinal) {
        throw new OnchainBroadcastError(
          'Transaction finalization failed due to missing signatures',
          {
            reason: 'MISSING_SIGNATURES'
          }
        );
      }

      rawHex = tx.hex;
    } catch (err: unknown) {
      if (err instanceof OnchainBroadcastError) {
        throw err;
      }
      const reason = err instanceof Error ? err.message : 'Invalid PSBT';
      throw new OnchainBroadcastError('Failed to parse or finalize PSBT', {
        reason
      }, err instanceof Error ? err : undefined);
    }

    try {
      const broadcastResult = await this.bitcoinClient.broadcastTransaction(rawHex);
      const durationMs = performance.now() - startTime;

      this.logger.info('Broadcast transaction successfully', {
        txid: broadcastResult.txid,
        network: validated.network,
        durationMs
      });

      return {
        txid: broadcastResult.txid
      };
    } catch (err: unknown) {
      if (err instanceof OnchainBroadcastError) {
        throw err;
      }
      const reason = err instanceof Error ? err.message : 'Broadcast transaction failed';
      throw new OnchainBroadcastError(`Broadcast failed: ${reason}`, {
        reason
      }, err instanceof Error ? err : undefined);
    }
  }

  private validate<T>(schema: z.ZodType<T>, input: unknown): T {
    this.assertNoPrivateKeys(input);
    const result = schema.safeParse(input);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue ? firstIssue.path.join('.') : 'request';
      const reason = firstIssue ? firstIssue.message : 'Invalid request payload';
      throw new ValidationError(reason, {
        field,
        reason,
        issues: result.error.issues
      });
    }
    return result.data;
  }

  private assertNoPrivateKeys(payload: unknown): void {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const entries = Object.entries(payload as Record<string, unknown>);
    for (const [key, value] of entries) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === 'privatekey' ||
        lowerKey === 'privkey' ||
        lowerKey === 'secretkey' ||
        lowerKey === 'wif'
      ) {
        throw new ValidationError('Private keys are not accepted', {
          field: key,
          reason: 'PRIVATE_KEY_REJECTED'
        });
      }

      if (typeof value === 'string') {
        if (/^[5KLc9][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(value)) {
          throw new ValidationError('WIF private key detected and rejected', {
            field: key,
            reason: 'WIF_PRIVATE_KEY_REJECTED'
          });
        }

        if (/^[xyzuvt]prv[1-9A-HJ-NP-Za-km-z]{100,120}$/.test(value)) {
          throw new ValidationError('Extended private key detected and rejected', {
            field: key,
            reason: 'XPRIV_PRIVATE_KEY_REJECTED'
          });
        }

        if (lowerKey.includes('key') && /^[0-9a-fA-F]{64}$/.test(value)) {
          throw new ValidationError('Private key hex detected and rejected', {
            field: key,
            reason: 'HEX_PRIVATE_KEY_REJECTED'
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        this.assertNoPrivateKeys(value);
      }
    }
  }
}
