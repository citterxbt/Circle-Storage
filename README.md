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
| `SHELBY_ACCOUNT_PRIVATE_KEY` | no | Service account that owns blobs written to Shelby. Empty keeps file bytes in this server's store — see [Shelby storage](#shelby-storage) |
| `SHELBY_NETWORK` | no | `testnet` (default), `shelbynet` or `local` |
| `APTOS_API_KEY` | no | Aptos Labs API key, recommended to avoid rate limits |
| `SUPABASE_URL` | no | Supabase project URL. Omit to use the local JSON store |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Supabase service-role key. Server-side only — never expose this to the client |
| `DISABLE_HMR` | no | Set to `true` to disable Vite HMR and file watching |

## Shelby storage

The integration in `shelby-storage.ts` writes uploaded bytes to the Shelby network and reads
them back on download, mapping the lease duration to the blob's on-chain expiration. It is
inactive unless `SHELBY_ACCOUNT_PRIVATE_KEY` is set, in which case the server keeps file bytes
itself, exactly as it falls back from Supabase to a local JSON file.

> [!IMPORTANT]
> **Shelby works on Aptos testnet, but not through the SDK's `upload()`.** Reads return 200 from
> `GET https://api.testnet.shelby.xyz/shelby/v1/blobs/<owner>/<blobName>` without any API key,
> and `register_blob`/`register_multiple_blobs` transactions succeed on chain today.
>
> What fails is the SDK's high-level upload. `register_blob` deployed at `0x85fdb9a1…` on Aptos
> testnet takes 7 arguments, while `@shelby-protocol/sdk` 0.4.1 builds the 10-argument form
> found on `shelbynet`, passing `null` where testnet expects a `u64`; the transaction build
> fails with `Type mismatch for argument 1` before any network call. It is not a peer-version
> problem — it reproduces on `@aptos-labs/ts-sdk` 5.2.1, 6.0.0 and 6.3.1 alike — and no
> published version matches: 0.2.0 through 0.3.1 build 5 arguments, 0.4.x build 8.
>
> The working shape on testnet, which this module does not yet use, is to orchestrate the steps
> rather than call `upload()`:
>
> 1. `generateCommitments()` from the SDK for the blob merkle root and chunkset count.
> 2. Build the 7-argument `register_blob` payload directly and have it signed — a wallet can do
>    this, which would make the uploader own the blob instead of a service account.
> 3. `POST /v1/multipart-uploads`, `PUT` the parts, then `POST /v1/multipart-uploads/{id}/complete`
>    against the Shelby RPC.
> 4. Read back with the plain `GET` above.

Two consequences of depending on this SDK, worth knowing before removing it:

- The server bundle is ESM (`dist/server.mjs`), because `@shelby-protocol/sdk` is ESM-only and
  cannot be `require`d.
- `@aptos-labs/ts-sdk` is pinned to v6 to satisfy the SDK's peer range of `^5.2.1 || ^6.0.0`.

Uploads run server-side because the SDK's `upload()` requires an `Account`, meaning a private
key, so a browser wallet cannot drive it. The blob owner on Shelby is therefore the service
account, not the uploader's wallet; who may read a file is still decided by this application's
own authorisation.

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
