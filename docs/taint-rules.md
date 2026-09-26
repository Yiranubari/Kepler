## same_payment_hash

Emits an edge between a `payment_hash` node and an `event_id` node when the payment hash appears in the Nostr event's content or tags.

- Relationship: `SAME_PAYMENT_HASH`
- Max confidence: `1.0`
- Evidence: one item per matching event, referencing the event id and the matched field (`content` or `tags`)
- Determinism: matches are exact 64-character hex, case-insensitive

## same_preimage

Emits an edge between a `preimage` node and an `event_id` node when the Lightning preimage appears in the Nostr event's content or tags.

- Relationship: `SAME_PREIMAGE`
- Max confidence: `1.0`
- Evidence: one item per matching event, referencing the event id and the matched field (`content` or `tags`)
- Determinism: matches are exact 64-character hex, case-insensitive

## published_by

Emits an edge from an `event_id` node to a `pubkey` node (renamed from `Npub` to `Pubkey`, storing 64-character lowercase hex) when the Nostr event was signed and published by that pubkey.

- Relationship: `PUBLISHED_BY`
- Max confidence: `1.0`
- Evidence: one item per matching event, referencing the event id and the pubkey
- Determinism: exact match between event pubkey metadata and pubkey node value, case-insensitive

## temporal_window

Emits an edge between two nodes of different types (`event_id`, `invoice`, `txid`) when their timestamps are within the configured temporal window.

- Relationship: `TEMPORAL_WINDOW`
- Max confidence: `0.5`
- Evidence: two items referencing each node's timestamp and the delta between them
- Determinism: nodes are sorted lexicographically by id and paired unordered `(A, B)` with `A.id < B.id`, emitting directed edge `A.id -> B.id` for cross-type nodes within window

## shared_mint

Emits an edge between a `mint` node and an `event_id` node when the Cashu mint URL referenced by a Cashu token appears in the Nostr event's content or tags.

- Relationship: `SHARED_MINT`
- Max confidence: `0.6`
- Evidence: one item per matching event, referencing the event id and the matched field (`content` or `tags`)
- Determinism: exact case-sensitive URL substring in content or exact tag element match

## cashu_quote_invoice

Emits an edge between a `mint` node and a `payment_hash` node when a Cashu mint quote reference matches the Lightning payment hash.

- Relationship: `CASHU_QUOTE_INVOICE`
- Max confidence: `1.0`
- Evidence: one item per match, referencing the payment hash and quoteHash field
- Determinism: exact 64-character hex match, case-insensitive


