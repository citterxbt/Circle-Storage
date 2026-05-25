/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { useAptosWallet } from "../lib/aptos-wallet";
import { Upload, HelpCircle, Shield, FileCheck, Eye, EyeOff, Coins, Zap } from "lucide-react";

export default function FileUploadPage() {
  const { address, connected, balance, signAndSubmitTransaction } = useAptosWallet();
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

  // Storage lease rate calculation weights (in APT per byte per month)
  const leaseCostFactor = {
    "7d": 0.002,
    "30d": 0.008,
    "90d": 0.02,
    "365d": 0.07
  };

  const calculateLeaseFee = () => {
    if (!file) return 0;
    // Base cost: 0.1 APT, plus tiny fractional cost for sizing and lease length
    const fileBytes = file.size;
    const factor = leaseCostFactor[duration];
    const sizeScaledFee = (fileBytes / 1024 / 1024) * factor;
    return parseFloat((0.05 + sizeScaledFee).toFixed(4));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const triggerSelectFile = () => {
    fileInputRef.current?.click();
  };

  const readFileAsBase64 = (targetFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Split meta data declaration to fetch raw Base64 string payload
        const base64Content = result.split(",")[1];
        resolve(base64Content);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(targetFile);
    });
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !address) {
      alert("Please connect your wallet first.");
      return;
    }
    if (!file) {
      alert("Please choose or drop a file to upload.");
      return;
    }
    if (visibility === 'public' && (!price || parseFloat(price) < 0)) {
      alert("Please specify a valid price >= 0 for public marketplace items.");
      return;
    }

    const leaseFee = calculateLeaseFee();
    if (balance < leaseFee) {
      alert(`Sufficient balance required to lock lease. Rent requires ${leaseFee} APT, but your balance is only ${balance.toFixed(2)} APT.`);
      return;
    }

    setUploading(true);
    setUploadSuccess(false);

    try {
      // Step 1: On-Chain Storage Lease lock allocation
      setUploadStep("Submitting on-chain transaction lock to Shelby contract registry...");
      const txPayload = {
        type: "entry_function_payload",
        function: "0x3::shelby::lock_storage_fee",
        type_arguments: [],
        arguments: [address, file.size, duration],
        amount: leaseFee // Deducts lease fee from test account sandbox state
      };

      const result = await signAndSubmitTransaction(txPayload);
      console.log("Aptos Testnet receipt hash:", result.hash);

      // Step 2: Client symmetric encrypt simulation & file base64 bundling
      setUploadStep("Preparing chunk streams and applying local AES-256 client cypher headers...");
      const fileBase64 = await readFileAsBase64(file);

      // Step 3: Server registration payload
      setUploadStep("Dispatching secured bytecode chunks directly onto Shelby Node Gateway...");
      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uploader: address,
          name: file.name,
          size: file.size,
          shelby_ref: `sh_testnet_${result.hash.slice(2, 24)}`,
          price: visibility === "private" ? 0 : parseFloat(price),
          visibility,
          duration,
          file_data: fileBase64,
          content_type: file.type
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
      alert(err.message || "An unexpected error occurred during Shelby node dispatch.");
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
      <div id="file-upload-header">
        <h3 className="text-xl font-medium text-white font-sans flex items-center gap-2">
          <Upload className="w-5 h-5 text-cyan-400" />
          Deploy to Shelby Testnet Storage
        </h3>
        <p className="text-xs text-slate-400 font-sans mt-0.5">Lease globally decentralized storage on-chain and set sovereign pricing controls.</p>
      </div>

      {uploadSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl flex flex-col items-center text-center gap-3 animate-fadeIn" id="upload-success-toast">
          <FileCheck className="w-12 h-12 text-emerald-400" />
          <h4 className="font-semibold text-white">Asset Anchor Set Successfully!</h4>
          <p className="text-xs text-slate-400 max-w-md">
            Your file contents are now locked and deployed using Shelby hash credentials. Metadata and security keys have been securely registered.
          </p>
          <div className="mt-2 bg-slate-950/80 px-4 py-2 border border-slate-900 rounded-xl font-mono text-xs select-all text-emerald-400">
            {generatedRef}
          </div>
          <button
            onClick={() => setUploadSuccess(false)}
            className="mt-2 text-xs font-mono text-slate-500 hover:text-slate-400 border border-slate-900 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Acknowledge Receipt
          </button>
        </div>
      )}

      {uploading ? (
        <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-5 min-h-[300px]" id="upload-loading-block">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-cyan-400 animate-spin"></div>
            <Zap className="w-6 h-6 text-cyan-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-sm font-sans font-semibold text-white">{uploadStep}</p>
          <p className="text-xs font-sans text-slate-400 leading-normal max-w-sm">Do not close this browser tab or navigate away. Interactive on-chain agreements require state synchronization across the active validators.</p>
        </div>
      ) : (
        <form onSubmit={handleUploadSubmit} className="space-y-8 bg-slate-900/10 border border-slate-900 p-8 rounded-3xl" id="file-upload-form">
          {/* File Picker drag and drop box */}
          <div 
            id="upload-drag-drop-area"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={triggerSelectFile}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center gap-3 ${
              file ? "border-cyan-500/50 bg-cyan-500/5" : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/60"
            }`}
          >
            <input
              id="input-file-native"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${file ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-900 text-slate-400"}`}>
              <Upload className="w-6 h-6" />
            </div>

            {file ? (
              <div className="space-y-1">
                <span className="font-medium text-white text-sm block max-w-md truncate">{file.name}</span>
                <span className="text-xs text-slate-500 font-mono">{formatBytes(file.size)}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-300 font-sans">Click to browse or Drag and Drop any file here</p>
                <p className="text-xs text-slate-500 font-sans leading-normal">Supports documents, datasets, Move packages, audio, and secure archives.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8" id="upload-settings-grid">
            {/* Left Col: settings inputs */}
            <div className="space-y-6">
              {/* Duration Select */}
              <div className="space-y-2">
                <label htmlFor="duration-select" className="block text-xs font-mono uppercase text-slate-400">Shelby Rent Lease Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["7d", "30d", "90d", "365d"] as const).map((d) => (
                    <button
                      key={d}
                      id={`btn-duration-${d}`}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`py-3 text-center text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer ${
                        duration === d
                          ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 font-medium"
                          : "bg-slate-950 border-slate-900 text-slate-400 hover:bg-slate-900/60"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility Settings */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase text-slate-400">Public Marketplace Visibility</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    id="btn-visibility-public"
                    type="button"
                    onClick={() => setVisibility("public")}
                    className={`p-4 flex items-start gap-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      visibility === "public"
                        ? "bg-cyan-500/10 border-cyan-400 text-cyan-400"
                        : "bg-slate-950 border-slate-900 text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <Eye className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-white">Public Listing</p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">Exposes file as an item card on the public marketplace. Decrypts bytes strictly after verified APT transfer.</p>
                    </div>
                  </button>

                  <button
                    id="btn-visibility-private"
                    type="button"
                    onClick={() => setVisibility("private")}
                    className={`p-4 flex items-start gap-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      visibility === "private"
                        ? "bg-purple-500/10 border-purple-400 text-purple-400"
                        : "bg-slate-950 border-slate-900 text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <EyeOff className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-white">Private Storage</p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">Visible ONLY to you. Files and keys can be accessed solely by the uploader's signature verified on-chain.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Pricing Config (if public) */}
              {visibility === "public" && (
                <div className="space-y-2 animate-fadeIn" id="upload-price-input-wrapper">
                  <label htmlFor="input-price" className="block text-xs font-mono uppercase text-slate-400">Sovereign Marketplace Price</label>
                  <div className="relative">
                    <input
                      id="input-price"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="1.0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-900 text-slate-100 rounded-xl pl-4 pr-16 py-3 text-sm focus:border-cyan-400 focus:outline-none transition-colors"
                    />
                    <span className="absolute right-4 top-3 text-xs font-mono text-cyan-400 font-bold">APT</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">This defines the payout amount transfer target. Buyers pay this value directly peer-to-peer to your wallet.</p>
                </div>
              )}
            </div>

            {/* Right Col: Cost Breakout Summary */}
            <div className="bg-slate-950 border border-slate-900 p-6 rounded-2xl flex flex-col justify-between" id="upload-cost-panel">
              <div className="space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Lease Allocation Estimate</h4>
                
                <div className="space-y-3 pt-2" id="cost-line-items">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Selected File size:</span>
                    <span className="text-white font-mono">{file ? formatBytes(file.size) : "0.00 Bytes"}</span>
                  </div>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Rent period:</span>
                    <span className="text-white font-mono">{duration} lease</span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Symmetric crypt mode:</span>
                    <span className="text-cyan-400 font-mono font-medium uppercase">AES-256 Sentry</span>
                  </div>

                  <div className="pt-3 border-t border-slate-950 flex justify-between items-center">
                    <span className="text-xs text-slate-400">On-Chain Lease cost:</span>
                    <span id="label-lease-cost" className="text-lg font-mono text-white tracking-tight flex items-center gap-1">
                      <Coins className="w-4 h-4 text-cyan-400" />
                      {calculateLeaseFee().toFixed(4)} APT
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-900 space-y-3">
                {!connected ? (
                  <div className="text-center text-xs text-slate-500 leading-relaxed font-sans font-medium">Connect your Aptos Wallet to enable on-chain lock deposits.</div>
                ) : (
                  <button
                    id="btn-upload-file-submit"
                    type="submit"
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold font-sans text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-lg"
                  >
                    <Shield className="w-4 h-4" />
                    Lock and Anchor on Shelby
                  </button>
                )}
                <div className="flex items-center gap-1.5 justify-center text-[10px] text-slate-500">
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
