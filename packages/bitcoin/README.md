# @kepler/bitcoin

## Purpose

The `@kepler/bitcoin` package is a thin protocol adapter for Bitcoin network operations in the Kepler agent wallet. It provides read-only chain data access via Esplora REST APIs with automated failover, pure transaction hex decoding (legacy and SegWit), and output script classification and address derivation.

## Required environment variables

- `ESPLORA_URL`: Primary Esplora REST API base URL (must use http or https scheme).
- `ESPLORA_FALLBACK_URL`: Fallback Esplora REST API base URL used if the primary endpoint returns 5xx or fails at transport (must use http or https scheme).
- `BITCOIN_NETWORK`: Bitcoin network identifier (`mainnet`, `testnet`, or `regtest`).

## Public API

### BitcoinClient

```typescript
class BitcoinClient {
  constructor(config: BitcoinConfig, logger: KeplerLogger);
  getTransaction(txid: string): Promise<BitcoinTransaction>;
  getAddressInfo(address: string): Promise<BitcoinAddressInfo>;
  getBlockTip(): Promise<BitcoinBlockTip>;
  parseTxHex(hex: string): BitcoinTransaction;
  parseOutputScript(scriptHex: string): { type: BitcoinScriptType; address: string | null };
}
```

### BitcoinConfig

```typescript
class BitcoinConfig {
  static fromEnv(): BitcoinConfig;
  readonly primaryUrl: string;
  readonly fallbackUrl: string;
  readonly network: 'mainnet' | 'testnet' | 'regtest';
}
```

### Errors

- `BitcoinConfigError`: Thrown when configuration variables are missing or malformed.
- `BitcoinNetworkError`: Thrown on network transport failure or unexpected HTTP error status.
- `BitcoinNotFoundError`: Thrown when a transaction or address is not found (HTTP 404).
- `BitcoinInvalidResponseError`: Thrown when API responses do not conform to expected schema.
- `BitcoinParseError`: Thrown when transaction hex, script hex, address format, or txid format is invalid.

### Types

- `BitcoinTransaction`
- `BitcoinInput`
- `BitcoinOutput`
- `BitcoinAddressInfo`
- `BitcoinBlockTip`
- `BitcoinScriptType`: `'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2wsh' | 'p2tr' | 'op_return' | 'unknown'`

## How to run tests

### Unit tests

```bash
npm run test:unit -w @kepler/bitcoin
```

### Integration tests

Integration tests require live Esplora endpoints and run only when `ESPLORA_URL` is set:

```bash
ESPLORA_URL="https://blockstream.info/api" ESPLORA_FALLBACK_URL="https://blockstream.info/api" BITCOIN_NETWORK="mainnet" npm run test:integration -w @kepler/bitcoin
```

### Typecheck

```bash
npm run typecheck -w @kepler/bitcoin
```

## Known limitations

- Read-only queries: Provides transaction, address info, and block tip lookups. Transaction construction, signing, and broadcasting are not handled by this adapter.
- Output script decoding: Classifies standard P2PKH, P2SH, P2WPKH, P2WSH, P2TR, and OP_RETURN scripts. Non-standard or bare multisig scripts are classified as `unknown`.
- Wire format verification: `parseTxHex` validates wire serialization structure and computes txid; it does not validate consensus rules or execute Bitcoin scripts.
