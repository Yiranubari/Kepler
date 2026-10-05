import {
  ValidationError,
  NotFoundError,
  NetworkError
} from '@kepler/shared';
import {
  BitcoinClient,
  BitcoinConfig,
  BitcoinNotFoundError,
  BitcoinNetworkError,
  BitcoinParseError,
  BitcoinInvalidResponseError,
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
  LightningNetworkError,
  LightningParseError,
  LightningInvoice,
  LightningPayment,
  LightningTransaction,
  Bolt11
} from '@kepler/lightning';
import {
  NostrClient,
  NostrConfig,
  NostrConnectionError,
  NostrTimeoutError,
  NostrParseError,
  VerifiedNostrEvent
} from '@kepler/nostr';
import {
  CashuClient,
  CashuConfig,
  CashuNetworkError,
  CashuParseError,
  CashuMintInfo,
  CashuTokenCodec,
  CashuTokenError,
  CashuToken
} from '@kepler/cashu';
import { getLogger } from '../../src/services/logger';
import { ProtocolsService } from '../../src/modules/protocols/protocols.service';
import { ProtocolOperationError } from '../../src/modules/protocols/protocols.errors';

describe('ProtocolsService', () => {
  const logger = getLogger('test-protocols-service');

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
  let service: ProtocolsService;

  beforeEach(() => {
    bitcoinClient = new BitcoinClient(bitcoinConfig, logger);
    lightningClient = new LightningClient(lightningConfig, logger);
    nostrClient = new NostrClient(nostrConfig, logger);
    cashuClient = new CashuClient(cashuConfig, logger);

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

  describe('Validation rejection on malformed input', () => {
    it('throws ValidationError for invalid bitcoin txid', async () => {
      await expect(service.fetchBitcoinTransaction('not-hex')).rejects.toBeInstanceOf(ValidationError);
      await expect(service.fetchBitcoinTransaction('abcd')).rejects.toBeInstanceOf(ValidationError);
      await expect(service.fetchBitcoinTransaction('00'.repeat(31))).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for invalid bitcoin address', async () => {
      await expect(service.fetchBitcoinAddress('invalid-address')).rejects.toBeInstanceOf(ValidationError);
      await expect(service.fetchBitcoinAddress('')).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for invalid lightning invoice', async () => {
      await expect(service.decodeLightningInvoice('invalid-prefix')).rejects.toBeInstanceOf(ValidationError);
      await expect(service.decodeLightningInvoice('')).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for invalid lightning payment hash', async () => {
      await expect(service.lookupLightningInvoice('short-hash')).rejects.toBeInstanceOf(ValidationError);
      await expect(service.lookupLightningInvoice('ZZ'.repeat(32))).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for invalid lightning list transactions limit', async () => {
      await expect(service.listLightningTransactions(0)).rejects.toBeInstanceOf(ValidationError);
      await expect(service.listLightningTransactions(51)).rejects.toBeInstanceOf(ValidationError);
      await expect(service.listLightningTransactions(-5)).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for invalid nostr eventId', async () => {
      await expect(service.fetchNostrEvent('short')).rejects.toBeInstanceOf(ValidationError);
      await expect(service.fetchNostrEvent('not-hex-id-too-long-or-invalid-symbols!!')).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for invalid nostr author pubkey or limit', async () => {
      await expect(service.fetchNostrEventsByAuthor('invalid-pubkey', 10)).rejects.toBeInstanceOf(ValidationError);
      await expect(service.fetchNostrEventsByAuthor('00'.repeat(32), 0)).rejects.toBeInstanceOf(ValidationError);
      await expect(service.fetchNostrEventsByAuthor('00'.repeat(32), 51)).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for invalid cashu mint url', async () => {
      await expect(service.fetchCashuMintInfo('not-a-url')).rejects.toBeInstanceOf(ValidationError);
      await expect(service.fetchCashuMintInfo('ftp://mint.example.com')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('Bitcoin error mappings', () => {
    const validTxid = '0000000000000000000000000000000000000000000000000000000000000001';
    const validAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

    it('maps BitcoinNotFoundError to NotFoundError in fetchBitcoinTransaction', async () => {
      jest.spyOn(bitcoinClient, 'getTransaction').mockRejectedValue(new BitcoinNotFoundError('tx not found', { txid: validTxid }));
      await expect(service.fetchBitcoinTransaction(validTxid)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('maps BitcoinNetworkError to NetworkError in fetchBitcoinTransaction', async () => {
      jest.spyOn(bitcoinClient, 'getTransaction').mockRejectedValue(new BitcoinNetworkError('esplora unreachable', { url: 'http://test' }));
      await expect(service.fetchBitcoinTransaction(validTxid)).rejects.toBeInstanceOf(NetworkError);
    });

    it('maps BitcoinParseError to ValidationError in fetchBitcoinTransaction', async () => {
      jest.spyOn(bitcoinClient, 'getTransaction').mockRejectedValue(new BitcoinParseError('malformed tx payload', { data: 'xyz' }));
      await expect(service.fetchBitcoinTransaction(validTxid)).rejects.toBeInstanceOf(ValidationError);
    });

    it('maps generic error to ProtocolOperationError in fetchBitcoinTransaction', async () => {
      jest.spyOn(bitcoinClient, 'getTransaction').mockRejectedValue(new Error('unknown bitcoin failure'));
      await expect(service.fetchBitcoinTransaction(validTxid)).rejects.toBeInstanceOf(ProtocolOperationError);
    });

    it('maps BitcoinNotFoundError to NotFoundError in fetchBitcoinAddress', async () => {
      jest.spyOn(bitcoinClient, 'getAddressInfo').mockRejectedValue(new BitcoinNotFoundError('address not found', { address: validAddress }));
      await expect(service.fetchBitcoinAddress(validAddress)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('maps BitcoinNetworkError to NetworkError in fetchBitcoinAddress', async () => {
      jest.spyOn(bitcoinClient, 'getAddressInfo').mockRejectedValue(new BitcoinNetworkError('network failure', { url: 'http://test' }));
      await expect(service.fetchBitcoinAddress(validAddress)).rejects.toBeInstanceOf(NetworkError);
    });

    it('maps BitcoinNetworkError to NetworkError in fetchBitcoinTip', async () => {
      jest.spyOn(bitcoinClient, 'getBlockTip').mockRejectedValue(new BitcoinNetworkError('tip fetch error', { url: 'http://test' }));
      await expect(service.fetchBitcoinTip()).rejects.toBeInstanceOf(NetworkError);
    });

    it('maps generic error to ProtocolOperationError in fetchBitcoinTip', async () => {
      jest.spyOn(bitcoinClient, 'getBlockTip').mockRejectedValue(new Error('tip generic failure'));
      await expect(service.fetchBitcoinTip()).rejects.toBeInstanceOf(ProtocolOperationError);
    });
  });

  describe('Lightning error mappings', () => {
    const validInvoice = 'lnbc10n1p383000pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y7372';
    const validHash = '0000000000000000000000000000000000000000000000000000000000000002';

    it('maps LightningParseError to ValidationError in decodeLightningInvoice', async () => {
      jest.spyOn(Bolt11, 'decode').mockImplementation(() => {
        throw new LightningParseError('checksum mismatch', { invoice: validInvoice });
      });
      await expect(service.decodeLightningInvoice(validInvoice)).rejects.toBeInstanceOf(ValidationError);
    });

    it('maps generic error to ProtocolOperationError in decodeLightningInvoice', async () => {
      jest.spyOn(Bolt11, 'decode').mockImplementation(() => {
        throw new Error('generic decode failure');
      });
      await expect(service.decodeLightningInvoice(validInvoice)).rejects.toBeInstanceOf(ProtocolOperationError);
    });

    it('returns LightningInvoice with payeePubkey null when n tag is absent', async () => {
      const mockInvoice: LightningInvoice = {
        bolt11: validInvoice,
        paymentHash: validHash,
        preimage: null,
        amountMsat: 10000n,
        description: 'test invoice',
        descriptionHash: null,
        payeePubkey: null,
        timestamp: 1700000000,
        expiry: 3600,
        expiresAt: 1700003600
      };
      jest.spyOn(Bolt11, 'decode').mockReturnValue(mockInvoice);
      const res = await service.decodeLightningInvoice(validInvoice);
      expect(res.payeePubkey).toBeNull();
    });

    it('maps LightningInvoiceError (NOT_FOUND) to NotFoundError in lookupLightningInvoice', async () => {
      jest.spyOn(lightningClient, 'lookupInvoice').mockRejectedValue(new LightningInvoiceError('invoice not found', { code: 'NOT_FOUND', paymentHash: validHash }));
      await expect(service.lookupLightningInvoice(validHash)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('maps LightningTimeoutError to NetworkError with TIMEOUT reason in lookupLightningInvoice', async () => {
      jest.spyOn(lightningClient, 'lookupInvoice').mockRejectedValue(new LightningTimeoutError('nwc timeout', { timeoutMs: 5000 }));
      try {
        await service.lookupLightningInvoice(validHash);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).context).toMatchObject({
          protocol: 'lightning',
          operation: 'lookupLightningInvoice',
          reason: 'TIMEOUT'
        });
      }
    });

    it('maps generic error to ProtocolOperationError in lookupLightningInvoice', async () => {
      jest.spyOn(lightningClient, 'lookupInvoice').mockRejectedValue(new Error('lookup failed'));
      await expect(service.lookupLightningInvoice(validHash)).rejects.toBeInstanceOf(ProtocolOperationError);
    });

    it('maps LightningTimeoutError to NetworkError with TIMEOUT reason in listLightningTransactions', async () => {
      jest.spyOn(lightningClient, 'listTransactions').mockRejectedValue(new LightningTimeoutError('nwc list timeout', { timeoutMs: 5000 }));
      try {
        await service.listLightningTransactions(10);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).context).toMatchObject({
          protocol: 'lightning',
          operation: 'listLightningTransactions',
          reason: 'TIMEOUT'
        });
      }
    });

    it('maps generic error to ProtocolOperationError in listLightningTransactions', async () => {
      jest.spyOn(lightningClient, 'listTransactions').mockRejectedValue(new Error('list transactions generic failure'));
      await expect(service.listLightningTransactions(10)).rejects.toBeInstanceOf(ProtocolOperationError);
    });
  });

  describe('Nostr error mappings', () => {
    const validEventId = '0000000000000000000000000000000000000000000000000000000000000003';
    const validPubkey = '0000000000000000000000000000000000000000000000000000000000000004';

    it('maps NostrConnectionError to NetworkError in fetchNostrEvent', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventById').mockRejectedValue(new NostrConnectionError('relay unreachable', { relay: 'wss://test' }));
      await expect(service.fetchNostrEvent(validEventId)).rejects.toBeInstanceOf(NetworkError);
    });

    it('maps NostrTimeoutError to NetworkError with TIMEOUT reason in fetchNostrEvent', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventById').mockRejectedValue(new NostrTimeoutError('relay query timed out', { timeoutMs: 3000 }));
      try {
        await service.fetchNostrEvent(validEventId);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).context).toMatchObject({
          protocol: 'nostr',
          operation: 'fetchNostrEvent',
          reason: 'TIMEOUT'
        });
      }
    });

    it('maps NostrParseError to ValidationError in fetchNostrEvent', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventById').mockRejectedValue(new NostrParseError('invalid event format', { data: 'invalid' }));
      await expect(service.fetchNostrEvent(validEventId)).rejects.toBeInstanceOf(ValidationError);
    });

    it('maps generic error to ProtocolOperationError in fetchNostrEvent', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventById').mockRejectedValue(new Error('unknown nostr error'));
      await expect(service.fetchNostrEvent(validEventId)).rejects.toBeInstanceOf(ProtocolOperationError);
    });

    it('maps NostrConnectionError to NetworkError in fetchNostrEventsByAuthor', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventsByAuthor').mockRejectedValue(new NostrConnectionError('relay down', { relay: 'wss://test' }));
      await expect(service.fetchNostrEventsByAuthor(validPubkey, 10)).rejects.toBeInstanceOf(NetworkError);
    });

    it('maps NostrTimeoutError to NetworkError with TIMEOUT reason in fetchNostrEventsByAuthor', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventsByAuthor').mockRejectedValue(new NostrTimeoutError('author query timeout', { timeoutMs: 4000 }));
      try {
        await service.fetchNostrEventsByAuthor(validPubkey, 10);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).context).toMatchObject({
          protocol: 'nostr',
          operation: 'fetchNostrEventsByAuthor',
          reason: 'TIMEOUT'
        });
      }
    });

    it('maps NostrParseError to ValidationError in fetchNostrEventsByAuthor', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventsByAuthor').mockRejectedValue(new NostrParseError('signature verification failed', { data: 'invalid' }));
      await expect(service.fetchNostrEventsByAuthor(validPubkey, 10)).rejects.toBeInstanceOf(ValidationError);
    });

    it('maps generic error to ProtocolOperationError in fetchNostrEventsByAuthor', async () => {
      jest.spyOn(nostrClient, 'connect').mockResolvedValue();
      jest.spyOn(nostrClient, 'fetchEventsByAuthor').mockRejectedValue(new Error('generic nostr failure'));
      await expect(service.fetchNostrEventsByAuthor(validPubkey, 10)).rejects.toBeInstanceOf(ProtocolOperationError);
    });
  });

  describe('Cashu error mappings', () => {
    const validUrl = 'https://testnut.cashu.space';

    it('maps CashuNetworkError to NetworkError in fetchCashuMintInfo', async () => {
      jest.spyOn(cashuClient, 'getMintInfo').mockRejectedValue(new CashuNetworkError('mint unreachable', { url: validUrl }));
      await expect(service.fetchCashuMintInfo(validUrl)).rejects.toBeInstanceOf(NetworkError);
    });

    it('maps CashuParseError to ValidationError in fetchCashuMintInfo', async () => {
      jest.spyOn(cashuClient, 'getMintInfo').mockRejectedValue(new CashuParseError('invalid info json', { data: 'bad' }));
      await expect(service.fetchCashuMintInfo(validUrl)).rejects.toBeInstanceOf(ValidationError);
    });

    it('maps generic error to ProtocolOperationError in fetchCashuMintInfo', async () => {
      jest.spyOn(cashuClient, 'getMintInfo').mockRejectedValue(new Error('generic mint failure'));
      await expect(service.fetchCashuMintInfo(validUrl)).rejects.toBeInstanceOf(ProtocolOperationError);
    });
  });

  describe('Logging privacy and hygiene', () => {
    const validTxid = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const validHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const validInvoice = 'lnbc10n1p383000pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y7372';

    it('does not log full txid at info level and truncates at debug level', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const debugSpy = jest.spyOn(logger, 'debug');

      const mockTx: BitcoinTransaction = {
        txid: validTxid,
        version: 1,
        locktime: 0,
        size: 200,
        weight: 800,
        fee: 1000n,
        inputs: [],
        outputs: [],
        status: { confirmed: true, blockHeight: 800000, blockHash: '00', blockTime: 1700000000 }
      };

      jest.spyOn(bitcoinClient, 'getTransaction').mockResolvedValue(mockTx);

      await service.fetchBitcoinTransaction(validTxid);

      for (const call of infoSpy.mock.calls) {
        const str = JSON.stringify(call);
        expect(str.includes(validTxid)).toBe(false);
      }

      const debugCalls = debugSpy.mock.calls.map((call) => JSON.stringify(call)).join(' ');
      const expectedTruncated = 'abcdef01…23456789';
      expect(debugCalls.includes(expectedTruncated)).toBe(true);
    });

    it('does not log raw invoice at info level', async () => {
      const infoSpy = jest.spyOn(logger, 'info');

      const mockInvoice: LightningInvoice = {
        bolt11: validInvoice,
        paymentHash: validHash,
        preimage: null,
        amountMsat: 10000n,
        description: 'test invoice',
        descriptionHash: null,
        payeePubkey: null,
        timestamp: 1700000000,
        expiry: 3600,
        expiresAt: 1700003600
      };

      jest.spyOn(Bolt11, 'decode').mockReturnValue(mockInvoice);

      await service.decodeLightningInvoice(validInvoice);

      for (const call of infoSpy.mock.calls) {
        const str = JSON.stringify(call);
        expect(str.includes(validInvoice)).toBe(false);
      }
    });

    it('does not log full payment hash or amount at info level in lookup', async () => {
      const infoSpy = jest.spyOn(logger, 'info');

      const mockPayment: LightningPayment = {
        paymentHash: validHash,
        preimage: 'preimage123',
        amountMsat: 50000n,
        feeMsat: 100n,
        status: 'succeeded',
        createdAt: 1700000000,
        description: 'test payment'
      };

      jest.spyOn(lightningClient, 'lookupInvoice').mockResolvedValue(mockPayment);

      await service.lookupLightningInvoice(validHash);

      for (const call of infoSpy.mock.calls) {
        const str = JSON.stringify(call);
        expect(str.includes(validHash)).toBe(false);
        expect(str.includes('preimage123')).toBe(false);
        expect(str.includes('50000')).toBe(false);
      }
    });
  });

  describe('fetchBalance', () => {
    const validBitcoinAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    const sampleTokenString = 'cashuAeyJ0b2tlbiI6W3siaWQiOiJtMSIsImFtb3VudCI6MTAwLCJzZWNyZXQiOiJzMSIsIkMiOiJjMSJ9XX0=';

    it('throws ValidationError when network is invalid', async () => {
      await expect(service.fetchBalance({ network: 'invalid-network' as unknown as 'mainnet' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when bitcoinAddress prefix is invalid', async () => {
      await expect(service.fetchBalance({ network: 'testnet', bitcoinAddress: 'invalid-prefix-addr' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when cashuToken is empty', async () => {
      await expect(service.fetchBalance({ network: 'testnet', cashuToken: '' })).rejects.toBeInstanceOf(ValidationError);
      await expect(service.fetchBalance({ network: 'testnet', cashuToken: '   ' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('returns connected false, balanceSats null, and error NOT_CONFIGURED when bitcoinAddress is omitted', async () => {
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 5000000n });
      const result = await service.fetchBalance({ network: 'mainnet' });
      expect(result.bitcoin).toEqual({ connected: false, balanceSats: null, error: 'NOT_CONFIGURED' });
    });

    it('sums utxos and returns connected true when bitcoinAddress is provided', async () => {
      const mockUtxos: Utxo[] = [
        {
          txid: '0000000000000000000000000000000000000000000000000000000000000001',
          vout: 0,
          value: 15000n,
          status: { confirmed: true, blockHeight: 800000, blockTime: 1700000000 }
        },
        {
          txid: '0000000000000000000000000000000000000000000000000000000000000002',
          vout: 1,
          value: 35000n,
          status: { confirmed: true, blockHeight: 800001, blockTime: 1700000100 }
        }
      ];
      jest.spyOn(bitcoinClient, 'getUtxos').mockResolvedValue(mockUtxos);
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 0n });

      const result = await service.fetchBalance({ network: 'mainnet', bitcoinAddress: validBitcoinAddress });
      expect(result.bitcoin).toEqual({ connected: true, balanceSats: '50000', error: null });
    });

    it('returns NETWORK_ERROR when bitcoinClient throws BitcoinNetworkError', async () => {
      jest.spyOn(bitcoinClient, 'getUtxos').mockRejectedValue(new BitcoinNetworkError('esplora unreachable', { url: 'http://test' }));
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 0n });
      const result = await service.fetchBalance({ network: 'mainnet', bitcoinAddress: validBitcoinAddress });
      expect(result.bitcoin).toEqual({ connected: true, balanceSats: null, error: 'NETWORK_ERROR' });
    });

    it('returns NETWORK_ERROR when bitcoinClient throws BitcoinInvalidResponseError', async () => {
      jest.spyOn(bitcoinClient, 'getUtxos').mockRejectedValue(new BitcoinInvalidResponseError('invalid json', { body: 'xyz' }));
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 0n });
      const result = await service.fetchBalance({ network: 'mainnet', bitcoinAddress: validBitcoinAddress });
      expect(result.bitcoin).toEqual({ connected: true, balanceSats: null, error: 'NETWORK_ERROR' });
    });

    it('returns connected true and error null when bitcoinClient throws BitcoinNotFoundError', async () => {
      jest.spyOn(bitcoinClient, 'getUtxos').mockRejectedValue(new BitcoinNotFoundError('address not found', { address: validBitcoinAddress }));
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 0n });
      const result = await service.fetchBalance({ network: 'mainnet', bitcoinAddress: validBitcoinAddress });
      expect(result.bitcoin).toEqual({ connected: true, balanceSats: null, error: null });
    });

    it('returns connected false and balanceSats null when lightningClient is not configured', async () => {
      const unconfiguredLightningClient = new LightningClient(new LightningConfig({}), logger);
      const customService = new ProtocolsService({
        bitcoinClient,
        lightningClient: unconfiguredLightningClient,
        nostrClient,
        cashuClient
      }, logger);

      const result = await customService.fetchBalance({ network: 'mainnet' });
      expect(result.lightning).toEqual({ connected: false, balanceSats: null, error: 'NOT_CONFIGURED' });
    });

    it('returns converted balance in sats when lightningClient is configured and returns balanceMsat', async () => {
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 75000000n });
      const result = await service.fetchBalance({ network: 'mainnet' });
      expect(result.lightning).toEqual({ connected: true, balanceSats: '75000', error: null });
    });

    it('returns connected true and balanceSats null when wallet does not support get_balance', async () => {
      jest.spyOn(lightningClient, 'getBalance').mockRejectedValue(
        new LightningInvoiceError('Method not supported by wallet', { method: 'get_balance', code: 'NOT_IMPLEMENTED', reason: 'Method not supported' })
      );
      const result = await service.fetchBalance({ network: 'mainnet' });
      expect(result.lightning).toEqual({ connected: true, balanceSats: null, error: 'UNSUPPORTED' });
    });

    it('returns TIMEOUT when lightningClient times out', async () => {
      jest.spyOn(lightningClient, 'getBalance').mockRejectedValue(
        new LightningTimeoutError('NWC request get_balance timed out after 5000ms', { method: 'get_balance', timeoutMs: 5000 })
      );
      const result = await service.fetchBalance({ network: 'mainnet' });
      expect(result.lightning).toEqual({ connected: true, balanceSats: null, error: 'TIMEOUT' });
    });

    it('returns connected false and balanceSats null when cashuToken is omitted', async () => {
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 1000n });
      const result = await service.fetchBalance({ network: 'mainnet' });
      expect(result.cashu).toEqual({ connected: false, balanceSats: null, error: 'NOT_CONFIGURED' });
    });

    it('sums proof amounts and returns connected true when cashuToken is provided', async () => {
      const mockCashuToken: CashuToken = {
        mint: 'https://mint.example.com',
        unit: 'sat',
        memo: null,
        proofs: [
          { id: '001', amount: 21n, secret: 'sec1', C: 'c1', witness: null },
          { id: '001', amount: 42n, secret: 'sec2', C: 'c2', witness: null }
        ]
      };
      jest.spyOn(CashuTokenCodec, 'decode').mockReturnValue(mockCashuToken);
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 0n });

      const result = await service.fetchBalance({ network: 'mainnet', cashuToken: sampleTokenString });
      expect(result.cashu).toEqual({ connected: true, balanceSats: '63', error: null });
    });

    it('returns NETWORK_ERROR when CashuTokenCodec.decode throws CashuParseError', async () => {
      jest.spyOn(CashuTokenCodec, 'decode').mockImplementation(() => {
        throw new CashuParseError('corrupted token', { input: sampleTokenString, reason: 'parse error' });
      });
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 0n });
      const result = await service.fetchBalance({ network: 'mainnet', cashuToken: sampleTokenString });
      expect(result.cashu).toEqual({ connected: true, balanceSats: null, error: 'NETWORK_ERROR' });
    });

    it('returns NETWORK_ERROR when CashuTokenCodec.decode throws CashuTokenError', async () => {
      jest.spyOn(CashuTokenCodec, 'decode').mockImplementation(() => {
        throw new CashuTokenError('invalid token structure', { reason: 'empty proofs' });
      });
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 0n });
      const result = await service.fetchBalance({ network: 'mainnet', cashuToken: sampleTokenString });
      expect(result.cashu).toEqual({ connected: true, balanceSats: null, error: 'NETWORK_ERROR' });
    });

    it('returns all balances on happy path with all protocols provided', async () => {
      const mockUtxos: Utxo[] = [
        {
          txid: '0000000000000000000000000000000000000000000000000000000000000001',
          vout: 0,
          value: 100000n,
          status: { confirmed: true, blockHeight: 800000, blockTime: 1700000000 }
        }
      ];
      const mockCashuToken: CashuToken = {
        mint: 'https://mint.example.com',
        unit: 'sat',
        memo: null,
        proofs: [
          { id: '001', amount: 500n, secret: 's1', C: 'c1', witness: null }
        ]
      };
      jest.spyOn(bitcoinClient, 'getUtxos').mockResolvedValue(mockUtxos);
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 250000n });
      jest.spyOn(CashuTokenCodec, 'decode').mockReturnValue(mockCashuToken);

      const result = await service.fetchBalance({
        network: 'signet',
        bitcoinAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        cashuToken: sampleTokenString
      });

      expect(result).toEqual({
        bitcoin: { connected: true, balanceSats: '100000', error: null },
        lightning: { connected: true, balanceSats: '250', error: null },
        cashu: { connected: true, balanceSats: '500', error: null }
      });
    });

    it('logs one debug line per protocol with protocol, connected, durationMs and does not log address, token or balance at info level', async () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      const infoSpy = jest.spyOn(logger, 'info');

      const mockUtxos: Utxo[] = [
        {
          txid: '0000000000000000000000000000000000000000000000000000000000000001',
          vout: 0,
          value: 12345n,
          status: { confirmed: true, blockHeight: 800000, blockTime: 1700000000 }
        }
      ];
      const mockCashuToken: CashuToken = {
        mint: 'https://mint.example.com',
        unit: 'sat',
        memo: null,
        proofs: [
          { id: '001', amount: 6789n, secret: 's1', C: 'c1', witness: null }
        ]
      };
      jest.spyOn(bitcoinClient, 'getUtxos').mockResolvedValue(mockUtxos);
      jest.spyOn(lightningClient, 'getBalance').mockResolvedValue({ balanceMsat: 5000000n });
      jest.spyOn(CashuTokenCodec, 'decode').mockReturnValue(mockCashuToken);

      const secretAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
      const secretToken = sampleTokenString;

      debugSpy.mockClear();
      infoSpy.mockClear();

      const result = await service.getBalance({
        network: 'mainnet',
        bitcoinAddress: secretAddress,
        cashuToken: secretToken
      });

      expect(result.bitcoin).toEqual({ connected: true, balanceSats: '12345', error: null });
      expect(result.lightning).toEqual({ connected: true, balanceSats: '5000', error: null });
      expect(result.cashu).toEqual({ connected: true, balanceSats: '6789', error: null });

      const debugContexts = debugSpy.mock.calls.map((call) => call[1] as Record<string, unknown>);
      const bitcoinLog = debugContexts.find((ctx) => ctx && ctx['protocol'] === 'bitcoin' && 'connected' in ctx);
      const lightningLog = debugContexts.find((ctx) => ctx && ctx['protocol'] === 'lightning' && 'connected' in ctx);
      const cashuLog = debugContexts.find((ctx) => ctx && ctx['protocol'] === 'cashu' && 'connected' in ctx);

      expect(bitcoinLog).toMatchObject({ protocol: 'bitcoin', connected: true, durationMs: expect.any(Number) });
      expect(lightningLog).toMatchObject({ protocol: 'lightning', connected: true, durationMs: expect.any(Number) });
      expect(cashuLog).toMatchObject({ protocol: 'cashu', connected: true, durationMs: expect.any(Number) });

      for (const call of infoSpy.mock.calls) {
        const str = JSON.stringify(call);
        expect(str.includes(secretAddress)).toBe(false);
        expect(str.includes(secretToken)).toBe(false);
        expect(str.includes('12345')).toBe(false);
        expect(str.includes('5000')).toBe(false);
        expect(str.includes('6789')).toBe(false);
      }
    });
  });
});
