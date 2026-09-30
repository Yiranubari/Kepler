import { BitcoinClient, BitcoinConfig, type Utxo } from '@kepler/bitcoin';
import { ValidationError } from '@kepler/shared';
import * as btc from '@scure/btc-signer';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hex, base64 } from '@scure/base';
import { getLogger } from '../../src/services/logger';
import { OnchainService } from '../../src/modules/onchain/onchain.service';
import {
  OnchainBroadcastError,
  OnchainInsufficientFundsError
} from '../../src/modules/onchain/onchain.errors';

describe('OnchainService', () => {
  const logger = getLogger('test-onchain-service');
  const bitcoinConfig = new BitcoinConfig({
    network: 'mainnet',
    primaryUrl: 'https://blockstream.info/api',
    fallbackUrl: 'https://mempool.space/api'
  });

  let bitcoinClient: BitcoinClient;
  let service: OnchainService;

  const validMainnetXpub = 'xpub661MyMwAqRbcEtUEgdXRTY6dJQG9fRgs7C5QomqETKMYBJVtSGpRqyHSmhWy8snovPd5oWZgQ14zUquxbxu7Z1umuXbN5VDpUL1QobD5xUY';
  const toAddress = 'bc1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnhqxx8z';
  const changeAddress = 'bc1q9e2h3d9sgsuwjdqt4fdjev9yz5gv67vmqaawl0';
  const txid = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    bitcoinClient = new BitcoinClient(bitcoinConfig, logger);
    service = new OnchainService(bitcoinClient, logger);

    debugSpy = jest.spyOn(logger, 'debug');
    infoSpy = jest.spyOn(logger, 'info');
    warnSpy = jest.spyOn(logger, 'warn');
    errorSpy = jest.spyOn(logger, 'error');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function assertNeverLogged(sensitiveValues: string[]): void {
    const allCalls = [
      ...debugSpy.mock.calls,
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls
    ];

    for (const call of allCalls) {
      const serialized = JSON.stringify(call);
      for (const val of sensitiveValues) {
        expect(serialized).not.toContain(val);
      }
    }
  }

  describe('validation on malformed input for every method', () => {
    it('derive throws ValidationError on malformed input', async () => {
      await expect(
        service.derive({
          xpub: validMainnetXpub,
          network: 'mainnet',
          count: 0
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('utxos throws ValidationError on malformed input', async () => {
      await expect(
        service.utxos({
          addresses: [],
          network: 'mainnet'
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('fees throws ValidationError on malformed input', async () => {
      await expect(
        service.fees({
          network: 'invalid-net' as unknown as 'mainnet'
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('buildPsbt throws ValidationError on malformed input', async () => {
      await expect(
        service.buildPsbt({
          xpub: validMainnetXpub,
          network: 'mainnet',
          toAddress,
          amountSats: '0',
          feeRate: 10
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('broadcast throws ValidationError on malformed input', async () => {
      await expect(
        service.broadcast({
          signedPsbt: 'not-base64!',
          network: 'mainnet'
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('derive', () => {
    it('derives receiving addresses and change address successfully without logging xpub', async () => {
      const response = await service.derive({
        xpub: validMainnetXpub,
        network: 'mainnet',
        count: 3
      });

      expect(response.addresses).toHaveLength(3);
      expect(response.addresses[0]).toMatch(/^bc1q/);
      expect(response.changeAddress).toMatch(/^bc1q/);

      assertNeverLogged([validMainnetXpub]);
    });

    it('rejects payload containing private keys', async () => {
      await expect(
        service.derive({
          xpub: validMainnetXpub,
          network: 'mainnet',
          count: 2,
          privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        } as unknown as { xpub: string; network: 'mainnet'; count: number })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects WIF private keys in inputs', async () => {
      await expect(
        service.derive({
          xpub: '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ',
          network: 'mainnet',
          count: 2
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('utxos', () => {
    it('fetches and deduplicates UTXOs across multiple addresses', async () => {
      const addr1 = 'bc1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnhqxx8z';
      const addr2 = 'bc1q0gklfcld5z4ktdr38k450hye2prpa5u3mvuqh7';

      const mockUtxo1: Utxo = {
        txid: 'tx1',
        vout: 0,
        value: 10000n,
        status: { confirmed: true, blockHeight: 1, blockTime: 1 }
      };
      const mockUtxo2: Utxo = {
        txid: 'tx2',
        vout: 0,
        value: 20000n,
        status: { confirmed: true, blockHeight: 1, blockTime: 1 }
      };

      jest.spyOn(bitcoinClient, 'getUtxos').mockImplementation(async (address: string) => {
        if (address === addr1) {
          return [mockUtxo1];
        }
        return [mockUtxo1, mockUtxo2];
      });

      const result = await service.utxos({
        addresses: [addr1, addr2],
        network: 'mainnet'
      });

      expect(result.utxos).toHaveLength(2);
      expect(result.totalSats).toBe('30000');
      expect(result.utxos[0].address).toBe(addr1);
      expect(result.utxos[1].address).toBe(addr2);
    });

    it('rejects request with invalid addresses for network', async () => {
      await expect(
        service.utxos({
          addresses: ['tb1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnaxa4u3'],
          network: 'mainnet'
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('fees', () => {
    it('fetches recommended fees and maps field names properly', async () => {
      jest.spyOn(bitcoinClient, 'getRecommendedFees').mockResolvedValue({
        fastestFee: 25,
        halfHourFee: 20,
        hourFee: 15,
        economyFee: 10,
        minimumFee: 2
      });

      const response = await service.fees({ network: 'mainnet' });

      expect(response).toEqual({
        fastest: 25,
        halfHour: 20,
        hour: 15,
        economy: 10,
        minimum: 2
      });
    });
  });

  describe('buildPsbt', () => {
    it('queries addresses, selects UTXOs, and builds PSBT without logging xpub, PSBT, or destination', async () => {
      jest.spyOn(bitcoinClient, 'getUtxos').mockResolvedValue([
        {
          txid,
          vout: 0,
          value: 100000n,
          status: { confirmed: true, blockHeight: 800000, blockTime: 1700000000 }
        }
      ]);

      const response = await service.buildPsbt({
        xpub: validMainnetXpub,
        network: 'mainnet',
        toAddress,
        amountSats: '50000',
        feeRate: 2,
        changeAddress
      });

      expect(response.inputCount).toBe(1);
      expect(response.outputCount).toBe(2);
      expect(typeof response.psbt).toBe('string');
      expect(typeof response.feeSats).toBe('string');

      assertNeverLogged([validMainnetXpub, toAddress, response.psbt]);
    });

    it('throws OnchainInsufficientFundsError when available funds are insufficient', async () => {
      jest.spyOn(bitcoinClient, 'getUtxos').mockResolvedValue([
        {
          txid,
          vout: 0,
          value: 10000n,
          status: { confirmed: true, blockHeight: 800000, blockTime: 1700000000 }
        }
      ]);

      await expect(
        service.buildPsbt({
          xpub: validMainnetXpub,
          network: 'mainnet',
          toAddress,
          amountSats: '50000',
          feeRate: 2,
          changeAddress
        })
      ).rejects.toBeInstanceOf(OnchainInsufficientFundsError);
    });
  });

  describe('broadcast', () => {
    it('throws OnchainBroadcastError with reason MISSING_SIGNATURES when signatures are missing', async () => {
      const decoded = btc.Address(btc.NETWORK).decode(toAddress);
      if (decoded.type !== 'wpkh') {
        throw new Error('Expected wpkh address');
      }
      const script = btc.OutScript.encode({ type: 'wpkh', hash: decoded.hash });

      const tx = new btc.Transaction();
      tx.addInput({
        txid,
        index: 0,
        witnessUtxo: { script, amount: 50000n }
      });
      tx.addOutputAddress(toAddress, 49000n, btc.NETWORK);

      const unsignedPsbtB64 = base64.encode(tx.toPSBT());

      await expect(
        service.broadcast({
          signedPsbt: unsignedPsbtB64,
          network: 'mainnet'
        })
      ).rejects.toThrow(OnchainBroadcastError);

      try {
        await service.broadcast({
          signedPsbt: unsignedPsbtB64,
          network: 'mainnet'
        });
      } catch (err) {
        expect(err).toBeInstanceOf(OnchainBroadcastError);
        const typed = err as OnchainBroadcastError;
        expect(typed.context.reason).toBe('MISSING_SIGNATURES');
      }

      assertNeverLogged([unsignedPsbtB64]);
    });

    it('finalizes signed PSBT and calls bitcoinClient.broadcastTransaction without logging PSBT', async () => {
      const privKey = hex.decode(
        '0000000000000000000000000000000000000000000000000000000000000001'
      );
      const pubKey = secp256k1.getPublicKey(privKey, true);
      const pay = btc.p2wpkh(pubKey, btc.NETWORK);

      const tx = new btc.Transaction();
      tx.addInput({
        txid,
        index: 0,
        witnessUtxo: { script: pay.script, amount: 50000n }
      });
      tx.addOutputAddress(pay.address, 49000n, btc.NETWORK);
      tx.sign(privKey);

      const signedPsbtB64 = base64.encode(tx.toPSBT());

      const broadcastSpy = jest
        .spyOn(bitcoinClient, 'broadcastTransaction')
        .mockResolvedValue({ txid: 'mock-broadcasted-txid' });

      const response = await service.broadcast({
        signedPsbt: signedPsbtB64,
        network: 'mainnet'
      });

      expect(response.txid).toBe('mock-broadcasted-txid');
      expect(broadcastSpy).toHaveBeenCalled();

      assertNeverLogged([signedPsbtB64]);
    });
  });
});
