/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { pathToFileURL } from "url";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { UserProfile, FileMetadata, PurchaseRecord, LeaderboardRow } from "./src/types";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  buildSignInMessage,
  createNonce,
  issueSessionToken,
  normalizeAddress,
  requireAuth,
  sessionAddress,
  verifyWalletSignature,
} from "./auth";
import { simulatedPaymentsAllowed, verifyAptPayment, verifyShelbyUsdPayment } from "./payments";
import {
  LEASE_TREASURY_ADDRESS,
  buildBlobName,
  isLeaseDuration,
  leaseExpirationMicros,
  leaseFeeSmallestUnits,
} from "./src/shelby";
import { getBlobBytes, putBlobBytes, verifyBlobRegistration } from "./shelby-storage";
import { isValidIvHex, isValidKeyHex } from "./src/encryption";
import { decryptStoredFile, isEncrypted } from "./file-payload";

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = path.join(process.cwd(), "server-db.json");

// Initialize Supabase if environment variables are provided, otherwise fallback to local JSON database gracefully
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabase: any = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("[Circle Storage] Supabase Database context initialized successfully with service role.");
  } catch (err) {
    console.error("[Circle Storage] Failed to initialize Supabase client instance:", err);
  }
} else {
  console.log("[Circle Storage] Supabase variables not discovered in runtime. Operating local database layer.");
}

// Structure of our fully integrated local Database fallback
export interface DatabaseSchema {
  profiles: { [wallet: string]: UserProfile };
  files: {
    [id: string]: FileMetadata & {
      aes_key: string;
      aes_iv: string;
      file_data: string; // Encrypted file payload (Base64)
      content_type: string;
      lease_tx: string; // Hash of the verified ShelbyUSD lease payment
      /** Address the Shelby blob is stored under; empty when the bytes are held locally. */
      shelby_owner: string;
    };
  };
  purchases: PurchaseRecord[];
}

// Check database file existence and seed realistic Web3 users/files out-of-the-box
function loadDatabase(): DatabaseSchema {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    } catch (err) {
      console.error("Failed to parse local database. Resetting.", err);
    }
  }

  // Reset default seed data to empty to clear any pre-loaded dummy data
  const seedData: DatabaseSchema = {
    profiles: {},
    files: {},
    purchases: []
  };

  saveDatabase(seedData);
  return seedData;
}

function saveDatabase(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write to local database.", err);
  }
}

export interface CreateAppOptions {
  /** Injected by request-level tests so they never read or overwrite the developer's JSON DB. */
  database?: DatabaseSchema;
  persistDatabase?: (database: DatabaseSchema) => void;
  /** API tests do not need Vite or the production static-file fallback. */
  serveFrontend?: boolean;
}

export async function createApp(options: CreateAppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(cookieParser());

  const db = options.database ?? loadDatabase();
  const persistDatabase = options.persistDatabase ?? saveDatabase;

  /** True when a lease payment has already been spent on an earlier upload. */
  const leaseTxAlreadyUsed = async (txHash: string): Promise<boolean> => {
    if (supabase) {
      try {
        const { data } = await supabase
          .from("files")
          .select("id")
          .eq("lease_tx", txHash)
          .maybeSingle();
        if (data) return true;
      } catch (err) {
        console.error("[Supabase DB Error] Lease reuse check failed:", err);
        // Fall through to the local store rather than allowing an unchecked reuse.
      }
    }

    return Object.values(db.files).some(f => f.lease_tx === txHash);
  };

  /**
   * Produce the base64 payload for a download.
   *
   * Records written while Shelby storage was configured hold no bytes of their own, so the
   * blob is fetched back from the network; older records still carry their own payload.
   */
  const resolveFilePayload = async (
    file: {
      shelby_owner?: string;
      shelby_ref: string;
      file_data?: string;
      aes_key?: string;
      aes_iv?: string;
    }
  ): Promise<{ data?: string; reason?: string }> => {
    if (!file.shelby_owner) {
      return { data: file.file_data || "" };
    }

    const read = await getBlobBytes({ account: file.shelby_owner, blobName: file.shelby_ref });
    if (!read.ok) return { reason: read.reason };

    // Files uploaded before encryption was added have no key and are stored as they were.
    if (!isEncrypted(file)) {
      return { data: read.data!.toString("base64") };
    }

    const plain = decryptStoredFile(read.data!, file.aes_key!, file.aes_iv!);
    if (!plain.ok) return { reason: plain.reason };

    return { data: plain.data!.toString("base64") };
  };

  // AUTH ROUTES
  //
  // Wallet ownership is established here and nowhere else. Every mutating route below reads
  // the caller's address from the session cookie rather than from the request body.

  // POST Issue a nonce for the wallet to sign
  app.post("/api/auth/nonce", (req, res) => {
    const address = normalizeAddress(String(req.body?.address || ""));
    if (!address) {
      return res.status(400).json({ error: "A valid Aptos address is required." });
    }

    const nonce = createNonce(address);
    return res.json({ nonce, message: buildSignInMessage(nonce) });
  });

  // POST Verify the signed nonce and open a session
  app.post("/api/auth/verify", async (req, res) => {
    const { address, publicKey, signature, fullMessage, nonce } = req.body || {};

    const result = await verifyWalletSignature({
      address: String(address || ""),
      publicKey: String(publicKey || ""),
      signature: String(signature || ""),
      fullMessage: String(fullMessage || ""),
      nonce: String(nonce || ""),
    });

    if (!result.ok) {
      console.warn(`[Circle Storage] Wallet sign-in rejected: ${result.reason}`);
      return res.status(401).json({ error: "SIGNATURE_REJECTED", message: result.reason });
    }

    res.cookie(SESSION_COOKIE, issueSessionToken(result.address), SESSION_COOKIE_OPTIONS);
    return res.json({ address: result.address });
  });

  // GET Current session, so the client can restore state without trusting localStorage
  app.get("/api/auth/session", (req, res) => {
    const address = sessionAddress(req);
    if (!address) return res.status(401).json({ error: "UNAUTHENTICATED" });
    return res.json({ address });
  });

  // POST Close the session
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(SESSION_COOKIE, { ...SESSION_COOKIE_OPTIONS, maxAge: undefined });
    return res.json({ success: true });
  });

  // API ROUTES

  // GET User Profile
  app.get("/api/profiles/:wallet", async (req, res) => {
    const { wallet } = req.params;
    const cleanWallet = wallet.toLowerCase();
    
    // 1. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("wallet_address", cleanWallet)
          .maybeSingle();
        
        if (data) {
          return res.json(data);
        }
      } catch (err) {
        console.error("[Supabase DB Error] Profiles select failed:", err);
      }
    }

    // 2. Fallback to Local JSON DB
    const profile = db.profiles[cleanWallet];
    if (profile) {
      return res.json(profile);
    }

    // Default placeholder for first-time connected wallets
    const defaultProfile: UserProfile = {
      wallet_address: cleanWallet,
      username: `apt_pioneer_${cleanWallet.slice(2, 8)}`,
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanWallet}`,
      bio: "Web3 early adopter on Aptos Shelby Testnet. No bio written yet.",
    };
    return res.json(defaultProfile);
  });

  // GET ALL Profiles (Leaderboard metrics)
  app.get("/api/profiles", async (req, res) => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*");
        if (data) {
          return res.json(data);
        }
      } catch (err) {
        console.error("[Supabase DB Error] Global profiles request failed:", err);
      }
    }

    return res.json(Object.values(db.profiles));
  });

  // POST Create/Update Profile — only ever writes the authenticated caller's own profile
  app.post("/api/profiles", requireAuth, async (req, res) => {
    const profile: UserProfile = req.body;
    if (!profile.username) {
      return res.status(400).json({ error: "Missing required profile parameters." });
    }

    const username = String(profile.username).trim();
    if (username.length === 0 || username.length > 12) {
      return res.status(400).json({ error: "Username must be between 1 and 12 characters." });
    }
    if (profile.bio && String(profile.bio).length > 100) {
      return res.status(400).json({ error: "Bio must be at most 100 characters." });
    }

    // Ignore any wallet_address in the body: the session is the only source of identity.
    const cleanWallet = req.walletAddress!;
    const finalProfile: UserProfile = {
      wallet_address: cleanWallet,
      username,
      avatar_url: profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanWallet}`,
      bio: profile.bio || "",
      x_social: profile.x_social || "",
      github_social: profile.github_social || "",
      telegram_social: profile.telegram_social || ""
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .upsert(finalProfile)
          .select();
        
        if (error) {
          console.error("[Supabase DB Error] Profiles upsert error details:", error);
          return res.status(500).json({ error: "Failed to store settings profile in Supabase." });
        }
        if (data && data.length > 0) {
          return res.json(data[0]);
        }
      } catch (err) {
        console.error("[Supabase DB Error] Fatal profiles upsert failure:", err);
        return res.status(500).json({ error: "Supabase connection error storing settings profile." });
      }
    }

    db.profiles[cleanWallet] = finalProfile;
    persistDatabase(db);
    return res.json(db.profiles[cleanWallet]);
  });

  // GET FILES with optional filters (Marketplace vs Dashboard)
  //
  // Private listings are only ever returned to their own uploader. Anonymous callers and
  // callers asking about somebody else's uploads see public listings only.
  app.get("/api/files", async (req, res) => {
    const { uploader } = req.query;
    const caller = sessionAddress(req);

    const requestedUploader = uploader ? normalizeAddress(String(uploader)) : null;
    if (uploader && !requestedUploader) {
      return res.status(400).json({ error: "Malformed uploader address." });
    }

    // Only a caller asking about their own uploads may see private entries.
    const includePrivate = requestedUploader !== null && requestedUploader === caller;

    if (supabase) {
      try {
        let query = supabase.from("files").select("*");
        if (!includePrivate) {
          query = query.eq("visibility", "public");
        }
        if (requestedUploader) {
          query = query.eq("uploader", requestedUploader);
        }

        const { data: dbFiles, error: filesErr } = await query;
        if (filesErr) {
          console.error("[Supabase DB Error] Files selection error:", filesErr);
          return res.status(500).json({ error: "Failed to query files from Supabase." });
        }

        // Fetch purchase logs in parallel
        const { data: dbPurchases, error: purchasesErr } = await supabase.from("purchases").select("file_id");
        const purchasesList = dbPurchases || [];

        const fileList = (dbFiles || []).map((f: any) => {
          const purchaseCount = purchasesList.filter((p: any) => p.file_id === f.id).length;
          return {
            id: f.id,
            uploader: f.uploader,
            name: f.name,
            size: Number(f.size),
            shelby_ref: f.shelby_ref,
            price: Number(f.price),
            visibility: f.visibility,
            duration: f.duration,
            created_at: f.created_at,
            purchase_count: purchaseCount
          };
        });

        return res.json(fileList);
      } catch (err) {
        console.error("[Supabase DB Error] Files endpoint logic failure:", err);
      }
    }
    
    let fileList = Object.values(db.files).map(f => {
      // Calculate purchase count for each file
      const purchaseCount = db.purchases.filter(p => p.file_id === f.id).length;
      return {
        id: f.id,
        uploader: f.uploader,
        name: f.name,
        size: f.size,
        shelby_ref: f.shelby_ref,
        price: f.price,
        visibility: f.visibility,
        duration: f.duration,
        created_at: f.created_at,
        purchase_count: purchaseCount
      };
    });

    if (!includePrivate) {
      fileList = fileList.filter(f => f.visibility === "public");
    }

    if (requestedUploader) {
      fileList = fileList.filter(f => f.uploader.toLowerCase() === requestedUploader);
    }

    return res.json(fileList);
  });

  // POST Upload storage file — the uploader is always the authenticated caller
  app.post("/api/files/upload", requireAuth, async (req, res) => {
    const {
      name, shelby_ref, price, visibility, duration, file_data, content_type, lease_tx,
      blob_name, register_tx, aes_key, aes_iv
    } = req.body;

    if (!name || !shelby_ref || !duration || !file_data) {
      return res.status(400).json({ error: "Missing required upload parameters." });
    }

    if (visibility !== "public" && visibility !== "private") {
      return res.status(400).json({ error: "Visibility must be either 'public' or 'private'." });
    }

    if (!isLeaseDuration(duration)) {
      return res.status(400).json({ error: "Unsupported lease duration." });
    }

    const numericPrice = Number(price) || 0;
    if (numericPrice < 0) {
      return res.status(400).json({ error: "Price cannot be negative." });
    }

    // Trust the payload we actually received rather than a client-supplied size.
    const actualSize = Buffer.byteLength(String(file_data), "base64");

    const id = "file_" + crypto.randomUUID();
    const cleanUploader = req.walletAddress!;
    // The browser encrypts before uploading and hands over the key. Anything stored on Shelby
    // has to arrive encrypted, or a paid file would sit there readable by the public.
    const aesKey = String(aes_key || "");
    const aesIv = String(aes_iv || "");

    if (blob_name && (!isValidKeyHex(aesKey) || !isValidIvHex(aesIv))) {
      return res.status(400).json({
        error: "A Shelby upload must include the AES-256 key and nonce used to encrypt it.",
      });
    }

    // Verify the storage lease was actually paid. The fee is recomputed here from the payload
    // we received, so a client cannot declare its own price.
    const requiredLeaseUnits = leaseFeeSmallestUnits(actualSize, duration);
    const leaseTxHash = String(lease_tx || "");

    if (!leaseTxHash) {
      return res.status(400).json({ error: "Missing the storage lease payment transaction." });
    }

    if (await leaseTxAlreadyUsed(leaseTxHash)) {
      return res.status(400).json({ error: "That lease payment has already been redeemed." });
    }

    const lease = await verifyShelbyUsdPayment({
      txHash: leaseTxHash,
      expectedSender: cleanUploader,
      expectedRecipient: LEASE_TREASURY_ADDRESS,
      minimumUnits: requiredLeaseUnits,
    });

    if (!lease.ok) {
      if (simulatedPaymentsAllowed()) {
        console.warn(
          `[Circle Storage] ALLOW_SIMULATED_PAYMENTS is on — accepting unverified lease ` +
            `payment for "${name}" (${lease.reason})`
        );
      } else {
        console.warn(`[Circle Storage] Lease payment rejected for "${name}": ${lease.reason}`);
        return res.status(400).json({
          error: "LEASE_NOT_VERIFIED",
          message: `Could not verify the storage lease payment: ${lease.reason}`,
        });
      }
    }

    // When the client registered a Shelby blob for this upload, transfer the bytes there and
    // keep no local copy. `shelbyRef` becomes the real blob name and `shelbyOwner` the wallet
    // that owns it. Uploads without a registration keep the previous behaviour of holding the
    // bytes here, the same way the server falls back from Supabase to a local file.
    let shelbyRef = String(shelby_ref);
    let shelbyOwner = "";
    let storedPayload = String(file_data);

    if (blob_name || register_tx) {
      if (!blob_name || !register_tx) {
        return res.status(400).json({
          error: "A Shelby upload needs both blob_name and register_tx.",
        });
      }

      // The registration decides the owner and the name, so a client cannot claim a blob it
      // did not register, or one registered by somebody else.
      const registration = await verifyBlobRegistration({
        txHash: String(register_tx),
        expectedOwner: cleanUploader,
        expectedBlobName: String(blob_name),
      });

      if (!registration.ok) {
        console.warn(`[Circle Storage] Blob registration rejected: ${registration.reason}`);
        return res.status(400).json({
          error: "REGISTRATION_NOT_VERIFIED",
          message: `Could not verify the Shelby blob registration: ${registration.reason}`,
        });
      }

      const written = await putBlobBytes({
        account: cleanUploader,
        blobName: String(blob_name),
        data: Buffer.from(storedPayload, "base64"),
      });

      if (!written.ok) {
        return res.status(502).json({
          error: "SHELBY_WRITE_FAILED",
          message: `Could not store the file on Shelby: ${written.reason}`,
        });
      }

      shelbyRef = String(blob_name);
      shelbyOwner = cleanUploader;
      storedPayload = "";
    }

    if (supabase) {
      try {
        // Enforce profiles seed insertion so reference constraints stay perfectly valid
        const { data: profileCheck, error: pError } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("wallet_address", cleanUploader)
          .maybeSingle();

        if (!profileCheck) {
          const defaultSeedProfile = {
            wallet_address: cleanUploader,
            username: `apt_pioneer_${cleanUploader.slice(2, 8)}`,
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUploader}`,
            bio: "Web3 early adopter on Aptos Shelby Testnet"
          };
          await supabase.from("profiles").insert(defaultSeedProfile);
        }

        const secureFilePayload = {
          id,
          uploader: cleanUploader,
          name,
          size: actualSize,
          shelby_ref: shelbyRef,
          price: visibility === "private" ? 0 : numericPrice,
          visibility,
          duration,
          created_at: new Date().toISOString(),
          aes_key: aesKey,
          aes_iv: aesIv,
          file_data: storedPayload,
          content_type: content_type || "application/octet-stream",
          lease_tx: leaseTxHash,
          shelby_owner: shelbyOwner
        };

        const { error: insertError } = await supabase.from("files").insert(secureFilePayload);
        if (insertError) {
          console.error("[Supabase DB Error] File registration failed:", insertError);
          return res.status(500).json({ error: "Failed to upload file to Supabase instance." });
        }

        return res.json({ id, status: "uploaded_success_registered", shelby_ref: shelbyRef });
      } catch (err) {
        console.error("[Supabase DB Error] Fatal upload query loop:", err);
        return res.status(500).json({ error: "Connection error saving secure file registry." });
      }
    }

    // Store secure file + key in local database fallback
    db.files[id] = {
      id,
      uploader: cleanUploader,
      name,
      size: actualSize,
      shelby_ref: shelbyRef,
      price: visibility === "private" ? 0 : numericPrice,
      visibility,
      duration,
      created_at: new Date().toISOString(),
      aes_key: aesKey,
      aes_iv: aesIv,
      file_data: storedPayload,
      content_type: content_type || "application/octet-stream",
      lease_tx: leaseTxHash,
      shelby_owner: shelbyOwner
    };

    persistDatabase(db);
    return res.json({ id, status: "uploaded_success_registered", shelby_ref: shelbyRef });
  });

  // POST Register & Validate On-chain purchases — the buyer is the authenticated caller
  app.post("/api/files/purchase", requireAuth, async (req, res) => {
    const { file_id, tx_hash } = req.body;

    if (!file_id || !tx_hash) {
      return res.status(400).json({ error: "Missing required transaction parameters." });
    }

    const cleanBuyer = req.walletAddress!;

    // 1. Fetch the listing, so price and payee come from our records rather than the client
    let targetPrice = 0;
    let targetUploader = "";
    if (supabase) {
      try {
        const { data: targetFile, error: fileFetchError } = await supabase
          .from("files")
          .select("*")
          .eq("id", file_id)
          .maybeSingle();

        if (fileFetchError || !targetFile) {
          return res.status(404).json({ error: "File listing not found in Supabase." });
        }
        targetPrice = Number(targetFile.price) || 0;
        targetUploader = String(targetFile.uploader);

        const { data: existingTx } = await supabase
          .from("purchases")
          .select("id")
          .eq("tx_hash", tx_hash)
          .maybeSingle();

        if (existingTx) {
          return res.status(400).json({ error: "Transaction hash has already been redeemed." });
        }

      } catch (err) {
        console.error("[Supabase DB Error] Verification mapping error", err);
        return res.status(500).json({ error: "Could not load the listing to verify payment against." });
      }
    } else {
      const targetFile = db.files[file_id];
      if (!targetFile) {
        return res.status(404).json({ error: "File listing not found." });
      }
      targetPrice = Number(targetFile.price) || 0;
      targetUploader = targetFile.uploader;

      const exists = db.purchases.some(p => p.tx_hash === tx_hash);
      if (exists) {
        return res.status(400).json({ error: "Transaction hash has already been redeemed." });
      }
    }

    if (cleanBuyer === targetUploader.toLowerCase()) {
      return res.status(400).json({ error: "You already own this file as its uploader." });
    }

    // 2. Verify the payment against the chain: right sender, right payee, enough APT.
    const payment = await verifyAptPayment({
      txHash: String(tx_hash),
      expectedSender: cleanBuyer,
      expectedRecipient: targetUploader,
      minimumApt: targetPrice,
    });

    if (!payment.ok) {
      if (simulatedPaymentsAllowed()) {
        console.warn(
          `[Circle Storage] ALLOW_SIMULATED_PAYMENTS is on — accepting unverified payment ` +
            `for ${file_id} (${payment.reason})`
        );
      } else {
        console.warn(`[Circle Storage] Payment rejected for ${file_id}: ${payment.reason}`);
        return res.status(400).json({
          error: "PAYMENT_NOT_VERIFIED",
          message: `Could not verify this payment on chain: ${payment.reason}`,
        });
      }
    }

    const record: PurchaseRecord = {
      id: "purchase_" + crypto.randomUUID(),
      file_id,
      buyer: cleanBuyer,
      tx_hash,
      // Record what the chain actually moved, not what the client claimed.
      amount: payment.ok ? Number(payment.amountOctas) / 100_000_000 : targetPrice,
      timestamp: new Date().toISOString()
    };

    if (supabase) {
      try {
        // Enforce profile seed insertion for referencing constraints
        const { data: pbCheck } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("wallet_address", cleanBuyer)
          .maybeSingle();

        if (!pbCheck) {
          await supabase.from("profiles").insert({
            wallet_address: cleanBuyer,
            username: `apt_pioneer_${cleanBuyer.slice(2, 8)}`,
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanBuyer}`,
            bio: "Web3 buyer on Aptos"
          });
        }

        const { error: purchaseInsErr } = await supabase.from("purchases").insert(record);
        if (purchaseInsErr) {
          console.error("[Supabase DB Error] Failed to write purchase record:", purchaseInsErr);
          return res.status(500).json({ error: "Failed to register transaction purchase in state storage." });
        }

        return res.json({ success: true, message: "On-chain payment verified successfully. Access granted.", record });
      } catch (err) {
        console.error("[Supabase DB Error] Fatal purchase insertion error:", err);
        return res.status(500).json({ error: "Supabase connection error storing verification ledger." });
      }
    }

    db.purchases.push(record);
    persistDatabase(db);
    return res.json({ success: true, message: "On-chain payment verified successfully. Access granted.", record });
  });

  // GET The caller's own verified purchases, so the client can render unlocked state after a
  // reload instead of tracking it only in memory.
  app.get("/api/purchases", requireAuth, async (req, res) => {
    const buyer = req.walletAddress!;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("purchases")
          .select("file_id")
          .eq("buyer", buyer);

        if (error) {
          console.error("[Supabase DB Error] Purchases lookup failed:", error);
          return res.status(500).json({ error: "Failed to load purchase history." });
        }
        return res.json({ file_ids: (data || []).map((p: any) => p.file_id) });
      } catch (err) {
        console.error("[Supabase DB Error] Fatal purchases lookup:", err);
        return res.status(500).json({ error: "Failed to load purchase history." });
      }
    }

    const fileIds = db.purchases
      .filter(p => p.buyer.toLowerCase() === buyer)
      .map(p => p.file_id);

    return res.json({ file_ids: fileIds });
  });

  // POST Download — gated on the authenticated caller being the uploader or a verified buyer
  app.post("/api/files/download", requireAuth, async (req, res) => {
    const { file_id } = req.body;

    if (!file_id) {
      return res.status(400).json({ error: "Missing download parameters." });
    }

    const cleanWallet = req.walletAddress!;

    if (supabase) {
      try {
        // Query secure encrypted file fields entirely server side (safe service-role privilege)
        const { data: targetFile, error: fileFetchError } = await supabase
          .from("files")
          .select("*")
          .eq("id", file_id)
          .maybeSingle();

        if (fileFetchError || !targetFile) {
          return res.status(404).json({ error: "Requested file not registered." });
        }

        // Check 1: Is user the original file uploader?
        const isUploader = targetFile.uploader.toLowerCase() === cleanWallet;

        // Check 2: Verify direct on-chain purchase from purchases table
        const { data: purchasedRecords, error: purchaseErr } = await supabase
          .from("purchases")
          .select("id")
          .eq("file_id", file_id)
          .eq("buyer", cleanWallet);

        const hasPurchased = purchasedRecords && purchasedRecords.length > 0;

        // Tight double-gating defense block
        if (!isUploader && !hasPurchased) {
          return res.status(403).json({
            error: "ACCESS_DENIED",
            message: "You have not verified an on-chain payment for this file. Content decrypted only after purchase."
          });
        }

        // Access certified. Fetch the payload, from Shelby when that is where it lives.
        const payload = await resolveFilePayload(targetFile);
        if (payload.data === undefined) {
          return res.status(502).json({
            error: "SHELBY_READ_FAILED",
            message: `Could not read the file back from Shelby: ${payload.reason}`
          });
        }

        return res.json({
          name: targetFile.name,
          content_type: targetFile.content_type,
          shelby_ref: targetFile.shelby_ref,
          data: payload.data
        });
      } catch (err) {
        console.error("[Supabase DB Error] Download access resolution failed:", err);
        return res.status(500).json({ error: "Database permission validation encountered an internal error." });
      }
    }

    // Legacy Local Database Fallback Logic
    const targetFile = db.files[file_id];
    if (!targetFile) {
      return res.status(404).json({ error: "Requested file not found." });
    }

    const isUploader = targetFile.uploader.toLowerCase() === cleanWallet;
    const hasPurchased = db.purchases.some(
      p => p.file_id === file_id && p.buyer.toLowerCase() === cleanWallet
    );

    if (!isUploader && !hasPurchased) {
      return res.status(403).json({
        error: "ACCESS_DENIED",
        message: "You have not verified an on-chain payment for this file. Content decrypted only after purchase."
      });
    }

    const payload = await resolveFilePayload(targetFile);
    if (payload.data === undefined) {
      return res.status(502).json({
        error: "SHELBY_READ_FAILED",
        message: `Could not read the file back from Shelby: ${payload.reason}`
      });
    }

    return res.json({
      name: targetFile.name,
      content_type: targetFile.content_type,
      shelby_ref: targetFile.shelby_ref,
      data: payload.data
    });
  });

  // LEADERBOARD ranking aggregator API
  app.get("/api/leaderboard", async (req, res) => {
    if (supabase) {
      try {
        const { data: profiles } = await supabase.from("profiles").select("*");
        const { data: files } = await supabase.from("files").select("*");
        const { data: purchases } = await supabase.from("purchases").select("*");

        const leaderboard: { [wallet: string]: LeaderboardRow } = {};

        (profiles || []).forEach((p: any) => {
          leaderboard[p.wallet_address.toLowerCase()] = {
            wallet_address: p.wallet_address,
            username: p.username,
            avatar_url: p.avatar_url,
            total_uploads: 0,
            total_earnings: 0
          };
        });

        (files || []).forEach((f: any) => {
          const uploader = f.uploader.toLowerCase();
          if (!leaderboard[uploader]) {
            leaderboard[uploader] = {
              wallet_address: f.uploader,
              username: f.uploader.slice(0, 10) + "...",
              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${f.uploader}`,
              total_uploads: 0,
              total_earnings: 0
            };
          }
          leaderboard[uploader].total_uploads += 1;
        });

        (purchases || []).forEach((p: any) => {
          const targetFile = (files || []).find((f: any) => f.id === p.file_id);
          if (targetFile) {
            const uploader = targetFile.uploader.toLowerCase();
            if (!leaderboard[uploader]) {
              leaderboard[uploader] = {
                wallet_address: targetFile.uploader,
                username: targetFile.uploader.slice(0, 10) + "...",
                avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${targetFile.uploader}`,
                total_uploads: 0,
                total_earnings: 0
              };
            }
            leaderboard[uploader].total_earnings += Number(p.amount) || 0;
          }
        });

        const outputSorted = Object.values(leaderboard).sort((a, b) => b.total_earnings - a.total_earnings);
        return res.json(outputSorted);
      } catch (err) {
        console.error("[Supabase DB Error] Leaderboard failure:", err);
      }
    }

    // Collect all profile records
    const leaderboard: { [wallet: string]: LeaderboardRow } = {};

    // Map profiles
    Object.values(db.profiles).forEach(p => {
      leaderboard[p.wallet_address.toLowerCase()] = {
        wallet_address: p.wallet_address,
        username: p.username,
        avatar_url: p.avatar_url,
        total_uploads: 0,
        total_earnings: 0
      };
    });

    // Populate uploads counts
    Object.values(db.files).forEach(f => {
      const uploader = f.uploader.toLowerCase();
      if (!leaderboard[uploader]) {
        leaderboard[uploader] = {
          wallet_address: f.uploader,
          username: f.uploader.slice(0, 10) + "...",
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${f.uploader}`,
          total_uploads: 0,
          total_earnings: 0
        };
      }
      leaderboard[uploader].total_uploads += 1;
    });

    // Populate earnings from purchases
    db.purchases.forEach(p => {
      const targetFile = db.files[p.file_id];
      if (targetFile) {
        const uploader = targetFile.uploader.toLowerCase();
        if (!leaderboard[uploader]) {
          leaderboard[uploader] = {
            wallet_address: targetFile.uploader,
            username: targetFile.uploader.slice(0, 10) + "...",
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${targetFile.uploader}`,
            total_uploads: 0,
            total_earnings: 0
          };
        }
        leaderboard[uploader].total_earnings += p.amount;
      }
    });

    const outputSorted = Object.values(leaderboard).sort((a, b) => b.total_earnings - a.total_earnings);
    return res.json(outputSorted);
  });

  // GET global metrics
  app.get("/api/stats/:wallet", async (req, res) => {
    const { wallet } = req.params;
    const cleanWallet = wallet.toLowerCase();

    if (supabase) {
      try {
        // Exact count files uploaded
        const { count, error } = await supabase
          .from("files")
          .select("*", { count: "exact", head: true })
          .eq("uploader", cleanWallet);
        
        // Fetch files to compute total earnings
        const { data: uploadedFiles } = await supabase
          .from("files")
          .select("id")
          .eq("uploader", cleanWallet);
        
        let totalEarnings = 0;
        if (uploadedFiles && uploadedFiles.length > 0) {
          const fileIds = uploadedFiles.map((f: any) => f.id);
          const { data: matchingPurchases } = await supabase
            .from("purchases")
            .select("amount")
            .in("file_id", fileIds);
          
          if (matchingPurchases) {
            totalEarnings = matchingPurchases.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
          }
        }

        return res.json({ filesUploadedCount: count || 0, totalEarnings });
      } catch (err) {
        console.error("[Supabase DB Error] Statistics request failed:", err);
      }
    }

    const uploaderFiles = Object.values(db.files).filter(f => f.uploader.toLowerCase() === cleanWallet);
    const filesUploadedCount = uploaderFiles.length;

    // Sum price of all purchases matching this uploader's files
    let totalEarnings = 0;
    db.purchases.forEach(p => {
      const targetFile = db.files[p.file_id];
      if (targetFile && targetFile.uploader.toLowerCase() === cleanWallet) {
        totalEarnings += Number(p.amount) || 0;
      }
    });

    return res.json({ filesUploadedCount, totalEarnings });
  });

  if (options.serveFrontend !== false) {
    // Express production static hosting or Vite integration
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  return app;
}

export async function startServer() {
  const app = await createApp();
  return app.listen(PORT, "0.0.0.0", () => {
    console.log(`Circle Storage application server running on http://localhost:${PORT}`);
  });
}

// Importing the module in tests must not bind a port or start Vite.
const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  void startServer();
}
