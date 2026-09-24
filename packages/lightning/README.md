# @kepler/lightning

## Purpose

The `@kepler/lightning` package is the protocol adapter for Lightning Network operations via Nostr Wallet Connect (NWC / NIP-47) in the Kepler agent wallet. It provides connection configuration parsing, hand-written BOLT11 invoice decoding, and NWC client communication for wallet operations.

## Required environment variables

- `NWC_CONNECTION_STRING`: Nostr Wallet Connect connection string starting with `nostr+walletconnect://` containing the wallet public key, relay URL, and authorization secret.
- `NWC_TIMEOUT_MS`: Optional request timeout in milliseconds (positive integer, defaults to 30000).

## Public API

### LightningClient

```typescript
class LightningClient {
  constructor(config: LightningConfig, logger: KeplerLogger, pool?: SimplePool);
  readonly isConnected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getInfo(): Promise<NWCWalletInfo>;
  createInvoice(amountMsat: bigint, description: string, expirySeconds?: number): Promise<InvoiceCreationResult>;
  payInvoice(invoice: string, amountMsat?: bigint): Promise<PaymentResult>;
  lookupInvoice(paymentHash: string): Promise<LightningPayment>;
  listTransactions(options?: { from?: number; until?: number; limit?: number; offset?: number; unpaid?: boolean; type?: 'incoming' | 'outgoing' }): Promise<LightningTransaction[]>;
}
```

### Bolt11

```typescript
class Bolt11 {
  static decode(invoice: string): LightningInvoice;
}
```

### LightningConfig

```typescript
class LightningConfig {
  static fromEnv(env?: Record<string, string | undefined>): LightningConfig;
  readonly connectionString: string;
  readonly walletPubkey: string;
  readonly relayUrl: string;
  readonly secret: string;
  readonly requestTimeoutMs: number;
}
```

### Errors

- `LightningConfigError`: Thrown when configuration variables or NWC parameters are missing or invalid (`LIGHTNING_CONFIG_ERROR`).
- `LightningNetworkError`: Thrown on relay network transport failures (`LIGHTNING_NETWORK_ERROR`).
- `LightningConnectionError`: Thrown when initial relay connection fails (`LIGHTNING_CONNECTION_ERROR`).
- `LightningTimeoutError`: Thrown when an NWC request exceeds the configured timeout (`LIGHTNING_TIMEOUT_ERROR`).
- `LightningInvoiceError`: Thrown on invoice generation or lookup failures, or response shape mismatches (`LIGHTNING_INVOICE_ERROR`).
- `LightningPaymentError`: Thrown on payment routing or execution failures, or returned payment hash mismatches (`LIGHTNING_PAYMENT_ERROR`).
- `LightningParseError`: Thrown when parsing BOLT11 invoices or payment hashes fails (`LIGHTNING_PARSE_ERROR`).

### Types

- `LightningInvoice`
- `LightningPayment`
- `LightningTransaction`
- `NWCWalletInfo`
- `InvoiceCreationResult`
- `PaymentResult`

## How to run tests

### Unit tests

```bash
npm run test:unit -w @kepler/lightning
```

### Integration tests

```bash
npm run test:integration -w @kepler/lightning
```

### Typecheck

```bash
npm run typecheck -w @kepler/lightning
```

## Known limitations

- BOLT11 signature is not verified by the parser.
- Integration tests require an NWC-enabled Lightning wallet.
- Single relay only. No fallback relay.
