import '../../src/config/env';
import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createApp, getLimiter } from '../../src/app';
import { getLogger } from '../../src/services/logger';
import {
  BitcoinClient,
  BitcoinConfig,
  BitcoinNotFoundError,
  BitcoinNetworkError,
  BitcoinTransaction,
  BitcoinAddressInfo,
  BitcoinBlockTip,
  Utxo
} from '@kepler/bitcoin';
import {
  LightningClient,
  LightningConfig,
  LightningInvoiceError,
  LightningTimeoutError,
  LightningInvoice,
  LightningPayment,
  LightningTransaction,
  Bolt11
} from '@kepler/lightning';
import {
  NostrClient,
  NostrConfig,
  NostrTimeoutError,
  VerifiedNostrEvent
} from '@kepler/nostr';
import {
  CashuClient,
  CashuConfig,
  CashuNetworkError,
  CashuMintInfo,
  CashuTokenCodec,
  CashuToken
} from '@kepler/cashu';

describe('ProtocolsController (Unit with stubbed protocol clients)', () => {
  const logger = getLogger('test-protocols-controller');
  const limiter = getLimiter();
  const prisma = new PrismaClient();

  const bitcoinConfig = new BitcoinConfig({
    network: 'mainnet',
    primaryUrl: 'https://blockstream.info/api',
    fallbackUrl: 'https://mempool.space/api'
  });
  const lightningConfig = new LightningConfig({
    connectionString: 'nostr+walletconnect://0000000000000000000000000000000000000000000000000000000000000001?relay=wss://relay.damus.io&secret=0000000000000000000000000000000000000000000000000000000000000002'
  });
  const nostrConfig = new NostrConfig({
    relays: ['wss://nos.lol'],
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001'
  });
  const cashuConfig = new CashuConfig({
    mintUrl: 'https://testnut.cashu.space'
  });

  let bitcoinClient: BitcoinClient;
  let lightningClient: LightningClient;
  let nostrClient: NostrClient;
  let cashuClient: CashuClient;
  let app: Express;

  beforeAll(async () => {
    bitcoinClient = new BitcoinClient(bitcoinConfig, logger);
    lightningClient = new LightningClient(lightningConfig, logger);
    nostrClient = new NostrClient(nostrConfig, logger);
    cashuClient = new CashuClient(cashuConfig, logger);

    app = createApp(limiter, logger, prisma, {
      bitcoinClient,
      lightningClient,
      nostrClient,
      cashuClient
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/protocols/bitcoin/transaction', () => {
    const validTxid = '0000000000000000000000000000000000000000000000000000000000000001';

    it('returns 200 with valid body on happy path', async () => {
      const mockTx: BitcoinTransaction = {
        txid: validTxid,
        version: 1,
        locktime: 0,
        size: 250,
        weight: 1000,
        fee: 5000n,
        inputs: [],
        outputs: [
          {
            scriptpubkey: '0014' + '00'.repeat(20),
            scriptpubkeyAddress: 'bc1qtest',
            value: 100000n
          }
        ],
        status: { confirmed: true, blockHeight: 800000, blockHash: '00000', blockTime: 1700000000 }
      };

      jest.spyOn(bitcoinClient, 'getTransaction').mockResolvedValue(mockTx);

      const res = await request(app)
        .post('/api/protocols/bitcoin/transaction')
        .send({ txid: validTxid });

      expect(res.status).toBe(200);
      expect(res.body.txid).toBe(validTxid);
      expect(res.body.fee).toBe('5000');
      expect(res.body.outputs[0].value).toBe('100000');
    });

    it('returns 400 with VALIDATION_ERROR on malformed input', async () => {
      const res = await request(app)
        .post('/api/protocols/bitcoin/transaction')
        .send({ txid: 'invalid-txid' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when transaction is not found', async () => {
      jest.spyOn(bitcoinClient, 'getTransaction').mockRejectedValue(
        new BitcoinNotFoundError('Transaction not found', { txid: validTxid })
      );

      const res = await request(app)
        .post('/api/protocols/bitcoin/transaction')
        .send({ txid: validTxid });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 502 on network failure', async () => {
      jest.spyOn(bitcoinClient, 'getTransaction').mockRejectedValue(
        new BitcoinNetworkError('Esplora unreachable', { url: 'https://test' })
      );

      const res = await request(app)
        .post('/api/protocols/bitcoin/transaction')
        .send({ txid: validTxid });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST /api/protocols/bitcoin/address', () => {
    const validAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

    it('returns 200 with valid body on happy path', async () => {
      const mockInfo: BitcoinAddressInfo = {
        address: validAddress,
        chainStats: {
          fundedTxoCount: 2,
          fundedTxoSum: 50000n,
          spentTxoCount: 1,
          spentTxoSum: 20000n
        },
        mempoolStats: {
          fundedTxoCount: 0,
          fundedTxoSum: 0n,
          spentTxoCount: 0,
          spentTxoSum: 0n
        }
      };

      jest.spyOn(bitcoinClient, 'getAddressInfo').mockResolvedValue(mockInfo);

      const res = await request(app)
        .post('/api/protocols/bitcoin/address')
        .send({ address: validAddress });

      expect(res.status).toBe(200);
      expect(res.body.address).toBe(validAddress);
      expect(res.body.chainStats.fundedTxoSum).toBe('50000');
      expect(res.body.chainStats.spentTxoSum).toBe('20000');
    });

    it('returns 400 with VALIDATION_ERROR on malformed input', async () => {
      const res = await request(app)
        .post('/api/protocols/bitcoin/address')
        .send({ address: 'invalid-address-format' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when address is not found', async () => {
      jest.spyOn(bitcoinClient, 'getAddressInfo').mockRejectedValue(
        new BitcoinNotFoundError('Address not found', { address: validAddress })
      );

      const res = await request(app)
        .post('/api/protocols/bitcoin/address')
        .send({ address: validAddress });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 502 on network failure', async () => {
      jest.spyOn(bitcoinClient, 'getAddressInfo').mockRejectedValue(
        new BitcoinNetworkError('Esplora down', { url: 'https://test' })
      );

      const res = await request(app)
        .post('/api/protocols/bitcoin/address')
        .send({ address: validAddress });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST /api/protocols/bitcoin/tip', () => {
    it('returns 200 on happy path', async () => {
      const mockTip: BitcoinBlockTip = {
        height: 850000,
        hash: '00000000000000000002a4b8',
        timestamp: 1700000000
      };

      jest.spyOn(bitcoinClient, 'getBlockTip').mockResolvedValue(mockTip);

      const res = await request(app)
        .post('/api/protocols/bitcoin/tip')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.height).toBe(850000);
      expect(res.body.hash).toBe('00000000000000000002a4b8');
    });

    it('returns 502 on network failure', async () => {
      jest.spyOn(bitcoinClient, 'getBlockTip').mockRejectedValue(
        new BitcoinNetworkError('Esplora unreachable', { url: 'https://test' })
      );

      const res = await request(app)
        .post('/api/protocols/bitcoin/tip')
        .send({});

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST /api/protocols/lightning/decode', () => {
    const validInvoice = 'lnbc10n1p383000pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y7372';

    it('returns 200 with valid body on happy path', async () => {
      const mockDecoded: LightningInvoice = {
        bolt11: validInvoice,
        paymentHash: '00'.repeat(32),
        preimage: null,
        amountMsat: 1000000n,
        description: 'test payment',
        descriptionHash: null,
        timestamp: 1700000000,
        expiry: 3600,
        payeePubkey: null,
        expiresAt: 1700003600
      };

      jest.spyOn(Bolt11, 'decode').mockReturnValue(mockDecoded);

      const res = await request(app)
        .post('/api/protocols/lightning/decode')
        .send({ invoice: validInvoice });

      expect(res.status).toBe(200);
      expect(res.body.paymentHash).toBe('00'.repeat(32));
      expect(res.body.amountMsat).toBe('1000000');
      expect(res.body.expiry).toBe(3600);
      expect(res.body.payeePubkey).toBeNull();
    });

    it('returns 400 with VALIDATION_ERROR on malformed input', async () => {
      const res = await request(app)
        .post('/api/protocols/lightning/decode')
        .send({ invoice: 'bad_prefix_invoice' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/protocols/lightning/lookup', () => {
    const validHash = '0000000000000000000000000000000000000000000000000000000000000002';

    it('returns 200 with valid body on happy path', async () => {
      const mockPayment: LightningPayment = {
        paymentHash: validHash,
        preimage: 'preimage_hex',
        amountMsat: 20000n,
        feeMsat: 100n,
        status: 'succeeded',
        createdAt: 1700000000,
        description: 'coffee'
      };

      jest.spyOn(lightningClient, 'lookupInvoice').mockResolvedValue(mockPayment);

      const res = await request(app)
        .post('/api/protocols/lightning/lookup')
        .send({ paymentHash: validHash });

      expect(res.status).toBe(200);
      expect(res.body.paymentHash).toBe(validHash);
      expect(res.body.amountMsat).toBe('20000');
      expect(res.body.feeMsat).toBe('100');
      expect(res.body.status).toBe('succeeded');
    });

    it('returns 400 with VALIDATION_ERROR on malformed input', async () => {
      const res = await request(app)
        .post('/api/protocols/lightning/lookup')
        .send({ paymentHash: 'short-hash' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when invoice is not found', async () => {
      jest.spyOn(lightningClient, 'lookupInvoice').mockRejectedValue(
        new LightningInvoiceError('Invoice not found', { code: 'NOT_FOUND', paymentHash: validHash })
      );

      const res = await request(app)
        .post('/api/protocols/lightning/lookup')
        .send({ paymentHash: validHash });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 502 on timeout', async () => {
      jest.spyOn(lightningClient, 'lookupInvoice').mockRejectedValue(
        new LightningTimeoutError('NWC request timed out', { timeoutMs: 5000 })
      );

      const res = await request(app)
        .post('/api/protocols/lightning/lookup')
        .send({ paymentHash: validHash });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST /api/protocols/lightning/transactions', () => {
    it('returns 200 on happy path', async () => {
      const mockTx: LightningTransaction = {
        type: 'incoming',
        invoice: 'lnbc1...',
        paymentHash: '00'.repeat(32),
        preimage: 'preimage_hex',
        amountMsat: 50000n,
        feeMsat: 50n,
        status: 'succeeded',
        createdAt: 1700000000,
        settledAt: 1700000005,
        description: 'donation'
      };

      jest.spyOn(lightningClient, 'listTransactions').mockResolvedValue([mockTx]);

      const res = await request(app)
        .post('/api/protocols/lightning/transactions')
        .send({ limit: 10 });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].amountMsat).toBe('50000');
      expect(res.body[0].feeMsat).toBe('50');
    });

    it('returns 400 with VALIDATION_ERROR on invalid limit', async () => {
      const res = await request(app)
        .post('/api/protocols/lightning/transactions')
        .send({ limit: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 502 on timeout', async () => {
      jest.spyOn(lightningClient, 'listTransactions').mockRejectedValue(
        new LightningTimeoutError('List transactions timed out', { timeoutMs: 5000 })
      );

      const res = await request(app)
        .post('/api/protocols/lightning/transactions')
        .send({ limit: 10 });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST /api/protocols/nostr/event', () => {
    const validEventId = '0000000000000000000000000000000000000000000000000000000000000003';

    it('returns 200 with event on happy path', async () => {
      const mockEvent: VerifiedNostrEvent = {
        event: {
          id: validEventId,
          pubkey: '11'.repeat(32),
          createdAt: 1700000000,
          kind: 1,
          tags: [],
          content: 'hello nostr',
          sig: '22'.repeat(64)
        },
        verified: true
      };

      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventById').mockResolvedValue(mockEvent);

      const res = await request(app)
        .post('/api/protocols/nostr/event')
        .send({ eventId: validEventId });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(validEventId);
      expect(res.body.createdAt).toBe(1700000000);
    });

    it('returns 200 with null when event not found on relays', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/protocols/nostr/event')
        .send({ eventId: validEventId });

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('returns 400 with VALIDATION_ERROR on malformed eventId', async () => {
      const res = await request(app)
        .post('/api/protocols/nostr/event')
        .send({ eventId: 'bad_event_id' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 502 on timeout', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventById').mockRejectedValue(
        new NostrTimeoutError('Query timed out', { timeoutMs: 3000 })
      );

      const res = await request(app)
        .post('/api/protocols/nostr/event')
        .send({ eventId: validEventId });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST /api/protocols/nostr/author', () => {
    const validPubkey = '0000000000000000000000000000000000000000000000000000000000000004';

    it('returns 200 on happy path', async () => {
      const mockEvent: VerifiedNostrEvent = {
        event: {
          id: '33'.repeat(32),
          pubkey: validPubkey,
          createdAt: 1700000000,
          kind: 1,
          tags: [],
          content: 'author message',
          sig: '44'.repeat(64)
        },
        verified: true
      };

      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventsByAuthor').mockResolvedValue([mockEvent]);

      const res = await request(app)
        .post('/api/protocols/nostr/author')
        .send({ pubkey: validPubkey, limit: 10 });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].pubkey).toBe(validPubkey);
      expect(res.body[0].createdAt).toBe(1700000000);
    });

    it('returns 400 with VALIDATION_ERROR on malformed pubkey or limit', async () => {
      const res = await request(app)
        .post('/api/protocols/nostr/author')
        .send({ pubkey: 'bad_pubkey', limit: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 502 on timeout', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventsByAuthor').mockRejectedValue(
        new NostrTimeoutError('Author query timed out', { timeoutMs: 3000 })
      );

      const res = await request(app)
        .post('/api/protocols/nostr/author')
        .send({ pubkey: validPubkey, limit: 10 });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST /api/protocols/cashu/mint', () => {
    const validUrl = 'https://testnut.cashu.space';

    it('returns 200 on happy path', async () => {
      const mockMintInfo: CashuMintInfo = {
        url: validUrl,
        name: 'Test Mint',
        version: '0.15.0',
        nuts: {
          4: { methods: [{ method: 'bolt11', unit: 'sat' }], disabled: false },
          5: { methods: [{ method: 'bolt11', unit: 'sat' }], disabled: false }
        },
        supportsMint: true,
        supportsMelt: true,
        supportsSwap: true,
        supportsRestore: true
      };

      jest.spyOn(cashuClient, 'getMintInfo').mockResolvedValue(mockMintInfo);

      const res = await request(app)
        .post('/api/protocols/cashu/mint')
        .send({ url: validUrl });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Mint');
      expect(res.body.version).toBe('0.15.0');
    });

    it('returns 400 with VALIDATION_ERROR on malformed url', async () => {
      const res = await request(app)
        .post('/api/protocols/cashu/mint')
        .send({ url: 'not-a-valid-url' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 502 on network failure', async () => {
      jest.spyOn(cashuClient, 'getMintInfo').mockRejectedValue(
        new CashuNetworkError('Mint unreachable', { url: validUrl })
      );

      const res = await request(app)
        .post('/api/protocols/cashu/mint')
        .send({ url: validUrl });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST /api/protocols/balance', () => {
    const validBitcoinAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    const sampleTokenString = 'cashuAeyJ0b2tlbiI6W3siaWQiOiJtMSIsImFtb3VudCI6MTAwLCJzZWNyZXQiOiJzMSIsIkMiOiJjMSJ9XX0=';

    it('returns 200 with all balances on happy path', async () => {
      const mockUtxos: Utxo[] = [
        {
          txid: '0000000000000000000000000000000000000000000000000000000000000001',
          vout: 0,
          value: 40000n,
          status: { confirmed: true, blockHeight: 800000, blockTime: 1700000000 }
        }
      ];
      const mockCashuToken: CashuToken = {
        mint: 'https://mint.example.com',
        unit: 'sat',
        memo: null,
        proofs: [
          { id: '001', amount: 300n, secret: 's1', C: 'c1', witness: null }
        ]
      };

      jest.spyOn(bitcoinClient, 'getUtxos').mockResolvedValue(mockUtxos);
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 8000000n });
      jest.spyOn(CashuTokenCodec, 'decode').mockReturnValue(mockCashuToken);

      const res = await request(app)
        .post('/api/protocols/balance')
        .send({
          network: 'mainnet',
          bitcoinAddress: validBitcoinAddress,
          cashuToken: sampleTokenString
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        bitcoin: { connected: true, balanceSats: '40000' },
        lightning: { connected: true, balanceSats: '8000' },
        cashu: { connected: true, balanceSats: '300' }
      });
    });

    it('returns 200 with disconnected states when optional fields are omitted', async () => {
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 10000n });

      const res = await request(app)
        .post('/api/protocols/balance')
        .send({ network: 'testnet' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        bitcoin: { connected: false, balanceSats: null },
        lightning: { connected: true, balanceSats: '10' },
        cashu: { connected: false, balanceSats: null }
      });
    });

    it('returns 400 with VALIDATION_ERROR on missing network', async () => {
      const res = await request(app)
        .post('/api/protocols/balance')
        .send({ bitcoinAddress: validBitcoinAddress });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with VALIDATION_ERROR on invalid network', async () => {
      const res = await request(app)
        .post('/api/protocols/balance')
        .send({ network: 'unknown-net' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with VALIDATION_ERROR on invalid bitcoinAddress prefix', async () => {
      const res = await request(app)
        .post('/api/protocols/balance')
        .send({ network: 'mainnet', bitcoinAddress: 'invalid_prefix' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with VALIDATION_ERROR on empty cashuToken', async () => {
      const res = await request(app)
        .post('/api/protocols/balance')
        .send({ network: 'mainnet', cashuToken: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 502 with PROTOCOL_OPERATION_ERROR on protocol failure', async () => {
      jest.spyOn(bitcoinClient, 'getUtxos').mockRejectedValue(
        new BitcoinNetworkError('Connection refused', { url: 'http://test' })
      );

      const res = await request(app)
        .post('/api/protocols/balance')
        .send({
          network: 'mainnet',
          bitcoinAddress: validBitcoinAddress
        });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('PROTOCOL_OPERATION_ERROR');
    });
  });
});
