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
| `SHELBY_API_KEY` | no | Attributes Shelby storage and egress to this project rather than an anonymous client. Works without it, but rate-limited |
| `SHELBY_RPC_URL` | no | Shelby RPC used to transfer and read blob bytes |
| `SHELBY_CONTRACT_ADDRESS` | no | Shelby's deployer, where blob registrations are verified |
| `SUPABASE_URL` | no | Supabase project URL. Omit to use the local JSON store |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Supabase service-role key. Server-side only — never expose this to the client |
| `DISABLE_HMR` | no | Set to `true` to disable Vite HMR and file watching |

## Shelby storage

Files live on Shelby, owned by the wallet that uploaded them. This has been exercised
end-to-end on Aptos testnet: a 625,466-byte upload read back at the same length, with the
contract reporting `is_written: true` and an expiration 30 days out for a `30d` lease.

The flow, split between the browser and `shelby-storage.ts`:

1. The browser erasure-codes the file and derives its commitments with `generateCommitments()`.
2. The uploader's wallet signs `register_blob`, so the blob belongs to them and this server
   holds no key. The lease duration becomes the blob's on-chain expiration.
3. The server verifies that registration on chain, then transfers the bytes:
   `POST /v1/multipart-uploads`, `PUT …/parts/0`, `POST …/complete`.
4. Downloads read the bytes back with a plain `GET /v1/blobs/<owner>/<blobName>`, still gated by
   this application's own authorisation.

Bytes are not kept locally once they are on Shelby; the record holds only metadata and the blob
name.

> [!NOTE]
> The `register_blob` payload is built by hand rather than with the SDK's helper, because no
> published SDK version matches the contract deployed on Aptos testnet. That contract takes 7
> arguments; `@shelby-protocol/sdk` 0.4.x builds the 8-to-10 argument form found on `shelbynet`,
> passing `null` where testnet expects a `u64` and failing with `Type mismatch for argument 1`
> before any network call. Versions 0.2.0 through 0.3.1 build 5. It is not a peer-version
> problem — it reproduces on `@aptos-labs/ts-sdk` 5.2.1, 6.0.0 and 6.3.1 alike.
>
> Two details the RPC enforces, both of which cost a debugging round here: the merkle root must
> be sent as 32 bytes rather than as its hex string, and the declared part size has a floor of
> 1 MiB however small the file is. Registration also lands on chain slightly before the RPC
> admits the blob exists, so opening an upload retries while it reports "not been registered".

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
src/App.tsx                App shell, tab routing, wallet header
src/lib/aptos-wallet.tsx   Wallet detection, connection, transaction signing
src/components/            Landing, Marketplace, Dashboard, Upload, Leaderboard
src/types.ts               Shared API and domain types
```

## Data storage

File bytes live on Shelby. What this server keeps is the metadata around them — profiles,
listings, purchases, and each file's blob name — in Supabase when configured, otherwise in
`server-db.json` in the working directory.

That JSON file is git-ignored and is not suitable for production: it is rewritten in full on
every request, and it is lost on restart in ephemeral environments such as Cloud Run. Configure
Supabase, or another persistent store, before deploying anywhere real.

## Known gaps

- The client-side AES-256 encryption referenced in some UI copy is not implemented. Files reach
  Shelby as they were uploaded. Either build it or correct the copy — as it stands the interface
  promises something it does not do.
- Buying a file has not been exercised end-to-end with a real wallet; only uploading and
  downloading have. It needs two accounts, since a buyer cannot be the uploader.
- Nonces are held in process memory, so sign-in breaks across more than one replica.
- `tsc` runs with `strict` disabled; enabling it currently surfaces around 998 errors.
- There are no automated tests and no CI.
- Blob names embed the owner address even though the RPC already namespaces by account, so it
  appears twice in every URL. Harmless, but untidy.

## License

Apache-2.0. See the SPDX headers in the source files.
