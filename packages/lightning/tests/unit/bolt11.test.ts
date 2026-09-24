import { Bolt11, LightningParseError } from '../../src';

describe('Bolt11 Parser', () => {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  function polymod(values: readonly number[]): number {
    let chk = 1;
    for (const val of values) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ val;
      if ((top >> 0) & 1) chk ^= 0x3b6a57b2;
      if ((top >> 1) & 1) chk ^= 0x26508e6d;
      if ((top >> 2) & 1) chk ^= 0x1ea119fa;
      if ((top >> 3) & 1) chk ^= 0x3d4233dd;
      if ((top >> 4) & 1) chk ^= 0x2a1462b3;
    }
    return chk;
  }

  function hrpExpand(hrp: string): number[] {
    const ret: number[] = [];
    for (let i = 0; i < hrp.length; i++) {
      ret.push(hrp.charCodeAt(i) >> 5);
    }
    ret.push(0);
    for (let i = 0; i < hrp.length; i++) {
      ret.push(hrp.charCodeAt(i) & 31);
    }
    return ret;
  }

  function convertBits(data: readonly number[], fromBits: number, toBits: number, pad: boolean): number[] | null {
    let acc = 0;
    let bits = 0;
    const ret: number[] = [];
    const maxv = (1 << toBits) - 1;
    for (const value of data) {
      if (value < 0 || (value >> fromBits) !== 0) {
        return null;
      }
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        ret.push((acc >> bits) & maxv);
      }
    }
    if (pad) {
      if (bits > 0) {
        ret.push((acc << (toBits - bits)) & maxv);
      }
    } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
      return null;
    }
    return ret;
  }

  function generateInvoice(
    hrp: string,
    timestamp: number,
    tags: Array<{ type: string; dataWords: number[] }>,
    sigHex?: string
  ): string {
    const words: number[] = [];
    for (let i = 6; i >= 0; i--) {
      words.unshift((timestamp >> (5 * (6 - i))) & 31);
    }

    for (const tag of tags) {
      const tagWord = CHARSET.indexOf(tag.type);
      words.push(tagWord);
      const len = tag.dataWords.length;
      words.push((len >> 5) & 31);
      words.push(len & 31);
      words.push(...tag.dataWords);
    }

    const sigBytes = Buffer.from(sigHex || '00'.repeat(65), 'hex');
    const sigWords = convertBits(Array.from(sigBytes), 8, 5, true)!;
    words.push(...sigWords);

    const mod = polymod([...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
    const checkWords: number[] = [];
    for (let p = 0; p < 6; p++) {
      checkWords.push((mod >> (5 * (5 - p))) & 31);
    }
    words.push(...checkWords);

    let bech32 = `${hrp}1`;
    for (const w of words) {
      bech32 += CHARSET[w];
    }
    return bech32;
  }

  const officialInvoice =
    'lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y7372';

  describe('decode official test vector', () => {
    it('decodes the official BOLT11 invoice correctly', () => {
      const decoded = Bolt11.decode(officialInvoice);

      expect(decoded.bolt11).toBe(officialInvoice);
      expect(decoded.amountMsat).toBe(2500000000n);
      expect(decoded.timestamp).toBe(1496314658);
      expect(decoded.paymentHash).toBe('0001020304050607080900010203040506070809000102030405060708090102');
      expect(decoded.description).toBe('coffee beans');
      expect(decoded.descriptionHash).toBeNull();
      expect(decoded.expiry).toBe(3600);
      expect(decoded.expiresAt).toBe(1496314658 + 3600);
      expect(decoded.preimage).toBeNull();
      expect(decoded.payeePubkey).toBe('');
    });

    it('decodes uppercase invoice correctly', () => {
      const upper = officialInvoice.toUpperCase();
      const decoded = Bolt11.decode(upper);
      expect(decoded.amountMsat).toBe(2500000000n);
      expect(decoded.paymentHash).toBe('0001020304050607080900010203040506070809000102030405060708090102');
      expect(decoded.description).toBe('coffee beans');
    });

    it('decodes a valid mainnet invoice asserting every field', () => {
      const paymentHashHex = '0001020304050607080900010203040506070809000102030405060708090102';
      const payeePubkeyHex = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
      const pWords = convertBits(Array.from(Buffer.from(paymentHashHex, 'hex')), 8, 5, true)!;
      const nWords = convertBits(Array.from(Buffer.from(payeePubkeyHex, 'hex')), 8, 5, true)!;
      const dWords = convertBits(Array.from(Buffer.from('Mainnet coffee', 'utf-8')), 8, 5, true)!;
      const xWords: number[] = [3, 28];

      const invoice = generateInvoice('lnbc10m', 1700000000, [
        { type: 'p', dataWords: pWords },
        { type: 'd', dataWords: dWords },
        { type: 'n', dataWords: nWords },
        { type: 'x', dataWords: xWords }
      ]);

      const decoded = Bolt11.decode(invoice);
      expect(decoded.paymentHash).toBe(paymentHashHex);
      expect(typeof decoded.amountMsat === 'bigint').toBe(true);
      expect(decoded.amountMsat).toBe(1000000000n);
      expect(decoded.description).toBe('Mainnet coffee');
      expect(decoded.payeePubkey).toBe(payeePubkeyHex);
      expect(decoded.timestamp).toBe(1700000000);
      expect(decoded.expiry).toBe(124);
      expect(decoded.expiresAt).toBe(1700000124);
    });

    it('decodes a valid testnet invoice with network-specific HRP handling', () => {
      const paymentHashHex = '0001020304050607080900010203040506070809000102030405060708090102';
      const pWords = convertBits(Array.from(Buffer.from(paymentHashHex, 'hex')), 8, 5, true)!;
      const invoice = generateInvoice('lntb20u', 1700000000, [{ type: 'p', dataWords: pWords }]);

      const decoded = Bolt11.decode(invoice);
      expect(decoded.bolt11.startsWith('lntb')).toBe(true);
      expect(decoded.amountMsat).toBe(2000000n);
      expect(decoded.paymentHash).toBe(paymentHashHex);
    });
  });

  describe('tagged fields parsing', () => {
    const paymentHashHex = '1122334455667788990011223344556677889900112233445566778899001122';
    const payeePubkeyHex = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
    const descriptionHashHex = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';

    const pWords = convertBits(Array.from(Buffer.from(paymentHashHex, 'hex')), 8, 5, true)!;
    const nWords = convertBits(Array.from(Buffer.from(payeePubkeyHex, 'hex')), 8, 5, true)!;
    const hWords = convertBits(Array.from(Buffer.from(descriptionHashHex, 'hex')), 8, 5, true)!;
    const dWords = convertBits(Array.from(Buffer.from('Kepler Test', 'utf-8')), 8, 5, true)!;

    it('parses custom expiry tag x', () => {
      let exp = 7200;
      const xWords: number[] = [];
      while (exp > 0) {
        xWords.unshift(exp & 31);
        exp = Math.floor(exp / 32);
      }

      const invoice = generateInvoice('lnbc10u', 1700000000, [
        { type: 'p', dataWords: pWords },
        { type: 'x', dataWords: xWords }
      ]);

      const decoded = Bolt11.decode(invoice);
      expect(decoded.expiry).toBe(7200);
      expect(decoded.expiresAt).toBe(1700007200);
      expect(decoded.amountMsat).toBe(1000000n);
      expect(decoded.paymentHash).toBe(paymentHashHex);
    });

    it('parses payee pubkey tag n', () => {
      const invoice = generateInvoice('lntb50n', 1700000000, [
        { type: 'p', dataWords: pWords },
        { type: 'n', dataWords: nWords }
      ]);

      const decoded = Bolt11.decode(invoice);
      expect(decoded.payeePubkey).toBe(payeePubkeyHex);
      expect(decoded.amountMsat).toBe(5000n);
    });

    it('parses description hash tag h', () => {
      const invoice = generateInvoice('lnbcrt1m', 1700000000, [
        { type: 'p', dataWords: pWords },
        { type: 'h', dataWords: hWords }
      ]);

      const decoded = Bolt11.decode(invoice);
      expect(decoded.descriptionHash).toBe(descriptionHashHex);
      expect(decoded.description).toBe('');
      expect(decoded.amountMsat).toBe(100000000n);
    });

    it('silently ignores c, s, 9, and unknown tags', () => {
      const invoice = generateInvoice('lnbc100n', 1700000000, [
        { type: 'p', dataWords: pWords },
        { type: 'd', dataWords: dWords },
        { type: 'c', dataWords: [1, 2] },
        { type: 's', dataWords: [3, 4, 5] },
        { type: '9', dataWords: [6] },
        { type: 'q', dataWords: [7, 8] }
      ]);

      const decoded = Bolt11.decode(invoice);
      expect(decoded.description).toBe('Kepler Test');
      expect(decoded.paymentHash).toBe(paymentHashHex);
    });
  });

  describe('amounts and multipliers', () => {
    const paymentHashHex = '1122334455667788990011223344556677889900112233445566778899001122';
    const pWords = convertBits(Array.from(Buffer.from(paymentHashHex, 'hex')), 8, 5, true)!;

    it('parses zero amount when amount is omitted in HRP', () => {
      const invoice = generateInvoice('lnbc', 1700000000, [{ type: 'p', dataWords: pWords }]);
      const decoded = Bolt11.decode(invoice);
      expect(decoded.amountMsat).toBe(0n);
    });

    it('parses zero amount when HRP is ln alone', () => {
      const invoice = generateInvoice('ln', 1700000000, [{ type: 'p', dataWords: pWords }]);
      const decoded = Bolt11.decode(invoice);
      expect(decoded.amountMsat).toBe(0n);
    });

    it('parses milli-BTC multiplier m', () => {
      const invoice = generateInvoice('lnbc5m', 1700000000, [{ type: 'p', dataWords: pWords }]);
      const decoded = Bolt11.decode(invoice);
      expect(decoded.amountMsat).toBe(500000000n);
    });

    it('parses micro-BTC multiplier u', () => {
      const invoice = generateInvoice('lnbc20u', 1700000000, [{ type: 'p', dataWords: pWords }]);
      const decoded = Bolt11.decode(invoice);
      expect(decoded.amountMsat).toBe(2000000n);
    });

    it('parses nano-BTC multiplier n', () => {
      const invoice = generateInvoice('lnbc100n', 1700000000, [{ type: 'p', dataWords: pWords }]);
      const decoded = Bolt11.decode(invoice);
      expect(decoded.amountMsat).toBe(10000n);
    });

    it('parses pico-BTC multiplier p ending in 0', () => {
      const invoice = generateInvoice('lnbc1000p', 1700000000, [{ type: 'p', dataWords: pWords }]);
      const decoded = Bolt11.decode(invoice);
      expect(decoded.amountMsat).toBe(100n);
    });

    it('parses whole BTC amount when multiplier is absent', () => {
      const invoice = generateInvoice('lnbc2', 1700000000, [{ type: 'p', dataWords: pWords }]);
      const decoded = Bolt11.decode(invoice);
      expect(decoded.amountMsat).toBe(200000000000n);
    });
  });

  describe('error handling', () => {
    it('throws LightningParseError for empty or whitespace string', () => {
      expect(() => Bolt11.decode('')).toThrow(LightningParseError);
      expect(() => Bolt11.decode('   ')).toThrow(LightningParseError);
    });

    it('throws LightningParseError for mixed case string', () => {
      const mixed = 'LNBC25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y7372';
      try {
        Bolt11.decode(mixed);
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningParseError);
        const parseErr = err as LightningParseError;
        expect(parseErr.code).toBe('LIGHTNING_PARSE_ERROR');
        expect(parseErr.context['reason']).toBeDefined();
      }
    });

    it('throws LightningParseError for missing separator 1', () => {
      expect(() => Bolt11.decode('lnbc25mqqqsyqcyq5rqwzqf')).toThrow(LightningParseError);
    });

    it('throws LightningParseError for unsupported HRP prefix', () => {
      expect(() => Bolt11.decode('lnxyz100n1pj48ugqpp5...')).toThrow(LightningParseError);
    });

    it('throws LightningParseError for invalid amount multiplier', () => {
      expect(() => Bolt11.decode('lnbc2500x1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpusp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgqrrzc4cvfue4zp3hggxp47ag7xnrlr8vgcmkjxk3j5jqethnumgkpqp23z9jclu3v0a7e0aruz366e9wqdykw6dxhdzcjjhldxq0w6wgqcnu43j')).toThrow(LightningParseError);
    });

    it('throws LightningParseError for invalid bech32 character', () => {
      expect(() => Bolt11.decode('lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y737b')).toThrow(LightningParseError);
    });

    it('throws LightningParseError for invalid checksum', () => {
      const corrupt = 'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpuyk0sg5g70me25alkluzd2x62aysf2pyy8edtjeevuv4p2d5p76r4zkmneet7uvyakky2zr4cusd45tftc9c5fh0nnqpnl2jfll544esqchsrnt';
      expect(() => Bolt11.decode(corrupt)).toThrow(LightningParseError);
    });

    it('throws LightningParseError on truncated bech32', () => {
      const truncated = officialInvoice.slice(0, 35);
      expect(() => Bolt11.decode(truncated)).toThrow(LightningParseError);
    });

    it('throws LightningParseError when required payment hash p tag is missing', () => {
      const invoice = generateInvoice('lnbc100n', 1700000000, [
        { type: 'd', dataWords: [1, 2, 3] }
      ]);
      expect(() => Bolt11.decode(invoice)).toThrow(LightningParseError);
    });

    it('throws LightningParseError for pico-bitcoin amount not ending in zero', () => {
      const paymentHashBytes = Buffer.from('aa'.repeat(32), 'hex');
      const pWords = convertBits(Array.from(paymentHashBytes), 8, 5, true)!;
      const invoice = generateInvoice('lnbc15p', 1700000000, [{ type: 'p', dataWords: pWords }]);
      expect(() => Bolt11.decode(invoice)).toThrow(LightningParseError);
    });

    it('throws LightningParseError for amount with leading zero', () => {
      const paymentHashBytes = Buffer.from('aa'.repeat(32), 'hex');
      const pWords = convertBits(Array.from(paymentHashBytes), 8, 5, true)!;
      const invoice = generateInvoice('lnbc05m', 1700000000, [{ type: 'p', dataWords: pWords }]);
      expect(() => Bolt11.decode(invoice)).toThrow(LightningParseError);
    });
  });
});
