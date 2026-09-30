# Policy Module

## Overview

The policy module is the pre-execution gate in Kepler. Before any payment is sent across Bitcoin, Lightning, or Cashu, before any Nostr event is published, or before any payment route is proposed, the orchestrator invokes the policy engine. The policy engine strictly enforces transaction budgets, daily spending limits, operational scopes, and protocol allowlists. On approval, the check passes with no side effects; on policy violation, a typed error is thrown.

## Bootstrapping Defaults

When Kepler initializes a new deployment, the policy repository creates a singleton row (`id = 'default'`) if one does not already exist:

- `dailyBudgetSats`: `100000` (100,000 sats / 0.001 BTC)
- `perTxBudgetSats`: `50000` (50,000 sats)
- `scopes`: `['Read', 'Propose']` (`Send` and `Publish` are off by default; stored and exposed as exact `PolicyScope` enum values)
- `allowedMints`: `[]` (empty list)
- `allowedRelays`: `[]` (empty list)
- `allowedEsplora`: `[]` (empty list)

These initial values are bootstrapping records, not runtime fallbacks. If the policy row is absent or inaccessible, the repository throws `PolicyNotFoundError`; it never substitutes in-memory or fake defaults. The operator must explicitly review and update this initial configuration to allow sending payments or publishing Nostr events.

## Daily Spending Calculation

Daily spending is computed dynamically from the persisted `ExecutionLog` table. There are no separate spend counters, background cron tasks, or scheduled reset jobs.

When calculating spend:
1. The repository queries `ExecutionLog` records where `status = 'succeeded'` and `createdAt >= since` (midnight UTC of the current day).
2. The `amountSats` field is extracted from each log entry's `detail` JSON object and summed as a `bigint`.
3. Contract: Any `ExecutionLog` row with `status = 'succeeded'` must include `amountSats` as a string in its `detail` JSON object (e.g. `{"amountSats": "1000"}`). The orchestrator must follow this contract when writing execution logs.
4. If any successful execution log is missing the `amountSats` field in its detail payload, the repository immediately throws `InternalError` with reason `MISSING_AMOUNT_FIELD`. Missing values are never silently skipped or treated as zero.
5. If the sum of today's spent sats plus the requested payment amount exceeds `dailyBudgetSats`, the operation is denied with `PolicyBudgetError`.

## Scopes and Allowlists

Operational capabilities are restricted by assigned `PolicyScope` values:
- `Read`: Querying wallet state, balances, invoices, and transaction histories.
- `Propose`: Generating taint graphs, evaluating routes, and assembling proof bundles.
- `Send`: Broadcasting on-chain Bitcoin transactions, paying Lightning invoices, or minting/swapping Cashu tokens.
- `Publish`: Broadcasting Nostr events to external relays.

Allowlists gate external network interactions:
- Mint URLs: Exact string matching using shared `policy.isMintAllowed()`.
- Relay URLs: Exact string matching using shared `policy.isRelayAllowed()`.
- Esplora URLs: Exact string matching using shared `policy.isEsploraAllowed()`.

## Error Hierarchy

All policy errors inherit from `KeplerError` and map directly to standard HTTP status codes:
- `PolicyNotFoundError` (`POLICY_NOT_FOUND`): HTTP 404
- `PolicyScopeError` (`POLICY_SCOPE_VIOLATION`): HTTP 403
- `PolicyBudgetError` (`POLICY_BUDGET_VIOLATION`): HTTP 403
- `PolicyAllowlistError` (`POLICY_ALLOWLIST_VIOLATION`): HTTP 403
- `PolicyInputError` (`POLICY_INPUT_ERROR`): HTTP 400
