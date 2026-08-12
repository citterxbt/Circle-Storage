# Circle Storage

On-chain Web3 file storage and an access-controlled file marketplace on Aptos (Shelby Testnet).

Users connect an Aptos wallet and lease storage for a file. A file can be kept private to the
uploader, or listed publicly so that buyers pay in APT to unlock the download.

## Status

> [!WARNING]
> **Testnet beta — not production-ready.** Wallet ownership, payments, encrypted storage and
> download access are enforced server-side. The Vercel deployment is intentionally limited to
> files of at most 3 MB because the API transfers encrypted bytes as Base64 JSON.

## Stack

- React 19 + Vite 6 + Tailwind CSS 4
- Express 4 API in `server.ts`, exposed on Vercel through `api/[...path].ts`
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
| `npm run build` | Builds the client into `dist/` and bundles the server to `dist/server.mjs` |
| `npm start` | Runs the production build |
| `npm test` | Runs the test suite once |
| `npm run test:watch` | Runs the tests in watch mode |
| `npm run lint` | Type-checks with `tsc --noEmit` |
| `npm run clean` | Removes build output |

## Tests

`tests/` covers the logic where a mistake is either exploitable or silent: payment
verification, wallet sign-in, the encryption round-trip between browser and server, and the fee
both sides compute independently.

The cases are drawn from faults this code actually had, so they are regression guards rather
than illustrations — a 64-character string once counted as proof of payment, a signature
collected elsewhere once satisfied sign-in, an empty file could not be decrypted, and files at a
megabyte boundary were rejected once encryption changed their size. Each of those has a test that
fails if the fix is undone.

CI runs the type-checker, the tests, and a build on every push and pull request. The build is
part of it because the browser plumbing — the erasure-coding WebAssembly in particular — can
break in ways the type-checker cannot see.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no | HTTP port to listen on (default `3000`) |
| `SESSION_SECRET` | in production | HMAC key (32+ chars) for sign-in session cookies. In development an ephemeral key is generated, so restarts sign everyone out |
| `APP_ORIGIN` | in production | Browser origin allowed in wallet sign-in messages. Defaults to `http://localhost:<PORT>` locally |
| `APTOS_FULLNODE_URL` | no | Node API used to verify payments and account auth keys |
| `APTOS_CHAIN_ID` | no | Chain ID accepted during wallet sign-in (default `118`, Shelbynet) |
| `SHELBY_NETWORK` | no | Active file-record namespace (default `shelbynet`) |
| `ALLOW_SIMULATED_PAYMENTS` | no | `true` accepts purchases that fail on-chain verification, for local testing without a funded wallet. Ignored in production |
| `SHELBY_API_KEY` | no | Attributes Shelby storage and egress to this project rather than an anonymous client. Works without it, but rate-limited |
| `SHELBY_RPC_URL` | no | Shelby RPC used to transfer and read blob bytes |
| `SHELBY_CONTRACT_ADDRESS` | no | Shelby's deployer, where blob registrations are verified |
| `SUPABASE_URL` | on Vercel | Supabase project URL. Omit only for local JSON-store development |
| `SUPABASE_SERVICE_ROLE_KEY` | on Vercel | Supabase `sb_secret_…` key. Server-side only — never expose this to the client |
| `DISABLE_HMR` | no | Set to `true` to disable Vite HMR and file watching |

### Keeping a free Supabase testnet project awake

Supabase's Free Plan pauses a low-activity project after a week. For this testnet repository,
the scheduled workflow in `.github/workflows/supabase-keepalive.yml` runs one tiny read query
each day. It is a testnet convenience, not a production availability strategy.

Before enabling it, add these **Actions secrets** in GitHub under **Settings → Secrets and
variables → Actions**:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | The project URL, for example `https://xyz.supabase.co` |
| `SUPABASE_KEEPALIVE_KEY` | The `sb_secret_…` value under **API Keys → Secret keys**. It must stay server-side; do not use the publishable key. |

After pushing, open **Actions → Keep Supabase Testnet Database Awake → Run workflow** once to
verify the secrets and table permissions. A successful run returns no database data or secrets
to the log.

## Deploying with Vercel + Supabase

This is the recommended Shelbynet setup. Vercel serves the Vite app and rewrites every `/api/*`
request to one Express serverless API; Supabase persists profiles, listings, purchases and the
single-use wallet sign-in nonces. No persistent Node server is needed.

1. In **Supabase → SQL Editor**, run
   [`supabase/migrations/20260801100000_circle_storage.sql`](supabase/migrations/20260801100000_circle_storage.sql)
   for a new database. Then run
   [`supabase/migrations/20260810120000_shelbynet_cutover.sql`](supabase/migrations/20260810120000_shelbynet_cutover.sql).
   The latter is non-destructive: it marks current rows as `aptos-testnet`, while new uploads
   are written as `shelbynet`. Do this before the first Shelbynet Vercel deploy.
2. Import this GitHub repository in Vercel. `vercel.json` sets the Vite build and the `/api/*`
   Function automatically.
3. Add these **Vercel Environment Variables** for Production (and Preview if you use previews):

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your `https://…supabase.co` project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | The Supabase **Secret key** beginning `sb_secret_` |
   | `SESSION_SECRET` | A unique random value of 32 characters or more |
   | `APP_ORIGIN` | Exact deployed origin, currently `https://circle-storage.vercel.app` |
   | `SHELBY_API_KEY` | Geomi API key created specifically for the `shelbynet` network |
   | `SHELBY_RPC_URL` | `https://api.shelbynet.shelby.xyz/shelby` |
   | `APTOS_FULLNODE_URL` | `https://api.shelbynet.shelby.xyz/v1` |
   | `APTOS_CHAIN_ID` | `118` |
   | `SHELBY_NETWORK` | `shelbynet` |

   Keep `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` server-side. They must not start with
   `VITE_`, be put in the client, or be added to GitHub Actions logs.
4. Redeploy, then open `https://circle-storage.vercel.app/api/auth/session`. Before a wallet
   signs in it should return JSON `401 {"error":"UNAUTHENTICATED"}` — not Vercel's 404 page.
   Then test the normal Petra sign-in, upload, unlock and download flow.

Vercel Functions accept at most 4.5 MB request and response bodies. Upload bytes now travel
directly from the browser to Shelby, but authorised downloads still pass through the API so the
UI caps selected plaintext files at just under 3 MiB. Supporting larger files requires a
streaming/proof-based download path; do not raise the Express limit alone.

## Shelby storage

Files live on Shelbynet, owned by the wallet that uploaded them. The network is separate from
Aptos Testnet, so existing Testnet registrations and blob bytes are intentionally not reused.

The flow, split between the browser and the API:

1. The browser erasure-codes the file and derives its commitments with `generateCommitments()`.
2. The uploader's wallet signs `register_blob`, so the blob belongs to them and this server
   holds no key. The lease duration becomes the blob's on-chain expiration.
3. After registration confirms, the browser sends encrypted bytes through Shelby's active v2
   chunkset API and receives signed storage-provider acknowledgements.
4. Petra signs `commit_object` with those acknowledgements. The API verifies the fee,
   registration, owner, blob size, UID, and commit before storing the marketplace record.
5. Downloads read the bytes back with a plain `GET /v1/blobs/<owner>/<blobName>`, still gated by
   this application's own authorisation.

Bytes are not kept locally once they are on Shelby; the record holds only metadata and the blob
name.

> [!NOTE]
> Shelbynet's `register_blob` uses ten arguments: object name, two optional location fields,
> expiration, commitment, chunksets, size, payment tier, encoding, and protocol-encryption.
> Circle Storage builds this exact payload so the app's own AES-GCM ciphertext is registered
> correctly. Before charging the platform fee, it reads the active location registry and passes
> that location explicitly, so a first-time account needs no preconfigured location preference.
> The Merkle root still must be encoded as 32 bytes, not as a hex string.
>
> The current v2 RPC identifies writes by the UID emitted during registration and requires a
> final `commit_object` transaction after the storage providers acknowledge the chunksets.

Two consequences of depending on this SDK, worth knowing before removing it:

- The server bundle is ESM (`dist/server.mjs`), because `@shelby-protocol/sdk` is ESM-only and
  cannot be `require`d.
- `@aptos-labs/ts-sdk` is pinned to v6 to satisfy the SDK's peer range of `^5.2.1 || ^6.0.0`.

The SDK's browser build also expects Node globals, so `src/main.tsx` shims `Buffer` and
`process`, and `vite.config.ts` keeps the erasure-coding packages out of dep pre-bundling so
their WebAssembly still resolves beside its own asset.

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
api/handler.ts              Vercel serverless wrapper for every /api route
supabase/migrations/       Supabase schema and atomic nonce-consumption function
src/App.tsx                App shell, tab routing, wallet header
src/lib/aptos-wallet.tsx   Wallet detection, connection, transaction signing
src/components/            Landing, Marketplace, Dashboard, Upload, Leaderboard
src/types.ts               Shared API and domain types
```

## Data storage

File bytes live on Shelby. What this server keeps is the metadata around them — profiles,
listings, purchases, each file's blob name, and hashed short-lived sign-in nonces — in Supabase
when configured, otherwise in `server-db.json` in the working directory.

That JSON file is git-ignored and is not suitable for production: it is rewritten in full on
every request, and it is lost on restart in ephemeral environments. Vercel refuses to start this
API without Supabase credentials, so a deployment cannot silently fall back to ephemeral data.

## Known gaps

- Vercel's 4.5 MB Function request/response limit caps this implementation at 3 MB per selected
  file. Large-file support requires direct browser-to-Shelby transfer rather than increasing an
  HTTP body limit.
- `tsc` runs with `strict` disabled; enabling it currently surfaces around 998 errors.
- The React components are not covered by automated browser tests. Request-level tests cover
  the API authentication boundary and profile identity enforcement; upload, purchase, unlock
  and download are covered below the HTTP layer and have also been exercised manually with real
  Petra accounts. The migrated flow must be manually exercised again on Shelbynet.
- The leaderboard and private-file visibility have not been exercised end-to-end.
- Blob names embed the owner address even though the RPC already namespaces by account, so it
  appears twice in every URL. Harmless, but untidy.

## License

Apache-2.0. See the SPDX headers in the source files.
