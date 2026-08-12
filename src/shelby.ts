/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared storage-lease constants and pricing.
 *
 * Both the browser and the server import this. The client uses it to display the fee and to
 * build the payment transaction; the server uses it to recompute the fee independently when
 * verifying that payment. If only the client knew the price, a caller could pay a token amount
 * and claim it settled the lease.
 */

/** ShelbyUSD on Shelbynet: name "ShelbyUSD", symbol "SHELBY_USD". */
export const SHELBY_USD_ASSET_TYPE =
  "0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1";

export const SHELBY_USD_DECIMALS = 8;

export const SHELBY_USD_SYMBOL = "SUSD";

/**
 * Where storage-lease fees are paid.
 *
 * Change this in one place only: the client pays this address and the server requires it as
 * the recipient, so the two must agree or every upload is rejected.
 */
export const LEASE_TREASURY_ADDRESS =
  "0xb79959d5aa6efcfa5dcecb8fe8a9c485c9d5a6b6c66baac8d521947862d588c0";

/**
 * The framework entry function a holder uses to move a fungible asset it owns.
 *
 * Note this is not `shelby_usd::transfer`: that one takes (signer, from, to, amount) and is
 * restricted to the token's admin, so an uploader calling it would abort.
 */
export const FUNGIBLE_TRANSFER_FUNCTION = "0x1::primary_fungible_store::transfer";

export const FUNGIBLE_METADATA_TYPE = "0x1::fungible_asset::Metadata";

/** Shelby's deployer on Shelbynet. */
export const SHELBY_DEPLOYER =
  "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

export const REGISTER_BLOB_FUNCTION = `${SHELBY_DEPLOYER}::blob_metadata::register_blob`;

/** Public Shelbynet node used to discover an active storage location before charging the user. */
export const SHELBY_APTOS_FULLNODE_URL = "https://api.shelbynet.shelby.xyz/v1";

/**
 * Resolve a location that currently accepts Shelbynet registrations.
 *
 * Shelbynet is reset frequently, so the active location name is read from chain instead of
 * hard-coded. This must happen before the platform-fee transaction: if the registry is empty or
 * unreachable, the upload stops without charging the user for a blob that cannot be registered.
 */
export async function activeShelbyWriteLocation(
  fetcher: typeof fetch = fetch
): Promise<string> {
  const response = await fetcher(`${SHELBY_APTOS_FULLNODE_URL}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      function: `${SHELBY_DEPLOYER}::location::activated_location_names`,
      type_arguments: [],
      arguments: [],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not resolve a Shelbynet storage location (HTTP ${response.status}). Try again shortly.`
    );
  }

  const result = await response.json();
  const names = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : [];
  const active = names.find((name: unknown) => typeof name === "string" && name.trim());

  if (!active) {
    throw new Error(
      "Shelbynet currently has no active storage location. No platform fee was charged."
    );
  }

  return active;
}

/**
 * The payment tier to register under. Shelby's `payment` module currently exposes a single
 * active tier at index 0.
 */
export const SHELBY_PAYMENT_TIER = 0;

/** The protocol-level encryption enum. Circle Storage encrypts bytes itself before storage. */
export const SHELBY_ENCRYPTION_UNENCRYPTED = 0;

/**
 * Convert the SDK's merkle root into the bytes `register_blob` expects.
 *
 * The SDK hands back a hex string. Passing that straight through as the `vector<u8>` argument
 * makes the wallet encode its 66 characters as 66 bytes, and the contract rejects it with "the
 * blob commitment length is invalid (must be exactly 32 bytes)". Decode it instead, and fail
 * here rather than at signing time if it is ever not 32 bytes.
 */
export function blobCommitmentBytes(merkleRootHex: string): Uint8Array {
  const clean = String(merkleRootHex).replace(/^0x/, "");

  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error(
      `Blob commitment must be 32 bytes of hex, but got ${clean.length / 2} bytes ` +
        `("${String(merkleRootHex).slice(0, 24)}…").`
    );
  }

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Registering a blob costs far more gas than a plain transfer, and the default ceiling is not
 * always enough — an under-funded registration aborts with "Out of gas" after the fee is spent.
 */
export const REGISTER_BLOB_MAX_GAS = 100_000;

export type LeaseDuration = "7d" | "30d" | "90d" | "365d";

const LEASE_DAYS: Record<LeaseDuration, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

/**
 * When a Shelby blob stored under this lease should expire, in microseconds since the epoch.
 *
 * Shelby requires every blob to carry an expiration, which is what makes the lease duration a
 * real property of the stored object rather than a label.
 */
export function leaseExpirationMicros(duration: LeaseDuration, nowMs: number): number {
  return (nowMs + LEASE_DAYS[duration] * 86_400_000) * 1000;
}

/** Shelby rejects names longer than 190 characters or ending in a slash. */
const MAX_BLOB_NAME_LENGTH = 190;

/**
 * Build the Shelby blob name for an upload.
 *
 * Namespacing by uploader keeps one account's files from colliding with another's, and the
 * file id makes each upload unique even when the same file is uploaded twice.
 */
export function buildBlobName(uploader: string, fileId: string, fileName: string): string {
  const prefix = `${uploader.toLowerCase()}/${fileId}`;

  // Keep the original name for legibility, but strip anything that would complicate a path.
  const readable = fileName
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_BLOB_NAME_LENGTH - prefix.length - 1);

  const name = readable ? `${prefix}/${readable}` : prefix;
  return name.slice(0, MAX_BLOB_NAME_LENGTH).replace(/\/+$/, "");
}

export function isLeaseDuration(value: unknown): value is LeaseDuration {
  return value === "7d" || value === "30d" || value === "90d" || value === "365d";
}

/**
 * Shelby's own storage price, read from its `payment` module: 39 ShelbyUSD units per chunk per
 * epoch to the storage provider plus 3 to the admin, with a chunk of 1 MiB and an epoch of a
 * day. The uploader pays this to the protocol directly when registering the blob.
 */
const SHELBY_UNITS_PER_CHUNK_PER_EPOCH = 42;
const SHELBY_CHUNK_BYTES = 1024 * 1024;

/** What Shelby itself charges to store this file for the lease, in ShelbyUSD units. */
export function shelbyStorageCostUnits(sizeBytes: number, duration: LeaseDuration): number {
  const chunks = Math.max(1, Math.ceil(sizeBytes / SHELBY_CHUNK_BYTES));
  return chunks * SHELBY_UNITS_PER_CHUNK_PER_EPOCH * LEASE_DAYS[duration];
}

/**
 * This application's cut, as a share of what the storage actually costs.
 *
 * Expressed as a fraction of Shelby's price rather than a flat figure so it stays proportionate
 * to the storage being paid for. Adjust this one number to change the fee.
 */
export const PLATFORM_FEE_RATE = 0.1;

/**
 * The platform fee in the asset's smallest unit, which is what a transfer actually carries.
 *
 * Client and server both call this with the same inputs so they arrive at the same integer: the
 * client pays it, the server recomputes it to check the payment, and a mismatch of one unit
 * would reject every upload.
 */
export function leaseFeeSmallestUnits(sizeBytes: number, duration: LeaseDuration): number {
  return Math.max(1, Math.round(shelbyStorageCostUnits(sizeBytes, duration) * PLATFORM_FEE_RATE));
}

/** The platform fee in whole ShelbyUSD, for display. */
export function leaseFee(sizeBytes: number, duration: LeaseDuration): number {
  return leaseFeeSmallestUnits(sizeBytes, duration) / 10 ** SHELBY_USD_DECIMALS;
}

/** What Shelby charges, in whole ShelbyUSD, for display alongside the platform fee. */
export function shelbyStorageCost(sizeBytes: number, duration: LeaseDuration): number {
  return shelbyStorageCostUnits(sizeBytes, duration) / 10 ** SHELBY_USD_DECIMALS;
}
