## same_payment_hash

Emits an edge between a `payment_hash` node and an `event_id` node when the payment hash appears in the Nostr event's content or tags.

- Relationship: `SAME_PAYMENT_HASH`
- Max confidence: `1.0`
- Evidence: one item per matching event, referencing the event id and the matched field (`content` or `tags`)
- Determinism: matches are exact 64-character hex, case-insensitive
