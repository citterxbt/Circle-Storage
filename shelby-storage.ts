/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Storing and retrieving file bytes on the Shelby network.
 *
 * Blobs are registered on chain by the uploader's own wallet, in the browser, so the uploader
 * owns the blob and this server holds no key. What happens here is the byte transfer: the
 * browser sends the ciphertext through Shelby's v2 chunkset API and commits the resulting
 * provider acknowledgements with the wallet. This server verifies those transactions and uses
 * a plain GET for authorised reads.
 *
 * The browser constructs the exact 10-argument `register_blob` payload required by Shelbynet.
 * This server never holds a wallet private key and does not proxy upload bytes.
 */

import { AccountAddress } from "@aptos-labs/ts-sdk";

const SHELBY_RPC_URL = (
  process.env.SHELBY_RPC_URL || "https://api.shelbynet.shelby.xyz/shelby"
).replace(/\/+$/, "");

const SHELBY_API_KEY = process.env.SHELBY_API_KEY || "";

const APTOS_FULLNODE =
  process.env.APTOS_FULLNODE_URL || "https://api.shelbynet.shelby.xyz/v1";

/** Shelby's deployer on Shelbynet. */
const SHELBY_DEPLOYER =
  process.env.SHELBY_CONTRACT_ADDRESS ||
  "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

const COMPLETE_TIMEOUT_MS = 180_000;

/** Blob names carry path structure, so keep the slashes and escape only the segments. */
function blobUrl(account: string, blobName: string): string {
  const encoded = blobName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${SHELBY_RPC_URL}/v1/blobs/${account}/${encoded}`;
}

async function withTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`${label} timed out; the Shelby RPC did not respond in time.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A Geomi key is scoped to its Shelby network. During a network cutover an old Testnet key is
 * rejected with 401/403 even though the Shelbynet RPC still permits anonymous traffic. Retry
 * without that key so storage remains usable at the anonymous rate limit while the deployment
 * key is being rotated.
 */
async function withApiKeyFallback(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const response = await withTimeout(url, init, timeoutMs, label);
  if (!SHELBY_API_KEY || (response.status !== 401 && response.status !== 403)) {
    return response;
  }

  console.warn(
    `[Circle Storage] Shelby rejected SHELBY_API_KEY with HTTP ${response.status}; ` +
      "retrying anonymously. Replace it with a Geomi key created for Shelbynet."
  );

  const anonymousHeaders = new Headers(init.headers);
  anonymousHeaders.delete("Authorization");
  return withTimeout(url, { ...init, headers: anonymousHeaders }, timeoutMs, label);
}

async function errorBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "(could not read error body)";
  }
}

export interface ShelbyResult {
  ok: boolean;
  /** Set when a read succeeded. */
  data?: Buffer;
  /** Set when the call failed: why. */
  reason?: string;
}

/** Read a blob back. Reads need no signature, only the owner and the name. */
export async function getBlobBytes(params: {
  account: string;
  blobName: string;
}): Promise<ShelbyResult> {
  try {
    const response = await withApiKeyFallback(
      blobUrl(params.account, params.blobName),
      { method: "GET", headers: SHELBY_API_KEY ? { Authorization: `Bearer ${SHELBY_API_KEY}` } : {} },
      COMPLETE_TIMEOUT_MS,
      "Reading the file from Shelby"
    );

    if (!response.ok) {
      return {
        ok: false,
        reason: `Shelby read failed (HTTP ${response.status}): ${await errorBody(response)}`,
      };
    }

    return { ok: true, data: Buffer.from(await response.arrayBuffer()) };
  } catch (err: any) {
    console.error(`[Circle Storage] Shelby read failed for "${params.blobName}":`, err);
    return { ok: false, reason: err?.message || "Shelby read failed." };
  }
}

export interface RegistrationResult {
  ok: boolean;
  reason?: string;
  uid?: string;
  blobSize?: number;
}

/**
 * Confirm on chain that the caller really registered this blob.
 *
 * Without this a client could name any blob and have its bytes accepted, or claim a blob
 * somebody else registered. Both the owner and the name come from the transaction rather than
 * from the request.
 */
export async function verifyBlobRegistration(params: {
  txHash: string;
  expectedOwner: string;
  expectedBlobName: string;
}): Promise<RegistrationResult> {
  const { txHash, expectedOwner, expectedBlobName } = params;

  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: "Registration hash is not a 32-byte hex value." };
  }

  let tx: any;
  try {
    const response = await fetch(`${APTOS_FULLNODE}/transactions/by_hash/${txHash}`);
    if (response.status === 404) {
      return { ok: false, reason: "Registration transaction was not found on chain." };
    }
    if (!response.ok) {
      return { ok: false, reason: `Aptos node returned HTTP ${response.status}.` };
    }
    tx = await response.json();
  } catch (err) {
    console.warn("[Circle Storage] Aptos node unreachable during registration check:", err);
    return { ok: false, reason: "Could not reach the Aptos node to check the registration." };
  }

  if (tx?.type !== "user_transaction") {
    return { ok: false, reason: "Hash does not refer to a user transaction." };
  }
  if (tx.success !== true) {
    return { ok: false, reason: `Registration did not succeed (${tx.vm_status || "unknown"}).` };
  }

  try {
    if (!AccountAddress.from(String(tx.sender)).equals(AccountAddress.from(expectedOwner))) {
      return { ok: false, reason: "Registration was not sent by the uploading wallet." };
    }
  } catch {
    return { ok: false, reason: "Registration sender could not be read." };
  }

  const payload = tx.payload;
  if (payload?.type !== "entry_function_payload") {
    return { ok: false, reason: "Registration is not a direct entry-function call." };
  }

  const expectedFunction = `${SHELBY_DEPLOYER}::blob_metadata::register_blob`;
  if (String(payload.function).toLowerCase() !== expectedFunction.toLowerCase()) {
    return { ok: false, reason: `Unexpected registration function: ${payload.function}` };
  }

  // register_blob's first argument is the blob name.
  const args: unknown[] = Array.isArray(payload.arguments) ? payload.arguments : [];
  if (String(args[0]) !== expectedBlobName) {
    return { ok: false, reason: "Registration is for a different blob name." };
  }

  const blobSize = Number(args[6]);
  if (!Number.isSafeInteger(blobSize) || blobSize < 0) {
    return { ok: false, reason: "Registration contains an invalid blob size." };
  }

  const registeredEvent = (Array.isArray(tx.events) ? tx.events : []).find((event: any) => {
    const type = String(event?.type || "").toLowerCase();
    const eventOwner = String(event?.data?.owner || "");
    const objectName = String(event?.data?.object_name || "");
    let ownerMatches = false;
    try {
      ownerMatches = AccountAddress.from(eventOwner).equals(AccountAddress.from(expectedOwner));
    } catch {}
    return (
      type.endsWith("::blob_metadata::blobregisteredevent") &&
      ownerMatches &&
      objectName.endsWith(`/${expectedBlobName}`)
    );
  });
  const uid = String(registeredEvent?.data?.uid || "");
  if (!/^\d+$/.test(uid)) {
    return { ok: false, reason: "Registration did not emit a blob UID." };
  }

  return { ok: true, uid, blobSize };
}

/** Confirm that the uploader finalized the registered v2 chunksets on chain. */
export async function verifyBlobCommit(params: {
  txHash: string;
  expectedOwner: string;
  expectedBlobName: string;
  expectedUid: string;
}): Promise<RegistrationResult> {
  const { txHash, expectedOwner, expectedBlobName, expectedUid } = params;

  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: "Commit hash is not a 32-byte hex value." };
  }

  let tx: any;
  try {
    const response = await fetch(`${APTOS_FULLNODE}/transactions/by_hash/${txHash}`);
    if (response.status === 404) {
      return { ok: false, reason: "Commit transaction was not found on chain." };
    }
    if (!response.ok) {
      return { ok: false, reason: `Aptos node returned HTTP ${response.status}.` };
    }
    tx = await response.json();
  } catch (err) {
    console.warn("[Circle Storage] Aptos node unreachable during commit check:", err);
    return { ok: false, reason: "Could not reach the Aptos node to check the commit." };
  }

  if (tx?.type !== "user_transaction" || tx.success !== true) {
    return {
      ok: false,
      reason: `Commit transaction did not succeed (${tx?.vm_status || "unknown"}).`,
    };
  }

  try {
    if (!AccountAddress.from(String(tx.sender)).equals(AccountAddress.from(expectedOwner))) {
      return { ok: false, reason: "Commit was not sent by the uploading wallet." };
    }
  } catch {
    return { ok: false, reason: "Commit sender could not be read." };
  }

  const payload = tx.payload;
  const expectedFunction = `${SHELBY_DEPLOYER}::blob_metadata::commit_object`;
  if (
    payload?.type !== "entry_function_payload" ||
    String(payload.function).toLowerCase() !== expectedFunction.toLowerCase()
  ) {
    return { ok: false, reason: `Unexpected commit function: ${payload?.function}` };
  }

  const args: unknown[] = Array.isArray(payload.arguments) ? payload.arguments : [];
  if (String(args[0]) !== expectedUid || String(args[1]) !== expectedBlobName) {
    return { ok: false, reason: "Commit is for a different registered blob." };
  }

  return { ok: true };
}
