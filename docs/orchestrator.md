# Orchestrator Module

## Purpose and the Eleven-Step Flow

The Orchestrator is the central coordinator of Kepler. It receives payment requests, runs cross-protocol taint analysis, selects the route with the lowest linkage confidence, validates policy constraints, constructs verifiable evidence bundles, dispatches protocol payment execution, publishes audit decisions to Nostr, and persists all execution telemetry.

For every payment request (`POST /api/orchestrator/orchestrate`), the orchestrator executes the following eleven steps sequentially:

1. **Load the Scenario**: The scenario record is retrieved from the database via `ScenarioService.getById(scenarioId)`. If not found, throws `OrchestratorNotFoundError` (HTTP 404).
2. **Guard Scenario State**: The scenario must be in `Pending` status. If the scenario is in any other status (`Analyzed`, `Decided`, `Executed`, or `Failed`), throws `OrchestratorStateError` (HTTP 409).
3. **Concurrency Guard**: Pre-flight verification queries the database for existing successful execution logs (`status = 'succeeded'`) associated with the scenario. If found, throws `OrchestratorStateError` with reason `ALREADY_EXECUTED` (HTTP 409).
4. **Taint Analysis Ingestion**: If `request.ingestData` contains nodes, the orchestrator invokes `TaintService.analyze(scenarioId, ingestData)`. If `request.ingestData` is empty, an empty `TaintGraph` is instantiated without calling the analysis service. The scenario status transitions to `Analyzed`.
5. **Policy Propose Gate**: The orchestrator calls `PolicyService.check({ kind: 'propose' })`. If the policy does not permit propose operations or if a policy error is encountered, the scenario transitions to `Failed` and `OrchestratorStateError` with reason `POLICY_DENIED` is thrown.
6. **Route Selection**: Candidates provided in `request.candidateRoutes` are evaluated using `RouteSelector.select(scenario, graph, candidates)`. Incompatible protocols are filtered out, and the candidate with lowest linkage confidence (with fee tiebreaking) is selected. If no candidate is compatible or candidate list is empty, `OrchestratorNoRouteError` (HTTP 422) is thrown and the scenario transitions to `Failed`.
7. **Evidence Bundle Generation**: The orchestrator inspects the taint graph for the highest-confidence edge matching the selected route protocol. If present, it builds an evidence bundle targeting that edge correlation. If absent, it builds a graph-level summary bundle using `ClaimType.Privacy`. The route reason string is deterministically generated from route attributes. The scenario transitions to `Decided`.
8. **Policy Send Gate**: The pre-execution send check calls `PolicyService.check({ kind: 'send', amountSats, protocol, mint })`. If spending limits, per-tx limits, or scopes are violated, the scenario transitions to `Failed` and `OrchestratorStateError` with reason `POLICY_DENIED` is thrown.
9. **Flow Dispatch**: The orchestrator dispatches execution to protocol-specific flows implementing `PaymentFlow`:
   - `Lightning` $\rightarrow$ `PayLightningFlow`
   - `Bitcoin` $\rightarrow$ `PayBitcoinFlow`
   - `Cashu` $\rightarrow$ `PayCashuFlow`
10. **Record Execution Log**: The execution result is persisted to `ExecutionLog`. The detail object strictly includes `amountSats` as a numeric string (required for `PolicyService.sumSpentSince`), `feeSats`, `identifier`, `routeName`, and `protocol`. A corresponding `Decision` record is also stored.
11. **Nostr Audit Publishing & Final State**: If policy permits publishing and payment execution succeeded, the orchestrator invokes `NostrClient.publishDecision(...)`. Nostr publishing is best-effort: failure to publish or policy denial of publish logs a warning and leaves `nostrEventId: null` without failing the orchestration. The scenario transitions to `Executed` on payment success or `Failed` on payment failure.

## The Route Selector's Decision Criteria

The `RouteSelector` is a pure function class (`RouteSelector.select(scenario, graph, candidates)`):

- **Protocol Compatibility Filtering**: Evaluates each candidate's `protocol` against the scenario's `target.kind`:
  - A `Lightning` target accepts only `Lightning` candidate routes.
  - A `Bitcoin` target accepts only `Bitcoin` candidate routes.
  - A `Cashu` target accepts only `Cashu` candidate routes.
  - Cross-protocol conversion is out of scope; incompatible candidates are strictly filtered out.
- **Primary Criterion — Linkage Confidence**: Remaining candidates are sorted in ascending order of `estimatedLinkageConfidence` ($0.0 \le \text{confidence} \le 1.0$). Lower linkage confidence represents higher privacy and is preferred.
- **Tiebreaker — Estimated Fee**: If two or more candidates have identical estimated linkage confidence, candidates are sorted in ascending order of `estimatedFeeSats` (lower fee wins).
- **Purity and Determinism**: The selection algorithm involves no randomness, no timestamps, no mutable graph manipulation, and no external I/O. The same input set always yields the exact same candidate.

## Flow Dispatch and the On-Chain Handoff

The orchestrator abstracts protocol payment mechanisms behind the `PaymentFlow` interface:

- **Lightning Flow (`PayLightningFlow`)**:
  - Extracts the BOLT11 invoice from candidate route parameters or scenario payload.
  - Calls `LightningClient.payInvoice(invoice)`.
  - Calculates fees with round-up precision: `(feeMsat + 999n) / 1000n`.
  - Captures payment hash as identifier.
- **Bitcoin Flow (`PayBitcoinFlow`)**:
  - Requires pre-signed PSBT (`signedPsbt`) passed in candidate route parameters.
  - Calls `OnchainService.broadcast({ signedPsbt, network })`.
  - Returns broadcasted transaction ID (`txid`) as identifier.
  - **On-chain Handoff Architecture**: The backend never stores private keys and never signs on-chain transactions. Signing takes place entirely in the client or hardware wallet. The client signs the PSBT and submits it to the orchestrator for route verification, evidence attachment, and broadcast.
- **Cashu Flow (`PayCashuFlow`)**:
  - Evaluates requested operation (`melt` or `swap`, defaulting to `melt`).
  - For `melt`: pays a destination Lightning invoice using Cashu ecash proofs via `CashuClient.melt(bolt11)`.
  - For `swap`: exchanges proofs with the target mint via `CashuClient.swap(token, amountSats)`.
  - Returns mint quote identifier or swap proof ID as identifier.

## Failure Handling and Scenario State Transitions

All transitions are strictly validated by the scenario lifecycle state machine:

- **State Path**: `Pending` $\rightarrow$ `Analyzed` $\rightarrow$ `Decided` $\rightarrow$ `Executed` | `Failed`.
- **Terminal Guarantees**: Any failure occurring after step 2 transitions the scenario to `Failed` before propagating the error. Scenarios never remain stuck in intermediate states (`Pending`, `Analyzed`, or `Decided`).
- **Suppressed Flow Errors**: `PaymentFlow` implementations catch downstream client exceptions and return `{ status: 'failed', identifier: '', feeSats: 0n, rawDetail: { error: message } }` rather than throwing. The orchestrator records the failure in `ExecutionLog`, transitions the scenario to `Failed`, and returns HTTP 202 with failure details.
- **Typed Error Hierarchy**: Errors map to deterministic HTTP status codes:
  - `OrchestratorNotFoundError`: HTTP 404
  - `OrchestratorStateError`: HTTP 409
  - `OrchestratorRouteError`: HTTP 422
  - `OrchestratorNoRouteError`: HTTP 422
  - `OrchestratorExecutionError`: HTTP 502

## Concurrency Guard

To prevent race conditions, double payments, or duplicate broadcasts:

1. Before starting taint ingestion or policy verification, the orchestrator queries `prisma.executionLog.findFirst({ where: { scenarioId, status: 'succeeded' } })`.
2. If a succeeded log already exists for this scenario, the orchestrator immediately rejects the request by throwing `OrchestratorStateError` with `reason: 'ALREADY_EXECUTED'`.
3. If concurrent requests arrive simultaneously, the first execution to finalize writes the `succeeded` execution log; subsequent calls will detect this row and abort prior to executing any financial flow.

## What the Orchestrator Does Not Do

- **Does Not Sign On-Chain Transactions**: Kepler backend does not hold on-chain private keys, does not derive signing keys from seed phrases, and does not sign PSBTs. PSBT signing is exclusively performed on user devices or hardware wallets.
- **Does Not Store Secrets**: No NWC secret keys, Nostr private keys, or wallet seeds are stored in code or database tables. All necessary authentication secrets are read from validated environment variables.
- **Does Not Call AI for Route Decisions**: The AI module is strictly limited to explaining taint graphs, suggesting routes, and generating user summaries. Core route selection, taint scoring, policy decisions, and proof bundle creation are pure deterministic algorithmic functions and never invoke AI providers.
- **Does Not Silent Fallback**: If protocol clients or required data endpoints are unavailable, the system throws typed errors and records clear terminal state rather than substituting simulated data or silent no-ops.
