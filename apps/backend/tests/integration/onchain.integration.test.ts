import net from 'node:net';
import dns from 'node:dns';
import '../../src/config/env';
import request from 'supertest';
import * as btc from '@scure/btc-signer';
import { base64 } from '@scure/base';
import { createApp, getLimiter } from '../../src/app';
import { getLogger } from '../../src/services/logger';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamilyAttemptTimeout(1000);
jest.setTimeout(30000);

describe('Onchain Module Integration', () => {
  const logger = getLogger('test-onchain-integration');
  const limiter = getLimiter();
  const app = createApp(limiter, logger);

  const knownTestnet4Xpub = 'tpubDDCFgoRpYFCJcFsk3ab8TuhQBxdcyEq9zMXjnSJwRJ5B27rFcCReyVABP6q3CG2hZ2VouPALBF2YqswEyCJKRPQerYDtWxoNaHicmru1FDD';
  const expectedTestnet4Addresses = [
    'tb1qtpdhsnahcrj40j9g6zd23yy807pdg2cxy4dlgu',
    'tb1qrh9m93w4mzvm7ezrc4qd2v9gpgfhazs6dws7hx',
    'tb1qxscfdwvmf27chhk40tg27aqhl8p233z3r9l9px',
    'tb1qe6qjpadgtl9qw4ltzr0ac8xpmsdrpr2q3lrmfz',
    'tb1q8raknqkyra5n03tv98fnaqc4tzx7ggjt036kjz'
  ];
  const expectedTestnet4ChangeAddress = 'tb1q44tjd52tv7sha3ujnr80h3fty2k088ag56txz9';

  const validMainnetXpub = 'xpub661MyMwAqRbcEtUEgdXRTY6dJQG9fRgs7C5QomqETKMYBJVtSGpRqyHSmhWy8snovPd5oWZgQ14zUquxbxu7Z1umuXbN5VDpUL1QobD5xUY';
  const validMainnetAddress = 'bc1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnhqxx8z';
  const validTestnetAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
  const dummyTxid = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  function createUnsignedPsbt(): string {
    const decoded = btc.Address(btc.NETWORK).decode(validMainnetAddress);
    if (decoded.type !== 'wpkh') {
      throw new Error('Expected wpkh address');
    }
    const script = btc.OutScript.encode({ type: 'wpkh', hash: decoded.hash });
    const tx = new btc.Transaction();
    tx.addInput({
      txid: dummyTxid,
      index: 0,
      witnessUtxo: { script, amount: 50000n }
    });
    tx.addOutputAddress(validMainnetAddress, 49000n, btc.NETWORK);
    return base64.encode(tx.toPSBT());
  }

  const hasEsplora = Boolean(process.env.ESPLORA_URL?.trim());
  const itWithEsplora = hasEsplora ? it : it.skip;

  describe('POST /api/onchain/fees', () => {
    itWithEsplora('returns real fees and runs when ESPLORA_URL is set', async () => {
      const res = await request(app)
        .post('/api/onchain/fees')
        .send({
          network: 'testnet4'
        });

      expect(res.status).toBe(200);
      expect(typeof res.body.fastest).toBe('number');
      expect(typeof res.body.halfHour).toBe('number');
      expect(typeof res.body.hour).toBe('number');
      expect(typeof res.body.economy).toBe('number');
      expect(typeof res.body.minimum).toBe('number');
      expect(res.body.fastest).toBeGreaterThanOrEqual(1);
    });

    it('returns 400 when network is invalid', async () => {
      const res = await request(app)
        .post('/api/onchain/fees')
        .send({
          network: 'unknown-network'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/onchain/derive', () => {
    it('returns addresses with a real testnet4 xpub', async () => {
      const res = await request(app)
        .post('/api/onchain/derive')
        .send({
          xpub: knownTestnet4Xpub,
          network: 'testnet4',
          count: 5
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.addresses)).toBe(true);
      expect(res.body.addresses).toHaveLength(5);
      expect(res.body.addresses).toEqual(expectedTestnet4Addresses);
      expect(res.body.changeAddress).toBe(expectedTestnet4ChangeAddress);
    });

    it('returns 400 with ONCHAIN_DERIVATION_ERROR on malformed xpub', async () => {
      const res = await request(app)
        .post('/api/onchain/derive')
        .send({
          xpub: 'invalid',
          network: 'testnet4',
          count: 1
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ONCHAIN_DERIVATION_ERROR');
    });

    it('returns 400 with ONCHAIN_DERIVATION_ERROR when xpub does not match network', async () => {
      const res = await request(app)
        .post('/api/onchain/derive')
        .send({
          xpub: validMainnetXpub,
          network: 'testnet4',
          count: 2
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ONCHAIN_DERIVATION_ERROR');
    });

    it('returns 400 when request contains private key', async () => {
      const res = await request(app)
        .post('/api/onchain/derive')
        .send({
          xpub: validMainnetXpub,
          network: 'mainnet',
          count: 2,
          privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when unrecognized fields are provided', async () => {
      const res = await request(app)
        .post('/api/onchain/derive')
        .send({
          xpub: validMainnetXpub,
          network: 'mainnet',
          count: 2,
          unexpected: true
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/onchain/utxos', () => {
    it('returns 400 when addresses array is empty', async () => {
      const res = await request(app)
        .post('/api/onchain/utxos')
        .send({
          addresses: [],
          network: 'mainnet'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when address does not match specified network', async () => {
      const res = await request(app)
        .post('/api/onchain/utxos')
        .send({
          addresses: [validTestnetAddress],
          network: 'mainnet'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/onchain/psbt/build', () => {
    it('returns 400 when amountSats is zero', async () => {
      const res = await request(app)
        .post('/api/onchain/psbt/build')
        .send({
          xpub: validMainnetXpub,
          network: 'mainnet',
          toAddress: validMainnetAddress,
          amountSats: '0',
          feeRate: 10
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when feeRate is out of range', async () => {
      const res = await request(app)
        .post('/api/onchain/psbt/build')
        .send({
          xpub: validMainnetXpub,
          network: 'mainnet',
          toAddress: validMainnetAddress,
          amountSats: '1000',
          feeRate: 0
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when toAddress belongs to different network', async () => {
      const res = await request(app)
        .post('/api/onchain/psbt/build')
        .send({
          xpub: validMainnetXpub,
          network: 'mainnet',
          toAddress: validTestnetAddress,
          amountSats: '1000',
          feeRate: 10
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when privateKey field is passed', async () => {
      const res = await request(app)
        .post('/api/onchain/psbt/build')
        .send({
          xpub: validMainnetXpub,
          network: 'mainnet',
          toAddress: validMainnetAddress,
          amountSats: '1000',
          feeRate: 10,
          privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/onchain/psbt/broadcast', () => {
    it('returns 400 on invalid base64 input', async () => {
      const res = await request(app)
        .post('/api/onchain/psbt/broadcast')
        .send({
          signedPsbt: 'not-base64!',
          network: 'mainnet'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 502 with ONCHAIN_BROADCAST_ERROR when signatures are missing', async () => {
      const unsignedPsbt = createUnsignedPsbt();
      const res = await request(app)
        .post('/api/onchain/psbt/broadcast')
        .send({
          signedPsbt: unsignedPsbt,
          network: 'mainnet'
        });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('ONCHAIN_BROADCAST_ERROR');
      expect(res.body.error.context.reason).toBe('MISSING_SIGNATURES');
    });
  });
});
