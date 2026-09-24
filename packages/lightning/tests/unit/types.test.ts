import {
  LightningInvoice,
  LightningPayment,
  LightningTransaction,
  NWCWalletInfo,
  InvoiceCreationResult,
  PaymentResult,
  NWCErrorPayloadSchema,
  NWCResponsePayloadSchema,
  NWCPayInvoiceResultSchema,
  NWCMakeInvoiceResultSchema,
  NWCLookupInvoiceResultSchema,
  NWCGetBalanceResultSchema,
  NWCGetInfoResultSchema,
  NWCTransactionItemSchema,
  NWCListTransactionsResultSchema
} from '../../src';

describe('Lightning Types and Schemas', () => {
  describe('LightningInvoice interface', () => {
    it('instantiates valid LightningInvoice with bigint amountMsat', () => {
      const invoice: LightningInvoice = {
        bolt11: 'lnbc100n1p...',
        paymentHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        preimage: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
        amountMsat: 10000000n,
        description: 'Test payment',
        descriptionHash: null,
        timestamp: 1700000000,
        expiry: 3600,
        payeePubkey: '03abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        expiresAt: 1700003600
      };

      expect(invoice.bolt11).toBe('lnbc100n1p...');
      expect(invoice.paymentHash).toBe('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
      expect(invoice.preimage).toBe('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff');
      expect(invoice.amountMsat).toBe(10000000n);
      expect(invoice.description).toBe('Test payment');
      expect(invoice.descriptionHash).toBeNull();
      expect(invoice.timestamp).toBe(1700000000);
      expect(invoice.expiry).toBe(3600);
      expect(invoice.payeePubkey).toBe('03abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
      expect(invoice.expiresAt).toBe(1700003600);
    });

    it('allows null preimage and descriptionHash', () => {
      const invoice: LightningInvoice = {
        bolt11: 'lnbc50n1...',
        paymentHash: '123456',
        preimage: null,
        amountMsat: 50000n,
        description: 'Unpaid invoice',
        descriptionHash: 'hash123',
        timestamp: 1700000000,
        expiry: 1800,
        payeePubkey: 'pubkey123',
        expiresAt: 1700001800
      };

      expect(invoice.preimage).toBeNull();
      expect(invoice.descriptionHash).toBe('hash123');
    });
  });

  describe('LightningPayment interface', () => {
    it('instantiates valid LightningPayment with bigint amount and fee', () => {
      const payment: LightningPayment = {
        paymentHash: 'payhash123',
        preimage: 'preimage123',
        amountMsat: 25000000n,
        feeMsat: 1000n,
        status: 'succeeded',
        createdAt: 1700000000,
        description: 'Outgoing payment'
      };

      expect(payment.paymentHash).toBe('payhash123');
      expect(payment.preimage).toBe('preimage123');
      expect(payment.amountMsat).toBe(25000000n);
      expect(payment.feeMsat).toBe(1000n);
      expect(payment.status).toBe('succeeded');
      expect(payment.createdAt).toBe(1700000000);
      expect(payment.description).toBe('Outgoing payment');
    });

    it('supports pending and failed statuses', () => {
      const pending: LightningPayment = {
        paymentHash: 'h1',
        preimage: '',
        amountMsat: 1000n,
        feeMsat: 0n,
        status: 'pending',
        createdAt: 1700000000,
        description: 'Pending payment'
      };
      expect(pending.status).toBe('pending');

      const failed: LightningPayment = {
        paymentHash: 'h2',
        preimage: '',
        amountMsat: 1000n,
        feeMsat: 0n,
        status: 'failed',
        createdAt: 1700000000,
        description: 'Failed payment'
      };
      expect(failed.status).toBe('failed');
    });
  });

  describe('LightningTransaction interface', () => {
    it('instantiates valid incoming LightningTransaction', () => {
      const tx: LightningTransaction = {
        type: 'incoming',
        invoice: 'lnbc1...',
        paymentHash: 'txhash1',
        preimage: 'preimage1',
        amountMsat: 100000n,
        feeMsat: 0n,
        status: 'succeeded',
        createdAt: 1700000000,
        settledAt: 1700000010,
        description: 'Received donation'
      };

      expect(tx.type).toBe('incoming');
      expect(tx.invoice).toBe('lnbc1...');
      expect(tx.amountMsat).toBe(100000n);
      expect(tx.feeMsat).toBe(0n);
      expect(tx.settledAt).toBe(1700000010);
    });

    it('instantiates valid outgoing LightningTransaction with null settledAt', () => {
      const tx: LightningTransaction = {
        type: 'outgoing',
        invoice: 'lnbc2...',
        paymentHash: 'txhash2',
        preimage: null,
        amountMsat: 50000n,
        feeMsat: 500n,
        status: 'pending',
        createdAt: 1700000000,
        settledAt: null,
        description: 'Pending outgoing payment'
      };

      expect(tx.type).toBe('outgoing');
      expect(tx.preimage).toBeNull();
      expect(tx.settledAt).toBeNull();
      expect(tx.amountMsat).toBe(50000n);
      expect(tx.feeMsat).toBe(500n);
    });
  });

  describe('NWCWalletInfo interface', () => {
    it('instantiates valid NWCWalletInfo shape', () => {
      const info: NWCWalletInfo = {
        alias: 'Kepler Alby Hub',
        color: '#ff9900',
        pubkey: '618bdf39eaf542de9ffd17c0a0e748fe35a73e42e09148daf349c9d0e7003289',
        network: 'mainnet',
        blockHeight: 850000,
        blockHash: '00000000000000000001abcdef...',
        methods: ['pay_invoice', 'get_balance', 'make_invoice', 'lookup_invoice', 'get_info']
      };

      expect(info.alias).toBe('Kepler Alby Hub');
      expect(info.network).toBe('mainnet');
      expect(info.methods).toHaveLength(5);
    });
  });

  describe('InvoiceCreationResult and PaymentResult interfaces', () => {
    it('instantiates InvoiceCreationResult', () => {
      const result: InvoiceCreationResult = {
        invoice: 'lnbc100n1...',
        paymentHash: 'phash123'
      };
      expect(result.invoice).toBe('lnbc100n1...');
      expect(result.paymentHash).toBe('phash123');
    });

    it('instantiates PaymentResult with bigint feeMsat', () => {
      const result: PaymentResult = {
        paymentHash: 'phash123',
        preimage: 'preimage123',
        feeMsat: 2000n
      };
      expect(result.paymentHash).toBe('phash123');
      expect(result.preimage).toBe('preimage123');
      expect(result.feeMsat).toBe(2000n);
    });
  });

  describe('NWC Zod Schemas', () => {
    it('validates NWCErrorPayloadSchema', () => {
      const raw = {
        code: 'PAYMENT_FAILED',
        message: 'Route not found'
      };
      const parsed = NWCErrorPayloadSchema.parse(raw);
      expect(parsed.code).toBe('PAYMENT_FAILED');
      expect(parsed.message).toBe('Route not found');

      expect(() => NWCErrorPayloadSchema.parse({ code: '' })).toThrow();
    });

    it('validates NWCResponsePayloadSchema', () => {
      const rawSuccess = {
        result_type: 'pay_invoice',
        result: { preimage: 'abc' }
      };
      const parsedSuccess = NWCResponsePayloadSchema.parse(rawSuccess);
      expect(parsedSuccess.result_type).toBe('pay_invoice');
      expect(parsedSuccess.error).toBeUndefined();

      const rawError = {
        result_type: 'pay_invoice',
        error: { code: 'INTERNAL', message: 'Something went wrong' }
      };
      const parsedError = NWCResponsePayloadSchema.parse(rawError);
      expect(parsedError.error?.code).toBe('INTERNAL');
    });

    it('validates NWCPayInvoiceResultSchema with number, bigint, or string fees_paid', () => {
      const parsedNumber = NWCPayInvoiceResultSchema.parse({
        preimage: 'abc123preimage',
        fees_paid: 1000
      });
      expect(parsedNumber.preimage).toBe('abc123preimage');
      expect(parsedNumber.fees_paid).toBe(1000);

      const parsedBigint = NWCPayInvoiceResultSchema.parse({
        preimage: 'abc123preimage',
        fees_paid: 5000n
      });
      expect(parsedBigint.fees_paid).toBe(5000n);

      const parsedDefault = NWCPayInvoiceResultSchema.parse({
        preimage: 'abc123preimage'
      });
      expect(parsedDefault.fees_paid).toBe(0);
    });

    it('validates NWCMakeInvoiceResultSchema', () => {
      const raw = {
        type: 'incoming',
        invoice: 'lnbc100n1...',
        payment_hash: 'phash123',
        amount: 100000,
        created_at: 1700000000
      };
      const parsed = NWCMakeInvoiceResultSchema.parse(raw);
      expect(parsed.invoice).toBe('lnbc100n1...');
      expect(parsed.payment_hash).toBe('phash123');
      expect(parsed.amount).toBe(100000);
    });

    it('validates NWCLookupInvoiceResultSchema', () => {
      const raw = {
        type: 'incoming',
        payment_hash: 'phash123',
        amount: 50000,
        created_at: 1700000000,
        settled_at: 1700000050
      };
      const parsed = NWCLookupInvoiceResultSchema.parse(raw);
      expect(parsed.payment_hash).toBe('phash123');
      expect(parsed.settled_at).toBe(1700000050);
    });

    it('validates NWCGetBalanceResultSchema', () => {
      const raw = { balance: 1250000 };
      const parsed = NWCGetBalanceResultSchema.parse(raw);
      expect(parsed.balance).toBe(1250000);

      const parsedString = NWCGetBalanceResultSchema.parse({ balance: '50000' });
      expect(parsedString.balance).toBe('50000');
    });

    it('validates NWCGetInfoResultSchema with defaults', () => {
      const raw = {
        alias: 'Alby Node',
        pubkey: '618bdf39...',
        network: 'mainnet',
        methods: ['pay_invoice', 'get_balance']
      };
      const parsed = NWCGetInfoResultSchema.parse(raw);
      expect(parsed.alias).toBe('Alby Node');
      expect(parsed.pubkey).toBe('618bdf39...');
      expect(parsed.network).toBe('mainnet');
      expect(parsed.block_height).toBe(0);
      expect(parsed.color).toBe('');
      expect(parsed.methods).toEqual(['pay_invoice', 'get_balance']);
    });

    it('validates NWCTransactionItemSchema and NWCListTransactionsResultSchema', () => {
      const rawTx = {
        type: 'incoming',
        payment_hash: 'txhash1',
        amount: 20000,
        created_at: 1700000000
      };
      const parsedTx = NWCTransactionItemSchema.parse(rawTx);
      expect(parsedTx.type).toBe('incoming');
      expect(parsedTx.invoice).toBe('');
      expect(parsedTx.fees_paid).toBe(0);

      const rawList = {
        transactions: [rawTx],
        total_count: 1
      };
      const parsedList = NWCListTransactionsResultSchema.parse(rawList);
      expect(parsedList.transactions).toHaveLength(1);
      expect(parsedList.total_count).toBe(1);
    });
  });
});
