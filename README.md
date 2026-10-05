# Kepler

Open source agent wallet for Bitcoin, Lightning, Nostr, and Cashu with cross protocol taint analysis and proof carrying AI decisions.

## Team

Yiranubari

## What it does

A user pastes a payment target. It can be a Lightning invoice, a Bitcoin address, or an ecash request. Before anything is sent, Kepler builds a graph of how that payment could link the user's Bitcoin, Lightning, and Nostr identities. It shows the paths, explains them in plain language, and attaches a verifiable evidence bundle to every decision. The user can click Verify to check the bundle, flip a tamper toggle, and watch verification fail. That is the point of the project: the AI explains, but every claim is machine verifiable without the AI.

## What works today

- Landing page and app shell with the Strike inspired visual system
- Home dashboard with wallet balance, recent activity, and limits
- Send flow for Lightning, on chain Bitcoin, and Cashu ecash. Input, preview, execute.
- Taint engine with six correlation rules across Bitcoin, Lightning, Nostr, and Cashu
- Taint graph view with a node detail panel, path list, and hover highlighting
- AI explanation in plain English. Provider is Groq, with Hugging Face as fallback.
- Evidence bundle view with claim card, raw data refs, verification steps, a Verify button, and a tamper toggle
- Policy editor with daily limit and per transaction limit. Advanced mode reveals scopes and allowlists.
- Network switch between mainnet, testnet, testnet4, signet, and regtest, with wallet reconnect
- Nostr decision logging. Every payment decision is published to relays as a signed event with an evidence reference.

## What is not finished

- Lightning execution needs a funded Nostr Wallet Connect wallet. The demo shows the preview step for Lightning and stops there.
- On chain PSBT signing works with Xverse on mainnet. Testnet signing through the Reown AppKit Bitcoin adapter does not complete.
- Cashu execution is built and unit tested but not exercised in the demo flow.

## Stack

- Frontend: React 18, TypeScript, Tailwind, Vite, TanStack Query, Zustand, Motion, React Flow, Reown AppKit
- Backend: Node.js 20, TypeScript, Express, Prisma, Postgres, Zod
- Protocols: Bitcoin via Esplora, Lightning via NWC, Nostr via nostr-tools, Cashu via @cashu/cashu-ts
- AI: Groq with Llama 3.3, Hugging Face Inference API as fallback
- All infrastructure is free. No paid APIs, no closed source services.

## Setup

Prerequisites:

- Node.js 20 or later
- Postgres 15 or later
- A Reown project ID from `dashboard.reown.com`
- A Groq API key from `console.groq.com` (free tier is enough)
- Optional: an NWC enabled wallet, e.g. Alby Hub, Coinos, or LNbits
- Optional: a public Cashu mint URL, e.g. `https://testnut.cashu.space`
- Optional: a Nostr private key (any 64 character hex string) and a relay list

Steps:

1. Clone the repository.
2. `npm install` from the repository root.
3. Create `apps/backend/.env` from `apps/backend/.env.example`. Fill in:
   - `DATABASE_URL`
   - `GROQ_API_KEY`
   - `NWC_CONNECTION_STRING` if you have one
   - `NOSTR_PRIVATE_KEY`, `NOSTR_RELAYS`
   - `CASHU_MINT_URL` if you have one
   - `ESPLORA_URL`, `ESPLORA_FALLBACK_URL`, `BITCOIN_NETWORK`
4. Create `apps/frontend/.env` from `apps/frontend/.env.example`. Fill in:
   - `VITE_API_BASE_URL=http://localhost:3000`
   - `VITE_REOWN_PROJECT_ID`
   - `VITE_BITCOIN_NETWORK`
5. Run the migrations:

```bash
npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
```

6. Start the backend:

```bash
npm run dev -w @kepler/backend
```

7. In a second terminal, start the frontend:

```bash
npm run dev:web
```

The frontend is available at `http://localhost:5173`. The backend is at `http://localhost:3000`.

## How to try it

1. Open `http://localhost:5173`. The landing page explains the product. Click Launch app.
2. The dashboard shows the current network, the connected wallet, and the balance strip.
3. Open Settings. Set the network to testnet4 if it is not already. Add the limits you want. The editor defaults to daily limit and per transaction limit. Advanced mode reveals scopes and allowlists.
4. Open Send. Paste a Lightning invoice from the test vector in `packages/lightning/tests/unit/bolt11.test.ts`, or any bolt11 invoice you have on hand. Preview shows amount, description, and expiry.
5. To see the core of the project, open a payment detail from History. The page shows the taint graph, the path list, and the AI explanation. The evidence bundle card is below. Click Verify claim. It passes. Flip the tamper toggle and click Verify claim again. It fails.
6. Open `/app/history/:id` in the URL bar for any scenario with a graph to see the raw data view if advanced mode is on.

## Architecture

See `docs/architecture.md` for the full picture. Short version: the frontend talks to a single Express backend. The backend has ten domain modules: taint, proof, policy, orchestrator, ai, scenario, protocols, onchain, config, and the shared contracts. The taint engine is deterministic. The proof layer recomputes every claim from raw data. The AI layer explains but never produces a claim.

## Documentation

- `docs/architecture.md`
- `docs/orchestrator.md`
- `docs/proof-claims.md`
- `docs/taint-rules.md`

## Known limitations

- The taint correlation verifier in `apps/backend/src/modules/proof/claims/taintCorrelation.claim.ts` handles six correlation types in a single file. Splitting it into one file per claim type is deferred.
- Timing is measured with `performance.now()` in most modules but `Date.now()` appears in the AI cache's TTL check and the policy engine's UTC day boundary. Both are intentional.
- Wallet connectors do not distinguish between testnet variants. Reown AppKit exposes a single Bitcoin testnet constant. When the app runs on testnet4, signet, or regtest, the connected wallet reports itself as testnet regardless.
- The Reown AppKit Bitcoin adapter does not fully support testnet signing for browser extensions. Kepler works on testnet for read only operations. On chain signing through the browser extension requires mainnet.
- The balance endpoint never logs an address, a token, or a balance value. It always returns per protocol state, including per protocol errors, so a single failure does not break the strip.

## Deployment

The backend runs on Render from the blueprint in `render.yaml`. The frontend runs on Vercel from `apps/frontend/vercel.json`. The database is hosted on Neon.

1. Create a Neon Postgres database and copy the pooled connection string.
2. In Render, create a Blueprint from this repository. Render reads `render.yaml` and creates the `kepler-api` web service.
3. When Render prompts for the `sync: false` variables, provide `DATABASE_URL` (the Neon connection string), `CORS_ORIGIN` (the Vercel frontend origin, for example `https://kepler.vercel.app`), `GROQ_API_KEY`, `HUGGINGFACE_API_KEY`, `NOSTR_PRIVATE_KEY`, `NWC_CONNECTION_STRING`, and any optional values you want.
4. In Vercel, import this repository and set the root directory to `apps/frontend`. Vercel reads `apps/frontend/vercel.json`. Set `VITE_API_BASE_URL` to the Render service URL and `VITE_REOWN_PROJECT_ID` to your Reown project ID.
5. After both services are live, confirm `GET /api/health` returns `{ "status": "ok" }` and that the frontend can reach the backend from the browser.

`CORS_ORIGIN` accepts a comma-separated list, so you can allow both the Vercel origin and `http://localhost:5173` during testing.

## License

MIT.
