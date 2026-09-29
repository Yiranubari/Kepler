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
  getUtxos(address: string): Promise<Utxo[]>;
  getRecommendedFees(): Promise<RecommendedFees>;
  broadcastTransaction(signedTxHex: string): Promise<BroadcastResult>;
  parseTxHex(hex: string): BitcoinTransaction;
  parseOutputScript(scriptHex: string): { type: BitcoinScriptType; address: string | null };
}
```

### Broadcast

The package does not sign transactions — it only broadcasts already-signed hex. Signing happens in the user's wallet via the backend's onchain module.

### BitcoinConfig

```typescript
class BitcoinConfig {
  static fromEnv(): BitcoinConfig;
  readonly primaryUrl: string;
  readonly fallbackUrl: string;
  readonly network: 'mainnet' | 'testnet' | 'testnet4' | 'regtest';
  readonly mempoolBaseUrl: string;
}
```

### Errors

- `BitcoinConfigError`: Thrown when configuration variables are missing or malformed.
- `BitcoinNetworkError`: Thrown on network transport failure or unexpected HTTP error status.
- `BitcoinNotFoundError`: Thrown when a transaction or address is not found (HTTP 404).
- `BitcoinInvalidResponseError`: Thrown when API responses do not conform to expected schema.
- `BitcoinParseError`: Thrown when transaction hex, script hex, address format, or txid format is invalid.
- `BitcoinBroadcastError`: Thrown when mempool.space rejects a transaction during broadcast.
- `BitcoinFeeError`: Thrown when fee estimation fails.

### Types

- `BitcoinTransaction`
- `BitcoinInput`
- `BitcoinOutput`
- `BitcoinAddressInfo`
- `BitcoinBlockTip`
- `BitcoinScriptType`: `'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2wsh' | 'p2tr' | 'op_return' | 'unknown'`
- `Utxo`
- `RecommendedFees`
- `BroadcastResult`

## How to run tests

### Unit tests

```bash
npm run test:unit -w @kepler/bitcoin
```

### Integration tests

Integration tests require live endpoints:

```bash
npm run test:integration -w @kepler/bitcoin
```

### Typecheck

```bash
npm run typecheck -w @kepler/bitcoin
```

## Known limitations

- No private keys or signing: The adapter only broadcasts pre-signed raw transactions. Signing and PSBT construction live in the backend.
- Output script decoding: Classifies standard P2PKH, P2SH, P2WPKH, P2WSH, P2TR, and OP_RETURN scripts. Non-standard or bare multisig scripts are classified as `unknown`.
- Wire format verification: `parseTxHex` validates wire serialization structure and computes txid; it does not validate consensus rules or execute Bitcoin scripts.
