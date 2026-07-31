/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Storing and retrieving file bytes on the Shelby network.
 *
 * Blobs are registered on chain by the uploader's own wallet, in the browser, so the uploader
 * owns the blob and this server holds no key. What happens here is the byte transfer: the
 * Shelby RPC's multipart endpoints for writes and a plain GET for reads, both carrying this
 * project's API key so storage and egress are attributed to it rather than to an anonymous
 * client.
 *
 * The SDK's `upload()` is deliberately not used: it builds the 10-argument `register_blob`
 * found on shelbynet, while Aptos testnet has a 7-argument version, so the transaction fails
 * to build. See the Shelby storage section of the README.
 */

import { AccountAddress } from "@aptos-labs/ts-sdk";

const SHELBY_RPC_URL = (
  process.env.SHELBY_RPC_URL || "https://api.testnet.shelby.xyz/shelby"
).replace(/\/+$/, "");

const SHELBY_API_KEY = process.env.SHELBY_API_KEY || "";

const APTOS_FULLNODE =
  process.env.APTOS_FULLNODE_URL || "https://fullnode.testnet.aptoslabs.com/v1";

/** Shelby's own deployer on both Aptos testnet and shelbynet. */
const SHELBY_DEPLOYER =
  process.env.SHELBY_CONTRACT_ADDRESS ||
  "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

const START_TIMEOUT_MS = 60_000;
const PART_TIMEOUT_MS = 120_000;
const COMPLETE_TIMEOUT_MS = 180_000;

/** Blob names carry path structure, so keep the slashes and escape only the segments. */
function blobUrl(account: string, blobName: string): string {
  const encoded = blobName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${SHELBY_RPC_URL}/v1/blobs/${account}/${encoded}`;
}

function rpcHeaders(contentType: string): Record<string, string> {
  return {
    "Content-Type": contentType,
    ...(SHELBY_API_KEY ? { Authorization: `Bearer ${SHELBY_API_KEY}` } : {}),
  };
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

/**
 * Transfer bytes for a blob that is already registered on chain.
 *
 * Registration has to land first — the RPC rejects an unknown blob — which is why the browser
 * signs and confirms `register_blob` before calling this.
 */
export async function putBlobBytes(params: {
  account: string;
  blobName: string;
  data: Buffer;
}): Promise<ShelbyResult> {
  const { account, blobName, data } = params;

  if (!SHELBY_API_KEY) {
    console.warn(
      "[Circle Storage] SHELBY_API_KEY is unset; Shelby traffic is anonymous and rate-limited."
    );
  }

  try {
    const startResponse = await withTimeout(
      `${SHELBY_RPC_URL}/v1/multipart-uploads`,
      {
        method: "POST",
        headers: rpcHeaders("application/json"),
        body: JSON.stringify({
          rawAccount: account,
          rawBlobName: blobName,
          rawPartSize: data.length,
        }),
      },
      START_TIMEOUT_MS,
      "Starting the Shelby upload"
    );

    if (!startResponse.ok) {
      return {
        ok: false,
        reason: `Shelby refused the upload (HTTP ${startResponse.status}): ${await errorBody(startResponse)}`,
      };
    }

    const { uploadId } = (await startResponse.json()) as { uploadId?: string };
    if (!uploadId) return { ok: false, reason: "Shelby did not return an upload id." };

    const partResponse = await withTimeout(
      `${SHELBY_RPC_URL}/v1/multipart-uploads/${uploadId}/parts/0`,
      { method: "PUT", headers: rpcHeaders("application/octet-stream"), body: new Uint8Array(data) },
      PART_TIMEOUT_MS,
      "Transferring the file to Shelby"
    );

    if (!partResponse.ok) {
      return {
        ok: false,
        reason: `Shelby rejected the payload (HTTP ${partResponse.status}): ${await errorBody(partResponse)}`,
      };
    }

    // Finalising is the slow phase: Shelby erasure-codes the payload and distributes it.
    const completeResponse = await withTimeout(
      `${SHELBY_RPC_URL}/v1/multipart-uploads/${uploadId}/complete`,
      { method: "POST", headers: rpcHeaders("application/json") },
      COMPLETE_TIMEOUT_MS,
      "Finalising the Shelby upload"
    );

    if (!completeResponse.ok) {
      return {
        ok: false,
        reason: `Shelby could not finalise the upload (HTTP ${completeResponse.status}): ${await errorBody(completeResponse)}`,
      };
    }

    return { ok: true };
  } catch (err: any) {
    console.error(`[Circle Storage] Shelby upload failed for "${blobName}":`, err);
    return { ok: false, reason: err?.message || "Shelby upload failed." };
  }
}

/** Read a blob back. Reads need no signature, only the owner and the name. */
export async function getBlobBytes(params: {
  account: string;
  blobName: string;
}): Promise<ShelbyResult> {
  try {
    const response = await withTimeout(
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

  return { ok: true };
}
