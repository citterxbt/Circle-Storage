/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * On-chain payment verification.
 *
 * Every field here arrives from a caller who benefits from lying about it, so each rejection is
 * load-bearing: before this existed, any 64-character string counted as proof of payment. The
 * fungible-asset cases mirror how the node actually renders an Object argument, `{ inner }`,
 * which was taken from a real ShelbyUSD transfer on testnet.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAptPayment, verifyShelbyUsdPayment } from "../payments";
import { SHELBY_USD_ASSET_TYPE } from "../src/shelby";

const HASH = `0x${"a".repeat(64)}`;
const PAYER = "0xb79959d5aa6efcfa5dcecb8fe8a9c485c9d5a6b6c66baac8d521947862d588c0";
const TREASURY = PAYER;
const SOMEONE_ELSE = "0x53442c9ad0ba9b107d031371c63de56492916e40167e2a5c2cc5cbbc09699e6";

/** Answer the node lookup with a canned transaction, or a 404. */
function respondWith(tx: unknown | 404) {
  vi.stubGlobal("fetch", async () =>
    tx === 404
      ? { status: 404, ok: false, json: async () => ({}), text: async () => "" }
      : { status: 200, ok: true, json: async () => tx, text: async () => "" }
  );
}

const shelbyTransfer = (overrides: Record<string, any> = {}) => ({
  type: "user_transaction",
  success: true,
  sender: PAYER,
  payload: {
    type: "entry_function_payload",
    function: "0x1::primary_fungible_store::transfer",
    type_arguments: ["0x1::fungible_asset::Metadata"],
    arguments: [{ inner: SHELBY_USD_ASSET_TYPE }, TREASURY, "5000000"],
    ...(overrides.payload || {}),
  },
  ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== "payload")),
});

const aptTransfer = (overrides: Record<string, any> = {}) => ({
  type: "user_transaction",
  success: true,
  sender: PAYER,
  payload: {
    type: "entry_function_payload",
    function: "0x1::aptos_account::transfer",
    type_arguments: [],
    arguments: [SOMEONE_ELSE, "100000000"],
    ...(overrides.payload || {}),
  },
  ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== "payload")),
});

const checkShelby = (minimumUnits = 5_000_000) =>
  verifyShelbyUsdPayment({
    txHash: HASH,
    expectedSender: PAYER,
    expectedRecipient: TREASURY,
    minimumUnits,
  });

afterEach(() => vi.unstubAllGlobals());

describe("ShelbyUSD lease payments", () => {
  it("accepts a transfer of exactly the fee", async () => {
    respondWith(shelbyTransfer());
    await expect(checkShelby()).resolves.toMatchObject({ ok: true });
  });

  it("accepts an overpayment", async () => {
    respondWith(shelbyTransfer());
    await expect(checkShelby(4_000_000)).resolves.toMatchObject({ ok: true });
  });

  it("accepts the asset written as a plain address", async () => {
    respondWith(
      shelbyTransfer({
        payload: { arguments: [SHELBY_USD_ASSET_TYPE, TREASURY, "5000000"] },
      })
    );
    await expect(checkShelby()).resolves.toMatchObject({ ok: true });
  });

  it("reports what the chain moved rather than what was claimed", async () => {
    respondWith(shelbyTransfer());
    const result = await checkShelby();
    expect(result.amountOctas).toBe(5_000_000n);
  });

  it("rejects an underpayment", async () => {
    respondWith(shelbyTransfer());
    await expect(checkShelby(5_000_001)).resolves.toMatchObject({ ok: false });
  });

  it("rejects payment to anyone but the treasury", async () => {
    respondWith(
      shelbyTransfer({
        payload: { arguments: [{ inner: SHELBY_USD_ASSET_TYPE }, SOMEONE_ELSE, "5000000"] },
      })
    );
    await expect(checkShelby()).resolves.toMatchObject({ ok: false });
  });

  it("rejects payment in some other fungible asset", async () => {
    // Otherwise a token the payer minted themselves would satisfy the amount check.
    respondWith(
      shelbyTransfer({ payload: { arguments: [{ inner: SOMEONE_ELSE }, TREASURY, "5000000"] } })
    );
    await expect(checkShelby()).resolves.toMatchObject({ ok: false });
  });

  it.each([
    ["a different function", { payload: { function: "0x1::coin::transfer" } }],
    ["a non-metadata type argument", { payload: { type_arguments: ["0x1::aptos_coin::AptosCoin"] } }],
    ["too few arguments", { payload: { arguments: [{ inner: SHELBY_USD_ASSET_TYPE }, TREASURY] } }],
    ["another sender", { sender: SOMEONE_ELSE }],
    ["a failed transaction", { success: false, vm_status: "ABORTED" }],
    ["a non-user transaction", { type: "state_checkpoint_transaction" }],
    ["a script payload", { payload: { type: "script_payload" } }],
  ])("rejects %s", async (_label, overrides) => {
    respondWith(shelbyTransfer(overrides as Record<string, any>));
    await expect(checkShelby()).resolves.toMatchObject({ ok: false });
  });

  it("rejects a hash that is not 32 bytes", async () => {
    respondWith(shelbyTransfer());
    const result = await verifyShelbyUsdPayment({
      txHash: "0xdeadbeef",
      expectedSender: PAYER,
      expectedRecipient: TREASURY,
      minimumUnits: 1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a transaction that is not on chain", async () => {
    respondWith(404);
    await expect(checkShelby()).resolves.toMatchObject({ ok: false });
  });
});

describe("APT purchases", () => {
  const checkApt = (minimumApt = 1) =>
    verifyAptPayment({
      txHash: HASH,
      expectedSender: PAYER,
      expectedRecipient: SOMEONE_ELSE,
      minimumApt,
    });

  it("accepts aptos_account::transfer, which works without a CoinStore", async () => {
    respondWith(aptTransfer());
    await expect(checkApt()).resolves.toMatchObject({ ok: true });
  });

  it("accepts coin::transfer of APT", async () => {
    respondWith(
      aptTransfer({
        payload: {
          function: "0x1::coin::transfer",
          type_arguments: ["0x1::aptos_coin::AptosCoin"],
        },
      })
    );
    await expect(checkApt()).resolves.toMatchObject({ ok: true });
  });

  it("rejects payment in a coin that is not APT", async () => {
    respondWith(
      aptTransfer({
        payload: { function: "0x1::coin::transfer", type_arguments: ["0x1::some::Token"] },
      })
    );
    await expect(checkApt()).resolves.toMatchObject({ ok: false });
  });

  it("rejects paying less than the listed price", async () => {
    respondWith(aptTransfer());
    await expect(checkApt(2)).resolves.toMatchObject({ ok: false });
  });

  it("rejects payment to someone other than the uploader", async () => {
    respondWith(aptTransfer({ payload: { arguments: [PAYER, "100000000"] } }));
    await expect(checkApt()).resolves.toMatchObject({ ok: false });
  });

  it("rejects a transaction sent by another wallet", async () => {
    respondWith(aptTransfer({ sender: SOMEONE_ELSE }));
    await expect(checkApt()).resolves.toMatchObject({ ok: false });
  });
});
