# Proof Claims

Kepler's proof layer transforms taint correlations and transaction executions into cryptographically signed, independently verifiable evidence bundles. Every bundle contains raw protocol data references, explicit verification rules, and an immutable canonical hash computed over the bundle's assertions.

Verification is pure, deterministic, and idempotent. It requires no network requests, no database access, and no AI interaction.

> Note: Lightning is not implemented as a dedicated claim type because Lightning data is already represented in the taint graph and the execution claim.

## Claim Types

Kepler implements four core claim types:
1. `ClaimType.Privacy` — Taint Correlation Claims
2. `ClaimType.Transaction` — Execution Claims
3. `ClaimType.Routing` — Routing Claims
4. `ClaimType.Nostr` — Nostr Claims

---

## Taint Correlation Claims (`ClaimType.Privacy`)

### Purpose
Proves that two graph nodes (`fromNodeId` and `toNodeId`) are correlated under a specific heuristic relationship with confidence C, substantiated by raw protocol data and deterministic verification steps.

Supported relationships:
- `SAME_PAYMENT_HASH`: Proves that a Lightning payment hash correlates with an external identifier (such as a Nostr event).
- `SAME_PREIMAGE`: Proves that a revealed Lightning preimage correlates with an external identifier.
- `PUBLISHED_BY`: Proves that a Nostr event was authored and cryptographically signed by a specific public key.
- `SHARED_MINT`: Proves that a Cashu mint URL is referenced by a Nostr event.
- `CASHU_QUOTE_INVOICE`: Proves that a Cashu mint quote reference matches a Lightning invoice payment hash.
- `TEMPORAL_WINDOW`: Proves that two protocol events occurred within a bounded time window.

### Input Shape
The claim builder accepts the following input structure:

```typescript
interface TaintCorrelationClaimInput {
  fromNodeId: string;
  toNodeId: string;
  relationship: string;
  confidence: number;
  edgeEvidence: Array<{
    kind: string;
    ref: string;
    description: string;
    data: unknown;
  }>;
  rawDataRefs: Array<{
    source: 'Bitcoin' | 'Lightning' | 'Nostr' | 'Cashu';
    ref: string;
    payload: unknown;
  }>;
}
```

### Verification Steps
Verification executes the following deterministic assertions:
1. **Bundle Hash Integrity**: Recomputes the SHA-256 hash across canonical JSON representations of the claim, raw data references, verification steps, confidence, and risk score. If the computed hash does not match `bundleHash`, verification fails immediately with `HASH_MISMATCH`.
2. **Raw Data Presence**: Ensures each required raw data reference is present in `bundle.rawDataRefs`. If missing, verification fails with `MISSING_RAW_DATA`.
3. **Step Execution**:
   - `SAME_PAYMENT_HASH:recompute`: Validates that the payment hash in the raw Lightning payment matches the payment hash referenced in the raw Nostr event content or tags.
   - `SAME_PREIMAGE:recompute`: Validates that the SHA-256 hash of the preimage in the Lightning settlement matches the payment hash in the raw Nostr event.
   - `PUBLISHED_BY:recompute`: Validates that the raw Nostr event's `pubkey` and `id` match the claim nodes.
   - `SHARED_MINT:recompute`: Validates that the mint URL in the Cashu token or quote appears verbatim (case-sensitive) in the Nostr event content or tags.
   - `CASHU_QUOTE_INVOICE:recompute`: Validates that the Cashu quote's payment hash matches the Lightning invoice payment hash.
   - `TEMPORAL_WINDOW:recompute`: Validates that the absolute time delta between the two protocol events does not exceed the verification step's configured window.

### Failure Modes
- `HASH_MISMATCH`: The evidence bundle or its raw data references were modified after generation.
- `MISSING_RAW_DATA`: A raw data reference referenced in a verification step could not be located in `bundle.rawDataRefs`.
- `STEP_FAILED`: A specific verification step failed rule recomputation (e.g., hash mismatch, unequal preimage, unmatching mint URL, or temporal window violation).

### Example Bundle JSON
```json
{
  "id": "evidence-7a3b4c5d",
  "claim": {
    "text": "payment_hash:1111111111111111111111111111111111111111111111111111111111111111 and event_id:2222222222222222222222222222222222222222222222222222222222222222 are correlated via SAME_PAYMENT_HASH with confidence 1.",
    "type": "Privacy"
  },
  "rawDataRefs": [
    {
      "source": "Lightning",
      "ref": "1111111111111111111111111111111111111111111111111111111111111111",
      "payload": {
        "paymentHash": "1111111111111111111111111111111111111111111111111111111111111111"
      },
      "fetchedAt": "2026-09-26T14:00:00.000Z"
    },
    {
      "source": "Nostr",
      "ref": "2222222222222222222222222222222222222222222222222222222222222222",
      "payload": {
        "id": "2222222222222222222222222222222222222222222222222222222222222222",
        "content": "Paid invoice 1111111111111111111111111111111111111111111111111111111111111111"
      },
      "fetchedAt": "2026-09-26T14:00:00.000Z"
    }
  ],
  "verificationSteps": [
    {
      "name": "SAME_PAYMENT_HASH:recompute",
      "endpoint": "local://proof/verify/SAME_PAYMENT_HASH",
      "input": {
        "relationship": "SAME_PAYMENT_HASH",
        "fromNodeId": "payment_hash:1111111111111111111111111111111111111111111111111111111111111111",
        "toNodeId": "event_id:2222222222222222222222222222222222222222222222222222222222222222"
      },
      "expected": true
    }
  ],
  "confidence": 1,
  "riskScore": null,
  "bundleHash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
  "createdAt": "2026-09-26T14:00:00.000Z"
}
```

---

## Execution Claims (`ClaimType.Transaction`)

### Purpose
Proves that a payment route step or operation executed across Bitcoin, Lightning, or Cashu and is anchored by a definitive protocol identifier (`txid`, `paymentHash`, or `quote`).

Supported protocols:
- `Bitcoin`: Proves an on-chain transaction execution identified by its `txid`.
- `Lightning`: Proves an off-chain payment execution identified by its `paymentHash`.
- `Cashu`: Proves an ecash mint quote or token operation identified by its `quote`.

### Input Shape
The claim builder accepts the following input structure:

```typescript
interface ExecutionClaimInput {
  protocol: 'Bitcoin' | 'Lightning' | 'Cashu';
  identifier: string;
  amountSats: string;
  rawDataRefs: Array<{
    source: 'Bitcoin' | 'Lightning' | 'Cashu';
    ref: string;
    payload: unknown;
  }>;
}
```

### Verification Steps
Verification executes the following deterministic assertions:
1. **Bundle Hash Integrity**: Validates the SHA-256 hash over canonical JSON representation of bundle assertions.
2. **Raw Data Presence**: Ensures that the raw protocol data reference matching `protocol` and `identifier` is present in `bundle.rawDataRefs`.
3. **Identifier Extraction (`execution:identifier`)**:
   - For `Bitcoin`: Asserts that `payload.txid === identifier`.
   - For `Lightning`: Asserts that `payload.paymentHash === identifier`.
   - For `Cashu`: Asserts that `payload.quote === identifier`.

### Failure Modes
- `HASH_MISMATCH`: The bundle contents or raw data reference payloads were tampered with after generation.
- `MISSING_RAW_DATA`: The required protocol execution data reference is not present in `rawDataRefs`.
- `STEP_FAILED`: The identifier in the raw execution payload does not match the claim's verified identifier.

### Example Bundle JSON
```json
{
  "id": "evidence-exec-89a1b2c3",
  "claim": {
    "text": "A payment of 50000 sats was executed via protocol Bitcoin with identifier 3333333333333333333333333333333333333333333333333333333333333333.",
    "type": "Transaction"
  },
  "rawDataRefs": [
    {
      "source": "Bitcoin",
      "ref": "3333333333333333333333333333333333333333333333333333333333333333",
      "payload": {
        "txid": "3333333333333333333333333333333333333333333333333333333333333333"
      },
      "fetchedAt": "2026-09-26T14:00:00.000Z"
    }
  ],
  "verificationSteps": [
    {
      "name": "execution:identifier",
      "endpoint": "/api/proof/verify",
      "input": {
        "protocol": "Bitcoin",
        "identifier": "3333333333333333333333333333333333333333333333333333333333333333"
      },
      "expected": "3333333333333333333333333333333333333333333333333333333333333333"
    }
  ],
  "confidence": 1,
  "riskScore": null,
  "bundleHash": "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
  "createdAt": "2026-09-26T14:00:00.000Z"
}
```

---

## Routing Claims (`ClaimType.Routing`)

### Purpose
Prove that a route was selected deterministically from a candidate list.

### Input Shape
The claim builder accepts the following input structure:

```typescript
interface RoutingClaimInput {
  targetKind: 'Lightning' | 'Bitcoin' | 'Cashu';
  selectedRouteName: string;
  candidates: Array<{
    name: string;
    protocol: 'Bitcoin' | 'Lightning' | 'Cashu';
    estimatedFeeSats: string;
    estimatedLinkageConfidence: number;
    params: Record<string, unknown>;
  }>;
  rawDataRefs: Array<{
    source: 'Bitcoin' | 'Lightning' | 'Cashu';
    ref: string;
    payload: unknown;
  }>;
}
```

### Verification
Re-run `RouteSelector.select` with the same inputs; the winner must match.

Verification executes the following deterministic assertions:
1. **Bundle Hash Integrity**: Recomputes the SHA-256 hash across canonical JSON representations of the claim, raw data references, verification steps, confidence, and risk score. If the computed hash does not match `bundleHash`, verification fails immediately with `HASH_MISMATCH`.
2. **Step Execution**:
   - `routing:selection`: Extracts `targetKind` and `candidates` from step input, invokes `RouteSelector.select(targetKind, candidates)`, and asserts that `selected.name === step.expected`.
   - `routing:deterministic`: Duplicate step verifying idempotence under the identical input and expected route name.

### Failure Modes
- `SELECTION_MISMATCH`: Thrown at build time if `selectedRouteName` does not match the canonical winner computed by `RouteSelector.select`.
- `STEP_FAILED`: Returned at verify time if candidate list or target kind is tampered or produces a different winning route.
- `HASH_MISMATCH`: Returned at verify time if the bundle contents or raw data references were tampered with after generation.

### Example Bundle JSON
```json
{
  "id": "routing:scenario-1:route-lightning-private",
  "claim": {
    "text": "Route route-lightning-private via Lightning was selected over 1 other candidates because it has the lowest estimated linkage confidence (0.1250).",
    "type": "Routing"
  },
  "rawDataRefs": [
    {
      "source": "Lightning",
      "ref": "route-ref-001",
      "payload": {
        "channel": "123x456x789"
      },
      "fetchedAt": "2026-10-01T00:00:00.000Z"
    }
  ],
  "verificationSteps": [
    {
      "name": "routing:selection",
      "endpoint": "/api/proof/verify",
      "input": {
        "targetKind": "Lightning",
        "candidates": [
          {
            "name": "route-lightning-fast",
            "protocol": "Lightning",
            "estimatedFeeSats": "25",
            "estimatedLinkageConfidence": 0.45,
            "params": {}
          },
          {
            "name": "route-lightning-private",
            "protocol": "Lightning",
            "estimatedFeeSats": "50",
            "estimatedLinkageConfidence": 0.125,
            "params": {}
          }
        ]
      },
      "expected": "route-lightning-private"
    },
    {
      "name": "routing:deterministic",
      "endpoint": "/api/proof/verify",
      "input": {
        "targetKind": "Lightning",
        "candidates": [
          {
            "name": "route-lightning-fast",
            "protocol": "Lightning",
            "estimatedFeeSats": "25",
            "estimatedLinkageConfidence": 0.45,
            "params": {}
          },
          {
            "name": "route-lightning-private",
            "protocol": "Lightning",
            "estimatedFeeSats": "50",
            "estimatedLinkageConfidence": 0.125,
            "params": {}
          }
        ]
      },
      "expected": "route-lightning-private"
    }
  ],
  "confidence": 1,
  "riskScore": 0.125,
  "bundleHash": "9b1c7c2be6143d2c67389a9f5d3f2780e03df8ebda729a997d9fe4dbffeb33bf",
  "createdAt": "2026-10-01T00:00:00.000Z"
}
```

---

## Nostr Claims (`ClaimType.Nostr`)

### Purpose
Prove that a Nostr event was signed by the claimed pubkey.

### Input Shape
The claim builder accepts the following input structure:

```typescript
interface NostrClaimInput {
  event: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  };
  rawDataRefs: Array<{
    source: 'Nostr';
    ref: string;
    payload: unknown;
  }>;
}
```

### Verification
`verifyEvent` from `nostr-tools`, offline and deterministic.

Verification executes the following deterministic assertions:
1. **Bundle Hash Integrity**: Recomputes the SHA-256 hash across canonical JSON representations of the claim, raw data references, verification steps, confidence, and risk score. If the computed hash does not match `bundleHash`, verification fails immediately with `HASH_MISMATCH`.
2. **Step Execution**:
   - `nostr:signature`: Extracts `event` from step input and calls `verifyEvent(event)`. If signature verification passes, the step succeeds; otherwise returns `STEP_FAILED`.

### Failure Modes
- `INVALID_SIGNATURE`: Thrown at build time if the Nostr event cryptographic signature fails `verifyEvent`.
- `STEP_FAILED`: Returned at verify time if the event payload or signature was tampered with.
- `HASH_MISMATCH`: Returned at verify time if the bundle contents or raw data references were tampered with after generation.

### Example Bundle JSON
```json
{
  "id": "nostr:scenario-1:f5525971d4626d20f17d4b9e93c6a4057d4e58ad6f489e87fb64b5a70e302d00",
  "claim": {
    "text": "Nostr event f5525971…0e302d00 was published by pubkey 1b84c556…d5dd078f at 1700000000 with a valid signature.",
    "type": "Nostr"
  },
  "rawDataRefs": [
    {
      "source": "Nostr",
      "ref": "f5525971d4626d20f17d4b9e93c6a4057d4e58ad6f489e87fb64b5a70e302d00",
      "payload": {
        "id": "f5525971d4626d20f17d4b9e93c6a4057d4e58ad6f489e87fb64b5a70e302d00",
        "pubkey": "1b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f",
        "created_at": 1700000000,
        "kind": 1,
        "tags": [
          ["t", "kepler"]
        ],
        "content": "Kepler verifiable Nostr proof claim test payload",
        "sig": "3a0b..."
      },
      "fetchedAt": "2026-10-01T00:00:00.000Z"
    }
  ],
  "verificationSteps": [
    {
      "name": "nostr:signature",
      "endpoint": "/api/proof/verify",
      "input": {
        "event": {
          "id": "f5525971d4626d20f17d4b9e93c6a4057d4e58ad6f489e87fb64b5a70e302d00",
          "pubkey": "1b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f",
          "created_at": 1700000000,
          "kind": 1,
          "tags": [
            ["t", "kepler"]
          ],
          "content": "Kepler verifiable Nostr proof claim test payload",
          "sig": "3a0b..."
        }
      },
      "expected": true
    }
  ],
  "confidence": 1,
  "riskScore": null,
  "bundleHash": "7c1d8e9f0a1b2c3d4e5f67890123456789abcdef0123456789abcdef01234567",
  "createdAt": "2026-10-01T00:00:00.000Z"
}
```
