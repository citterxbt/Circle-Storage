/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { useAptosWallet } from "../lib/aptos-wallet";
import { useToast } from "./Toaster";
import {
  AUTH_TAG_LENGTH_BYTES,
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_KEY_BITS,
  IV_LENGTH_BYTES,
  bytesToHex
} from "../encryption";
import { MAX_UPLOAD_LABEL, MAX_UPLOAD_PLAINTEXT_BYTES } from "../file-limits";
import {
  FUNGIBLE_METADATA_TYPE,
  FUNGIBLE_TRANSFER_FUNCTION,
  LEASE_TREASURY_ADDRESS,
  SHELBY_ENCRYPTION_UNENCRYPTED,
  REGISTER_BLOB_FUNCTION,
  REGISTER_BLOB_MAX_GAS,
  SHELBY_PAYMENT_TIER,
  SHELBY_USD_ASSET_TYPE,
  SHELBY_USD_SYMBOL,
  activeShelbyWriteLocation,
  blobCommitmentBytes,
  buildBlobName,
  leaseExpirationMicros,
  leaseFee,
  leaseFeeSmallestUnits,
  shelbyStorageCost
} from "../shelby";
import { Upload, HelpCircle, Shield, FileCheck, Eye, EyeOff, Coins, Zap } from "lucide-react";

export default function FileUploadPage() {
  const { address, connected, shelbyUSDBalance, signAndSubmitTransaction } = useAptosWallet();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<"7d" | "30d" | "90d" | "365d">("30d");
  const [visibility, setVisibility] = useState<"private" | "public">("public");
  const [price, setPrice] = useState<string>("1.0"); // starting price
  
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [generatedRef, setGeneratedRef] = useState<string>("");

  // Everything is charged on what actually gets stored, which is the ciphertext: AES-GCM adds
  // its authentication tag and nothing else, so the billable size is known before encrypting.
  // The fee schedule lives in src/shelby.ts because the server recomputes it from the bytes it
  // receives, and a quote that ignored the tag would fall short at a megabyte boundary.
  const billableSize = () => (file ? file.size + AUTH_TAG_LENGTH_BYTES : 0);
  const calculateLeaseFee = () => (file ? leaseFee(billableSize(), duration) : 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const selectFile = (nextFile: File) => {
    if (nextFile.size > MAX_UPLOAD_PLAINTEXT_BYTES) {
      toast.error(
        `Vercel deployment supports files up to ${MAX_UPLOAD_LABEL}. Choose a smaller file to upload.`
      );
      return;
    }
    setFile(nextFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      selectFile(e.target.files[0]);
    }
  };

  const triggerSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !address) {
      toast.info("Connect your wallet first.");
      return;
    }
    if (!file) {
      toast.info("Choose or drop a file to upload.");
      return;
    }
    if (file.size > MAX_UPLOAD_PLAINTEXT_BYTES) {
      toast.error(`Vercel deployment supports files up to ${MAX_UPLOAD_LABEL}.`);
      return;
    }
    if (visibility === 'public' && (!price || parseFloat(price) < 0)) {
      toast.info("Set a price of 0 or more for a public listing.");
      return;
    }

    const fee = calculateLeaseFee();
    if (shelbyUSDBalance < fee) {
      toast.error(
        `This upload needs ${fee.toFixed(8)} ${SHELBY_USD_SYMBOL} but your wallet holds ` +
        `${shelbyUSDBalance.toFixed(8)} ${SHELBY_USD_SYMBOL}.`
      );
      return;
    }

    setUploading(true);
    setUploadSuccess(false);

    try {
      // Step 1: Encrypt the file here, before it leaves the browser.
      //
      // Anyone can read a Shelby blob if they know its name, and the name is public on chain, so
      // the paywall depends on the bytes being unreadable rather than on the name being secret.
      //
      // This also has to come before the fee is paid. The fee is charged per megabyte of what
      // gets stored, and the server recomputes it from the bytes it receives — so paying for the
      // plaintext would fall short whenever the tag pushes the ciphertext into another chunk.
      setUploadStep("Encrypting the file with AES-256...");
      const plainBytes = new Uint8Array(await file.arrayBuffer());
      const key = await crypto.subtle.generateKey(
        { name: ENCRYPTION_ALGORITHM, length: ENCRYPTION_KEY_BITS },
        true,
        ["encrypt"]
      );
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
      const cipherBuffer = await crypto.subtle.encrypt(
        { name: ENCRYPTION_ALGORITHM, iv },
        key,
        plainBytes
      );
      const aesKeyHex = bytesToHex(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
      const aesIvHex = bytesToHex(iv);

      const fileBytes = new Uint8Array(cipherBuffer);

      // Resolve an active location before collecting the platform fee. New Shelbynet accounts
      // have no default location preference, and registration aborts if both location inputs are
      // empty. Reading the registry also survives Shelbynet resets that rename the active region.
      setUploadStep("Resolving an active Shelbynet storage location...");
      const selectedLocation = await activeShelbyWriteLocation();

      // Step 2: Pay this application's fee, sized from the ciphertext the server will receive.
      //
      // This transfers the fungible asset through the framework's primary store rather than
      // calling shelby_usd::transfer, which is restricted to the token's admin.
      setUploadStep("Waiting for signature: platform fee...");
      const feeResult = await signAndSubmitTransaction({
        function: FUNGIBLE_TRANSFER_FUNCTION,
        typeArguments: [FUNGIBLE_METADATA_TYPE],
        functionArguments: [
          SHELBY_USD_ASSET_TYPE,
          LEASE_TREASURY_ADDRESS,
          String(leaseFeeSmallestUnits(fileBytes.length, duration))
        ]
      });
      console.log("Platform fee hash:", feeResult.hash);

      // Step 3: Work out Shelby's commitments for the ciphertext.
      //
      // The SDK erasure-codes the bytes and derives the merkle root the contract records. It has
      // to run on exactly the bytes that get uploaded, which is why encryption comes first.
      setUploadStep("Erasure coding the file and computing Shelby commitments...");
      const {
        createDefaultErasureCodingProvider,
        defaultErasureCodingConfig,
        expectedTotalChunksets,
        generateCommitments
      } = await import("@shelby-protocol/sdk/browser");

      const erasureConfig = defaultErasureCodingConfig();
      const provider = await createDefaultErasureCodingProvider();
      const commitments = await generateCommitments(provider, fileBytes);
      const numChunksets = expectedTotalChunksets(
        fileBytes.length,
        erasureConfig.chunkSizeBytes * erasureConfig.erasure_k
      );

      // Step 4: Register the blob on Shelbynet, signed by the uploader's own wallet so the
      // blob belongs to them. Supplying the selected active location also supports first-time
      // accounts that do not yet have an on-chain location preference.
      const blobName = buildBlobName(address, `up_${Date.now()}`, file.name);
      setUploadStep("Waiting for signature: registering the blob on Shelby...");
      const registerResult = await signAndSubmitTransaction({
        function: REGISTER_BLOB_FUNCTION,
        typeArguments: [],
        functionArguments: [
          blobName,
          selectedLocation,
          null,
          String(leaseExpirationMicros(duration, Date.now())),
          blobCommitmentBytes(commitments.blob_merkle_root),
          numChunksets,
          String(fileBytes.length),
          SHELBY_PAYMENT_TIER,
          erasureConfig.enumIndex,
          SHELBY_ENCRYPTION_UNENCRYPTED
        ],
        options: { maxGasAmount: REGISTER_BLOB_MAX_GAS }
      });
      console.log("Shelby registration hash:", registerResult.hash);

      // Step 5: Hand the ciphertext to the server, which transfers them to Shelby's RPC under this
      // project's API key and keeps no copy of its own.
      setUploadStep("Transferring the file to Shelby storage providers...");
      // The ciphertext is what Shelby stores, so that is what travels — never the plaintext.
      let binary = "";
      fileBytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      const fileBase64 = btoa(binary);

      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: file.name,
          shelby_ref: blobName,
          price: visibility === "private" ? 0 : parseFloat(price),
          visibility,
          duration,
          file_data: fileBase64,
          content_type: file.type,
          lease_tx: feeResult.hash,
          blob_name: blobName,
          register_tx: registerResult.hash,
          aes_key: aesKeyHex,
          aes_iv: aesIvHex
        })
      });

      if (uploadRes.ok) {
        const payloadData = await uploadRes.json();
        setGeneratedRef(payloadData.shelby_ref);
        setUploadSuccess(true);
        // Reset file input
        setFile(null);
      } else {
        const errDetails = await uploadRes.json();
        throw new Error(errDetails.error || "Failed to register storage upload.");
      }

    } catch (err: any) {
      console.error("Storage upload failed", err);
      toast.error(err.message || "The upload did not complete.");
    } finally {
      setUploading(false);
      setUploadStep("");
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8" id="file-upload-section">
      {/* Overview */}
      <div id="file-upload-header" className="animate-fadeIn">
        <h3 className="text-xl font-bold text-white font-sans flex items-center gap-2">
          <Upload className="w-5 h-5 text-pink-500" />
          Deploy to Shelby Testnet Storage
        </h3>
        <p className="text-xs text-white/60 font-sans mt-1">Lease globally decentralized storage on-chain and set sovereign pricing controls.</p>
      </div>

      {uploadSuccess && (
        <div className="bg-[#0b1c12]/80 border border-emerald-500/20 p-6 rounded-2xl flex flex-col items-center text-center gap-3 animate-fadeIn shadow-lg" id="upload-success-toast">
          <FileCheck className="w-12 h-12 text-emerald-400" />
          <h4 className="font-bold text-emerald-400">Asset Anchor Set Successfully!</h4>
          <p className="text-xs text-white/80 max-w-md font-sans">
            Your file contents are now locked and deployed using Shelby hash credentials. Metadata and security keys have been securely registered.
          </p>
          <div className="mt-2 bg-black/45 px-4 py-2 border border-white/10 rounded-xl font-mono text-xs select-all text-emerald-450 text-emerald-400">
            {generatedRef}
          </div>
          <button
            onClick={() => setUploadSuccess(false)}
            className="mt-2 text-xs font-semibold text-white/70 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/5"
          >
            Acknowledge Receipt
          </button>
        </div>
      )}

      {uploading ? (
        <div className="bg-black/30 border border-white/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-5 min-h-[300px] shadow-sm animate-fadeIn" id="upload-loading-block">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-pink-500 animate-spin"></div>
            <Zap className="w-6 h-6 text-pink-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-sm font-sans font-bold text-white">{uploadStep}</p>
          <p className="text-xs font-sans text-white/60 leading-normal max-w-sm">Do not close this browser tab or navigate away. Interactive on-chain agreements require state synchronization across the active validators.</p>
        </div>
      ) : (
        <form onSubmit={handleUploadSubmit} className="space-y-8 bg-black/30 border border-white/10 p-8 rounded-3xl shadow-lg animate-fadeIn" id="file-upload-form">
          {/* File Picker drag and drop box */}
          <div 
            id="upload-drag-drop-area"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={triggerSelectFile}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center gap-3 ${
              file 
                ? "border-pink-500/40 bg-pink-950/20" 
                : "border-white/10 bg-black/15 hover:border-pink-500/25 hover:bg-white/[0.02]"
            }`}
          >
            <input
              id="input-file-native"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${file ? "bg-pink-950/50 text-pink-400 border border-pink-500/20" : "bg-white/5 text-white/50 border border-white/10"}`}>
              <Upload className="w-6 h-6" />
            </div>
 
            {file ? (
              <div className="space-y-1">
                <span className="font-bold text-white text-sm block max-w-md truncate">{file.name}</span>
                <span className="text-xs text-white/40 font-mono">{formatBytes(file.size)}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-bold text-white/80 font-sans">Click to browse or Drag and Drop any file here</p>
                <p className="text-xs text-white/50 font-sans leading-normal">Supports documents, datasets, Move packages, audio, and secure archives.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8" id="upload-settings-grid">
            {/* Left Col: settings inputs */}
            <div className="space-y-6">
              {/* Duration Select */}
              <div className="space-y-2">
                <label htmlFor="duration-select" className="block text-xs font-mono uppercase text-white/45 font-bold">Shelby Rent Lease Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["7d", "30d", "90d", "365d"] as const).map((d) => (
                    <button
                      key={d}
                      id={`btn-duration-${d}`}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`py-3 text-center text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer ${
                        duration === d
                          ? "bg-pink-500/20 border-pink-500/40 text-pink-400 font-extrabold"
                          : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility Settings */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase text-white/45 font-bold">Public Marketplace Visibility</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    id="btn-visibility-public"
                    type="button"
                    onClick={() => setVisibility("public")}
                    className={`p-4 flex items-start gap-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      visibility === "public"
                        ? "bg-pink-950/30 border-pink-500/30 text-pink-400"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    <Eye className="w-5 h-5 flex-shrink-0 mt-0.5 text-pink-450" />
                    <div>
                      <p className="text-xs font-bold text-white">Public Listing</p>
                      <p className="text-[10px] text-white/50 mt-1 leading-normal">Exposes file as an item card on the public marketplace. Decrypts bytes strictly after verified APT transfer.</p>
                    </div>
                  </button>

                  <button
                    id="btn-visibility-private"
                    type="button"
                    onClick={() => setVisibility("private")}
                    className={`p-4 flex items-start gap-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      visibility === "private"
                        ? "bg-amber-950/30 border-amber-500/30 text-amber-400"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    <EyeOff className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-450" />
                    <div>
                      <p className="text-xs font-bold text-white">Private Storage</p>
                      <p className="text-[10px] text-white/50 mt-1 leading-normal">Visible ONLY to you. Files and keys can be accessed solely by the uploader's signature verified on-chain.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Pricing Config (if public) */}
              {visibility === "public" && (
                <div className="space-y-2 animate-fadeIn" id="upload-price-input-wrapper">
                  <label htmlFor="input-price" className="block text-xs font-mono uppercase text-white/45 font-bold">Sovereign Marketplace Price</label>
                  <div className="relative">
                    <input
                      id="input-price"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="1.0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 text-white rounded-xl pl-4 pr-16 py-3 text-sm focus:border-pink-500 focus:outline-none transition-colors"
                    />
                    <span className="absolute right-4 top-3 text-xs font-mono text-pink-400 font-bold">APT</span>
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">This defines the payout target rate. Buyers transfer this value directly peer-to-peer to your secure wallet.</p>
                </div>
              )}
            </div>

            {/* Right Col: Cost Breakout Summary */}
            <div className="bg-black/35 border border-white/10 p-6 rounded-2xl flex flex-col justify-between" id="upload-cost-panel">
              <div className="space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-white/40">Lease Allocation Estimate</h4>
                
                <div className="space-y-3 pt-2" id="cost-line-items">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Selected File size:</span>
                    <span className="text-white font-bold font-mono">{file ? formatBytes(file.size) : "0.00 Bytes"}</span>
                  </div>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Rent period:</span>
                    <span className="text-white font-bold font-mono">{duration} lease</span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Symmetric crypt mode:</span>
                    <span className="text-pink-400 font-mono font-bold uppercase">AES-256 Sentry</span>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs text-white/70 font-semibold direct-lease-label">Platform fee:</span>
                    <span id="label-lease-cost" className="text-lg font-mono text-white tracking-tight flex items-center gap-1 font-bold">
                      <Coins className="w-4 h-4 text-amber-500" />
                      {calculateLeaseFee().toFixed(8)} {SHELBY_USD_SYMBOL}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Shelby storage, paid to the protocol:</span>
                    <span className="text-white font-bold font-mono">
                      {(file ? shelbyStorageCost(billableSize(), duration) : 0).toFixed(8)} {SHELBY_USD_SYMBOL}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Your {SHELBY_USD_SYMBOL} balance:</span>
                    <span className="text-white font-bold font-mono">
                      {shelbyUSDBalance.toFixed(8)} {SHELBY_USD_SYMBOL}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-3">
                {!connected ? (
                  <div className="text-center text-xs text-white/50 leading-relaxed font-sans font-medium">Connect your Aptos Wallet to enable on-chain lock deposits.</div>
                ) : (
                  <button
                    id="btn-upload-file-submit"
                    type="submit"
                    className="w-full py-4 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-bold font-sans text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md shadow-pink-500/10 border border-white/10"
                  >
                    <Shield className="w-4 h-4" />
                    Lock and Anchor on Shelby
                  </button>
                )}
                <div className="flex items-center gap-1.5 justify-center text-[10px] text-white/40 font-sans">
                  <span>Guaranteed absolute, verified access-control.</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
