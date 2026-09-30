import type { Utxo } from '@kepler/bitcoin';
import { UtxoSelector, DUST_THRESHOLD_SATS } from '../../src/modules/onchain/utxo.selector';
import { OnchainInsufficientFundsError } from '../../src/modules/onchain/onchain.errors';

describe('UtxoSelector', () => {
  const changeAddress = 'bc1q9e2h3d9sgsuwjdqt4fdjev9yz5gv67vmqaawl0';

  const makeUtxo = (txid: string, vout: number, value: bigint): Utxo => ({
    txid,
    vout,
    value,
    status: {
      confirmed: true,
      blockHeight: 800000,
      blockTime: 1700000000
    }
  });

  describe('select', () => {
    it('is deterministic: same inputs produce identical output', () => {
      const utxos = [
        makeUtxo('tx1', 0, 50000n),
        makeUtxo('tx2', 1, 25000n)
      ];
      const result1 = UtxoSelector.select(utxos, 20000n, 2, changeAddress);
      const result2 = UtxoSelector.select(utxos, 20000n, 2, changeAddress);

      expect(result1).toEqual(result2);
      expect(result1.feeSats).toBe(result2.feeSats);
      expect(result1.changeSats).toBe(result2.changeSats);
      expect(result1.totalInputSats).toBe(result2.totalInputSats);
    });

    it('selects from a UTXO set that covers target plus fee using largest-first selection', () => {
      const utxoSmall = makeUtxo('tx-small', 0, 10000n);
      const utxoLarge = makeUtxo('tx-large', 0, 50000n);
      const utxoMedium = makeUtxo('tx-medium', 0, 30000n);

      const result = UtxoSelector.select(
        [utxoSmall, utxoLarge, utxoMedium],
        25000n,
        1,
        changeAddress
      );

      expect(result.inputs).toHaveLength(1);
      expect(result.inputs[0].txid).toBe('tx-large');
      expect(result.totalInputSats).toBe(50000n);
    });

    it('accumulates multiple UTXOs in descending order until target plus fee is met', () => {
      const utxos = [
        makeUtxo('tx-1', 0, 2000n),
        makeUtxo('tx-2', 0, 5000n),
        makeUtxo('tx-3', 0, 8000n)
      ];

      const result = UtxoSelector.select(utxos, 11000n, 1, changeAddress);

      expect(result.inputs).toHaveLength(2);
      expect(result.inputs[0].txid).toBe('tx-3');
      expect(result.inputs[1].txid).toBe('tx-2');
      expect(result.totalInputSats).toBe(13000n);
      expect(result.changeSats).toBeGreaterThanOrEqual(DUST_THRESHOLD_SATS);
      expect(result.totalInputSats).toBe(11000n + result.feeSats + result.changeSats);
    });

    it('adds change below the dust threshold to the fee', () => {
      const utxos = [makeUtxo('tx1', 0, 10200n)];
      const target = 10000n;
      const feeRate = 1;

      const result = UtxoSelector.select(utxos, target, feeRate, changeAddress);

      expect(result.changeSats).toBe(0n);
      expect(result.feeSats).toBe(200n);
      expect(result.totalInputSats).toBe(target + result.feeSats);
    });

    it('creates change output when change is at or above dust threshold', () => {
      const utxos = [makeUtxo('tx1', 0, 100000n)];
      const target = 10000n;
      const feeRate = 2;

      const result = UtxoSelector.select(utxos, target, feeRate, changeAddress);

      const expectedVBytes = 10 + 1 * 68 + 62;
      const expectedFee = BigInt(expectedVBytes * feeRate);

      expect(result.feeSats).toBe(expectedFee);
      expect(result.changeSats).toBe(100000n - target - expectedFee);
      expect(result.changeSats).toBeGreaterThanOrEqual(DUST_THRESHOLD_SATS);
      expect(result.totalInputSats).toBe(target + result.feeSats + result.changeSats);
    });

    it('throws OnchainInsufficientFundsError with exact shortfall when funds are insufficient', () => {
      const utxos = [makeUtxo('tx1', 0, 5000n)];
      const target = 10000n;
      const feeRate = 1;

      expect(() => {
        UtxoSelector.select(utxos, target, feeRate, changeAddress);
      }).toThrow(OnchainInsufficientFundsError);

      try {
        UtxoSelector.select(utxos, target, feeRate, changeAddress);
      } catch (err) {
        expect(err).toBeInstanceOf(OnchainInsufficientFundsError);
        const typedErr = err as OnchainInsufficientFundsError;
        expect(typedErr.code).toBe('ONCHAIN_INSUFFICIENT_FUNDS');
        expect(typedErr.context.availableSats).toBe(5000);
        expect(typedErr.context.requiredSats).toBe(10000);
        expect(typeof typedErr.context.feeSats).toBe('number');
        expect(typedErr.context.feeSats).toBeGreaterThan(0);
      }
    });

    it('throws OnchainInsufficientFundsError for empty utxos array', () => {
      expect(() => {
        UtxoSelector.select([], 1000n, 1, changeAddress);
      }).toThrow(OnchainInsufficientFundsError);
    });

    it('throws error for invalid changeAddress or non-positive feeRate', () => {
      const utxos = [makeUtxo('tx1', 0, 10000n)];

      expect(() => {
        UtxoSelector.select(utxos, 5000n, 1, '');
      }).toThrow();

      expect(() => {
        UtxoSelector.select(utxos, 5000n, 0, changeAddress);
      }).toThrow();

      expect(() => {
        UtxoSelector.select(utxos, 5000n, -1, changeAddress);
      }).toThrow();
    });
  });
});
