import type { Utxo } from '@kepler/bitcoin';
import { OnchainInsufficientFundsError, OnchainPsbtBuildError } from './onchain.errors';

export const DUST_THRESHOLD_SATS = 294n;

export interface UtxoSelectionResult<T extends Utxo = Utxo> {
  readonly inputs: T[];
  readonly totalInputSats: bigint;
  readonly feeSats: bigint;
  readonly changeSats: bigint;
}

export class UtxoSelector {
  public static select<T extends Utxo = Utxo>(
    utxos: readonly T[],
    targetSats: bigint,
    feeRate: number,
    changeAddress: string
  ): UtxoSelectionResult<T> {
    if (!changeAddress || typeof changeAddress !== 'string') {
      throw new OnchainPsbtBuildError('changeAddress must be a non-empty string', {
        reason: 'changeAddress must be a non-empty string',
        step: 'utxo_selection'
      });
    }

    if (!Number.isFinite(feeRate) || feeRate <= 0) {
      throw new OnchainPsbtBuildError('feeRate must be a positive number', {
        reason: 'feeRate must be a positive number',
        step: 'utxo_selection'
      });
    }

    let totalAvailableSats = 0n;
    for (const utxo of utxos) {
      totalAvailableSats += utxo.value;
    }

    const sortedUtxos = [...utxos].sort((a, b) => {
      if (b.value !== a.value) {
        return b.value > a.value ? 1 : -1;
      }
      if (a.txid !== b.txid) {
        return a.txid > b.txid ? 1 : -1;
      }
      return a.vout - b.vout;
    });

    const selectedInputs: T[] = [];
    let accumulatedInputSats = 0n;

    for (const utxo of sortedUtxos) {
      selectedInputs.push(utxo);
      accumulatedInputSats += utxo.value;

      const vBytesWithChange = 10 + selectedInputs.length * 68 + 62;
      const feeWithChange = BigInt(Math.ceil(vBytesWithChange * feeRate));

      if (accumulatedInputSats >= targetSats + feeWithChange) {
        const rawChange = accumulatedInputSats - targetSats - feeWithChange;
        if (rawChange >= DUST_THRESHOLD_SATS) {
          return {
            inputs: selectedInputs,
            totalInputSats: accumulatedInputSats,
            feeSats: feeWithChange,
            changeSats: rawChange
          };
        }

        const feeNoChange = accumulatedInputSats - targetSats;
        return {
          inputs: selectedInputs,
          totalInputSats: accumulatedInputSats,
          feeSats: feeNoChange,
          changeSats: 0n
        };
      }

      const vBytesNoChange = 10 + selectedInputs.length * 68 + 31;
      const minFeeNoChange = BigInt(Math.ceil(vBytesNoChange * feeRate));

      if (accumulatedInputSats >= targetSats + minFeeNoChange) {
        const feeNoChange = accumulatedInputSats - targetSats;
        return {
          inputs: selectedInputs,
          totalInputSats: accumulatedInputSats,
          feeSats: feeNoChange,
          changeSats: 0n
        };
      }
    }

    const estimatedVBytes = 10 + Math.max(sortedUtxos.length, 1) * 68 + 62;
    const estimatedFee = BigInt(Math.ceil(estimatedVBytes * feeRate));

    throw new OnchainInsufficientFundsError('Insufficient funds for requested amount and fees', {
      availableSats: Number(totalAvailableSats),
      requiredSats: Number(targetSats),
      feeSats: Number(estimatedFee)
    });
  }
}
