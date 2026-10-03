import * as btc from '@scure/btc-signer';
import { base64 } from '@scure/base';
import type { Utxo } from '@kepler/bitcoin';
import type { SupportedNetwork } from './onchain.types';
import { OnchainPsbtBuildError } from './onchain.errors';
import { DUST_THRESHOLD_SATS } from './utxo.selector';

export interface PsbtBuilderParams {
  readonly xpub?: string;
  readonly network: SupportedNetwork;
  readonly inputs: ReadonlyArray<Utxo & { readonly address?: string }>;
  readonly totalInputSats: bigint;
  readonly toAddress: string;
  readonly amountSats: bigint;
  readonly feeSats: bigint;
  readonly changeSats: bigint;
  readonly changeAddress?: string;
}

interface BtcNetworkConfig {
  readonly bech32: string;
  readonly pubKeyHash: number;
  readonly scriptHash: number;
  readonly wif: number;
}

export class PsbtBuilder {
  public static build(params: PsbtBuilderParams): string {
    const {
      network,
      inputs,
      totalInputSats,
      toAddress,
      amountSats,
      feeSats,
      changeSats,
      changeAddress
    } = params;

    if (!inputs || inputs.length === 0) {
      throw new OnchainPsbtBuildError('At least one input UTXO is required', {
        reason: 'No input UTXOs provided',
        step: 'validate_inputs'
      });
    }

    if (amountSats <= 0n) {
      throw new OnchainPsbtBuildError('amountSats must be greater than 0', {
        reason: 'Invalid amountSats value',
        step: 'validate_amount'
      });
    }

    if (totalInputSats - (amountSats + changeSats) !== feeSats) {
      throw new OnchainPsbtBuildError(
        `Total input sats (${totalInputSats}) minus outputs (${amountSats} + ${changeSats}) does not equal feeSats (${feeSats})`,
        {
          reason: 'Fee mismatch between inputs and outputs',
          step: 'fee_assertion'
        }
      );
    }

    const btcNetwork = PsbtBuilder.resolveNetwork(network);
    const tx = new btc.Transaction();

    for (let index = 0; index < inputs.length; index++) {
      const input = inputs[index];
      const address = input.address || changeAddress;

      if (!address) {
        throw new OnchainPsbtBuildError(`Input at index ${index} lacks an address and no changeAddress provided`, {
          reason: 'Missing address for witnessUtxo derivation',
          step: 'derive_script'
        });
      }

      let script: Uint8Array;
      try {
        const decoded = btc.Address(btcNetwork).decode(address);
        if (decoded.type !== 'wpkh') {
          throw new OnchainPsbtBuildError(`Expected P2WPKH address, got type: ${decoded.type}`, {
            reason: `Expected P2WPKH address, got type: ${decoded.type}`,
            step: 'derive_script'
          });
        }
        script = btc.OutScript.encode({ type: 'wpkh', hash: decoded.hash });
      } catch (err: unknown) {
        if (err instanceof OnchainPsbtBuildError) {
          throw err;
        }
        const reason = err instanceof Error ? err.message : 'Failed to derive script from address';
        throw new OnchainPsbtBuildError(`Failed to derive witness script for address ${address}`, {
          reason,
          step: 'derive_script'
        }, err instanceof Error ? err : undefined);
      }

      try {
        tx.addInput({
          txid: input.txid,
          index: input.vout,
          witnessUtxo: {
            script,
            amount: input.value
          }
        });
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : 'Failed to add input to transaction';
        throw new OnchainPsbtBuildError(`Failed to add input at index ${index}`, {
          reason,
          step: 'add_input'
        }, err instanceof Error ? err : undefined);
      }
    }

    try {
      tx.addOutputAddress(toAddress, amountSats, btcNetwork);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Failed to add recipient output';
      throw new OnchainPsbtBuildError(`Failed to add recipient output for ${toAddress}`, {
        reason,
        step: 'add_recipient_output'
      }, err instanceof Error ? err : undefined);
    }

    if (changeSats >= DUST_THRESHOLD_SATS) {
      if (!changeAddress) {
        throw new OnchainPsbtBuildError('changeAddress is required when changeSats is at or above dust threshold', {
          reason: 'Missing changeAddress for change output',
          step: 'add_change_output'
        });
      }

      try {
        tx.addOutputAddress(changeAddress, changeSats, btcNetwork);
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : 'Failed to add change output';
        throw new OnchainPsbtBuildError(`Failed to add change output for ${changeAddress}`, {
          reason,
          step: 'add_change_output'
        }, err instanceof Error ? err : undefined);
      }
    }

    if (tx.fee !== feeSats) {
      throw new OnchainPsbtBuildError(
        `Computed transaction fee (${tx.fee}) does not match expected feeSats (${feeSats})`,
        {
          reason: 'Transaction fee check failed',
          step: 'fee_assertion'
        }
      );
    }

    try {
      const psbtBytes = tx.toPSBT();
      return base64.encode(psbtBytes);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Failed to serialize PSBT';
      throw new OnchainPsbtBuildError('Failed to serialize PSBT to base64', {
        reason,
        step: 'serialize_psbt'
      }, err instanceof Error ? err : undefined);
    }
  }

  private static resolveNetwork(network: SupportedNetwork): BtcNetworkConfig {
    switch (network) {
      case 'mainnet':
        return btc.NETWORK;
      case 'testnet':
      case 'testnet4':
      case 'signet':
        return btc.TEST_NETWORK;
      case 'regtest':
        return { ...btc.TEST_NETWORK, bech32: 'bcrt' };
      default:
        throw new OnchainPsbtBuildError(`Unsupported network: ${String(network)}`, {
          reason: `Network ${String(network)} is not supported`,
          step: 'resolve_network'
        });
    }
  }
}
