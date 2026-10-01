# @kepler/shared

`@kepler/shared` is the canonical package defining domain entities, serialized wire schemas, the typed exception hierarchy, and deterministic JSON hashing utilities across the Kepler monorepo.

## Purpose

The package serves as the immutable single source of truth for all domain shapes shared between backend services, protocol clients, worker processes, and the user interface. It centralizes:

- **Shared Domain Models**: Strictly typed TypeScript classes representing taint graph components, cryptographic evidence bundles, financial policy constraints, and scenario lifecycles.
- **Exception Hierarchy**: A unified set of typed error classes rooted in `KeplerError` with structured context objects and standard JSON serializations.
- **Canonical JSON Serialization**: Deterministic, RFC 8785-compliant JSON stringification used to guarantee byte-for-byte reproducibility of SHA-256 evidence bundle hashes.
- **Logging Interface**: Abstract logger definitions (`KeplerLogger`) decoupling business logic from concrete logging implementations.

## What is Exported

### Domain Classes and Enums

- **Taint Analysis**: `TaintGraph`, `TaintNode`, `TaintEdge`, `EvidenceItem`, `EvidencePath`, `ProtocolType`, `TaintNodeType`, `EvidenceItemKind`
- **Proof and Evidence**: `EvidenceBundle`, `Claim`, `RawDataRef`, `VerificationStep`, `ClaimVerificationResult`, `ClaimType`, `RawDataSource`
- **Policy Management**: `Policy`, `PolicyScope`
- **Scenario Management**: `Scenario`, `ScenarioStatus`, `PaymentTarget`, `PaymentTargetKind`

### Cryptographic and Deterministic Utilities

- `CanonicalJson`: Provides deterministic sorting and key-stable JSON stringification via `CanonicalJson.stringify(value)` for reproducible cryptographic hashing.
- `KeplerLogger`: Core structured logger interface.

### Exception Hierarchy

All application errors inherit from `KeplerError` and enforce typed context payloads:

- `ConfigurationError`: Missing or invalid environment variables and application configurations.
- `ValidationError`: Schema parsing failures and input validation rejections.
- `NotFoundError`: Requested resources (scenarios, evidence bundles, records) missing from storage.
- `NetworkError`: Remote network, HTTP transport, or RPC communication failures.
- `RateLimitError`: Throttling and rate limit violations.
- `PolicyError`: Financial policy budget exceeded or unauthorized network operation.
- `TaintError`: Taint engine graph construction or calculation failures.
- `ProofError`: Evidence bundle verification mismatches and hash corruption.
- `AIError`: Upstream AI model execution or formatting errors.
- `ProtocolError`: Low-level protocol client exceptions (Bitcoin, Lightning, Nostr, Cashu).
- `InternalError`: Unexpected system faults.

## How to Import

Always use named imports directly from `@kepler/shared`. Never use deep imports into internal package file paths:

```typescript
import {
  TaintGraph,
  TaintNode,
  EvidenceBundle,
  Policy,
  Scenario,
  PaymentTargetKind,
  CanonicalJson
} from '@kepler/shared';
```

## Architectural Rules

1. **Source of Truth**: All shared types, domain classes, and enum values live in `packages/shared/src`. Subpackages and applications (`apps/backend`, `apps/frontend`, `packages/*`) must never redefine shapes that exist in `@kepler/shared`.
2. **No Deep Imports**: Consumers must import from `@kepler/shared` only. Internal files such as `@kepler/shared/src/evidence` or `@kepler/shared/dist/taint` are private implementation details.
3. **No External Runtime Logic**: `@kepler/shared` contains pure data shapes, serialization utilities (`CanonicalJson`), and error definitions. It never performs I/O operations, network requests, database transactions, or external state mutations.
4. **Strict Immutability**: Domain models freeze internal state during instantiation (`Object.freeze(this)`), guaranteeing that in-memory structures remain immutable across evaluation pipelines.
