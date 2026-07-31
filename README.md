# Circle Storage

On-chain Web3 file storage and an access-controlled file marketplace on Aptos (Shelby Testnet).

Users connect an Aptos wallet and lease storage for a file. A file can be kept private to the
uploader, or listed publicly so that buyers pay in APT to unlock the download.

## Status

> [!WARNING]
> **Prototype — not production-ready.** This is a testnet demo. Parts of the wallet, payment
> and access-control flow are still simulated rather than enforced, so the app must not be
> exposed publicly or used with real assets until the items under
> [Known gaps](#known-gaps) are addressed.

## Stack

- React 19 + Vite 6 + Tailwind CSS 4
- Express 4 API in `server.ts`, served through Vite middleware during development
- Persistence: Supabase when configured, otherwise a local JSON file (`server-db.json`)
- Aptos wallet integration via injected browser extensions (AIP-62 and legacy providers)

## Requirements

- Node.js 20 or newer
- An Aptos wallet extension (for example Petra) for the wallet flows

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your env file. Every value is optional — without Supabase credentials the app
   falls back to the local JSON store:

   ```bash
   cp .env.example .env
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

   The app is served on http://localhost:3000 (override with `PORT`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server: Express API plus Vite middleware with HMR |
| `npm run build` | Builds the client into `dist/` and bundles the server to `dist/server.cjs` |
| `npm start` | Runs the production build |
| `npm run lint` | Type-checks with `tsc --noEmit` |
| `npm run clean` | Removes build output |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no | HTTP port to listen on (default `3000`) |
| `SUPABASE_URL` | no | Supabase project URL. Omit to use the local JSON store |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Supabase service-role key. Server-side only — never expose this to the client |
| `DISABLE_HMR` | no | Set to `true` to disable Vite HMR and file watching |

## Project layout

```
server.ts                  Express API, plus static hosting / Vite middleware
src/App.tsx                App shell, tab routing, wallet header
src/lib/aptos-wallet.tsx   Wallet detection, connection, transaction signing
src/components/            Landing, Marketplace, Dashboard, Upload, Leaderboard
src/types.ts               Shared API and domain types
```

## Data storage

When Supabase is not configured, all state — including uploaded file payloads — is written to
`server-db.json` in the working directory. That file is git-ignored and is not suitable for
production: it is rewritten in full on every request, and it is lost on restart in ephemeral
environments such as Cloud Run. Configure Supabase, or another persistent store, before
deploying anywhere real.

## Known gaps

Carried over from the project handover and tracked separately:

- Server-side authorization is missing. API routes still need a wallet-signature session so
  that request handlers derive the caller's address from a verified token.
- On-chain payment verification needs hardening before it can be relied on.
- The client-side AES-256 encryption referenced in some UI copy is not implemented. Either
  build it or correct the copy.
- Wallet balances and the faucet are simulated in the browser, not read from chain.
- There are no automated tests and no CI.

## License

Apache-2.0. See the SPDX headers in the source files.
