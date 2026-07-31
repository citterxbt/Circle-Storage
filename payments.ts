/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * On-chain verification of APT payments.
 *
 * A transaction hash on its own proves nothing: it has to be a successful transfer, sent by
 * the buyer, to the uploader, for at least the listed price. Every one of those has to be
 * checked against the chain, because all of them are attacker-controlled inputs.
 */

import { AccountAddress } from "@aptos-labs/ts-sdk";

const APTOS_FULLNODE = process.env.APTOS_FULLNODE_URL || "https://fullnode.testnet.aptoslabs.com/v1";

const OCTAS_PER_APT = 100_000_000;

const APT_COIN_TYPE = "0x1::aptos_coin::AptosCoin";

/** Entry functions we recognise as a plain APT transfer. */
const TRANSFER_FUNCTIONS = new Set([
  "0x1::coin::transfer",
  "0x1::aptos_account::transfer",
  "0x1::aptos_account::transfer_coins",
]);

export interface PaymentCheck {
  txHash: string;
  expectedSender: string;
  expectedRecipient: string;
  minimumApt: number;
}

/** Not a discriminated union, for the same reason as `VerifyResult` in auth.ts. */
export interface PaymentResult {
  ok: boolean;
  /** Set when `ok` is true: the amount the chain actually moved. */
  amountOctas?: bigint;
  /** Set when `ok` is false: why the payment was rejected. */
  reason?: string;
}

function sameAddress(a: string, b: string): boolean {
  try {
    return AccountAddress.from(a).equals(AccountAddress.from(b));
  } catch {
    return false;
  }
}

/**
 * Simulated payments let the flow be exercised without a funded testnet wallet. This is off
 * unless explicitly enabled, and refuses to turn on in production.
 */
export function simulatedPaymentsAllowed(): boolean {
  return (
    process.env.ALLOW_SIMULATED_PAYMENTS === "true" && process.env.NODE_ENV !== "production"
  );
}

export async function verifyAptPayment(check: PaymentCheck): Promise<PaymentResult> {
  const { txHash, expectedSender, expectedRecipient, minimumApt } = check;

  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: "Transaction hash is not a 32-byte hex value." };
  }

  let tx: any;
  try {
    const response = await fetch(`${APTOS_FULLNODE}/transactions/by_hash/${txHash}`);
    if (response.status === 404) {
      return { ok: false, reason: "Transaction was not found on chain." };
    }
    if (!response.ok) {
      return { ok: false, reason: `Aptos node returned HTTP ${response.status}.` };
    }
    tx = await response.json();
  } catch (err) {
    console.warn("[Circle Storage] Aptos node unreachable during payment check:", err);
    return { ok: false, reason: "Could not reach the Aptos node to verify the payment." };
  }

  if (tx?.type !== "user_transaction") {
    return { ok: false, reason: "Hash does not refer to a user transaction." };
  }

  if (tx.success !== true) {
    return { ok: false, reason: `Transaction did not succeed (${tx.vm_status || "unknown"}).` };
  }

  if (!sameAddress(String(tx.sender || ""), expectedSender)) {
    return { ok: false, reason: "Transaction was not sent by the purchasing wallet." };
  }

  const payload = tx.payload;
  if (payload?.type !== "entry_function_payload") {
    return { ok: false, reason: "Transaction is not a direct entry-function transfer." };
  }

  if (!TRANSFER_FUNCTIONS.has(String(payload.function))) {
    return { ok: false, reason: `Unsupported payment function: ${payload.function}` };
  }

  // coin::transfer and transfer_coins are generic; a non-APT type argument means the buyer
  // paid in some other asset.
  const typeArgs: string[] = Array.isArray(payload.type_arguments) ? payload.type_arguments : [];
  if (typeArgs.length > 0 && typeArgs[0] !== APT_COIN_TYPE) {
    return { ok: false, reason: "Payment was not made in APT." };
  }

  const args: unknown[] = Array.isArray(payload.arguments) ? payload.arguments : [];
  if (args.length < 2) {
    return { ok: false, reason: "Transfer payload is missing its recipient or amount." };
  }

  if (!sameAddress(String(args[0]), expectedRecipient)) {
    return { ok: false, reason: "Payment did not go to the file's uploader." };
  }

  let amountOctas: bigint;
  try {
    amountOctas = BigInt(String(args[1]));
  } catch {
    return { ok: false, reason: "Transfer amount could not be read." };
  }

  const requiredOctas = BigInt(Math.floor(minimumApt * OCTAS_PER_APT));
  if (amountOctas < requiredOctas) {
    return {
      ok: false,
      reason: `Paid ${amountOctas} octas but the listing requires ${requiredOctas}.`,
    };
  }

  return { ok: true, amountOctas };
}
