# Kepler

Open source agent wallet for Bitcoin, Lightning, Nostr, and Cashu with cross-protocol taint analysis and proof-carrying AI decisions.

## Monorepo structure

- `apps/backend`: Node.js + TypeScript API, taint engine, proof layer, orchestrator
- `apps/frontend`: React + TypeScript + Tailwind UI
- `packages/shared`: shared types, schemas, constants
- `packages/bitcoin`: Bitcoin adapters
- `packages/lightning`: Lightning / NWC adapters
- `packages/nostr`: Nostr relay client and signing
- `packages/cashu`: Cashu mint/melt SDK wrappers

## Getting started

See individual README files in each app/package.

The AI module requires at least one of GROQ_API_KEY or HUGGINGFACE_API_KEY at boot. If neither is configured, the backend fails to boot.

## License

MIT
