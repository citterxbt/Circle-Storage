/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Storing and retrieving file bytes on the Shelby network.
 *
 * Shelby's high-level upload requires an `Account`, meaning a private key, so it cannot be
 * driven by a browser wallet. Uploads therefore run here, server-side, under a service
 * account. That account is the blob owner as far as Shelby is concerned; who may read a file
 * is still decided by this application's own authorisation.
 *
 * Everything is optional: with no service key configured the server falls back to keeping
 * bytes in its own store, the same way it falls back from Supabase to a local JSON file.
 */

import {
  Account,
  Ed25519PrivateKey,
  Network,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";

/** Shelby accepts only these three networks. */
const SHELBY_NETWORKS = {
  local: Network.LOCAL,
  testnet: Network.TESTNET,
  shelbynet: Network.SHELBYNET,
} as const;

const SHELBY_NETWORK =
  SHELBY_NETWORKS[(process.env.SHELBY_NETWORK || "testnet") as keyof typeof SHELBY_NETWORKS] ||
  Network.TESTNET;

let cached: { client: ShelbyNodeClient; account: Account } | null = null;
let initFailed = false;

/** True when a service key is present, so uploads can reach Shelby. */
export function shelbyStorageConfigured(): boolean {
  return !initFailed && Boolean(process.env.SHELBY_ACCOUNT_PRIVATE_KEY);
}

/**
 * Build the client and service account once, on first use.
 *
 * A malformed key is reported once and then disables Shelby storage, so a bad value degrades
 * to local storage instead of failing every upload with the same error.
 */
function shelby(): { client: ShelbyNodeClient; account: Account } | null {
  if (cached) return cached;
  if (initFailed) return null;

  const raw = process.env.SHELBY_ACCOUNT_PRIVATE_KEY;
  if (!raw) return null;

  try {
    const privateKey = new Ed25519PrivateKey(
      PrivateKey.formatPrivateKey(raw.trim(), PrivateKeyVariants.Ed25519)
    );
    const account = Account.fromPrivateKey({ privateKey });

    const client = new ShelbyNodeClient({
      network: SHELBY_NETWORK,
      ...(process.env.APTOS_API_KEY ? { apiKey: process.env.APTOS_API_KEY } : {}),
    });

    console.log(
      `[Circle Storage] Shelby storage enabled on ${SHELBY_NETWORK} as ` +
        `${account.accountAddress.toStringLong()}`
    );

    cached = { client, account };
    return cached;
  } catch (err) {
    initFailed = true;
    console.error(
      "[Circle Storage] SHELBY_ACCOUNT_PRIVATE_KEY could not be loaded; falling back to " +
        "local file storage.",
      err
    );
    return null;
  }
}

/** The address that owns the blobs this server writes, needed to read them back. */
export function shelbyServiceAddress(): string | null {
  const active = shelby();
  return active ? active.account.accountAddress.toStringLong() : null;
}

export interface ShelbyWriteResult {
  ok: boolean;
  /** Set when ok: the address the blob is stored under. */
  owner?: string;
  /** Set when the write failed: why. */
  reason?: string;
}

/**
 * Write bytes to Shelby under `blobName`, expiring at `expirationMicros`.
 *
 * The SDK handles erasure coding, on-chain registration and the upload to storage providers.
 * The service account pays gas in APT and storage in ShelbyUSD, so both must be funded.
 */
export async function writeBlob(params: {
  data: Buffer;
  blobName: string;
  expirationMicros: number;
}): Promise<ShelbyWriteResult> {
  const active = shelby();
  if (!active) return { ok: false, reason: "Shelby storage is not configured." };

  try {
    await active.client.upload({
      blobData: new Uint8Array(params.data),
      signer: active.account,
      blobName: params.blobName,
      expirationMicros: params.expirationMicros,
    });

    return { ok: true, owner: active.account.accountAddress.toStringLong() };
  } catch (err: any) {
    console.error(`[Circle Storage] Shelby upload failed for "${params.blobName}":`, err);
    return { ok: false, reason: err?.message || "Shelby upload failed." };
  }
}

export interface ShelbyReadResult {
  ok: boolean;
  /** Set when ok: the blob contents. */
  data?: Buffer;
  /** Set when the read failed: why. */
  reason?: string;
}

/**
 * Read a blob back. This needs no signer, so it works for any blob the owner made readable.
 */
export async function readBlob(params: {
  owner: string;
  blobName: string;
}): Promise<ShelbyReadResult> {
  const active = shelby();
  if (!active) return { ok: false, reason: "Shelby storage is not configured." };

  try {
    const blob = await active.client.download({
      account: params.owner,
      blobName: params.blobName,
    });

    // A ShelbyBlob exposes a stream rather than a buffer, so drain it.
    const chunks: Buffer[] = [];
    const reader = blob.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value as Uint8Array));
    }

    return { ok: true, data: Buffer.concat(chunks) };
  } catch (err: any) {
    console.error(`[Circle Storage] Shelby download failed for "${params.blobName}":`, err);
    return { ok: false, reason: err?.message || "Shelby download failed." };
  }
}
