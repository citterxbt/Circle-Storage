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
| `SESSION_SECRET` | in production | HMAC key (32+ chars) for sign-in session cookies. In development an ephemeral key is generated, so restarts sign everyone out |
| `APTOS_FULLNODE_URL` | no | Node API used to verify payments and account auth keys |
| `ALLOW_SIMULATED_PAYMENTS` | no | `true` accepts purchases that fail on-chain verification, for local testing without a funded wallet. Ignored in production |
| `SUPABASE_URL` | no | Supabase project URL. Omit to use the local JSON store |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Supabase service-role key. Server-side only — never expose this to the client |
| `DISABLE_HMR` | no | Set to `true` to disable Vite HMR and file watching |

## Authentication

Connecting a wallet does not grant any server-side access on its own. The client asks
`/api/auth/nonce` for a challenge, the wallet signs this application's sign-in statement, and
`/api/auth/verify` checks the signature, confirms the signing key controls the claimed address,
and issues an httpOnly session cookie.

Every mutating route and every download derives the caller's address from that cookie. An
address supplied in a request body is ignored, so a client cannot act on behalf of another
wallet.

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

- The client-side AES-256 encryption referenced in some UI copy is not implemented. Either
  build it or correct the copy.
- Wallet balances and the faucet are simulated in the browser, not read from chain, so the
  affordability checks shown in the UI are decorative.
- The upload flow signs a call to `0x3::shelby::lock_storage_fee`, which does not exist on
  testnet, and the AIP-62 transaction payload uses `arguments` where the standard expects
  `functionArguments`.
- Nothing pins the wallet's network, so a wallet left on mainnet would submit a real transfer.
- Nonces are held in process memory, so sign-in breaks across more than one replica.
- `tsc` runs with `strict` disabled; enabling it currently surfaces around 998 errors.
- There are no automated tests and no CI.

## License

Apache-2.0. See the SPDX headers in the source files.
