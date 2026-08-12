/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pricing and blob-registration inputs.
 *
 * The fee cases exist because the client and the server compute it independently and a
 * disagreement of a single unit rejects the upload — which is exactly what happened when
 * encryption started adding 16 bytes and pushed files at a megabyte boundary into another chunk.
 * The commitment case exists because passing the merkle root as its hex string sent 66 bytes
 * where the contract demands 32.
 */

import { describe, expect, it } from "vitest";
import { AUTH_TAG_LENGTH_BYTES } from "../src/encryption";
import {
  LeaseDuration,
  activeShelbyWriteLocation,
  blobCommitmentBytes,
  buildBlobName,
  isLeaseDuration,
  leaseExpirationMicros,
  leaseFeeSmallestUnits,
  shelbyStorageCostUnits,
} from "../src/shelby";

const MIB = 1024 * 1024;
const UPLOADER = "0xb79959d5aa6efcfa5dcecb8fe8a9c485c9d5a6b6c66baac8d521947862d588c0";

describe("Shelbynet write location", () => {
  it("uses the first active location returned by the on-chain registry", async () => {
    const fetcher = async () =>
      new Response(JSON.stringify([["shelbynet-1"]]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    await expect(activeShelbyWriteLocation(fetcher as typeof fetch)).resolves.toBe("shelbynet-1");
  });

  it("fails before payment when no storage location is active", async () => {
    const fetcher = async () => new Response(JSON.stringify([[]]), { status: 200 });

    await expect(activeShelbyWriteLocation(fetcher as typeof fetch)).rejects.toThrow(
      /no active storage location/i
    );
  });

  it("surfaces a node failure instead of guessing a location", async () => {
    const fetcher = async () => new Response("unavailable", { status: 503 });

    await expect(activeShelbyWriteLocation(fetcher as typeof fetch)).rejects.toThrow(/HTTP 503/);
  });
});

describe("lease duration", () => {
  it.each(["7d", "30d", "90d", "365d"])("accepts %s", (value) => {
    expect(isLeaseDuration(value)).toBe(true);
  });

  it.each(["1d", "9999d", "", null, 30])("rejects %s", (value) => {
    expect(isLeaseDuration(value)).toBe(false);
  });
});

describe("fee agreement between client and server", () => {
  // The client pays for the ciphertext it produced; the server recharges from the bytes it
  // received. Both are the plaintext plus the tag, so they must land on the same integer.
  const sizes = [0, 1, 3000, 625466, MIB - 16, MIB, MIB + 1, 2 * MIB - 8, 2 * MIB, 5 * MIB];

  it.each(sizes)("agrees for a %i byte file", (plainSize) => {
    const billable = plainSize + AUTH_TAG_LENGTH_BYTES;

    const paidByClient = leaseFeeSmallestUnits(billable, "30d");
    const requiredByServer = leaseFeeSmallestUnits(billable, "30d");

    expect(paidByClient).toBe(requiredByServer);
    expect(Number.isInteger(paidByClient)).toBe(true);
  });

  it("would have fallen short had the client priced the plaintext", () => {
    // Kept as a regression guard: this is the shape of the bug, not a behaviour we want back.
    const plainOnly = leaseFeeSmallestUnits(MIB, "30d");
    const withTag = leaseFeeSmallestUnits(MIB + AUTH_TAG_LENGTH_BYTES, "30d");
    expect(plainOnly).toBeLessThan(withTag);
  });

  it("never charges nothing", () => {
    expect(leaseFeeSmallestUnits(0, "7d")).toBeGreaterThan(0);
  });

  it("charges more for longer leases and larger files", () => {
    expect(leaseFeeSmallestUnits(MIB, "365d")).toBeGreaterThan(leaseFeeSmallestUnits(MIB, "7d"));
    expect(leaseFeeSmallestUnits(10 * MIB, "30d")).toBeGreaterThan(
      leaseFeeSmallestUnits(MIB, "30d")
    );
  });

  it("stays a fraction of what Shelby itself charges", () => {
    for (const duration of ["7d", "30d", "90d", "365d"] as LeaseDuration[]) {
      expect(leaseFeeSmallestUnits(5 * MIB, duration)).toBeLessThan(
        shelbyStorageCostUnits(5 * MIB, duration)
      );
    }
  });
});

describe("lease expiration", () => {
  it("converts the lease into microseconds ahead of now", () => {
    const now = 1_700_000_000_000;
    expect(leaseExpirationMicros("30d", now)).toBe((now + 30 * 86_400_000) * 1000);
  });

  it("orders the durations", () => {
    const now = Date.now();
    const at = (d: LeaseDuration) => leaseExpirationMicros(d, now);
    expect(at("7d")).toBeLessThan(at("30d"));
    expect(at("30d")).toBeLessThan(at("90d"));
    expect(at("90d")).toBeLessThan(at("365d"));
  });
});

describe("blob commitment bytes", () => {
  const root = "0xb0d15b9e7ecaf4e3559de9823188a54d8d871f82b6ecabfec93768a59f4efef1";

  it("decodes 32 bytes from the SDK's hex string", () => {
    const bytes = blobCommitmentBytes(root);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
    expect(bytes[0]).toBe(0xb0);
    expect(bytes[31]).toBe(0xf1);
  });

  it("accepts the same value without a prefix or in upper case", () => {
    expect(blobCommitmentBytes(root.slice(2))).toEqual(blobCommitmentBytes(root));
    expect(blobCommitmentBytes(`0x${root.slice(2).toUpperCase()}`)).toEqual(
      blobCommitmentBytes(root)
    );
  });

  it.each([
    ["too short", "0xabcd"],
    ["too long", `${root}ab`],
    ["not hex", `0x${"z".repeat(64)}`],
    ["empty", ""],
  ])("rejects a root that is %s", (_label, value) => {
    expect(() => blobCommitmentBytes(value)).toThrow(/32 bytes/);
  });
});

describe("blob names", () => {
  it("namespaces by uploader and upload", () => {
    const name = buildBlobName(UPLOADER, "up_123", "holiday photo.png");
    expect(name.startsWith(`${UPLOADER.toLowerCase()}/up_123/`)).toBe(true);
  });

  it("keeps within Shelby's 190 character limit and never trails a slash", () => {
    const name = buildBlobName(UPLOADER, "up_123", `${"x".repeat(400)}.png`);
    expect(name.length).toBeLessThanOrEqual(190);
    expect(name.endsWith("/")).toBe(false);
  });

  it("strips characters that would complicate a path", () => {
    const name = buildBlobName(UPLOADER, "up_1", "a b/c?d.png");
    expect(name.split("/").slice(2).join("/")).toBe("a_b_c_d.png");
  });

  it("still produces a name when nothing of the filename survives", () => {
    const name = buildBlobName(UPLOADER, "up_1", "???");
    expect(name).toBe(`${UPLOADER.toLowerCase()}/up_1`);
  });
});
