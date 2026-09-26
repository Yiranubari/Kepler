# Proof Claims

Kepler's proof layer transforms taint correlations and transaction executions into cryptographically signed, independently verifiable evidence bundles. Every bundle contains raw protocol data references, explicit verification rules, and an immutable canonical hash computed over the bundle's assertions.

Verification is pure, deterministic, and idempotent. It requires no network requests, no database access, and no AI interaction.

## Claim Types

Kepler currently implements two core claim types:
1. `ClaimType.Privacy` — Taint Correlation Claims
2. `ClaimType.Transaction` — Execution Claims

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
  payload: unknown;
  status: 'completed' | 'pending' | 'failed';
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
    "text": "Execution of Lightning with identifier 3333333333333333333333333333333333333333333333333333333333333333 completed",
    "type": "Transaction"
  },
  "rawDataRefs": [
    {
      "source": "Lightning",
      "ref": "3333333333333333333333333333333333333333333333333333333333333333",
      "payload": {
        "paymentHash": "3333333333333333333333333333333333333333333333333333333333333333",
        "preimage": "4444444444444444444444444444444444444444444444444444444444444444",
        "status": "completed"
      },
      "fetchedAt": "2026-09-26T14:00:00.000Z"
    }
  ],
  "verificationSteps": [
    {
      "name": "execution:identifier",
      "endpoint": "local://proof/verify/execution",
      "input": {
        "protocol": "Lightning",
        "identifier": "3333333333333333333333333333333333333333333333333333333333333333"
      },
      "expected": true
    }
  ],
  "confidence": 1,
  "riskScore": null,
  "bundleHash": "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
  "createdAt": "2026-09-26T14:00:00.000Z"
}
```
