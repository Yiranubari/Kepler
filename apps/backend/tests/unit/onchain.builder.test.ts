import * as btc from '@scure/btc-signer';
import { base64 } from '@scure/base';
import type { Utxo } from '@kepler/bitcoin';
import { PsbtBuilder } from '../../src/modules/onchain/psbt.builder';
import { OnchainPsbtBuildError } from '../../src/modules/onchain/onchain.errors';

describe('PsbtBuilder', () => {
  const toAddress = 'bc1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnhqxx8z';
  const changeAddress = 'bc1q9e2h3d9sgsuwjdqt4fdjev9yz5gv67vmqaawl0';
  const txid = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const makeInput = (value: bigint, address: string = changeAddress): Utxo & { address: string } => ({
    txid,
    vout: 0,
    value,
    address,
    status: {
      confirmed: true,
      blockHeight: 800000,
      blockTime: 1700000000
    }
  });

  describe('build', () => {
    it('is deterministic: same inputs produce identical base64', () => {
      const inputs = [makeInput(50000n)];
      const params = {
        network: 'mainnet' as const,
        inputs,
        totalInputSats: 50000n,
        toAddress,
        amountSats: 20000n,
        feeSats: 280n,
        changeSats: 29720n,
        changeAddress
      };

      const psbt1 = PsbtBuilder.build(params);
      const psbt2 = PsbtBuilder.build(params);

      expect(psbt1).toBe(psbt2);
      expect(typeof psbt1).toBe('string');
    });

    it('builds a PSBT with 1 input and 1 recipient, asserts base64 decodes and fee equals expected value', () => {
      const inputs = [makeInput(10500n)];
      const amountSats = 10000n;
      const feeSats = 500n;
      const changeSats = 0n;

      const psbtBase64 = PsbtBuilder.build({
        network: 'mainnet',
        inputs,
        totalInputSats: 10500n,
        toAddress,
        amountSats,
        feeSats,
        changeSats,
        changeAddress
      });

      const psbtBytes = base64.decode(psbtBase64);
      expect(psbtBytes.length).toBeGreaterThan(0);

      const parsedTx = btc.Transaction.fromPSBT(psbtBytes);
      expect(parsedTx.inputsLength).toBe(1);
      expect(parsedTx.outputsLength).toBe(1);
      expect(parsedTx.fee).toBe(feeSats);
      expect(parsedTx.getOutput(0).amount).toBe(amountSats);
    });

    it('builds with change, asserting change output is present and fee is correct', () => {
      const inputs = [makeInput(50000n)];
      const amountSats = 10000n;
      const feeSats = 280n;
      const changeSats = 39720n;

      const psbtBase64 = PsbtBuilder.build({
        network: 'mainnet',
        inputs,
        totalInputSats: 50000n,
        toAddress,
        amountSats,
        feeSats,
        changeSats,
        changeAddress
      });

      const psbtBytes = base64.decode(psbtBase64);
      const parsedTx = btc.Transaction.fromPSBT(psbtBytes);

      expect(parsedTx.inputsLength).toBe(1);
      expect(parsedTx.outputsLength).toBe(2);
      expect(parsedTx.fee).toBe(feeSats);

      const recipientOutput = parsedTx.getOutput(0);
      const changeOutput = parsedTx.getOutput(1);
      expect(recipientOutput.amount).toBe(amountSats);
      expect(changeOutput.amount).toBe(changeSats);
    });

    it('builds with change below dust, asserting no change output is added', () => {
      const inputs = [makeInput(10200n)];
      const amountSats = 10000n;
      const feeSats = 200n;
      const changeSats = 0n;

      const psbtBase64 = PsbtBuilder.build({
        network: 'mainnet',
        inputs,
        totalInputSats: 10200n,
        toAddress,
        amountSats,
        feeSats,
        changeSats,
        changeAddress
      });

      const psbtBytes = base64.decode(psbtBase64);
      const parsedTx = btc.Transaction.fromPSBT(psbtBytes);

      expect(parsedTx.inputsLength).toBe(1);
      expect(parsedTx.outputsLength).toBe(1);
      expect(parsedTx.fee).toBe(feeSats);
    });

    it('ensures the built PSBT is unsigned and has no signatures', () => {
      const inputs = [makeInput(50000n)];
      const psbtBase64 = PsbtBuilder.build({
        network: 'mainnet',
        inputs,
        totalInputSats: 50000n,
        toAddress,
        amountSats: 10000n,
        feeSats: 280n,
        changeSats: 39720n,
        changeAddress
      });

      const parsedTx = btc.Transaction.fromPSBT(base64.decode(psbtBase64));
      const input = parsedTx.getInput(0);

      expect(input.partialSig).toBeUndefined();
      expect(input.finalScriptSig).toBeUndefined();
      expect(input.finalScriptWitness).toBeUndefined();
      expect(parsedTx.isFinal).toBe(false);
    });

    it('builds PSBT for testnet addresses and network', () => {
      const testnetTo = 'tb1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnaxa4u3';
      const testnetChange = 'tb1q0gklfcld5z4ktdr38k450hye2prpa5u3328nvd';
      const inputs = [makeInput(50000n, testnetChange)];

      const psbtBase64 = PsbtBuilder.build({
        network: 'testnet',
        inputs,
        totalInputSats: 50000n,
        toAddress: testnetTo,
        amountSats: 15000n,
        feeSats: 280n,
        changeSats: 34720n,
        changeAddress: testnetChange
      });

      const parsedTx = btc.Transaction.fromPSBT(base64.decode(psbtBase64));
      expect(parsedTx.inputsLength).toBe(1);
      expect(parsedTx.outputsLength).toBe(2);
      expect(parsedTx.fee).toBe(280n);
    });

    it('throws OnchainPsbtBuildError when fee assertion fails', () => {
      const inputs = [makeInput(50000n)];

      expect(() => {
        PsbtBuilder.build({
          network: 'mainnet',
          inputs,
          totalInputSats: 50000n,
          toAddress,
          amountSats: 20000n,
          feeSats: 500n,
          changeSats: 29720n,
          changeAddress
        });
      }).toThrow(OnchainPsbtBuildError);

      try {
        PsbtBuilder.build({
          network: 'mainnet',
          inputs,
          totalInputSats: 50000n,
          toAddress,
          amountSats: 20000n,
          feeSats: 500n,
          changeSats: 29720n,
          changeAddress
        });
      } catch (err) {
        const typed = err as OnchainPsbtBuildError;
        expect(typed.code).toBe('ONCHAIN_PSBT_BUILD_ERROR');
        expect(typed.context.step).toBe('fee_assertion');
      }
    });

    it('throws OnchainPsbtBuildError when inputs are empty', () => {
      expect(() => {
        PsbtBuilder.build({
          network: 'mainnet',
          inputs: [],
          totalInputSats: 0n,
          toAddress,
          amountSats: 10000n,
          feeSats: 200n,
          changeSats: 0n,
          changeAddress
        });
      }).toThrow(OnchainPsbtBuildError);
    });

    it('throws OnchainPsbtBuildError when amountSats is zero or negative', () => {
      const inputs = [makeInput(10000n)];

      expect(() => {
        PsbtBuilder.build({
          network: 'mainnet',
          inputs,
          totalInputSats: 10000n,
          toAddress,
          amountSats: 0n,
          feeSats: 200n,
          changeSats: 9800n,
          changeAddress
        });
      }).toThrow(OnchainPsbtBuildError);
    });

    it('throws OnchainPsbtBuildError when unsupported network is provided', () => {
      const inputs = [makeInput(50000n)];

      expect(() => {
        PsbtBuilder.build({
          network: 'unsupported' as 'mainnet',
          inputs,
          totalInputSats: 50000n,
          toAddress,
          amountSats: 10000n,
          feeSats: 280n,
          changeSats: 39720n,
          changeAddress
        });
      }).toThrow(OnchainPsbtBuildError);
    });
  });
});
