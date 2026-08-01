/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Server } from "http";
import { Account } from "@aptos-labs/ts-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSignInMessage } from "../auth";
import { createApp, type DatabaseSchema } from "../server";

const emptyDatabase = (): DatabaseSchema => ({ profiles: {}, files: {}, purchases: [] });

function walletMessage(address: string, message: string, nonce: string) {
  return [
    "APTOS",
    `address: ${address}`,
    "application: http://localhost:3000",
    "chainId: 2",
    `message: ${message}`,
    `nonce: ${nonce}`,
  ].join("\n");
}

describe("API authentication boundary", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = await createApp({
      database: emptyDatabase(),
      persistDatabase: () => {},
      serveFrontend: false,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a port.");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("rejects malformed nonce requests and protected requests without a session", async () => {
    const nonce = await fetch(`${baseUrl}/api/auth/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "not-an-address" }),
    });
    expect(nonce.status).toBe(400);

    const session = await fetch(`${baseUrl}/api/auth/session`);
    expect(session.status).toBe(401);
    await expect(session.json()).resolves.toMatchObject({ error: "UNAUTHENTICATED" });

    const profile = await fetch(`${baseUrl}/api/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "intruder" }),
    });
    expect(profile.status).toBe(401);
  });

  it("opens a cookie session and ignores a forged wallet address in protected writes", async () => {
    const account = Account.generate();
    const address = account.accountAddress.toStringLong();

    const nonceResponse = await fetch(`${baseUrl}/api/auth/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    expect(nonceResponse.status).toBe(200);
    const { nonce, message } = await nonceResponse.json();
    expect(message).toBe(buildSignInMessage(nonce));

    const fullMessage = walletMessage(address, message, nonce);
    const signature = account.sign(new TextEncoder().encode(fullMessage)).toString();
    const verifyResponse = await fetch(`${baseUrl}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        publicKey: account.publicKey.toString(),
        signature,
        fullMessage,
        nonce,
      }),
    });

    expect(verifyResponse.status).toBe(200);
    const setCookie = verifyResponse.headers.get("set-cookie");
    expect(setCookie).toContain("cs_session=");
    expect(setCookie?.toLowerCase()).toContain("httponly");
    const cookie = setCookie!.split(";", 1)[0];

    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: cookie },
    });
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toEqual({ address: address.toLowerCase() });

    const forgedAddress = Account.generate().accountAddress.toStringLong();
    const profileResponse = await fetch(`${baseUrl}/api/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ wallet_address: forgedAddress, username: "owner" }),
    });
    expect(profileResponse.status).toBe(200);
    await expect(profileResponse.json()).resolves.toMatchObject({
      wallet_address: address.toLowerCase(),
      username: "owner",
    });
  });
});
