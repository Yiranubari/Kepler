import {
  DeriveRequestSchema,
  DeriveResponseSchema,
  UtxosRequestSchema,
  UtxosResponseSchema,
  FeesRequestSchema,
  FeesResponseSchema,
  PsbtBuildRequestSchema,
  PsbtBuildResponseSchema,
  PsbtBroadcastRequestSchema,
  PsbtBroadcastResponseSchema,
  AmountSatsSchema,
  FeeRateSchema,
  CountSchema,
  PsbtStringSchema,
  XpubSchema,
  BitcoinAddressSchema
} from '../../src/modules/onchain/onchain.validators';

describe('Onchain Validators', () => {
  const validMainnetXpub = 'xpub661MyMwAqRbcEtUEgdXRTY6dJQG9fRgs7C5QomqETKMYBJVtSGpRqyHSmhWy8snovPd5oWZgQ14zUquxbxu7Z1umuXbN5VDpUL1QobD5xUY';
  const validTestnetTpub = 'tpubD6NzVbkrYhZ4Wgf68pWWfTRzdXMoepBvepfiAKtNoE7RvbAbWVfWzQxH1jbkfNk3iJ9zR65Yw6u3B2QZzpkMSTN4y8Lfm1t44HbpZX7efhZ';
  const validMainnetAddress = 'bc1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnhqxx8z';
  const validTestnetAddress = 'tb1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnaxa4u3';
  const validRegtestAddress = 'bcrt1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnl0yctc';
  const validBase64 = Buffer.from('test-psbt-data').toString('base64');
  const validTxid = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  describe('XpubSchema', () => {
    it('accepts valid mainnet xpub', () => {
      expect(XpubSchema.safeParse(validMainnetXpub).success).toBe(true);
    });

    it('accepts valid testnet tpub', () => {
      expect(XpubSchema.safeParse(validTestnetTpub).success).toBe(true);
    });

    it('rejects invalid xpub prefix', () => {
      const invalidPrefix = 'apub661MyMwAqRbcEtUEgdXRTY6dJQG9fRgs7C5QomqETKMYBJVtSGpRqyHSmhWy8snovPd5oWZgQ14zUquxbxu7Z1umuXbN5VDpUL1QobD5xUY';
      expect(XpubSchema.safeParse(invalidPrefix).success).toBe(false);
    });

    it('rejects xpub containing control characters', () => {
      const withControlChar = validMainnetXpub.slice(0, 10) + '\u0000' + validMainnetXpub.slice(11);
      expect(XpubSchema.safeParse(withControlChar).success).toBe(false);
    });

    it('rejects too short or too long key', () => {
      expect(XpubSchema.safeParse('xpub123').success).toBe(false);
      expect(XpubSchema.safeParse('xpub' + 'a'.repeat(200)).success).toBe(false);
    });
  });

  describe('BitcoinAddressSchema', () => {
    it('accepts valid mainnet bech32 address', () => {
      expect(BitcoinAddressSchema.safeParse(validMainnetAddress).success).toBe(true);
    });

    it('accepts valid testnet bech32 address', () => {
      expect(BitcoinAddressSchema.safeParse(validTestnetAddress).success).toBe(true);
    });

    it('accepts valid regtest bech32 address', () => {
      expect(BitcoinAddressSchema.safeParse(validRegtestAddress).success).toBe(true);
    });

    it('accepts legacy 1 and 3 addresses', () => {
      expect(BitcoinAddressSchema.safeParse('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').success).toBe(true);
      expect(BitcoinAddressSchema.safeParse('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy').success).toBe(true);
    });

    it('rejects invalid address prefix', () => {
      expect(BitcoinAddressSchema.safeParse('zz1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnhqxx8z').success).toBe(false);
    });

    it('rejects address with control characters', () => {
      expect(BitcoinAddressSchema.safeParse('bc1qnskw4\u0007kf6qevrcyjjd7cnn39uemz9j2cnhqxx8z').success).toBe(false);
    });
  });

  describe('AmountSatsSchema', () => {
    it('accepts positive integer strings', () => {
      expect(AmountSatsSchema.safeParse('1').success).toBe(true);
      expect(AmountSatsSchema.safeParse('50000').success).toBe(true);
      expect(AmountSatsSchema.safeParse('2100000000000000').success).toBe(true);
    });

    it('rejects zero amount', () => {
      expect(AmountSatsSchema.safeParse('0').success).toBe(false);
      expect(AmountSatsSchema.safeParse('000').success).toBe(false);
    });

    it('rejects negative numbers and decimals', () => {
      expect(AmountSatsSchema.safeParse('-100').success).toBe(false);
      expect(AmountSatsSchema.safeParse('10.5').success).toBe(false);
    });

    it('rejects non-numeric string', () => {
      expect(AmountSatsSchema.safeParse('abc').success).toBe(false);
    });
  });

  describe('FeeRateSchema', () => {
    it('accepts numbers between 1 and 1000', () => {
      expect(FeeRateSchema.safeParse(1).success).toBe(true);
      expect(FeeRateSchema.safeParse(50).success).toBe(true);
      expect(FeeRateSchema.safeParse(1000).success).toBe(true);
    });

    it('rejects numbers outside range', () => {
      expect(FeeRateSchema.safeParse(0).success).toBe(false);
      expect(FeeRateSchema.safeParse(1001).success).toBe(false);
      expect(FeeRateSchema.safeParse(-5).success).toBe(false);
    });

    it('rejects non-integer numbers', () => {
      expect(FeeRateSchema.safeParse(2.5).success).toBe(false);
    });
  });

  describe('CountSchema', () => {
    it('accepts integers between 1 and 100', () => {
      expect(CountSchema.safeParse(1).success).toBe(true);
      expect(CountSchema.safeParse(20).success).toBe(true);
      expect(CountSchema.safeParse(100).success).toBe(true);
    });

    it('rejects invalid count', () => {
      expect(CountSchema.safeParse(0).success).toBe(false);
      expect(CountSchema.safeParse(101).success).toBe(false);
      expect(CountSchema.safeParse(1.5).success).toBe(false);
    });
  });

  describe('PsbtStringSchema', () => {
    it('accepts valid base64 strings', () => {
      expect(PsbtStringSchema.safeParse(validBase64).success).toBe(true);
    });

    it('rejects non-base64 strings', () => {
      expect(PsbtStringSchema.safeParse('not-base-64!').success).toBe(false);
      expect(PsbtStringSchema.safeParse('abc').success).toBe(false);
    });

    it('rejects empty strings', () => {
      expect(PsbtStringSchema.safeParse('').success).toBe(false);
    });
  });

  describe('DeriveRequestSchema', () => {
    it('accepts valid mainnet derive request', () => {
      const result = DeriveRequestSchema.safeParse({
        xpub: validMainnetXpub,
        network: 'mainnet',
        count: 5,
        change: false
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid testnet derive request', () => {
      const result = DeriveRequestSchema.safeParse({
        xpub: validTestnetTpub,
        network: 'testnet',
        count: 10
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid count', () => {
      const result = DeriveRequestSchema.safeParse({
        xpub: validTestnetTpub,
        network: 'mainnet',
        count: 0
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown properties via strict', () => {
      const result = DeriveRequestSchema.safeParse({
        xpub: validMainnetXpub,
        network: 'mainnet',
        count: 5,
        extraProperty: true
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DeriveResponseSchema', () => {
    it('accepts valid response', () => {
      const result = DeriveResponseSchema.safeParse({
        addresses: [validMainnetAddress],
        changeAddress: validMainnetAddress
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown fields', () => {
      const result = DeriveResponseSchema.safeParse({
        addresses: [validMainnetAddress],
        changeAddress: validMainnetAddress,
        unknownField: 123
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UtxosRequestSchema', () => {
    it('accepts valid request matching network', () => {
      const result = UtxosRequestSchema.safeParse({
        addresses: [validMainnetAddress],
        network: 'mainnet'
      });
      expect(result.success).toBe(true);
    });

    it('rejects addresses from different network', () => {
      const result = UtxosRequestSchema.safeParse({
        addresses: [validTestnetAddress],
        network: 'mainnet'
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty addresses array', () => {
      const result = UtxosRequestSchema.safeParse({
        addresses: [],
        network: 'mainnet'
      });
      expect(result.success).toBe(false);
    });

    it('rejects extra fields', () => {
      const result = UtxosRequestSchema.safeParse({
        addresses: [validMainnetAddress],
        network: 'mainnet',
        unwanted: 'key'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UtxosResponseSchema', () => {
    it('accepts valid utxos response', () => {
      const result = UtxosResponseSchema.safeParse({
        utxos: [
          {
            txid: validTxid,
            vout: 0,
            valueSats: '10000',
            address: validMainnetAddress,
            confirmed: true
          }
        ],
        totalSats: '10000'
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid txid format', () => {
      const result = UtxosResponseSchema.safeParse({
        utxos: [
          {
            txid: 'invalid-txid',
            vout: 0,
            valueSats: '10000',
            address: validMainnetAddress,
            confirmed: true
          }
        ],
        totalSats: '10000'
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown fields', () => {
      const result = UtxosResponseSchema.safeParse({
        utxos: [],
        totalSats: '0',
        extra: 'field'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('FeesRequestSchema and FeesResponseSchema', () => {
    it('accepts valid fees request', () => {
      expect(FeesRequestSchema.safeParse({ network: 'mainnet' }).success).toBe(true);
    });

    it('rejects extra fields in fees request', () => {
      expect(FeesRequestSchema.safeParse({ network: 'mainnet', unexpected: 1 }).success).toBe(false);
    });

    it('accepts valid fees response', () => {
      const result = FeesResponseSchema.safeParse({
        fastest: 20,
        halfHour: 15,
        hour: 10,
        economy: 5,
        minimum: 1
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown properties in fees response', () => {
      const result = FeesResponseSchema.safeParse({
        fastest: 20,
        halfHour: 15,
        hour: 10,
        economy: 5,
        minimum: 1,
        bonusFee: 99
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PsbtBuildRequestSchema and PsbtBuildResponseSchema', () => {
    it('accepts valid build request', () => {
      const result = PsbtBuildRequestSchema.safeParse({
        xpub: validMainnetXpub,
        network: 'mainnet',
        toAddress: validMainnetAddress,
        amountSats: '50000',
        feeRate: 15,
        changeAddress: validMainnetAddress
      });
      expect(result.success).toBe(true);
    });

    it('rejects toAddress matching wrong network', () => {
      const result = PsbtBuildRequestSchema.safeParse({
        xpub: validMainnetXpub,
        network: 'mainnet',
        toAddress: validTestnetAddress,
        amountSats: '50000',
        feeRate: 15
      });
      expect(result.success).toBe(false);
    });

    it('rejects changeAddress matching wrong network', () => {
      const result = PsbtBuildRequestSchema.safeParse({
        xpub: validMainnetXpub,
        network: 'mainnet',
        toAddress: validMainnetAddress,
        amountSats: '50000',
        feeRate: 15,
        changeAddress: validTestnetAddress
      });
      expect(result.success).toBe(false);
    });

    it('rejects build request with extra fields', () => {
      const result = PsbtBuildRequestSchema.safeParse({
        xpub: validMainnetXpub,
        network: 'mainnet',
        toAddress: validMainnetAddress,
        amountSats: '50000',
        feeRate: 15,
        unknownField: true
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid build response', () => {
      const result = PsbtBuildResponseSchema.safeParse({
        psbt: validBase64,
        feeSats: '150',
        inputCount: 1,
        outputCount: 2
      });
      expect(result.success).toBe(true);
    });

    it('rejects extra fields in build response', () => {
      const result = PsbtBuildResponseSchema.safeParse({
        psbt: validBase64,
        feeSats: '150',
        inputCount: 1,
        outputCount: 2,
        extra: 'field'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PsbtBroadcastRequestSchema and PsbtBroadcastResponseSchema', () => {
    it('accepts valid broadcast request', () => {
      const result = PsbtBroadcastRequestSchema.safeParse({
        signedPsbt: validBase64,
        network: 'testnet'
      });
      expect(result.success).toBe(true);
    });

    it('rejects broadcast request with extra fields', () => {
      const result = PsbtBroadcastRequestSchema.safeParse({
        signedPsbt: validBase64,
        network: 'testnet',
        extra: 123
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid broadcast response', () => {
      const result = PsbtBroadcastResponseSchema.safeParse({
        txid: validTxid
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid txid in broadcast response', () => {
      const result = PsbtBroadcastResponseSchema.safeParse({
        txid: 'not-a-64-character-hex'
      });
      expect(result.success).toBe(false);
    });
  });
});
