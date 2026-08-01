/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * File encryption shared between the browser and the server.
 *
 * Blobs on Shelby are readable by anyone who knows their name, and the name is an argument of
 * the public `register_blob` transaction — so a paywall cannot rest on keeping it secret.
 * Files are therefore encrypted before they are uploaded, which leaves the blob useless without
 * its key, and the key is released only after the same purchase check that gates a download.
 *
 * Encryption happens in the browser rather than on the server because the blob's commitments
 * are computed there and registered on chain: encrypting afterwards would upload bytes that no
 * longer match what the contract recorded.
 *
 * The server holds the keys, so it can read any file. That is a real limitation, not a
 * zero-knowledge design: it stops the public reading a paid file straight off Shelby, and
 * nothing more.
 */

/** AES-GCM with a 256-bit key. */
export const ENCRYPTION_ALGORITHM = "AES-GCM";
export const ENCRYPTION_KEY_BITS = 256;

/** GCM's standard nonce length. */
export const IV_LENGTH_BYTES = 12;

/**
 * GCM authentication tag length. WebCrypto appends the tag to the ciphertext; Node's decipher
 * wants it separately, so the server splits these bytes off the end.
 */
export const AUTH_TAG_LENGTH_BYTES = 16;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error("Expected an even-length hex string.");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Lengths a stored key and nonce must have, checked before anything relies on them. */
export function isValidKeyHex(hex: unknown): boolean {
  return typeof hex === "string" && /^[0-9a-fA-F]{64}$/.test(hex.replace(/^0x/, ""));
}

export function isValidIvHex(hex: unknown): boolean {
  return (
    typeof hex === "string" &&
    new RegExp(`^[0-9a-fA-F]{${IV_LENGTH_BYTES * 2}}$`).test(hex.replace(/^0x/, ""))
  );
}
