/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Wallet-based authentication.
 *
 * The client proves control of an Aptos address by signing a server-issued nonce with its
 * wallet. Once verified, the server hands out an HMAC-signed session cookie, and every
 * protected route derives the caller's address from that cookie instead of trusting an
 * address supplied in the request body.
 */

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { AccountAddress, Ed25519PublicKey, Ed25519Signature } from "@aptos-labs/ts-sdk";

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const SESSION_COOKIE = "cs_session";

const APTOS_FULLNODE = process.env.APTOS_FULLNODE_URL || "https://fullnode.testnet.aptoslabs.com/v1";
const EXPECTED_APPLICATION =
  process.env.APP_ORIGIN || `http://localhost:${process.env.PORT || "3000"}`;
const EXPECTED_CHAIN_ID = process.env.APTOS_CHAIN_ID || "2";

/**
 * Secret used to sign session tokens. In production this must be supplied so that sessions
 * survive a restart and cannot be forged; in development we fall back to an ephemeral value.
 */
const SESSION_SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters when NODE_ENV=production."
    );
  }
  console.warn(
    "[Circle Storage] SESSION_SECRET is unset or too short. Using an ephemeral development " +
      "secret — all sessions will be invalidated on restart."
  );
  return crypto.randomBytes(32).toString("hex");
})();

/**
 * Pending nonces, keyed by lowercase address.
 *
 * This is process-local, so it does not survive a restart and is not shared across
 * instances. Move it to a shared store (Supabase, Redis) before running more than one
 * replica.
 */
const pendingNonces = new Map<string, { nonce: string; expiresAt: number }>();

function pruneExpiredNonces() {
  const now = Date.now();
  for (const [address, entry] of pendingNonces) {
    if (entry.expiresAt <= now) pendingNonces.delete(address);
  }
}

/** Normalise any accepted address form to the canonical 66-character representation. */
export function normalizeAddress(value: string): string | null {
  try {
    return AccountAddress.from(value).toStringLong().toLowerCase();
  } catch {
    return null;
  }
}

export function createNonce(address: string): string {
  pruneExpiredNonces();
  const nonce = crypto.randomBytes(16).toString("hex");
  pendingNonces.set(address.toLowerCase(), { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
  return nonce;
}

/** Returns true only once per issued nonce, so a captured signature cannot be replayed. */
function consumeNonce(address: string, nonce: string): boolean {
  const key = address.toLowerCase();
  const entry = pendingNonces.get(key);
  if (!entry) return false;
  pendingNonces.delete(key);
  if (entry.expiresAt <= Date.now()) return false;
  return timingSafeEqual(entry.nonce, nonce);
}

/** The human-readable statement the wallet is asked to sign. */
export function buildSignInMessage(nonce: string): string {
  return `Sign in to Circle Storage. This request will not trigger a blockchain transaction or cost any gas. Nonce: ${nonce}`;
}

/** Read one field from the AIP-62 structured message that the wallet actually signed. */
function signedField(fullMessage: string, field: string): string | null {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}:\\s*(.*?)\\s*$`, "im").exec(fullMessage);
  return match?.[1] || null;
}

/**
 * Wallets have emitted the application as either an origin or a bare host. Accept both forms,
 * but never a different host: the application field is what prevents a signature collected by
 * another website from becoming a Circle Storage session.
 */
function applicationMatches(actual: string, expected: string): boolean {
  try {
    const expectedUrl = new URL(expected);
    const cleanActual = actual.trim().replace(/\/$/, "").toLowerCase();
    return (
      cleanActual === expectedUrl.origin.toLowerCase() ||
      cleanActual === expectedUrl.host.toLowerCase()
    );
  } catch {
    return (
      actual.trim().replace(/\/$/, "").toLowerCase() ===
      expected.trim().replace(/\/$/, "").toLowerCase()
    );
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Confirm that the public key which produced the signature actually controls the claimed
 * address.
 *
 * Normally the address is derived directly from the key. Accounts that have rotated their
 * authentication key no longer satisfy that, so fall back to comparing against the auth key
 * the chain currently records for the address.
 */
async function publicKeyControlsAddress(
  publicKey: Ed25519PublicKey,
  address: string
): Promise<boolean> {
  const derivedAuthKey = publicKey.authKey();

  const derivedAddress = derivedAuthKey.derivedAddress().toStringLong().toLowerCase();
  if (derivedAddress === address.toLowerCase()) return true;

  try {
    const response = await fetch(`${APTOS_FULLNODE}/accounts/${address}`);
    if (!response.ok) return false;
    const account = await response.json();
    if (typeof account?.authentication_key !== "string") return false;
    return (
      account.authentication_key.toLowerCase() === derivedAuthKey.toString().toLowerCase()
    );
  } catch (err) {
    console.warn("[Circle Storage] Could not read on-chain auth key for rotation check:", err);
    return false;
  }
}

export interface VerifyRequest {
  address: string;
  publicKey: string;
  signature: string;
  /** The exact payload the wallet signed, which wraps our message with wallet metadata. */
  fullMessage: string;
  nonce: string;
}

/**
 * Deliberately not a discriminated union: this project compiles with `strict` off, and
 * without `strictNullChecks` TypeScript cannot narrow one of those by its `ok` flag.
 */
export interface VerifyResult {
  ok: boolean;
  /** Set when `ok` is true: the verified, canonical address. */
  address?: string;
  /** Set when `ok` is false: why verification failed. */
  reason?: string;
}

export async function verifyWalletSignature(input: VerifyRequest): Promise<VerifyResult> {
  const { address, publicKey, signature, fullMessage, nonce } = input;

  if (!address || !publicKey || !signature || !fullMessage || !nonce) {
    return { ok: false, reason: "Missing signature parameters." };
  }

  const normalized = normalizeAddress(address);
  if (!normalized) return { ok: false, reason: "Malformed Aptos address." };

  if (!consumeNonce(normalized, nonce)) {
    return { ok: false, reason: "Nonce is unknown, already used, or expired." };
  }

  // Validate every security-relevant field before checking the signature. A genuine signature
  // is not enough when it was requested by a different dapp, on a different network, or over a
  // larger message that merely quotes our statement.
  if (fullMessage.split(/\r?\n/, 1)[0]?.trim() !== "APTOS") {
    return { ok: false, reason: "Signed payload is not an Aptos structured message." };
  }

  if (signedField(fullMessage, "message") !== buildSignInMessage(nonce)) {
    return { ok: false, reason: "Signed payload is not this application's sign-in statement." };
  }

  const application = signedField(fullMessage, "application");
  if (!application || !applicationMatches(application, EXPECTED_APPLICATION)) {
    return { ok: false, reason: "Signed payload was requested by a different application." };
  }

  if (signedField(fullMessage, "chainId") !== EXPECTED_CHAIN_ID) {
    return { ok: false, reason: "Wallet must be connected to Aptos testnet to sign in." };
  }

  // Wallets that echo the signing address must echo the one being claimed.
  const addressLine = /^address:\s*(\S+)\s*$/im.exec(fullMessage);
  if (addressLine) {
    const signedAddress = normalizeAddress(addressLine[1]);
    if (!signedAddress || signedAddress !== normalized) {
      return { ok: false, reason: "Signed payload names a different address." };
    }
  }

  let key: Ed25519PublicKey;
  try {
    key = new Ed25519PublicKey(publicKey);
  } catch {
    return { ok: false, reason: "Unsupported or malformed public key." };
  }

  let signatureValid = false;
  try {
    signatureValid = key.verifySignature({
      message: new TextEncoder().encode(fullMessage),
      signature: new Ed25519Signature(signature),
    });
  } catch (err) {
    console.warn("[Circle Storage] Signature verification threw:", err);
    return { ok: false, reason: "Signature could not be verified." };
  }

  if (!signatureValid) return { ok: false, reason: "Signature does not match the payload." };

  if (!(await publicKeyControlsAddress(key, normalized))) {
    return { ok: false, reason: "Public key does not control the claimed address." };
  }

  return { ok: true, address: normalized };
}

/** Session token format: base64url(payload).hex(hmac) */
export function issueSessionToken(address: string): string {
  const payload = JSON.stringify({ address, exp: Date.now() + SESSION_TTL_MS });
  const encoded = Buffer.from(payload, "utf-8").toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("hex");
  return `${encoded}.${signature}`;
}

export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("hex");
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (typeof payload?.address !== "string" || typeof payload?.exp !== "number") return null;
    if (payload.exp <= Date.now()) return null;
    return payload.address.toLowerCase();
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_MS,
  path: "/",
};

/** The address of the authenticated caller, or null when there is no valid session. */
export function sessionAddress(req: Request): string | null {
  return readSessionToken(req.cookies?.[SESSION_COOKIE]);
}

/**
 * Gate a route behind a valid session and expose the verified address as `req.walletAddress`.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const address = sessionAddress(req);
  if (!address) {
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      message: "Connect and sign in with your Aptos wallet to continue.",
    });
  }
  req.walletAddress = address;
  next();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      walletAddress?: string;
    }
  }
}
