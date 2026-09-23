import type { KeplerLogger } from '@kepler/shared';
import {
  BitcoinClient,
  BitcoinConfig,
  BitcoinNotFoundError,
  BitcoinNetworkError,
  BitcoinInvalidResponseError,
  BitcoinParseError
} from '../../src';

class TestLogger implements KeplerLogger {
  public readonly debugLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly infoLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly warnLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly errorLogs: Array<{ message: string; error?: unknown; context?: Record<string, unknown> }> = [];
  public readonly fatalLogs: Array<{ message: string; error: unknown; context?: Record<string, unknown> }> = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.debugLogs.push({ message, context });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.infoLogs.push({ message, context });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.warnLogs.push({ message, context });
  }

  public error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.errorLogs.push({ message, error, context });
  }

  public fatal(message: string, error: unknown, context?: Record<string, unknown>): void {
    this.fatalLogs.push({ message, error, context });
  }
}

describe('BitcoinClient', () => {
  const originalFetch = global.fetch;
  let fetchHandler: (input: string | URL | Request) => Promise<Response>;
  let logger: TestLogger;
  let config: BitcoinConfig;
  let client: BitcoinClient;

  const primaryBaseUrl = 'https://primary.kepler.network/api';
  const fallbackBaseUrl = 'https://fallback.kepler.network/api';

  beforeEach(() => {
    logger = new TestLogger();
    config = new BitcoinConfig({
      primaryUrl: primaryBaseUrl,
      fallbackUrl: fallbackBaseUrl,
      network: 'mainnet'
    });
    client = new BitcoinClient(config, logger);

    global.fetch = jest.fn((input: string | URL | Request) => fetchHandler(input));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getTransaction', () => {
    const validTxid = 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16';

    const testTxPayload = {
      txid: validTxid,
      version: 1,
      locktime: 0,
      size: 275,
      weight: 1100,
      fee: 0,
      status: {
        confirmed: true,
        block_height: 170,
        block_hash: '00000000d1145790a8694403d4063f323d499e655c83426834d4ce2f8dd4a2ee',
        block_time: 1231731365
      },
      vin: [
        {
          txid: '0437cd7f8525ceed2324359c2d0ba26006d92d856a9c20fa0241106ee5a597c9',
          vout: 0,
          prevout: {
            scriptpubkey: '76a914ac443be7989b96b95898b517954bdcee2b928baf88ac',
            scriptpubkey_address: '1Ghrxydn3ZySX391RmSZVpqG4haQqdEoM5',
            value: 5000000000
          },
          scriptsig: '483045022100...',
          sequence: 4294967295,
          witness: []
        }
      ],
      vout: [
        {
          scriptpubkey: '76a914ac443be7989b96b95898b517954bdcee2b928baf88ac',
          scriptpubkey_address: '1Ghrxydn3ZySX391RmSZVpqG4haQqdEoM5',
          value: 1000000000
        },
        {
          scriptpubkey: '76a91418aefbf6d67d65595bb8a7337e816c3e7434b1e088ac',
          scriptpubkey_address: '13FvP5oD8x7...',
          value: 4000000000
        }
      ]
    };

    it('rejects invalid txid string before network call', async () => {
      fetchHandler = jest.fn();
      await expect(client.getTransaction('invalid_txid')).rejects.toThrow(BitcoinParseError);
      await expect(client.getTransaction(validTxid.toUpperCase())).rejects.toThrow(BitcoinParseError);
      await expect(client.getTransaction(`${validTxid}aa`)).rejects.toThrow(BitcoinParseError);
      expect(fetchHandler).not.toHaveBeenCalled();
    });

    it('fetches successfully from primary endpoint', async () => {
      fetchHandler = async (url) => {
        expect(String(url)).toBe(`${primaryBaseUrl}/tx/${validTxid}`);
        return new Response(JSON.stringify(testTxPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const tx = await client.getTransaction(validTxid);
      expect(tx.txid).toBe(validTxid);
      expect(tx.fee).toBe(0n);
      expect(tx.status.confirmed).toBe(true);
      expect(tx.inputs[0]?.prevout?.value).toBe(5000000000n);
      expect(tx.outputs[0]?.value).toBe(1000000000n);
      expect(tx.outputs[1]?.value).toBe(4000000000n);

      expect(logger.debugLogs).toHaveLength(1);
      const log = logger.debugLogs[0];
      expect(log?.context?.['txid']).toBe(validTxid);
      expect(log?.context?.['source']).toBe('primary');
      expect(typeof log?.context?.['durationMs']).toBe('number');
    });

    it('primary 404 throws BitcoinNotFoundError immediately without attempting fallback', async () => {
      let callCount = 0;
      fetchHandler = async () => {
        callCount++;
        return new Response('Transaction not found', { status: 404 });
      };

      await expect(client.getTransaction(validTxid)).rejects.toThrow(BitcoinNotFoundError);
      expect(callCount).toBe(1);
      expect(logger.warnLogs).toHaveLength(0);
    });

    it('primary 4xx non-404 throws BitcoinNetworkError immediately without attempting fallback', async () => {
      let callCount = 0;
      fetchHandler = async (url) => {
        callCount++;
        expect(String(url)).toBe(`${primaryBaseUrl}/tx/${validTxid}`);
        return new Response('Bad Request', { status: 400 });
      };

      await expect(client.getTransaction(validTxid)).rejects.toThrow(BitcoinNetworkError);
      expect(callCount).toBe(1);
      expect(logger.warnLogs).toHaveLength(0);
    });

    it('primary 2xx with invalid schema body throws BitcoinInvalidResponseError immediately without attempting fallback', async () => {
      let callCount = 0;
      fetchHandler = async (url) => {
        callCount++;
        expect(String(url)).toBe(`${primaryBaseUrl}/tx/${validTxid}`);
        return new Response(JSON.stringify({ txid: validTxid, invalid: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await expect(client.getTransaction(validTxid)).rejects.toThrow(BitcoinInvalidResponseError);
      expect(callCount).toBe(1);
      expect(logger.warnLogs).toHaveLength(0);
    });

    it('primary transport error attempts fallback and succeeds on valid fallback response', async () => {
      let primaryCalls = 0;
      let fallbackCalls = 0;
      fetchHandler = async (url) => {
        if (String(url).startsWith(primaryBaseUrl)) {
          primaryCalls++;
          throw new TypeError('Failed to fetch');
        }
        fallbackCalls++;
        return new Response(JSON.stringify(testTxPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const tx = await client.getTransaction(validTxid);
      expect(tx.txid).toBe(validTxid);
      expect(primaryCalls).toBe(1);
      expect(fallbackCalls).toBe(1);
      expect(logger.warnLogs).toHaveLength(1);
      expect(logger.warnLogs[0]?.context?.['txid']).toBe(validTxid);
      expect(logger.debugLogs).toHaveLength(1);
      expect(logger.debugLogs[0]?.context?.['source']).toBe('fallback');
    });

    it('primary 5xx attempts fallback and succeeds on valid fallback response', async () => {
      let primaryCalls = 0;
      let fallbackCalls = 0;
      fetchHandler = async (url) => {
        if (String(url).startsWith(primaryBaseUrl)) {
          primaryCalls++;
          return new Response('Internal Server Error', { status: 500 });
        }
        fallbackCalls++;
        return new Response(JSON.stringify(testTxPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const tx = await client.getTransaction(validTxid);
      expect(tx.txid).toBe(validTxid);
      expect(primaryCalls).toBe(1);
      expect(fallbackCalls).toBe(1);
      expect(logger.warnLogs).toHaveLength(1);
      expect(logger.warnLogs[0]?.context?.['txid']).toBe(validTxid);
      expect(logger.warnLogs[0]?.context?.['primaryError']).toBeDefined();
      expect(logger.debugLogs).toHaveLength(1);
      expect(logger.debugLogs[0]?.context?.['source']).toBe('fallback');
    });

    it('primary 5xx or transport error attempts fallback and throws BitcoinNetworkError wrapping both errors when fallback fails', async () => {
      let primaryCalls = 0;
      let fallbackCalls = 0;
      fetchHandler = async (url) => {
        if (String(url).startsWith(primaryBaseUrl)) {
          primaryCalls++;
          return new Response('Service Unavailable', { status: 503 });
        }
        fallbackCalls++;
        return new Response('Bad Gateway', { status: 502 });
      };

      await expect(client.getTransaction(validTxid)).rejects.toThrow(BitcoinNetworkError);
      expect(primaryCalls).toBe(1);
      expect(fallbackCalls).toBe(1);
      expect(logger.warnLogs).toHaveLength(1);
      expect(logger.errorLogs).toHaveLength(1);
      const errorLog = logger.errorLogs[0];
      expect(errorLog?.context?.['txid']).toBe(validTxid);
      expect(errorLog?.context?.['primaryError']).toBeDefined();
      expect(errorLog?.context?.['fallbackError']).toBeDefined();
    });

    it('throws BitcoinInvalidResponseError on negative output amount', async () => {
      const invalidAmountsPayload = {
        ...testTxPayload,
        vout: [
          {
            scriptpubkey: '76a914ac443be7989b96b95898b517954bdcee2b928baf88ac',
            value: -100
          }
        ]
      };

      fetchHandler = async () => {
        return new Response(JSON.stringify(invalidAmountsPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      await expect(client.getTransaction(validTxid)).rejects.toThrow(BitcoinInvalidResponseError);
    });
  });

  describe('getAddressInfo', () => {
    const validAddress = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

    const testAddressPayload = {
      address: validAddress,
      chain_stats: {
        funded_txo_count: 5,
        funded_txo_sum: 5000000000,
        spent_txo_count: 3,
        spent_txo_sum: 3000000000
      },
      mempool_stats: {
        funded_txo_count: 1,
        funded_txo_sum: 100000000,
        spent_txo_count: 0,
        spent_txo_sum: 0
      }
    };

    it('rejects invalid address string before network call', async () => {
      fetchHandler = jest.fn();
      await expect(client.getAddressInfo('eth1invalidaddress')).rejects.toThrow(BitcoinParseError);
      await expect(client.getAddressInfo('0x123456789abcdef')).rejects.toThrow(BitcoinParseError);
      expect(fetchHandler).not.toHaveBeenCalled();
    });

    it('fetches address info successfully from primary endpoint', async () => {
      fetchHandler = async (url) => {
        expect(String(url)).toBe(`${primaryBaseUrl}/address/${validAddress}`);
        return new Response(JSON.stringify(testAddressPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const info = await client.getAddressInfo(validAddress);
      expect(info.address).toBe(validAddress);
      expect(info.chainStats.fundedTxoCount).toBe(5);
      expect(info.chainStats.fundedTxoSum).toBe(5000000000n);
      expect(info.chainStats.spentTxoSum).toBe(3000000000n);
      expect(info.mempoolStats.fundedTxoSum).toBe(100000000n);

      expect(logger.debugLogs).toHaveLength(1);
      expect(logger.debugLogs[0]?.context?.['address']).toBe(validAddress);
      expect(logger.debugLogs[0]?.context?.['source']).toBe('primary');
    });

    it('throws BitcoinNotFoundError immediately on 404', async () => {
      fetchHandler = async () => {
        return new Response('Address not found', { status: 404 });
      };

      await expect(client.getAddressInfo(validAddress)).rejects.toThrow(BitcoinNotFoundError);
    });
  });

  describe('getBlockTip', () => {
    const testBlocks = [
      {
        id: '0000000000000000000320283a032748acf82278b65747026f4948b869b900f2',
        height: 840000,
        timestamp: 1713571767
      }
    ];

    it('fetches tip block successfully', async () => {
      fetchHandler = async (url) => {
        expect(String(url)).toBe(`${primaryBaseUrl}/blocks`);
        return new Response(JSON.stringify(testBlocks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const tip = await client.getBlockTip();
      expect(tip.height).toBe(840000);
      expect(tip.hash).toBe('0000000000000000000320283a032748acf82278b65747026f4948b869b900f2');
      expect(tip.timestamp).toBe(1713571767);

      expect(logger.debugLogs).toHaveLength(1);
      expect(logger.debugLogs[0]?.context?.['source']).toBe('primary');
    });

    it('handles fallback for block tip on 500', async () => {
      fetchHandler = async (url) => {
        if (String(url).startsWith(primaryBaseUrl)) {
          return new Response('Bad Gateway', { status: 502 });
        }
        return new Response(JSON.stringify(testBlocks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const tip = await client.getBlockTip();
      expect(tip.height).toBe(840000);
      expect(logger.warnLogs).toHaveLength(1);
      expect(logger.debugLogs).toHaveLength(1);
      expect(logger.debugLogs[0]?.context?.['source']).toBe('fallback');
    });
  });

  describe('parseOutputScript', () => {
    it('recognizes p2pkh script and generates base58 address', () => {
      const script = '76a914ac443be7989b96b95898b517954bdcee2b928baf88ac';
      const parsed = client.parseOutputScript(script);
      expect(parsed.type).toBe('p2pkh');
      expect(parsed.address).toBe('1Ghrxydn3ZySX391RmSZVpqG4haQqdEoM5');
    });

    it('recognizes p2sh script and generates base58 address', () => {
      const script = 'a9148434dc45527945316b1c8253871490f713dd137987';
      const parsed = client.parseOutputScript(script);
      expect(parsed.type).toBe('p2sh');
      expect(parsed.address).toBe('3Dk4SfxyECgwipro3Xq7WQ48RqmrobhX75');
    });

    it('recognizes p2wpkh script and generates bech32 address', () => {
      const script = '00146ffe291ac4b12dedef7a29ff385eb1f1cd2d292b';
      const parsed = client.parseOutputScript(script);
      expect(parsed.type).toBe('p2wpkh');
      expect(parsed.address).toBe('bc1qdllzjxkykyk7mmm698lnsh4378xj62fthqex3q');
    });

    it('recognizes p2wsh script and generates bech32 address', () => {
      const script = '002079be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
      const parsed = client.parseOutputScript(script);
      expect(parsed.type).toBe('p2wsh');
      expect(parsed.address).toBe('bc1q0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqgp5m2n');
    });

    it('recognizes p2tr script and generates bech32m address', () => {
      const script = '512079be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
      const parsed = client.parseOutputScript(script);
      expect(parsed.type).toBe('p2tr');
      expect(parsed.address).toBe('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0');
    });

    it('recognizes op_return script and returns null address', () => {
      const script = '6a146b65706c6572207461696e742065766964656e63';
      const parsed = client.parseOutputScript(script);
      expect(parsed.type).toBe('op_return');
      expect(parsed.address).toBeNull();
    });

    it('returns unknown type for unrecognized scripts', () => {
      const script = '522102...';
      const parsed = client.parseOutputScript(script);
      expect(parsed.type).toBe('unknown');
      expect(parsed.address).toBeNull();
    });

    it('derives testnet address when configured for testnet', () => {
      const testnetConfig = new BitcoinConfig({
        primaryUrl: primaryBaseUrl,
        fallbackUrl: fallbackBaseUrl,
        network: 'testnet'
      });
      const testnetClient = new BitcoinClient(testnetConfig, logger);

      const p2wpkh = '00146ffe291ac4b12dedef7a29ff385eb1f1cd2d292b';
      const parsed = testnetClient.parseOutputScript(p2wpkh);
      expect(parsed.type).toBe('p2wpkh');
      expect(parsed.address?.startsWith('tb1')).toBe(true);

      const p2pkh = '76a914ac443be7989b96b95898b517954bdcee2b928baf88ac';
      const parsedP2pkh = testnetClient.parseOutputScript(p2pkh);
      expect(parsedP2pkh.type).toBe('p2pkh');
      expect(parsedP2pkh.address?.startsWith('m') || parsedP2pkh.address?.startsWith('n')).toBe(true);
    });

    it('derives regtest address when configured for regtest', () => {
      const regtestConfig = new BitcoinConfig({
        primaryUrl: primaryBaseUrl,
        fallbackUrl: fallbackBaseUrl,
        network: 'regtest'
      });
      const regtestClient = new BitcoinClient(regtestConfig, logger);

      const p2wpkh = '00146ffe291ac4b12dedef7a29ff385eb1f1cd2d292b';
      const parsed = regtestClient.parseOutputScript(p2wpkh);
      expect(parsed.type).toBe('p2wpkh');
      expect(parsed.address?.startsWith('bcrt1')).toBe(true);
    });
  });

  describe('parseTxHex', () => {
    const satoshiTxHex =
      '0100000001c997a5e56e104102fa209c6a852dd90660a20b2d9c352423edce25857fcd3704000000004847304402204e45e16932b8af514961a1d3a1a25fdf3f4f7732e9d624c6c61548ab5fb8cd410220181522ec8eca07de4860a4acdd12909d831cc56cbbac4622082221a8768d1d0901ffffffff0200ca9a3b00000000434104ae1a62fe09c5f51b13905f07f06b99a2f7159b2225f374cd378d71302fa28414e7aab37397f554a7df5f142c21c1b7303b8a0626f1baded5c72a704f7e6cd84cac00286bee0000000043410411db93e1dcdb8a016b49840f8c53bc1eb68a382e97b1482ecad7b148a6909a5cb2e0eaddfb84ccf9744464f82e160bfa9b8b64f9d4c03f999b8643f656b412a3ac00000000';

    const segwitTxHex =
      '020000000001017ee0cb971f5e4bd8c815d1aae88700087ebfe6252ecf22ec3a8bd00d806009950000000000ffffffff074458c25c010000001600146ffe291ac4b12dedef7a29ff385eb1f1cd2d292b6caf0100000000001976a914ac443be7989b96b95898b517954bdcee2b928baf88ac19e26b00000000001976a91418aefbf6d67d65595bb8a7337e816c3e7434b1e088aca59a4b00000000001600147ad2b4f53c5c9278101363c3edf7be97fe06a9aaadaa26000000000017a9148434dc45527945316b1c8253871490f713dd13798751081400000000001600144f8c2e78cbdc0846c0d00690b266c30d062b9029f21f0f00000000001976a914d3c8352cdc6c9b5b1d6b358b6aefe3fff97bcbd588ac0247304402203f1bb748fcebc2bfe37792f38830fa90f1426f526a482e4f91f2c4dc961f5f49022060077de35888968fcd3b81e5a18c9646cfe0302f9b4b5cbcb469ac8a64acfaf001210396b8a5b321e1e2bfe0739d5ea7a0215958b5b295f898aae400daba6f53ad01e600000000';

    it('decodes valid serialized legacy transaction with input and output counts and values', () => {
      const tx = client.parseTxHex(satoshiTxHex);
      expect(tx.txid).toBe('f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16');
      expect(tx.version).toBe(1);
      expect(tx.locktime).toBe(0);
      expect(tx.fee).toBeNull();
      expect(tx.status.confirmed).toBeNull();
      expect(tx.status.blockHeight).toBeNull();
      expect(tx.status.blockHash).toBeNull();
      expect(tx.status.blockTime).toBeNull();
      expect(tx.inputs).toHaveLength(1);
      expect(tx.inputs[0]?.txid).toBe('0437cd7f8525ceed2324359c2d0ba26006d92d856a9c20fa0241106ee5a597c9');
      expect(tx.inputs[0]?.vout).toBe(0);
      expect(tx.outputs).toHaveLength(2);
      expect(tx.outputs[0]?.value).toBe(1000000000n);
      expect(tx.outputs[1]?.value).toBe(4000000000n);
    });

    it('decodes valid segwit transaction and asserts witness data is parsed', () => {
      const tx = client.parseTxHex(segwitTxHex);
      expect(tx.txid).toBe('6df8283e072433688bbe55c2961ebf41dac34a95457f90114c6554b699213ae3');
      expect(tx.version).toBe(2);
      expect(tx.fee).toBeNull();
      expect(tx.status.confirmed).toBeNull();
      expect(tx.status.blockHeight).toBeNull();
      expect(tx.status.blockHash).toBeNull();
      expect(tx.status.blockTime).toBeNull();
      expect(tx.inputs).toHaveLength(1);
      expect(tx.inputs[0]?.witness).toHaveLength(2);
      expect(tx.inputs[0]?.witness[0]?.startsWith('30440220')).toBe(true);
      expect(tx.inputs[0]?.witness[1]?.startsWith('0396b8a5')).toBe(true);
      expect(tx.outputs).toHaveLength(7);
      expect(tx.outputs[0]?.value).toBe(5851207748n);
      expect(tx.outputs[0]?.scriptpubkeyAddress).toBe('bc1qdllzjxkykyk7mmm698lnsh4378xj62fthqex3q');
    });

    it('throws BitcoinParseError on truncated hex', () => {
      expect(() => client.parseTxHex('0100000001')).toThrow(BitcoinParseError);
      expect(() => client.parseTxHex(satoshiTxHex.slice(0, 40))).toThrow(BitcoinParseError);
    });

    it('throws BitcoinParseError on hex with invalid witness marker', () => {
      const invalidMarkerSegwit = '02000000000201...';
      expect(() => client.parseTxHex(invalidMarkerSegwit)).toThrow(BitcoinParseError);
    });

    it('throws BitcoinParseError on malformed hex input', () => {
      expect(() => client.parseTxHex('')).toThrow(BitcoinParseError);
      expect(() => client.parseTxHex('010')).toThrow(BitcoinParseError);
      expect(() => client.parseTxHex('not-hex-data')).toThrow(BitcoinParseError);
    });

    it('throws BitcoinParseError on trailing bytes', () => {
      expect(() => client.parseTxHex(`${satoshiTxHex}00`)).toThrow(BitcoinParseError);
    });
  });
});
