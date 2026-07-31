/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * On-chain verification of payments.
 *
 * A transaction hash on its own proves nothing: it has to be a successful transfer, sent by
 * the payer, to the expected recipient, for at least the expected amount, in the expected
 * asset. Every one of those is an attacker-controlled input, so each is checked against chain.
 */

import { AccountAddress } from "@aptos-labs/ts-sdk";
import {
  FUNGIBLE_METADATA_TYPE,
  FUNGIBLE_TRANSFER_FUNCTION,
  SHELBY_USD_ASSET_TYPE,
} from "./src/shelby";

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

/**
 * Fetch a transaction and apply the checks every payment shares: it exists, it is a settled
 * user transaction that succeeded, the expected wallet sent it, and it directly calls an entry
 * function. Returns the entry-function payload, or the reason it cannot be trusted.
 */
async function loadSettledTransfer(
  txHash: string,
  expectedSender: string
): Promise<{ payload?: any; reason?: string }> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { reason: "Transaction hash is not a 32-byte hex value." };
  }

  let tx: any;
  try {
    const response = await fetch(`${APTOS_FULLNODE}/transactions/by_hash/${txHash}`);
    if (response.status === 404) {
      return { reason: "Transaction was not found on chain." };
    }
    if (!response.ok) {
      return { reason: `Aptos node returned HTTP ${response.status}.` };
    }
    tx = await response.json();
  } catch (err) {
    console.warn("[Circle Storage] Aptos node unreachable during payment check:", err);
    return { reason: "Could not reach the Aptos node to verify the payment." };
  }

  if (tx?.type !== "user_transaction") {
    return { reason: "Hash does not refer to a user transaction." };
  }

  if (tx.success !== true) {
    return { reason: `Transaction did not succeed (${tx.vm_status || "unknown"}).` };
  }

  if (!sameAddress(String(tx.sender || ""), expectedSender)) {
    return { reason: "Transaction was not sent by the paying wallet." };
  }

  if (tx.payload?.type !== "entry_function_payload") {
    return { reason: "Transaction is not a direct entry-function transfer." };
  }

  return { payload: tx.payload };
}

export async function verifyAptPayment(check: PaymentCheck): Promise<PaymentResult> {
  const { txHash, expectedSender, expectedRecipient, minimumApt } = check;

  const loaded = await loadSettledTransfer(txHash, expectedSender);
  if (!loaded.payload) return { ok: false, reason: loaded.reason };
  const payload = loaded.payload;

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

export interface ShelbyPaymentCheck {
  txHash: string;
  expectedSender: string;
  expectedRecipient: string;
  /** Required amount in ShelbyUSD's smallest unit. */
  minimumUnits: number;
}

/**
 * Verify a ShelbyUSD storage-lease payment.
 *
 * The transfer must call the framework's primary-store transfer for a fungible asset, and the
 * asset it moved must be ShelbyUSD itself — otherwise a payment in some worthless token the
 * payer minted would satisfy the recipient and amount checks.
 */
export async function verifyShelbyUsdPayment(
  check: ShelbyPaymentCheck
): Promise<PaymentResult> {
  const { txHash, expectedSender, expectedRecipient, minimumUnits } = check;

  const loaded = await loadSettledTransfer(txHash, expectedSender);
  if (!loaded.payload) return { ok: false, reason: loaded.reason };
  const payload = loaded.payload;

  if (String(payload.function) !== FUNGIBLE_TRANSFER_FUNCTION) {
    return { ok: false, reason: `Unsupported lease payment function: ${payload.function}` };
  }

  const typeArgs: string[] = Array.isArray(payload.type_arguments) ? payload.type_arguments : [];
  if (typeArgs[0] !== FUNGIBLE_METADATA_TYPE) {
    return { ok: false, reason: "Lease payment was not a fungible asset transfer." };
  }

  // arguments are (metadata object, recipient, amount)
  const args: unknown[] = Array.isArray(payload.arguments) ? payload.arguments : [];
  if (args.length < 3) {
    return { ok: false, reason: "Lease transfer payload is missing its asset, recipient or amount." };
  }

  const metadata =
    typeof args[0] === "object" && args[0] !== null
      ? String((args[0] as any).inner ?? (args[0] as any).address ?? "")
      : String(args[0]);

  if (!sameAddress(metadata, SHELBY_USD_ASSET_TYPE)) {
    return { ok: false, reason: "Lease payment was not made in ShelbyUSD." };
  }

  if (!sameAddress(String(args[1]), expectedRecipient)) {
    return { ok: false, reason: "Lease payment did not go to the storage treasury." };
  }

  let amountUnits: bigint;
  try {
    amountUnits = BigInt(String(args[2]));
  } catch {
    return { ok: false, reason: "Lease amount could not be read." };
  }

  const required = BigInt(Math.max(0, Math.floor(minimumUnits)));
  if (amountUnits < required) {
    return {
      ok: false,
      reason: `Paid ${amountUnits} ShelbyUSD units but the lease requires ${required}.`,
    };
  }

  return { ok: true, amountOctas: amountUnits };
}
