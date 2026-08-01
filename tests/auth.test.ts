/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Wallet sign-in.
 *
 * These use real Ed25519 keys rather than stubs, because the whole point is that a signature
 * cannot be faked. Two rejections here were found by testing and not by reading: a signature
 * farmed elsewhere that merely contained our nonce used to be accepted, and so did a payload
 * naming somebody else's address.
 */

import { Account } from "@aptos-labs/ts-sdk";
import { describe, expect, it } from "vitest";
import {
  buildSignInMessage,
  createNonce,
  issueSessionToken,
  normalizeAddress,
  readSessionToken,
  verifyWalletSignature,
} from "../auth";

/** The envelope a wallet signs, as Petra composes it. */
function fullMessageFor(address: string, message: string, nonce: string) {
  return [
    "APTOS",
    `address: ${address}`,
    "application: http://localhost:3000",
    "chainId: 2",
    `message: ${message}`,
    `nonce: ${nonce}`,
  ].join("\n");
}

function sign(account: Account, payload: string) {
  return account.sign(new TextEncoder().encode(payload)).toString();
}

/** Ask for a nonce and sign it the way the browser would. */
async function signInAs(account: Account, options: { as?: Account } = {}) {
  const address = account.accountAddress.toStringLong();
  const nonce = createNonce(address);
  const fullMessage = fullMessageFor(address, buildSignInMessage(nonce), nonce);
  const signer = options.as ?? account;

  return verifyWalletSignature({
    address,
    publicKey: signer.publicKey.toString(),
    signature: sign(signer, fullMessage),
    fullMessage,
    nonce,
  });
}

describe("address normalisation", () => {
  it("pads short forms to the canonical length", () => {
    expect(normalizeAddress("0x1")).toBe(`0x${"0".repeat(63)}1`);
  });

  it("rejects nonsense", () => {
    expect(normalizeAddress("not-an-address")).toBeNull();
    expect(normalizeAddress("")).toBeNull();
  });
});

describe("session tokens", () => {
  const address = Account.generate().accountAddress.toStringLong();

  it("round-trips the address it was issued for", () => {
    expect(readSessionToken(issueSessionToken(address))).toBe(address.toLowerCase());
  });

  it("rejects a token with a tampered signature", () => {
    const token = issueSessionToken(address);
    expect(readSessionToken(`${token.slice(0, -2)}00`)).toBeNull();
  });

  it("rejects a token with a tampered payload", () => {
    const [payload, signature] = issueSessionToken(address).split(".");
    const forged = Buffer.from(
      JSON.stringify({ address: "0x1", exp: Date.now() + 60_000 }),
      "utf-8"
    ).toString("base64url");
    expect(readSessionToken(`${forged}.${signature}`)).toBeNull();
    expect(readSessionToken(`${payload}.${"0".repeat(64)}`)).toBeNull();
  });

  it.each(["", "nonsense", "a.b", undefined])("rejects %s", (token) => {
    expect(readSessionToken(token as string | undefined)).toBeNull();
  });
});

describe("wallet signature verification", () => {
  it("accepts a genuine signature", async () => {
    const account = Account.generate();
    const result = await signInAs(account);
    expect(result.ok).toBe(true);
    expect(result.address).toBe(account.accountAddress.toStringLong().toLowerCase());
  });

  it("refuses to reuse a nonce", async () => {
    const account = Account.generate();
    const address = account.accountAddress.toStringLong();
    const nonce = createNonce(address);
    const fullMessage = fullMessageFor(address, buildSignInMessage(nonce), nonce);
    const signature = sign(account, fullMessage);
    const attempt = () =>
      verifyWalletSignature({
        address,
        publicKey: account.publicKey.toString(),
        signature,
        fullMessage,
        nonce,
      });

    await expect(attempt()).resolves.toMatchObject({ ok: true });
    await expect(attempt()).resolves.toMatchObject({ ok: false });
  });

  it("rejects an unknown nonce", async () => {
    const account = Account.generate();
    const address = account.accountAddress.toStringLong();
    const nonce = "00".repeat(16);
    const fullMessage = fullMessageFor(address, buildSignInMessage(nonce), nonce);

    await expect(
      verifyWalletSignature({
        address,
        publicKey: account.publicKey.toString(),
        signature: sign(account, fullMessage),
        fullMessage,
        nonce,
      })
    ).resolves.toMatchObject({ ok: false });
  });

  it("rejects a key that does not control the claimed address", async () => {
    // Signing correctly is not enough; the key has to belong to the account being claimed.
    const claimed = Account.generate();
    const impostor = Account.generate();
    await expect(signInAs(claimed, { as: impostor })).resolves.toMatchObject({ ok: false });
  });

  it("rejects a signature over anything but this application's statement", async () => {
    // A signature collected on another site that merely quotes our nonce must not pass.
    const account = Account.generate();
    const address = account.accountAddress.toStringLong();
    const nonce = createNonce(address);
    const elsewhere = `Approve airdrop claim reference ${nonce}`;

    await expect(
      verifyWalletSignature({
        address,
        publicKey: account.publicKey.toString(),
        signature: sign(account, elsewhere),
        fullMessage: elsewhere,
        nonce,
      })
    ).resolves.toMatchObject({ ok: false });
  });

  it("rejects a payload that names a different address", async () => {
    const account = Account.generate();
    const other = Account.generate();
    const address = account.accountAddress.toStringLong();
    const nonce = createNonce(address);
    const fullMessage = fullMessageFor(
      other.accountAddress.toStringLong(),
      buildSignInMessage(nonce),
      nonce
    );

    await expect(
      verifyWalletSignature({
        address,
        publicKey: account.publicKey.toString(),
        signature: sign(account, fullMessage),
        fullMessage,
        nonce,
      })
    ).resolves.toMatchObject({ ok: false });
  });

  it("rejects a payload altered after signing", async () => {
    const account = Account.generate();
    const address = account.accountAddress.toStringLong();
    const nonce = createNonce(address);
    const fullMessage = fullMessageFor(address, buildSignInMessage(nonce), nonce);

    await expect(
      verifyWalletSignature({
        address,
        publicKey: account.publicKey.toString(),
        signature: sign(account, fullMessage),
        fullMessage: fullMessage.replace("chainId: 2", "chainId: 1"),
        nonce,
      })
    ).resolves.toMatchObject({ ok: false });
  });

  it.each([
    ["no signature", { signature: "" }],
    ["no public key", { publicKey: "" }],
    ["no payload", { fullMessage: "" }],
    ["a malformed address", { address: "nope" }],
  ])("rejects a request with %s", async (_label, overrides) => {
    const account = Account.generate();
    const address = account.accountAddress.toStringLong();
    const nonce = createNonce(address);
    const fullMessage = fullMessageFor(address, buildSignInMessage(nonce), nonce);

    await expect(
      verifyWalletSignature({
        address,
        publicKey: account.publicKey.toString(),
        signature: sign(account, fullMessage),
        fullMessage,
        nonce,
        ...overrides,
      })
    ).resolves.toMatchObject({ ok: false });
  });
});
