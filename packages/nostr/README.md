# @kepler/nostr

## Purpose

The `@kepler/nostr` package is the protocol adapter for Nostr operations in the Kepler agent wallet. It provides relay pool connectivity, event signing, signature verification, event publishing (including Kepler decision events), event querying, and NIP-19 bech32 key encoding and decoding.

## Required environment variables

- `NOSTR_PRIVATE_KEY`: 64-character lowercase hex encoded private key.
- `NOSTR_RELAYS`: Comma-separated list of relay WebSocket URLs starting with `wss://`.
- `NOSTR_TIMEOUT_MS`: Optional relay connection and query timeout in milliseconds (positive integer, defaults to 30000).
- `NOSTR_PUBLISH_TIMEOUT_MS`: Optional event publish timeout in milliseconds (positive integer, defaults to 10000).
- `NOSTR_MAX_LIMIT`: Optional maximum limit for event queries (positive integer, defaults to 500).

## Public API

### NostrClient

```typescript
class NostrClient {
  constructor(config: NostrConfig, logger: KeplerLogger, pool?: SimplePool);
  readonly isConnected: boolean;
  readonly connectedRelays: string[];
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<PublishResult>;
  publishDecision(payload: KeplerDecisionPayload): Promise<PublishResult>;
  fetchEvents(filter: NostrFilter): Promise<VerifiedNostrEvent[]>;
  fetchEventById(id: string): Promise<VerifiedNostrEvent | null>;
  fetchEventsByAuthor(pubkey: string, kinds?: number[], limit?: number): Promise<VerifiedNostrEvent[]>;
  fetchEventsByTag(tagName: string, tagValue: string, kinds?: number[], limit?: number): Promise<VerifiedNostrEvent[]>;
  npubEncode(pubkey: string): string;
  npubDecode(npub: string): string;
}
```

### NostrConfig

```typescript
class NostrConfig {
  static fromEnv(env?: Record<string, string | undefined>): NostrConfig;
  constructor(options: NostrConfigOptions);
  readonly privateKey: string;
  readonly relays: readonly string[];
  readonly timeoutMs: number;
  readonly publishTimeoutMs: number;
  readonly maxLimit: number;
  readonly publicKey: string;
  readonly npub: string;
}
```

### Errors

- `NostrConfigError`: Thrown when configuration variables are missing or malformed (`NOSTR_CONFIG_ERROR`).
- `NostrNetworkError`: Thrown on relay network transport failures (`NOSTR_NETWORK_ERROR`).
- `NostrConnectionError`: Thrown when zero relays successfully connect (`NOSTR_CONNECTION_ERROR`).
- `NostrTimeoutError`: Thrown when a relay connection, publish, or fetch operation times out (`NOSTR_TIMEOUT_ERROR`).
- `NostrPublishError`: Thrown when zero relays accept a published event (`NOSTR_PUBLISH_ERROR`).
- `NostrVerificationError`: Thrown when event signature verification fails (`NOSTR_VERIFICATION_ERROR`).
- `NostrParseError`: Thrown when parsing keys, filters, or event payloads fails (`NOSTR_PARSE_ERROR`).

### Kinds and Tags

- `NostrKind`: Frozen object containing standard kind numbers (`Metadata`, `TextNote`, `ContactList`, `EncryptedDirectMessage`, `Deletion`, `Reaction`, `ZapReceipt`, `AppSpecificData`).
- `KeplerTag`: Frozen object containing decision event tag identifiers (`Kepler`, `Scenario`, `EvidenceHash`, `Decision`, `Protocol`).

### Types and Schemas

- `NostrEvent`
- `NostrFilter`
- `VerifiedNostrEvent`
- `PublishResult`
- `PublishRejectedRelay`
- `KeplerDecisionPayload`
- `NostrEventSchema`
- `NostrWireEventSchema`
- `NostrFilterSchema`
- `KeplerDecisionPayloadSchema`

## How to run tests

### Unit tests

```bash
npm run test:unit -w @kepler/nostr
```

### Integration tests

```bash
NOSTR_PRIVATE_KEY="<hex>" NOSTR_RELAYS="wss://relay.damus.io,wss://nos.lol" npm run test:integration -w @kepler/nostr
```

### Typecheck

```bash
npm run typecheck -w @kepler/nostr
```

## Known limitations

- Single private key per process. No key rotation.
- No NIP-42 authentication. Only public relays that accept unauthenticated REQ and EVENT.
- No encrypted DMs. The EncryptedDirectMessage kind is defined but not implemented.
- No relay scoring or selection. All relays are treated equally.
- Integration tests publish real events to public relays.
