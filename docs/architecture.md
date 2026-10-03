# Kepler Architecture

## Overview

Kepler is an open-source agent wallet for Bitcoin, Lightning, Nostr, and Cashu designed to perform cross-protocol taint analysis and attach verifiable cryptographic evidence to autonomous payment decisions. The system tracks surveillance and linkage risks across on-chain transactions, Lightning payment hashes, Nostr identities, and Cashu mints, generating immutable evidence bundles that allow external observers to independently verify route selections without trusting intermediaries or artificial intelligence.

## Repository Layout

- `apps/backend`: Express and TypeScript service hosting the taint engine, proof system, policy evaluation, and orchestrator.
- `apps/frontend`: React, TypeScript, and Tailwind user interface providing interactive graph visualization and evidence verification.
- `packages/shared`: Canonical source of truth defining domain entities, exception hierarchies, and deterministic JSON schemas.
- `packages/bitcoin`: Protocol client providing Esplora connectivity, address derivation, fee estimation, and PSBT handling.
- `packages/lightning`: Protocol client implementing Nostr Wallet Connect (NIP-47) for remote Lightning node payments.
- `packages/nostr`: Protocol client managing relay connectivity, event retrieval, cryptographic verification, and broadcast.
- `packages/cashu`: Protocol client communicating with Cashu mints for quotes, minting, and melt operations.

## Request Lifecycle

A payment request traverses a strictly ordered pipeline:

1. **Frontend Initiation**: The client sends a payment payload with target metadata and candidates to `POST /api/orchestrator/orchestrate`.
2. **Scenario and State Guard**: The orchestrator loads the target scenario and verifies that its state permits execution.
3. **Taint Ingestion and Graph Construction**: Protocol metadata is ingested by the taint engine. Deterministic correlation rules execute over ingested data to construct a directed taint graph.
4. **Proof Construction**: The proof service constructs a cryptographic evidence bundle detailing observed correlations and route candidates, computing canonical SHA-256 digests.
5. **Policy Gate**: The policy service evaluates candidate routes against configured per-transaction budget limits, daily spending velocity, and allowlists.
6. **Route Selection**: The route selector analyzes candidate pathways and picks the route minimizing linkage confidence score, applying fee tiebreaking deterministically.
7. **Flow Dispatch**: The orchestrator dispatches execution to the corresponding flow handler (Lightning, Bitcoin, or Cashu).
8. **Execution Logging**: Transaction identifiers, settlement preimages, or ecash quote states are persisted to an execution record.
9. **Nostr Event Publishing**: A standardized decision event is signed and broadcast to configured Nostr relays on a best-effort basis for public auditability.

## Module Boundaries

Architectural separation enforces boundaries across backend modules:

- Business logic resides strictly within the `services/` directory of each module. Controllers handle request validation, schema parsing, service delegation, and HTTP status mappings.
- Repositories are limited to database persistence via Prisma and contain no calculation or orchestration rules.
- Protocol adapters in `packages/*` are thin, stateless clients without taint heuristics or policy rules.
- The orchestrator module is the sole component permitted to coordinate protocol adapters, trigger AI operations, and publish Nostr audit events.
- Core evaluation systems (the taint engine, policy engine, and proof layer) never call the AI layer. Core guarantees remain deterministic and mathematically provable.

## Taint Graph Data Flow

The taint engine builds an in-memory graph consisting of `TaintNode`, `TaintEdge`, `EvidenceItem`, and `EvidencePath` structures. Nodes represent discrete protocol entities such as on-chain addresses, Lightning payment hashes, Nostr public keys, or Cashu mint URLs. Edges represent directed or undirected linkage relationships established through explicit heuristics, including shared payment hashes, published preimages, author signatures, shared mint endpoints, or temporal proximity windows. Every heuristic calculation is deterministic; identical raw inputs produce identical graph topology and linkage scores.

## Proof Verification

Evidence bundles generated during route selection contain raw protocol references, declarative verification steps, and an immutable canonical hash. A verification step recomputes claim validity purely from stored raw data payloads:

- Route selection steps invoke the pure route selector using original candidates to verify that the claimed route was the algorithmic winner.
- Nostr claim verification executes cryptographic signature validation via `verifyEvent` from `nostr-tools`.
- Privacy correlation steps recompute hash equalities or temporal bounds.

Verification is entirely offline, idempotent, and independent of external network endpoints, database state, or AI models.

## AI Layer

The artificial intelligence subsystem is strictly constrained to three peripheral advisory capabilities: explaining generated taint graphs in natural language, suggesting privacy-preserving alternative payment routes, and summarizing evidence bundles for human review. AI results are never fed into policy authorization or cryptographic bundle construction. The service implements an explicit multi-provider fallback hierarchy, caches model outputs against canonical prompt digests, and strips sensitive authentication tokens or private key material before dispatching prompts.

## Non-Custodial Design

Kepler operates under strict non-custodial principles:

- The server never generates, stores, or handles private keys, seed phrases, or master secrets.
- On-chain Bitcoin workflows use Partially Signed Bitcoin Transactions (PSBT), exporting unsigned proposals to external signer devices.
- Lightning operations communicate with remote user-controlled lightning nodes via encrypted Nostr Wallet Connect (NWC) connection strings.
- Cashu workflows operate over ecash tokens signed by independent mints, with proofs stored and redeemed directly by the user client.

## Known Limitations

- **Process-Global DNS Resolution in Integration Tests**: In integration test suites connecting to remote protocol endpoints (such as Nostr relays, Cashu mints, and Bitcoin Esplora nodes), Node.js Happy Eyeballs auto-selection can cause socket timeouts when attempting IPv6 before IPv4. While `NODE_OPTIONS="--no-network-family-autoselection"` handles this at the runtime process level, integration test suites configuring `dns.setDefaultResultOrder('ipv4first')` introduce a process-global side effect within the test worker. Running Jest with `--runInBand` prevents cross-suite pollution.
- Integration tests that call public Esplora, Nostr relays, or public test mints require IPv4-first DNS resolution. This is set per test file currently; a shared Jest setup will consolidate it in a follow-up.
- The taint correlation verifier in apps/backend/src/modules/proof/claims/taintCorrelation.claim.ts handles six correlation types in a single file. Splitting it into one file per claim type is deferred. The file is under 700 lines and remains auditable, but future claim types should be added to separate files rather than this one.
- Timing is measured with performance.now() in most modules but Date.now() appears in the AI cache's TTL check and the policy engine's UTC day boundary. Both are intentional: the cache needs wall-clock time for TTL semantics, and the policy engine needs wall-clock time for calendar-day budget resets. A consolidation pass is deferred.

