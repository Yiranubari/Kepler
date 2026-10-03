import * as btc from '@scure/btc-signer';
import { HDKey } from '@scure/bip32';
import { createBase58check } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2';
import type { SupportedNetwork } from './onchain.types';
import { OnchainDerivationError } from './onchain.errors';

interface BtcNetworkConfig {
  readonly bech32: string;
  readonly pubKeyHash: number;
  readonly scriptHash: number;
  readonly wif: number;
}

const SUPPORTED_NETWORKS: readonly SupportedNetwork[] = [
  'mainnet',
  'testnet',
  'testnet4',
  'signet',
  'regtest'
];

export class XpubDeriver {
  private static readonly base58check = createBase58check(sha256);

  public static deriveAddresses(
    xpub: string,
    network: SupportedNetwork,
    count: number,
    change: boolean
  ): string[] {
    if (!SUPPORTED_NETWORKS.includes(network)) {
      throw new OnchainDerivationError(`Unsupported network: ${String(network)}`, {
        reason: `Unsupported network: ${String(network)}`
      });
    }

    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new OnchainDerivationError('Invalid count parameter', {
        reason: 'Count must be an integer between 1 and 100'
      });
    }

    if (!xpub || typeof xpub !== 'string') {
      throw new OnchainDerivationError('Invalid xpub', {
        reason: 'xpub must be a non-empty string'
      });
    }

    const hdkey = XpubDeriver.parseXpub(xpub);
    if (network === 'mainnet' && !xpub.startsWith('xpub') && !xpub.startsWith('ypub') && !xpub.startsWith('zpub')) {
      throw new OnchainDerivationError(`xpub does not match network ${network}`, {
        reason: 'NETWORK_MISMATCH'
      });
    }
    if (network !== 'mainnet' && !xpub.startsWith('tpub') && !xpub.startsWith('upub') && !xpub.startsWith('vpub')) {
      throw new OnchainDerivationError(`xpub does not match network ${network}`, {
        reason: 'NETWORK_MISMATCH'
      });
    }
    const networkConfig = XpubDeriver.resolveNetworkConfig(network);
    const branchIndex = change ? 1 : 0;

    try {
      const branchKey = hdkey.deriveChild(branchIndex);
      const addresses: string[] = [];

      for (let index = 0; index < count; index++) {
        const child = branchKey.deriveChild(index);
        if (!child.publicKey) {
          throw new OnchainDerivationError('Public key derivation produced null key', {
            reason: `No public key at index ${index}`
          });
        }

        const payment = btc.p2wpkh(child.publicKey, networkConfig);
        if (!payment.address) {
          throw new OnchainDerivationError('Address formatting returned undefined', {
            reason: `No address generated for index ${index}`
          });
        }

        addresses.push(payment.address);
      }

      return addresses;
    } catch (err: unknown) {
      if (err instanceof OnchainDerivationError) {
        throw err;
      }
      const reason = err instanceof Error ? err.message : 'Child key derivation failed';
      throw new OnchainDerivationError('Derivation failed', { reason }, err instanceof Error ? err : undefined);
    }
  }

  public static deriveChangeAddress(xpub: string, network: SupportedNetwork): string {
    const addresses = XpubDeriver.deriveAddresses(xpub, network, 1, true);
    const changeAddress = addresses[0];
    if (!changeAddress) {
      throw new OnchainDerivationError('Failed to derive change address', {
        reason: 'No address returned'
      });
    }
    return changeAddress;
  }

  private static parseXpub(xpub: string): HDKey {
    try {
      const decoded = XpubDeriver.base58check.decode(xpub);
      if (decoded.length !== 78) {
        throw new OnchainDerivationError('Failed to parse xpub', {
          reason: 'Invalid extended key length'
        });
      }

      if (decoded[45] === 0) {
        throw new OnchainDerivationError('Failed to parse xpub', {
          reason: 'Expected extended public key, received private key'
        });
      }

      const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
      const version = view.getUint32(0, false);
      return HDKey.fromExtendedKey(xpub, { private: 0, public: version });
    } catch (err: unknown) {
      if (err instanceof OnchainDerivationError) {
        throw err;
      }
      const reason = err instanceof Error ? err.message : 'Invalid extended key';
      throw new OnchainDerivationError('Failed to parse xpub', { reason }, err instanceof Error ? err : undefined);
    }
  }

  private static resolveNetworkConfig(network: SupportedNetwork): BtcNetworkConfig {
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
        throw new OnchainDerivationError(`Unsupported network: ${String(network)}`, {
          reason: `Unsupported network: ${String(network)}`
        });
    }
  }
}
