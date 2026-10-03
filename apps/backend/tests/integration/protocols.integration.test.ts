import net from 'node:net';
import dns from 'node:dns';
import '../../src/config/env';
import { getLogger } from '../../src/services/logger';
import { BitcoinClient, BitcoinConfig } from '@kepler/bitcoin';
import { LightningClient, LightningConfig } from '@kepler/lightning';
import { NostrClient, NostrConfig } from '@kepler/nostr';
import { CashuClient, CashuConfig } from '@kepler/cashu';
import { ProtocolsService } from '../../src/modules/protocols/protocols.service';

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

describe('Protocols Integration (Real services, no mocks)', () => {
  jest.setTimeout(30000);

  const logger = getLogger('test-protocols-integration');

  const officialInvoice =
    'lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y7372';

  const hasEsplora = Boolean(process.env.ESPLORA_URL);
  const hasNostrRelays = Boolean(process.env.NOSTR_RELAYS || process.env.RELAYS);
  const hasCashuMint = Boolean(process.env.CASHU_MINT_URL || process.env.CASHU_MINT);

  let service: ProtocolsService;
  let nostrClient: NostrClient;

  beforeAll(async () => {
    const bitcoinConfig = BitcoinConfig.fromEnv({
      ...process.env,
      BITCOIN_NETWORK: process.env.BITCOIN_NETWORK || 'mainnet',
      ESPLORA_URL: process.env.ESPLORA_URL || 'https://blockstream.info/api',
      ESPLORA_FALLBACK_URL: process.env.ESPLORA_FALLBACK_URL || 'https://mempool.space/api'
    });
    const bitcoinClient = new BitcoinClient(bitcoinConfig, logger);

    const lightningConfig = LightningConfig.fromEnv();
    const lightningClient = new LightningClient(lightningConfig, logger);

    const nostrConfig = NostrConfig.fromEnv();
    nostrClient = new NostrClient(nostrConfig, logger);

    const cashuConfig = CashuConfig.fromEnv();
    const cashuClient = new CashuClient(cashuConfig, logger);

    service = new ProtocolsService(
      {
        bitcoinClient,
        lightningClient,
        nostrClient,
        cashuClient
      },
      logger
    );
  });

  afterAll(async () => {
    if (nostrClient && nostrClient.isConnected) {
      await nostrClient.disconnect();
    }
  });

  describe('Lightning invoice decode (Pure)', () => {
    it('decodes a valid official BOLT11 invoice correctly without network', async () => {
      const decoded = await service.decodeLightningInvoice(officialInvoice);

      expect(decoded.bolt11).toBe(officialInvoice);
      expect(decoded.amountMsat).toBe(2500000000n);
      expect(decoded.paymentHash).toBe('0001020304050607080900010203040506070809000102030405060708090102');
      expect(decoded.description).toBe('coffee beans');
      expect(decoded.expiry).toBe(3600);
      expect(decoded.timestamp).toBe(1496314658);
    });
  });

  describe('Bitcoin transaction fetch (Real Esplora)', () => {
    const testFn = hasEsplora ? it : it.skip;

    testFn('fetches a real confirmed Bitcoin transaction from Esplora', async () => {
      const genesisTxid = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';
      const tx = await service.fetchBitcoinTransaction(genesisTxid);

      expect(tx.txid).toBe(genesisTxid);
      expect(tx.outputs.length).toBeGreaterThan(0);
      expect(tx.status.confirmed).toBe(true);
    });
  });

  describe('Nostr event fetch (Real Relays)', () => {
    const testFn = hasNostrRelays ? it : it.skip;

    testFn('queries Nostr relay for a well-known event or author', async () => {
      const jackPubkey = '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2';
      const events = await service.fetchNostrEventsByAuthor(jackPubkey, 5);

      expect(Array.isArray(events)).toBe(true);
      if (events.length > 0) {
        expect(events[0].pubkey).toBe(jackPubkey);
        expect(typeof events[0].id).toBe('string');
      }
    });
  });

  describe('Cashu mint info fetch (Real Mint)', () => {
    const testFn = hasCashuMint ? it : it.skip;

    testFn('fetches real mint information from configured mint', async () => {
      const mintUrl = (process.env.CASHU_MINT_URL || process.env.CASHU_MINT || 'https://testnut.cashu.space').trim();
      const mintInfo = await service.fetchCashuMintInfo(mintUrl);

      expect(mintInfo).toBeDefined();
      expect(typeof mintInfo.name).toBe('string');
      expect(mintInfo.nuts).toBeDefined();
    });
  });
});
