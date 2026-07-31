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

/** ShelbyUSD on Aptos testnet: name "ShelbyUSD", symbol "SHELBY_USD". */
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

/** ShelbyUSD charged per megabyte, by lease length. */
const LEASE_COST_PER_MB: Record<LeaseDuration, number> = {
  "7d": 0.002,
  "30d": 0.008,
  "90d": 0.02,
  "365d": 0.07,
};

const LEASE_BASE_FEE = 0.05;

export function isLeaseDuration(value: unknown): value is LeaseDuration {
  return value === "7d" || value === "30d" || value === "90d" || value === "365d";
}

/** The lease fee in whole ShelbyUSD, for display. */
export function leaseFee(sizeBytes: number, duration: LeaseDuration): number {
  const megabytes = sizeBytes / 1024 / 1024;
  return LEASE_BASE_FEE + megabytes * LEASE_COST_PER_MB[duration];
}

/**
 * The lease fee in the asset's smallest unit, which is what a transfer actually carries.
 *
 * Client and server both call this with the same inputs so they arrive at the same integer.
 */
export function leaseFeeSmallestUnits(sizeBytes: number, duration: LeaseDuration): number {
  return Math.round(leaseFee(sizeBytes, duration) * 10 ** SHELBY_USD_DECIMALS);
}
