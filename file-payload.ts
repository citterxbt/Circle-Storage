/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Recovering the plaintext of a stored file.
 *
 * This lives apart from server.ts so the decryption the server actually performs is the same
 * code the tests exercise, rather than a second copy of it that could drift.
 */

import crypto from "crypto";
import { AUTH_TAG_LENGTH_BYTES, isValidIvHex, isValidKeyHex } from "./src/encryption";

export interface DecryptResult {
  ok: boolean;
  /** Set when ok: the recovered plaintext. */
  data?: Buffer;
  /** Set when the file could not be recovered: why. */
  reason?: string;
}

/**
 * True when this record carries a real key. Files uploaded before encryption existed have a
 * placeholder here and are stored as they were, so they are returned untouched.
 */
export function isEncrypted(file: { aes_key?: string; aes_iv?: string }): boolean {
  return isValidKeyHex(file.aes_key) && isValidIvHex(file.aes_iv);
}

/**
 * Decrypt what came back from Shelby.
 *
 * The browser encrypted with AES-GCM, which appends its authentication tag to the ciphertext;
 * Node wants that tag separately. An empty file encrypts to nothing but the tag, so a
 * zero-length remainder is still valid — only a shorter one is impossible.
 */
export function decryptStoredFile(cipher: Buffer, keyHex: string, ivHex: string): DecryptResult {
  if (!isValidKeyHex(keyHex) || !isValidIvHex(ivHex)) {
    return { ok: false, reason: "The stored key or nonce is not usable." };
  }

  const tagAt = cipher.length - AUTH_TAG_LENGTH_BYTES;
  if (tagAt < 0) {
    return { ok: false, reason: "Stored file is too short to be valid ciphertext." };
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(keyHex.replace(/^0x/, ""), "hex"),
      Buffer.from(ivHex.replace(/^0x/, ""), "hex")
    );
    decipher.setAuthTag(cipher.subarray(tagAt));

    return {
      ok: true,
      data: Buffer.concat([decipher.update(cipher.subarray(0, tagAt)), decipher.final()]),
    };
  } catch (err) {
    // A failure means the bytes or the key do not match. Returning the ciphertext instead would
    // hand over something unusable and look like corruption further downstream.
    console.error("[Circle Storage] Could not decrypt a stored file:", err);
    return { ok: false, reason: "The stored file could not be decrypted." };
  }
}
