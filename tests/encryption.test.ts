/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The browser encrypts and the server decrypts, so these two have to agree exactly. The cases
 * here are the ones that caught real faults: an empty file encrypts to nothing but its
 * authentication tag, which an off-by-one length guard rejected as too short.
 */

import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { decryptStoredFile, isEncrypted } from "../file-payload";
import {
  AUTH_TAG_LENGTH_BYTES,
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_KEY_BITS,
  IV_LENGTH_BYTES,
  bytesToHex,
  hexToBytes,
  isValidIvHex,
  isValidKeyHex,
} from "../src/encryption";

/** Exactly what FileUploadPage does, using the same WebCrypto API the browser exposes. */
async function encryptAsBrowser(plain: Uint8Array) {
  const key = await crypto.webcrypto.subtle.generateKey(
    { name: ENCRYPTION_ALGORITHM, length: ENCRYPTION_KEY_BITS },
    true,
    ["encrypt"]
  );
  const iv = crypto.webcrypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const cipher = await crypto.webcrypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    plain
  );

  return {
    cipher: Buffer.from(new Uint8Array(cipher)),
    aesKey: bytesToHex(new Uint8Array(await crypto.webcrypto.subtle.exportKey("raw", key))),
    aesIv: bytesToHex(iv),
  };
}

/** The server's own decryption, so a regression there fails here. */
function decryptAsServer(cipher: Buffer, aesKey: string, aesIv: string): Buffer {
  const result = decryptStoredFile(cipher, aesKey, aesIv);
  if (!result.ok) throw new Error(result.reason);
  return result.data!;
}

describe("hex helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = crypto.randomBytes(48);
    expect(Buffer.from(hexToBytes(bytesToHex(bytes)))).toEqual(bytes);
  });

  it("accepts a 0x prefix", () => {
    expect(hexToBytes("0xff00")).toEqual(new Uint8Array([255, 0]));
  });

  it.each(["abc", "zz", "0xzz"])("rejects %s", (bad) => {
    expect(() => hexToBytes(bad)).toThrow();
  });
});

describe("key and nonce validation", () => {
  it("accepts what the browser produces", async () => {
    const { aesKey, aesIv } = await encryptAsBrowser(new Uint8Array([1, 2, 3]));
    expect(isValidKeyHex(aesKey)).toBe(true);
    expect(isValidIvHex(aesIv)).toBe(true);
  });

  it("rejects the placeholder keys that predate real encryption", () => {
    expect(isValidKeyHex("aes_key_vutp9rngqk")).toBe(false);
    expect(isValidIvHex("")).toBe(false);
  });

  it.each([
    ["too short", "ab".repeat(16)],
    ["too long", "ab".repeat(33)],
    ["not hex", "z".repeat(64)],
    ["not a string", 1234],
  ])("rejects a key that is %s", (_label, key) => {
    expect(isValidKeyHex(key)).toBe(false);
  });
});

describe("browser to server round-trip", () => {
  // 1 MiB matters because it is a chunk boundary for pricing; empty matters because the
  // ciphertext is then nothing but the tag.
  it.each([
    ["an empty file", 0],
    ["one byte", 1],
    ["3 KB", 3000],
    ["1 MiB exactly", 1024 * 1024],
    ["2 MiB exactly", 2 * 1024 * 1024],
  ])(
    "recovers %s byte for byte",
    async (_label, size) => {
      const plain = crypto.randomBytes(size);
      const { cipher, aesKey, aesIv } = await encryptAsBrowser(plain);

      expect(cipher.length).toBe(size + AUTH_TAG_LENGTH_BYTES);
      expect(decryptAsServer(cipher, aesKey, aesIv)).toEqual(plain);
    },
    // The megabyte cases are kept because they sit on a pricing boundary, and encrypting that
    // much takes longer than the default limit allows on a shared CI runner.
    30_000
  );

  it("refuses a wrong key rather than returning rubbish", async () => {
    const { cipher, aesIv } = await encryptAsBrowser(crypto.randomBytes(256));
    const wrongKey = bytesToHex(crypto.randomBytes(32));
    expect(() => decryptAsServer(cipher, wrongKey, aesIv)).toThrow();
  });

  it("refuses a wrong nonce", async () => {
    const { cipher, aesKey } = await encryptAsBrowser(crypto.randomBytes(256));
    const wrongIv = bytesToHex(crypto.randomBytes(IV_LENGTH_BYTES));
    expect(() => decryptAsServer(cipher, aesKey, wrongIv)).toThrow();
  });

  it("detects a single flipped bit", async () => {
    const { cipher, aesKey, aesIv } = await encryptAsBrowser(crypto.randomBytes(256));
    const tampered = Buffer.from(cipher);
    tampered[0] ^= 1;
    expect(() => decryptAsServer(tampered, aesKey, aesIv)).toThrow();
  });

  it("rejects ciphertext shorter than the tag", async () => {
    const { aesKey, aesIv } = await encryptAsBrowser(new Uint8Array([1]));
    expect(() => decryptAsServer(Buffer.alloc(8), aesKey, aesIv)).toThrow(/too short/);
  });
});

describe("legacy records", () => {
  it("treats the pre-encryption placeholder as unencrypted", () => {
    expect(isEncrypted({ aes_key: "aes_key_vutp9rngqk", aes_iv: "" })).toBe(false);
  });

  it("treats a real key and nonce as encrypted", async () => {
    const { aesKey, aesIv } = await encryptAsBrowser(new Uint8Array([7]));
    expect(isEncrypted({ aes_key: aesKey, aes_iv: aesIv })).toBe(true);
  });

  it("refuses to decrypt with an unusable key instead of throwing", () => {
    const result = decryptStoredFile(Buffer.alloc(32), "aes_key_nope", "");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not usable/);
  });
});
